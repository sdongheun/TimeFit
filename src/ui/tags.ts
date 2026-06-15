// 카테고리 → 분위기/활동 태그 (점진 필터용)
export type Mood = '자연' | '문화' | '도심';
export type Activity = '먹기' | '보기' | '걷기' | '체험';

const MAP: Record<string, { mood: Mood; acts: Activity[] }> = {
  자연관광지: { mood: '자연', acts: ['보기'] },
  '산책로/둘레길': { mood: '자연', acts: ['걷기'] },
  '역사/유적/종교': { mood: '문화', acts: ['보기'] },
  문화시설: { mood: '문화', acts: ['보기'] },
  '지역축제/행사': { mood: '문화', acts: ['보기'] },
  상업지구: { mood: '도심', acts: ['보기'] },
  식당: { mood: '도심', acts: ['먹기'] },
  카페: { mood: '도심', acts: ['먹기'] },
  '레저/스포츠': { mood: '도심', acts: ['체험'] },
  테마시설: { mood: '도심', acts: ['체험'] },
  체험활동관광지: { mood: '문화', acts: ['체험'] },
  상점: { mood: '도심', acts: ['보기'] },
  '역/터미널/휴게소': { mood: '도심', acts: [] },
};

export const MOODS: Mood[] = ['자연', '문화', '도심'];
export const ACTS: Activity[] = ['먹기', '보기', '걷기', '체험'];

export const moodOf = (cat: string): Mood | undefined => MAP[cat]?.mood;
export const actsOf = (cat: string): Activity[] => MAP[cat]?.acts ?? [];
