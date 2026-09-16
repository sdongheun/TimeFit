const HTTPS = /^https:\/\//;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 공개 runtime 사진은 정확한 contentId/source/sourceId/URL 단일 연결만 허용한다.
 * 기존 verified 행은 API 서비스 이용허락과 상업·변경 이용 조건을 모두 요구하고,
 * operator_approved 행은 권리 검증과 혼동되지 않는 별도 metadata만 투영한다.
 * 불완전·중복·불일치는 모두 기본 이미지다.
 */
export function projectRuntimeImageWithPermission(contentId, candidate, permissionRows) {
  if (!HTTPS.test(text(candidate?.imageUrl)) || !candidate?.imageSource || !candidate?.imageEvidence?.source || !candidate?.imageEvidence?.sourceId) return null;
  const matches = permissionRows.filter((row) => (
    row.contentId === contentId
    && row.imageUrl === candidate.imageUrl
    && row.source === candidate.imageEvidence.source
    && String(row.sourceId) === String(candidate.imageEvidence.sourceId)
  ));
  if (matches.length !== 1) return null;

  const permission = matches[0];
  if (permission.permissionBasis === 'operator_decision') {
    if (permission.status !== 'operator_approved'
      || !['busan_shopping', 'tourapi'].includes(permission.source)
      || !text(permission.sourceName)
      || !text(permission.attribution)
      || !text(permission.displayConditions)
      || !/^\d{4}-\d{2}-\d{2}$/.test(text(permission.approvedAt))) return null;

    return {
      imageUrl: candidate.imageUrl,
      imageSource: candidate.imageSource,
      imageEvidence: {
        ...candidate.imageEvidence,
        usagePermission: {
          basis: 'operator_decision',
          status: 'operator_approved',
          sourceName: text(permission.sourceName),
          attribution: text(permission.attribution),
          displayConditions: text(permission.displayConditions),
          approvedAt: text(permission.approvedAt),
        },
      },
    };
  }

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
