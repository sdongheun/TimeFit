// TourAPI 클라이언트 (후보 탐색 + 운영시간)
const KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY ?? '';
const KOR = 'https://apis.data.go.kr/B551011/KorService2';
const COMMON: Record<string, string> = { MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json' };

const USETIME_FIELD: Record<string, string> = {
  '12': 'usetime', '14': 'usetimeculture', '15': 'usetimefestival',
  '28': 'usetimeleports', '38': 'opentime', '39': 'opentimefood',
};

async function call(op: string, params: Record<string, string | number>): Promise<any[]> {
  const qs = new URLSearchParams({ serviceKey: KEY, ...COMMON, ...(params as any) }).toString();
  try {
    const res = await fetch(`${KOR}/${op}?${qs}`);
    const j = await res.json();
    let items = j?.response?.body?.items?.item;
    if (items && !Array.isArray(items)) items = [items];
    return items ?? [];
  } catch {
    return [];
  }
}

export type RawPoi = { title: string; contentid: string; contenttypeid: string; mapx: string; mapy: string; dist: string };

export async function locationBased(lat: number, lon: number, radiusM: number, rows = 60): Promise<RawPoi[]> {
  return call('locationBasedList2', { mapX: lon, mapY: lat, radius: radiusM, numOfRows: rows, pageNo: 1 }) as Promise<RawPoi[]>;
}

export async function detailIntro(contentId: string, typeId: string): Promise<any | null> {
  const items = await call('detailIntro2', { contentId, contentTypeId: typeId });
  return items[0] ?? null;
}

function parseOpen(text?: string): { open: number; close: number } | null {
  if (!text) return null;
  if (/24시간|상시|always/i.test(text)) return { open: 0, close: 1440 };
  const m = String(text).match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
  return m ? { open: +m[1] * 60 + +m[2], close: +m[3] * 60 + +m[4] } : null;
}

export function isOpenDuringText(
  hours: string | undefined,
  startMin: number,
  dwell: number,
  requireKnownHours = false,
): { ok: boolean; note: string } {
  const parsed = parseOpen(hours);
  if (!parsed) return { ok: !requireKnownHours, note: requireKnownHours ? '운영시간 미확인' : '운영시간 미확인' };
  const ok = startMin >= parsed.open && startMin + dwell <= parsed.close;
  return { ok, note: ok ? String(hours).replace(/<br\s*\/?>/gi, ' ') : '영업시간 밖' };
}

// 방문 [start, start+dwell]이 영업시간 내인가
export function isOpenDuring(
  intro: any,
  typeId: string,
  startMin: number,
  dwell: number,
  todayYmd?: string,
  requireKnownHours = false,
): { ok: boolean; note: string } {
  // 축제(15): 행사 기간 게이트 — 기간 밖(종료된/미개막 행사)이면 시간과 무관하게 탈락
  // (playtime만 보면 작년에 끝난 박람회도 통과하는 버그 → 기간 필수 검사)
  if (typeId === '15') {
    const s = String(intro?.eventstartdate ?? ''), e = String(intro?.eventenddate ?? '');
    const today = todayYmd ?? ymdNow();
    if (!/^\d{8}$/.test(s) || !/^\d{8}$/.test(e)) return { ok: false, note: '행사 기간 미확인' };
    if (today < s || today > e) return { ok: false, note: '행사 기간 아님' };
  }
  const ut = intro?.[USETIME_FIELD[typeId]];
  const checked = isOpenDuringText(ut, startMin, dwell, requireKnownHours);
  if (!checked.ok && typeId === '15' && !ut) return { ok: false, note: '행사 운영시간 미확인' };
  return checked;
}

function ymdNow(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
