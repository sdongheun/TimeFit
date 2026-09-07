const HTTPS = /^https:\/\//;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 공개 runtime 사진은 URL의 도달성이 아니라 공식 API 서비스 단위 이용허락과
 * 정확한 contentId/source/sourceId/URL 연결로 허용한다. 현재 UI가 이미지를
 * crop할 수 있으므로 상업 이용과 변경 이용이 모두 확인된 단일 연결 row만
 * 통과시킨다. 불완전·중복·불일치는 모두 기본 이미지다.
 */
export function projectRuntimeImageWithPermission(contentId, candidate, permissionRows) {
  if (!candidate?.imageUrl || !candidate?.imageSource || !candidate?.imageEvidence?.source || !candidate?.imageEvidence?.sourceId) return null;
  const matches = permissionRows.filter((row) => (
    row.contentId === contentId
    && row.imageUrl === candidate.imageUrl
    && row.source === candidate.imageEvidence.source
    && String(row.sourceId) === String(candidate.imageEvidence.sourceId)
  ));
  if (matches.length !== 1) return null;

  const permission = matches[0];
  if (permission.permissionBasis !== 'api_service'
    || !text(permission.serviceName)
    || permission.status !== 'verified'
    || !text(permission.rightsHolder)
    || !HTTPS.test(text(permission.sourcePageUrl))
    || !text(permission.licenseName)
    || !HTTPS.test(text(permission.licenseUrl))
    || !text(permission.attribution)
    || typeof permission.attributionRequired !== 'boolean'
    || !text(permission.displayConditions)
    || permission.commercialUseAllowed !== true
    || permission.modificationAllowed !== true
    || !/^\d{4}-\d{2}-\d{2}$/.test(text(permission.verifiedAt))) return null;

  return {
    imageUrl: candidate.imageUrl,
    imageSource: candidate.imageSource,
    imageEvidence: {
      ...candidate.imageEvidence,
      usagePermission: {
        basis: 'api_service',
        serviceName: text(permission.serviceName),
        status: 'verified',
        rightsHolder: text(permission.rightsHolder),
        sourcePageUrl: text(permission.sourcePageUrl),
        licenseName: text(permission.licenseName),
        licenseUrl: text(permission.licenseUrl),
        attribution: text(permission.attribution),
        attributionRequired: permission.attributionRequired,
        displayConditions: text(permission.displayConditions),
        commercialUseAllowed: true,
        modificationAllowed: true,
        verifiedAt: text(permission.verifiedAt),
      },
    },
  };
}
