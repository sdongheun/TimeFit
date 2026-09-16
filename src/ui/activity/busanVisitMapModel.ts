import type { CompletedMapPlace } from './completedPlaceMapModel';

export const BUSAN_DISTRICTS = [
  { id: 'Buk-gu', name: '북구', labelX: 255, labelY: 215 },
  { id: 'Busanjin-gu', name: '부산진구', labelX: 278, labelY: 287 },
  { id: 'Dong-gu', name: '동구', labelX: 282, labelY: 334 },
  { id: 'Dongnae-gu', name: '동래구', labelX: 326, labelY: 236 },
  { id: 'Gangseo-gu', name: '강서구', labelX: 135, labelY: 300 },
  { id: 'Geumjeong-gu', name: '금정구', labelX: 332, labelY: 171 },
  { id: 'Haeundae-gu', name: '해운대구', labelX: 418, labelY: 250 },
  { id: 'Jung-gu', name: '중구', labelX: 276, labelY: 361 },
  { id: 'Nam-gu', name: '남구', labelX: 335, labelY: 345 },
  { id: 'Saha-gu', name: '사하구', labelX: 203, labelY: 385 },
  { id: 'Sasang-gu', name: '사상구', labelX: 218, labelY: 302 },
  { id: 'Seo-gu', name: '서구', labelX: 248, labelY: 372 },
  { id: 'Suyeong-gu', name: '수영구', labelX: 365, labelY: 295 },
  { id: 'Yeongdo-gu', name: '영도구', labelX: 307, labelY: 408 },
  { id: 'Yeonje-gu', name: '연제구', labelX: 334, labelY: 272 },
  { id: 'Gijang-gun', name: '기장군', labelX: 487, labelY: 112 },
] as const;

export type BusanDistrictName = typeof BUSAN_DISTRICTS[number]['name'];
export type BusanVisitCatalogPlace = Readonly<{
  contentId: string;
  title?: string;
  category?: string | null;
  addr1?: string | null;
  lat?: number;
  lon?: number;
  mapVerification?: { status?: string | null; placeId?: string | null; placeUrl?: string | null } | null;
}>;

export type BusanVisitPlace = Readonly<{
  contentId: string;
  title: string;
  district: BusanDistrictName;
  neighborhood: string | null;
  category: string;
  source: BusanVisitCatalogPlace & { title: string; lat: number; lon: number };
}>;

export type BusanVisitPlaceSummary = BusanVisitPlace & Readonly<{ visitCount: number }>;

const districtNames = BUSAN_DISTRICTS.map(row => row.name).sort((a, b) => b.length - a.length);

export function busanDistrictFromAddress(address: string | null | undefined): BusanDistrictName | null {
  const value = address?.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  if (/(?:부산광역시|부산시|부산)\s+진구(?:\s|$)/.test(value)) return '부산진구';
  return districtNames.find(name => new RegExp(`^(?:(?:부산광역시|부산시|부산)\\s+)?${name}(?:\\s|$)`).test(value)) ?? null;
}

export function busanNeighborhoodFromAddress(address: string | null | undefined, district: BusanDistrictName): string | null {
  const value = address?.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  const parenthetical = value.match(/\(([^()]*(?:동\d*가?|읍|면))\)/)?.[1]?.trim();
  if (parenthetical) return parenthetical;
  const districtIndex = value.indexOf(district);
  if (districtIndex < 0) return null;
  const remainder = value.slice(districtIndex + district.length).trim();
  const firstToken = remainder.split(' ')[0]?.replace(/[(),]/g, '');
  return firstToken && /(?:동\d*가?|읍|면)$/.test(firstToken) ? firstToken : null;
}

export function buildBusanVisitMap(places: readonly CompletedMapPlace[], catalog: readonly BusanVisitCatalogPlace[]) {
  const index = new Map(catalog.map(place => [place.contentId, place]));
  const counts = new Map<BusanDistrictName, number>();
  const mapped: BusanVisitPlace[] = [];
  const summaries = new Map<string, BusanVisitPlaceSummary>();
  let unlocatedCount = 0;
  for (const visit of places) {
    const source = index.get(visit.contentId);
    const district = busanDistrictFromAddress(source?.addr1);
    if (!source || !district || !Number.isFinite(source.lat) || !Number.isFinite(source.lon)) {
      unlocatedCount += 1;
      continue;
    }
    counts.set(district, (counts.get(district) ?? 0) + 1);
    const mappedPlace: BusanVisitPlace = {
      contentId: visit.contentId,
      title: visit.title,
      district,
      neighborhood: busanNeighborhoodFromAddress(source.addr1, district),
      category: source.category?.trim() || '분류 미확인',
      source: { ...source, title: visit.title, lat: source.lat!, lon: source.lon! },
    };
    mapped.push(mappedPlace);
    const previous = summaries.get(visit.contentId);
    summaries.set(visit.contentId, previous ? { ...previous, visitCount: previous.visitCount + 1 } : { ...mappedPlace, visitCount: 1 });
  }
  return {
    districts: BUSAN_DISTRICTS.map(district => ({ ...district, count: counts.get(district.name) ?? 0 })),
    places: mapped,
    placeSummaries: [...summaries.values()],
    unlocatedCount,
  };
}
