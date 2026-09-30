import type { StructuredAvailability } from '../engine/courseV1';
import runtimeCatalog from './busan_poi_catalog.json';
import reviewedAvailability from '../../data/processed/review/부산_장소_구조화_운영시간.json';

type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
type ReviewedRow = (typeof reviewedAvailability.data)[number];
type DayType = StructuredAvailability['dayTypes'][number];
type OpeningInput = Readonly<{ rawText?: string; closedText?: string; eventStartDate?: string; eventEndDate?: string }>;
type ProvenanceField = keyof OpeningInput;
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export type LiveOpeningNeedsReviewReason =
  | 'source_mapping_mismatch'
  | 'missing_opening_text'
  | 'conditional_or_reference_only'
  | 'multiple_or_exception_rules'
  | 'closed_text_requires_review'
  | 'unrepresentable_day_rule'
  | 'invalid_time_range'
  | 'invalid_event_period';

export type LiveOpeningProvenance = Readonly<{
  source: 'tourapi_detailIntro2_live';
  sourceId: string;
  mode: 'reviewed_exact_reuse' | 'live_runtime_parse' | 'event_period_gate' | 'rejected';
  parserVersion: 1;
  fields: readonly ProvenanceField[];
  reviewedVersion?: string;
}>;

export type LiveOpeningResult = DeepReadonly<
  | { status: 'structured'; availability: StructuredAvailability; provenance: LiveOpeningProvenance }
  | { status: 'needs_review'; reason: LiveOpeningNeedsReviewReason; availability: StructuredAvailability; provenance: LiveOpeningProvenance }
  | { status: 'event_excluded'; reason: 'event_not_started' | 'event_ended'; provenance: LiveOpeningProvenance }
>;

type Baseline = Readonly<{
  placeId: string;
  sourceId: string;
  contentTypeId: string;
  reviewedSourceText: string;
  reviewedVersion: string;
  hasExactTourEvidence: boolean;
  storedTourRawText?: string;
  availability?: DeepReadonly<StructuredAvailability>;
}>;

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const fullDayTypes: DayType[] = ['weekday', 'weekend'];
const emptyAvailability = (): StructuredAvailability => ({ status: 'needs_review', alwaysAccessible: false, dayTypes: [], windows: [] });

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function normalizeLiveOpeningSourceText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

const cleanText = normalizeLiveOpeningSourceText;

function sourceFields(opening: OpeningInput): ProvenanceField[] {
  return (['closedText', 'eventEndDate', 'eventStartDate', 'rawText'] as const)
    .filter((field) => Object.hasOwn(opening, field));
}

function provenance(sourceId: string, opening: OpeningInput, mode: LiveOpeningProvenance['mode'], reviewedVersion?: string): LiveOpeningProvenance {
  return {
    source: 'tourapi_detailIntro2_live',
    sourceId,
    mode,
    parserVersion: 1,
    fields: sourceFields(opening),
    ...(reviewedVersion ? { reviewedVersion } : {}),
  };
}

function structured(sourceId: string, opening: OpeningInput, availability: StructuredAvailability, mode: 'reviewed_exact_reuse' | 'live_runtime_parse', reviewedVersion?: string): LiveOpeningResult {
  return deepFreeze({ status: 'structured', availability, provenance: provenance(sourceId, opening, mode, reviewedVersion) });
}

function needsReview(sourceId: string, opening: OpeningInput, reason: LiveOpeningNeedsReviewReason): LiveOpeningResult {
  return deepFreeze({ status: 'needs_review', reason, availability: emptyAvailability(), provenance: provenance(sourceId, opening, 'rejected') });
}

function dateNumber(value: string): number | null {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? year * 10000 + month * 100 + day : null;
}

function referenceDateNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? dateNumber(`${match[1]}${match[2]}${match[3]}`) : null;
}

