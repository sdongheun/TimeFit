type CatalogDisplayPlace = {
  addr1?: string | null;
  shortStay?: { type?: string | null } | null;
};

const activityLabels: Record<string, string> = {
  scenic_pause: '풍경 감상',
  quick_browse: '둘러보기',
  compact_culture: '문화 공간 관람',
  quick_rest: '잠깐 쉬기',
};

function getDistrict(address: string | null | undefined): string | null {
  if (!address) return null;
  return address.split(/\s+/).find((part) => /(?:구|군)$/.test(part)) ?? null;
}

/** 카탈로그 근거를 사용자용 맥락으로만 바꾼다. 없거나 알 수 없는 값은 추정하지 않는다. */
export function getPlaceDiscoveryContext(place: CatalogDisplayPlace | undefined): string | null {
  const district = getDistrict(place?.addr1);
  const activity = place?.shortStay?.type ? activityLabels[place.shortStay.type] : null;
  return district && activity ? `${district} · ${activity}` : null;
}

/** 코스 시간·경로·순서를 바꾸지 않는 대표 카드용 표시 문자열이다. */
export function buildCourseDiscoveryContext(
  placeIds: readonly string[],
  getPlace: (placeId: string) => CatalogDisplayPlace | undefined,
): string | null {
  const contexts = placeIds.map((placeId) => getPlaceDiscoveryContext(getPlace(placeId))).filter((context): context is string => Boolean(context));
  return contexts.length ? contexts.join(' → ') : null;
}
