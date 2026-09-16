/** 데이터 generator가 공개한 usagePermission만 소비한다. URL/호스트로 허락을 추정하지 않는다. */
export type PlacePhotoInput = { imageUrl?: string | null; imageSource?: string | null; imageEvidence?: unknown };
export type ApprovedPlacePhoto = {
  url: string;
  status: 'verified' | 'operator_approved';
  attribution: string;
  licenseName: string | null;
  sourcePageUrl: string | null;
  licenseUrl: string | null;
};
const string = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const https = (value: unknown): boolean => { try { const url = new URL(string(value)); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
const date = (value: unknown): boolean => /^\d{4}-\d{2}-\d{2}$/.test(string(value));
export function approvedPlacePhoto(place: PlacePhotoInput | null | undefined): ApprovedPlacePhoto | null {
  if (!place || !https(place.imageUrl)) return null;
  const evidence = place.imageEvidence as { source?: unknown; sourceId?: unknown; finalUrl?: unknown; usagePermission?: Record<string, unknown> } | null;
  const permission = evidence?.usagePermission;
  if (!permission) return null;
  if (permission.status === 'verified') {
    if (permission.commercialUseAllowed !== true || permission.modificationAllowed !== true
      || !string(permission.rightsHolder) || !string(permission.attribution) || !string(permission.licenseName)
      || !https(permission.sourcePageUrl) || !https(permission.licenseUrl) || !date(permission.verifiedAt)) return null;
    return { url: string(place.imageUrl), status: 'verified', attribution: string(permission.attribution), licenseName: string(permission.licenseName), sourcePageUrl: string(permission.sourcePageUrl), licenseUrl: string(permission.licenseUrl) };
  }
  if (permission.status === 'operator_approved') {
    if (permission.basis !== 'operator_decision' || !string(evidence?.source) || !string(evidence?.sourceId)
      || !string(permission.sourceName) || !string(permission.attribution) || !string(permission.displayConditions)
      || !date(permission.approvedAt)) return null;
    const finalUrl = string(evidence?.finalUrl);
    if (finalUrl && (!https(finalUrl) || finalUrl !== string(place.imageUrl))) return null;
    return { url: string(place.imageUrl), status: 'operator_approved', attribution: string(permission.attribution), licenseName: null, sourcePageUrl: null, licenseUrl: null };
  }
  return null;
}