function eventGate(sourceId: string, opening: OpeningInput, referenceDate: string): LiveOpeningResult | null {
  const hasStart = Object.hasOwn(opening, 'eventStartDate') && cleanText(opening.eventStartDate) !== '';
  const hasEnd = Object.hasOwn(opening, 'eventEndDate') && cleanText(opening.eventEndDate) !== '';
  if (!hasStart && !hasEnd) return null;
  const start = hasStart ? dateNumber(cleanText(opening.eventStartDate)) : null;
  const end = hasEnd ? dateNumber(cleanText(opening.eventEndDate)) : null;
  const reference = referenceDateNumber(referenceDate);
  if (start === null || end === null || reference === null || start > end) return needsReview(sourceId, opening, 'invalid_event_period');
  if (reference < start) return deepFreeze({ status: 'event_excluded', reason: 'event_not_started', provenance: provenance(sourceId, opening, 'event_period_gate') });
  if (reference > end) return deepFreeze({ status: 'event_excluded', reason: 'event_ended', provenance: provenance(sourceId, opening, 'event_period_gate') });
  return null;
}

function dayTypesFor(text: string): { dayTypes?: DayType[]; invalid: boolean } {
  const compact = text.replace(/\s+/g, '');
  const all = /매일/.test(compact) || /월(?:요일)?[~∼～-]일(?:요일)?/.test(compact);
  const weekday = /평일/.test(compact) || /월(?:요일)?[~∼～-]금(?:요일)?/.test(compact);
  const weekend = /주말/.test(compact) || /토(?:요일)?[~∼～-]일(?:요일)?/.test(compact);
  const hasAnyDayToken = /(?:월|화|수|목|금|토|일)(?:요일)?/.test(compact) || /평일|주말|매일/.test(compact);
  const matchedKinds = Number(all) + Number(weekday) + Number(weekend);
  if (matchedKinds > 1) return { invalid: true };
  if (all) return { dayTypes: [...fullDayTypes], invalid: false };
  if (weekday) return { dayTypes: ['weekday'], invalid: false };
  if (weekend) return { dayTypes: ['weekend'], invalid: false };
  if (hasAnyDayToken) return { invalid: true };
  return { dayTypes: [...fullDayTypes], invalid: false };
}

export function parseSafeLiveOpeningText(rawText: string): { availability?: StructuredAvailability; reason?: LiveOpeningNeedsReviewReason } {
  const text = cleanText(rawText);
  if (!text) return { reason: 'missing_opening_text' };
  if (/점포별|매장별|가게별|상이|문의|홈페이지\s*참조|참조|행사별|프로그램별/.test(text)) return { reason: 'conditional_or_reference_only' };

  const withoutNoHoliday = text.replace(/연중무휴/g, '');
  if (/임시\s*휴무|휴무|휴관|휴점|예약|성수기|비수기|하절기|동절기|공휴일|입장\s*마감|마지막\s*주문|라스트\s*오더|라스트오더/.test(withoutNoHoliday)) {
    return { reason: 'multiple_or_exception_rules' };
  }

  const timeTokens = text.match(/(?:[01]?\d|2[0-4]):[0-5]\d/g) ?? [];
  const rangePattern = /([01]?\d|2[0-3]):([0-5]\d)\s*[~∼～-]\s*([01]?\d|2[0-4]):([0-5]\d)/g;
  const ranges = [...text.matchAll(rangePattern)];
  if (ranges.length === 0) {
    if (/24\s*시간|상시|연중무휴/.test(text)) return { availability: { status: 'structured', alwaysAccessible: true, dayTypes: [...fullDayTypes], windows: [{ startMin: 0, endMin: 1440 }] } };
    return { reason: 'invalid_time_range' };
  }
  if (ranges.length !== 1 || timeTokens.length !== 2) return { reason: 'multiple_or_exception_rules' };

  const days = dayTypesFor(text);
  if (days.invalid || !days.dayTypes) return { reason: 'unrepresentable_day_rule' };
  const match = ranges[0];
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if ((endHour === 24 && endMinute !== 0) || startHour === 24) return { reason: 'invalid_time_range' };
  const startMin = startHour * 60 + startMinute;
  const endMin = endHour * 60 + endMinute;
  if (startMin === endMin) return { reason: 'invalid_time_range' };
  if (startMin === 0 && endMin === 1440) return { availability: { status: 'structured', alwaysAccessible: true, dayTypes: days.dayTypes, windows: [{ startMin: 0, endMin: 1440 }] } };
  if (startMin < endMin) return { availability: { status: 'structured', alwaysAccessible: false, dayTypes: days.dayTypes, windows: [{ startMin, endMin }] } };
  if (days.dayTypes.length !== 2) return { reason: 'unrepresentable_day_rule' };
  return { availability: { status: 'structured', alwaysAccessible: false, dayTypes: days.dayTypes, windows: [{ startMin: 0, endMin }, { startMin, endMin: 1440 }] } };
}

