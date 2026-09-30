import type { StructuredAvailability } from '../engine/courseV1';
import attractionSource from '../../data/processed/부산시_명소정보.json';
import foodSource from '../../data/processed/부산시_맛집정보.json';
import shoppingSource from '../../data/processed/부산시_쇼핑정보.json';
import sourceMapping from '../../data/processed/review/live_source_place_mapping_manifest.json';
import reviewedAvailability from '../../data/processed/review/부산_장소_구조화_운영시간.json';
import {
  normalizeLiveOpeningSourceText,
  parseSafeLiveOpeningText,
  type LiveOpeningNeedsReviewReason,
} from './liveOpeningNormalizer';

export type BusanOpeningSourceKey = 'busan_attraction' | 'busan_food' | 'busan_shopping';
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
type SourceRow = Readonly<Record<string, unknown> & { UC_SEQ: string | number }>;

export type BusanLiveOpeningResult = DeepReadonly<
  | {
    status: 'structured';
    availability: StructuredAvailability;
    provenance: BusanLiveOpeningProvenance;
  }
  | {
    status: 'needs_review';
    reason: LiveOpeningNeedsReviewReason;
    availability: StructuredAvailability;
    provenance: BusanLiveOpeningProvenance;
  }
>;

export type BusanLiveOpeningProvenance = Readonly<{
  source: BusanOpeningSourceKey;
  sourceId: string;
  mode: 'reviewed_exact_reuse' | 'live_runtime_parse' | 'rejected';
  parserVersion: 1;
  fields: readonly ('openingText' | 'closedText')[];
  reviewedVersion?: string;
}>;

type Baseline = Readonly<{
  placeId: string;
  source: BusanOpeningSourceKey;
  sourceId: string;
  storedOpeningText: string;
  storedClosedText: string;
  reviewedVersion?: string;
  availability?: DeepReadonly<StructuredAvailability>;
}>;

const sourceRows: Readonly<Record<BusanOpeningSourceKey, readonly SourceRow[]>> = {
  busan_attraction: attractionSource.data as readonly SourceRow[],
  busan_food: foodSource.data as readonly SourceRow[],
  busan_shopping: shoppingSource.data as readonly SourceRow[],
};
const sourceRowByKey = new Map<string, SourceRow>();
for (const [source, rows] of Object.entries(sourceRows) as [BusanOpeningSourceKey, readonly SourceRow[]][]) {
  for (const row of rows) sourceRowByKey.set(`${source}:${String(row.UC_SEQ)}`, row);
}

const reviewedByPlaceId = new Map(reviewedAvailability.data.map((row) => [row.placeId, row]));
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const emptyAvailability = (): StructuredAvailability => ({ status: 'needs_review', alwaysAccessible: false, dayTypes: [], windows: [] });

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function sourceOpening(row: SourceRow): string {
  return normalizeLiveOpeningSourceText(row.USAGE_DAY_WEEK_AND_TIME || row.USAGE_DAY);
}

function sourceClosed(row: SourceRow): string {
  return normalizeLiveOpeningSourceText(row.HLDY_INFO);
}

function reviewedStructuredAvailability(placeId: string, source: BusanOpeningSourceKey, sourceId: string, storedOpeningText: string): {
  reviewedVersion?: string;
  availability?: StructuredAvailability;
} {
  const reviewed = reviewedByPlaceId.get(placeId);
  if (!reviewed || reviewed.status !== 'structured' || !storedOpeningText) return {};
  const exactEvidence = reviewed.sourceEvidence.filter((evidence) => evidence.source === source
    && String(evidence.sourceIdOrUrl) === sourceId
    && normalizeLiveOpeningSourceText(evidence.sourceText) === storedOpeningText);
  if (exactEvidence.length === 0 || normalizeLiveOpeningSourceText(reviewed.sourceText) !== storedOpeningText) return {};
  const dayTypes = (reviewed.dayTypes ?? []).filter((day): day is 'weekday' | 'weekend' => day === 'weekday' || day === 'weekend');
  const windows = (reviewed.windows ?? []).filter((window) => Number.isFinite(window.startMin) && Number.isFinite(window.endMin));
  if (dayTypes.length === 0 || (reviewed.alwaysAccessible !== true && windows.length === 0)) return {};
  return {
    reviewedVersion: reviewed.version,
    availability: {
      status: 'structured',
      alwaysAccessible: reviewed.alwaysAccessible === true,
      dayTypes,
      windows: windows.map((window) => ({ startMin: window.startMin, endMin: window.endMin })),
    },
  };
}

const baselines: readonly Baseline[] = sourceMapping.data
  .filter((mapping) => mapping.classification === 'representative_core' || mapping.classification === 'representative_standard')
  .flatMap((mapping) => (Object.entries(mapping.busanSourceIds) as [BusanOpeningSourceKey, string[]][])
    .flatMap(([source, sourceIds]) => sourceIds.map((sourceId) => {
      const row = sourceRowByKey.get(`${source}:${sourceId}`);
      if (!row) throw new Error(`${mapping.contentId}: missing ${source}/${sourceId}`);
      const storedOpeningText = sourceOpening(row);
      const storedClosedText = sourceClosed(row);
      const reviewed = reviewedStructuredAvailability(mapping.contentId, source, sourceId, storedOpeningText);
      return deepFreeze({
        placeId: mapping.contentId,
        source,
        sourceId,
        storedOpeningText,
        storedClosedText,
        ...reviewed,
      });
    })))
  .sort((left, right) => compare(`${left.placeId}:${left.source}:${left.sourceId}`, `${right.placeId}:${right.source}:${right.sourceId}`));

