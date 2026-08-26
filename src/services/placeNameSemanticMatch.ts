export type PlaceNameMatchKind = 'direct' | 'transit_variant' | 'none';

const TRANSIT_TOKEN = /(\d+호선|경전철)/g;
const CITY_BEFORE_TRANSIT = /부산(?=(?:\d+호선|경전철))/g;

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function transitTokens(value: string): string[] {
  return normalized(value).match(TRANSIT_TOKEN) ?? [];
}

function placeToken(value: string): string {
  return normalized(value).replace(CITY_BEFORE_TRANSIT, '').replace(TRANSIT_TOKEN, '');
}

export type TransitPlaceQueryPlan = { baseName: string; transitTokens: string[]; canFallback: boolean };

/**
 * 제공사가 반환한 교통 카테고리 필드에서만 노선 표기를 보존한다.
 * 장소명·검색어·주소는 입력으로 받지 않아, 제공사가 주지 않은 노선을 추론할 수 없다.
 */
export function lineLabelsFromProviderCategoryFields(fields: readonly (string | undefined)[]): string[] | undefined {
  const labels = fields.flatMap((field) => transitTokens(field ?? ''));
  const unique = [...new Set(labels)].sort();
  return unique.length > 0 ? unique : undefined;
}

export function planTransitPlaceQuery(query: string): TransitPlaceQueryPlan {
  const baseName = placeToken(query);
  const tokens = transitTokens(query).sort();
  return { baseName, transitTokens: tokens, canFallback: !!baseName && tokens.length > 0 };
}

/**
 * 제공사 장소명만 대상으로 하는 순수 매칭이다. 주소/상호/카탈로그 이름 보정에는 쓰지 않는다.
 * 고유 장소명과 교통 수식어가 모두 있어야 도시 접두·공백·순서 차이를 확장해 허용한다.
 */
export function matchPlaceNameQuery(query: string, providerName: string): PlaceNameMatchKind {
  const q = normalized(query);
  const name = normalized(providerName);
  if (!q || !name) return 'none';
  const qPlace = placeToken(query);
  const namePlace = placeToken(providerName);
  const qTransit = transitTokens(query).sort();
  const nameTransit = transitTokens(providerName).sort();

  // 교통 수식어 단독은 전체 역/정류장 검색으로 확장하지 않는다.
  if (!qPlace) return q === name ? 'direct' : 'none';
  if (q === name || name.startsWith(q) || name.includes(q)) return 'direct';
  if (qTransit.length === 0 || nameTransit.length === 0) return 'none';
  if (qPlace !== namePlace || qTransit.length !== nameTransit.length) return 'none';
  return qTransit.every((token, index) => token === nameTransit[index]) ? 'transit_variant' : 'none';
}
