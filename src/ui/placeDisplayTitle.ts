/** Remove only a terminal provider language list; meaningful parenthetical names stay intact. */
export function placeDisplayTitle(title: string): string {
  const trimmed = title.trim();
  const cleaned = trimmed.replace(/\s*\(\s*(?:한|영|중간|중번|일)(?:\s*,\s*(?:한|영|중간|중번|일))+\s*\)$/, '').trim();
  return cleaned || trimmed;
}