const parseRuntimeAvailability = parseSafeLiveOpeningText;

const allRuntime: readonly RuntimePlace[] = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data];
const reviewedByPlaceId = new Map<string, ReviewedRow>(reviewedAvailability.data.map((row) => [row.placeId, row]));
const representative = new Set(['representative_core', 'representative_standard']);

const baselines: readonly Baseline[] = allRuntime
  .filter((place) => representative.has(place.classification) && place.tourapiContentId && place.tourapiContentTypeId)
  .map((place) => {
    const reviewed = reviewedByPlaceId.get(place.contentId);
    if (!reviewed) throw new Error(`${place.contentId}: reviewed availability missing`);
    const sourceId = String(place.tourapiContentId);
    const exactEvidenceTexts = [...new Set(reviewed.sourceEvidence
      .filter((evidence) => evidence.source === 'tourapi_detailIntro2' && String(evidence.sourceIdOrUrl) === sourceId)
      .map((evidence) => cleanText(evidence.sourceText))
      .filter(Boolean))];
    const reviewedDayTypes = (reviewed.dayTypes ?? []).filter((day): day is DayType => day === 'weekday' || day === 'weekend');
    const reviewedWindows = (reviewed.windows ?? []).filter((window) => Number.isFinite(window.startMin) && Number.isFinite(window.endMin));
    const reusable = reviewed.status === 'structured'
      && typeof reviewed.alwaysAccessible === 'boolean'
      && reviewedDayTypes.length > 0
      && (reviewed.alwaysAccessible || reviewedWindows.length > 0)
      && exactEvidenceTexts.length === 1
      && cleanText(reviewed.sourceText) === exactEvidenceTexts[0];
    return deepFreeze({
      placeId: place.contentId,
      sourceId,
      contentTypeId: String(place.tourapiContentTypeId),
      reviewedSourceText: cleanText(reviewed.sourceText),
      reviewedVersion: reviewed.version,
      hasExactTourEvidence: exactEvidenceTexts.length === 1,
      ...(exactEvidenceTexts.length === 1 ? { storedTourRawText: exactEvidenceTexts[0] } : {}),
      ...(reusable ? { availability: { status: 'structured' as const, alwaysAccessible: reviewed.alwaysAccessible === true, dayTypes: reviewedDayTypes, windows: reviewedWindows.map((window) => ({ ...window })) } } : {}),
    });
  })
  .sort((left, right) => compare(left.placeId, right.placeId));

const baselineByPlaceId = new Map(baselines.map((baseline) => [baseline.placeId, baseline]));

