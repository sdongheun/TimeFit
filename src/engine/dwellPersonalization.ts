/** DB/React/network 객체를 받지 않는 2-AB 체류 개인화 순수 계약. */
export type DwellPersonalizationSampleV1 = Readonly<{
  category: string;
  subCategory: string;
  dwellMin: number;
}>;

export type DwellPersonalizationInputV1 = Readonly<{
  category: string;
  subCategory?: string;
  minStayMin: number;
  recommendedStayMin: number;
  maxStayMin: number;
  /** 오래된 표본부터 최신 표본 순서다. raw timestamp는 엔진에 전달하지 않는다. */
  samples: readonly DwellPersonalizationSampleV1[];
}>;

export type DwellPersonalizationResultV1 = Readonly<{
  state: 'applied' | 'not_applied';
  recommendedStayMin: number;
  /** 같은 category+subCategory에 속하며 양의 유한값인 전체 표본 수. */
  validSampleCount: number;
  /** 중앙값에 실제 사용한 최신 window 수(최대 5). */
  windowSampleCount: number;
}>;

const MINIMUM_SAMPLE_COUNT = 3;
const SAMPLE_WINDOW_LIMIT = 5;
const MAX_DEFAULT_ADJUSTMENT_MIN = 10;

function notApplied(recommendedStayMin: number, validSampleCount = 0): DwellPersonalizationResultV1 {
  return {
    state: 'not_applied',
    recommendedStayMin,
    validSampleCount,
    windowSampleCount: Math.min(validSampleCount, SAMPLE_WINDOW_LIMIT),
  };
}

function hasValidCatalogRange(input: DwellPersonalizationInputV1): boolean {
  return Number.isFinite(input.minStayMin)
    && Number.isFinite(input.recommendedStayMin)
    && Number.isFinite(input.maxStayMin)
    && input.minStayMin > 0
    && input.minStayMin <= input.recommendedStayMin
    && input.recommendedStayMin <= input.maxStayMin;
}

/**
 * 같은 복합 키의 유효 표본만 골라 최신 최대 5개의 중앙값을 5분 단위로 반올림한다.
 * 결과는 카탈로그 기본 권장값 ±10분, 그 다음 장소 min/max 순서로 제한한다.
 */
export function deriveDwellPersonalizationV1(
  input: DwellPersonalizationInputV1,
): DwellPersonalizationResultV1 {
  if (!hasValidCatalogRange(input)
    || typeof input.category !== 'string' || input.category.length === 0
    || typeof input.subCategory !== 'string' || input.subCategory.length === 0
    || !Array.isArray(input.samples)) {
    return notApplied(input.recommendedStayMin);
  }

  const valid = input.samples.filter((sample) => sample
    && sample.category === input.category
    && sample.subCategory === input.subCategory
    && Number.isFinite(sample.dwellMin)
    && sample.dwellMin > 0);
  if (valid.length < MINIMUM_SAMPLE_COUNT) return notApplied(input.recommendedStayMin, valid.length);

  const window = valid.slice(-SAMPLE_WINDOW_LIMIT).map((sample) => sample.dwellMin).sort((a, b) => a - b);
  const middle = Math.floor(window.length / 2);
  const median = window.length % 2 === 1
    ? window[middle]!
    : (window[middle - 1]! + window[middle]!) / 2;
  const rounded = Math.round(median / 5) * 5;
  const adjustmentClamped = Math.max(
    input.recommendedStayMin - MAX_DEFAULT_ADJUSTMENT_MIN,
    Math.min(input.recommendedStayMin + MAX_DEFAULT_ADJUSTMENT_MIN, rounded),
  );
  const rangeClamped = Math.max(input.minStayMin, Math.min(input.maxStayMin, adjustmentClamped));
  return {
    state: 'applied',
    recommendedStayMin: rangeClamped,
    validSampleCount: valid.length,
    windowSampleCount: window.length,
  };
}