const baselineByKey = new Map(baselines.map((baseline) => [`${baseline.placeId}:${baseline.source}:${baseline.sourceId}`, baseline]));

function provenance(
  source: BusanOpeningSourceKey,
  sourceId: string,
  input: Readonly<{ openingText?: string; closedText?: string }>,
  mode: BusanLiveOpeningProvenance['mode'],
  reviewedVersion?: string,
): BusanLiveOpeningProvenance {
  const fields = (['closedText', 'openingText'] as const).filter((field) => Object.hasOwn(input, field));
  return { source, sourceId, mode, parserVersion: 1, fields, ...(reviewedVersion ? { reviewedVersion } : {}) };
}

function needsReview(
  source: BusanOpeningSourceKey,
  sourceId: string,
  input: Readonly<{ openingText?: string; closedText?: string }>,
  reason: LiveOpeningNeedsReviewReason,
): BusanLiveOpeningResult {
  return deepFreeze({ status: 'needs_review', reason, availability: emptyAvailability(), provenance: provenance(source, sourceId, input, 'rejected') });
}

export function normalizeBusanLiveOpening(input: Readonly<{
  placeId: string;
  source: BusanOpeningSourceKey;
  sourceId: string;
  openingText?: string;
  closedText?: string;
}>): BusanLiveOpeningResult {
  const baseline = baselineByKey.get(`${input.placeId}:${input.source}:${input.sourceId}`);
  if (!baseline) return needsReview(input.source, input.sourceId, input, 'source_mapping_mismatch');
  const openingText = normalizeLiveOpeningSourceText(input.openingText);
  const closedText = normalizeLiveOpeningSourceText(input.closedText);
  if (closedText && !/^연중무휴[.!]?$/u.test(closedText) && !/^무휴[.!]?$/u.test(closedText)) {
    return needsReview(input.source, input.sourceId, input, 'closed_text_requires_review');
  }
  if (baseline.availability
    && openingText === baseline.storedOpeningText
    && closedText === baseline.storedClosedText) {
    return deepFreeze({
      status: 'structured',
      availability: {
        status: 'structured',
        alwaysAccessible: baseline.availability.alwaysAccessible,
        dayTypes: [...baseline.availability.dayTypes],
        windows: baseline.availability.windows.map((window) => ({ ...window })),
      },
      provenance: provenance(input.source, input.sourceId, input, 'reviewed_exact_reuse', baseline.reviewedVersion),
    });
  }
  const parsed = parseSafeLiveOpeningText(openingText);
  if (!parsed.availability) return needsReview(input.source, input.sourceId, input, parsed.reason ?? 'invalid_time_range');
  return deepFreeze({
    status: 'structured',
    availability: parsed.availability,
    provenance: provenance(input.source, input.sourceId, input, 'live_runtime_parse'),
  });
}

export type StoredRepresentativeBusanOpeningAudit = DeepReadonly<{
  summary: {
    representativePlaces: number;
    representativeLinks: number;
    exactReviewedReuse: number;
    safeRuntimeParse: number;
    needsReview: number;
  };
  rows: readonly {
    placeId: string;
    source: BusanOpeningSourceKey;
    sourceId: string;
    disposition: 'exact_reviewed_reuse' | 'safe_runtime_parse' | 'needs_review';
    reason?: LiveOpeningNeedsReviewReason;
  }[];
}>;

/** Stored-evidence audit only. Source opening/closed text is consumed in memory and never returned. */
export function auditStoredRepresentativeBusanOpenings(): StoredRepresentativeBusanOpeningAudit {
  const rows = baselines.map((baseline) => {
    const result = normalizeBusanLiveOpening({
      placeId: baseline.placeId,
      source: baseline.source,
      sourceId: baseline.sourceId,
      ...(baseline.storedOpeningText ? { openingText: baseline.storedOpeningText } : {}),
      ...(baseline.storedClosedText ? { closedText: baseline.storedClosedText } : {}),
    });
    return result.status === 'structured'
      ? {
        placeId: baseline.placeId,
        source: baseline.source,
        sourceId: baseline.sourceId,
        disposition: result.provenance.mode === 'reviewed_exact_reuse' ? 'exact_reviewed_reuse' as const : 'safe_runtime_parse' as const,
      }
      : {
        placeId: baseline.placeId,
        source: baseline.source,
        sourceId: baseline.sourceId,
        disposition: 'needs_review' as const,
        reason: result.reason,
      };
  });
  return deepFreeze({
    summary: {
      representativePlaces: new Set(rows.map((row) => row.placeId)).size,
      representativeLinks: rows.length,
      exactReviewedReuse: rows.filter((row) => row.disposition === 'exact_reviewed_reuse').length,
      safeRuntimeParse: rows.filter((row) => row.disposition === 'safe_runtime_parse').length,
      needsReview: rows.filter((row) => row.disposition === 'needs_review').length,
    },
    rows,
  });
}
