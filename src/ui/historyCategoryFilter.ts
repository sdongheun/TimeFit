type Row = { places: readonly { category?: string | null }[] };
const category = (value?: string | null) => value?.trim() || '기타';
export function historyCategories(rows: readonly Row[]): string[] {
  return [...new Set(rows.flatMap(row => row.places.map(place => category(place.category))))].sort((a, b) => a === '기타' ? 1 : b === '기타' ? -1 : a.localeCompare(b, 'ko'));
}
export function filterHistory<T extends Row>(rows: readonly T[], selected: string | null): readonly T[] {
  return selected === null ? rows : rows.filter(row => row.places.some(place => category(place.category) === selected));
}