/** Pure runtime normalization. It accepts only the handler-normalized opening fields and an explicit date. */
export function normalizeTourLiveOpening(input: Readonly<{
  placeId: string;
  sourceId: string;
  contentTypeId: string;
  referenceDate: string;
  opening: OpeningInput;
}>): LiveOpeningResult {
  const baseline = baselineByPlaceId.get(input.placeId);
  if (!baseline || baseline.sourceId !== input.sourceId || baseline.contentTypeId !== input.contentTypeId) return needsReview(input.sourceId, input.opening, 'source_mapping_mismatch');

  const eventResult = eventGate(input.sourceId, input.opening, input.referenceDate);
  if (eventResult) return eventResult;

  const closedText = cleanText(input.opening.closedText);
  if (closedText && !/^연중무휴[.!]?$/u.test(closedText) && !/^무휴[.!]?$/u.test(closedText)) {
    return needsReview(input.sourceId, input.opening, 'closed_text_requires_review');
  }
  const hasAddedConstraint = Boolean(closedText)
    || (Object.hasOwn(input.opening, 'eventStartDate') && cleanText(input.opening.eventStartDate))
    || (Object.hasOwn(input.opening, 'eventEndDate') && cleanText(input.opening.eventEndDate));
  const rawText = cleanText(input.opening.rawText);
  if (!hasAddedConstraint && baseline.availability && baseline.hasExactTourEvidence && rawText === baseline.reviewedSourceText) {
    return structured(input.sourceId, input.opening, {
      status: 'structured',
      alwaysAccessible: baseline.availability.alwaysAccessible,
      dayTypes: [...baseline.availability.dayTypes],
      windows: baseline.availability.windows.map((window) => ({ ...window })),
    }, 'reviewed_exact_reuse', baseline.reviewedVersion);
  }

  const parsed = parseRuntimeAvailability(rawText);
  return parsed.availability
    ? structured(input.sourceId, input.opening, parsed.availability, 'live_runtime_parse')
    : needsReview(input.sourceId, input.opening, parsed.reason ?? 'invalid_time_range');
}

export type StoredRepresentativeTourOpeningAudit = DeepReadonly<{
  summary: {
    representativeTourLinked: number;
    exactReviewedReuse: number;
    safeRuntimeParse: number;
    needsReview: number;
    eventExcluded: number;
  };
  rows: readonly {
    placeId: string;
    sourceId: string;
    disposition: 'exact_reviewed_reuse' | 'safe_runtime_parse' | 'needs_review' | 'event_excluded';
    reason?: LiveOpeningNeedsReviewReason | 'event_not_started' | 'event_ended';
  }[];
}>;

/** Stored-evidence audit only. Raw reviewed text is consumed in memory and never returned. */
export function auditStoredRepresentativeTourOpenings(referenceDate: string): StoredRepresentativeTourOpeningAudit {
  const rows = baselines.map((baseline) => {
    const result = normalizeTourLiveOpening({
      placeId: baseline.placeId,
      sourceId: baseline.sourceId,
      contentTypeId: baseline.contentTypeId,
      referenceDate,
      opening: { ...(baseline.storedTourRawText ? { rawText: baseline.storedTourRawText } : {}) },
    });
    if (result.status === 'structured') return {
      placeId: baseline.placeId,
      sourceId: baseline.sourceId,
      disposition: result.provenance.mode === 'reviewed_exact_reuse' ? 'exact_reviewed_reuse' as const : 'safe_runtime_parse' as const,
    };
    return {
      placeId: baseline.placeId,
      sourceId: baseline.sourceId,
      disposition: result.status === 'event_excluded' ? 'event_excluded' as const : 'needs_review' as const,
      reason: result.reason,
    };
  });
  return deepFreeze({
    summary: {
      representativeTourLinked: rows.length,
      exactReviewedReuse: rows.filter((row) => row.disposition === 'exact_reviewed_reuse').length,
      safeRuntimeParse: rows.filter((row) => row.disposition === 'safe_runtime_parse').length,
      needsReview: rows.filter((row) => row.disposition === 'needs_review').length,
      eventExcluded: rows.filter((row) => row.disposition === 'event_excluded').length,
    },
    rows,
  });
}
