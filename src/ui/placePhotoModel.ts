/** 데이터 generator가 공개한 usagePermission만 소비한다. URL/호스트로 허락을 추정하지 않는다. */
export type PlacePhotoInput = { imageUrl?: string | null; imageSource?: string | null; imageEvidence?: unknown };
export type ApprovedPlacePhoto = { url: string; attribution: string; licenseName: string; sourcePageUrl: string; licenseUrl: string };
export function approvedPlacePhoto(place: PlacePhotoInput | null | undefined): ApprovedPlacePhoto | null {
  if (!place) return null;
  const evidence = place.imageEvidence as { usagePermission?: Record<string, unknown> } | null;
  const permission = evidence?.usagePermission;
  const string = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
  const https = (value: unknown): boolean => { try { const url = new URL(string(value)); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
  if (!https(place.imageUrl) || permission?.status !== 'verified' || permission.commercialUseAllowed !== true
    || permission.modificationAllowed !== true || !string(permission.rightsHolder) || !string(permission.attribution)
    || !string(permission.licenseName) || !https(permission.sourcePageUrl) || !https(permission.licenseUrl)
    || !/^\d{4}-\d{2}-\d{2}$/.test(string(permission.verifiedAt))) return null;
  return { url: string(place.imageUrl), attribution: string(permission.attribution), licenseName: string(permission.licenseName), sourcePageUrl: string(permission.sourcePageUrl), licenseUrl: string(permission.licenseUrl) };
}

export function photoMarkerFields(place: PlacePhotoInput): PlacePhotoInput {
  return approvedPlacePhoto(place) ? {imageUrl: place.imageUrl, imageSource: place.imageSource, imageEvidence: place.imageEvidence} : {};
}
