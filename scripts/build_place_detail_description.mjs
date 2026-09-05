const OFFICIAL_DETAIL_SOURCES = new Set(['busan_attraction', 'busan_shopping', 'busan_food']);

function decodeHtmlEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
  });
}

export function normalizeOfficialDescription(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const normalized = decodeHtmlEntities(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|h[1-6]|li|ol|p|section|table|tr|ul)>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' '))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ');
  const paragraphs = normalized.split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').replace(/\s+([,.;:!?。！？])/gu, '$1').trim())
    .filter(Boolean);
  return paragraphs[0] ?? '';
}

export function truncateOfficialDescription(value, maxCodePoints = 240) {
  const points = Array.from(value);
  if (points.length <= maxCodePoints) return value;
  const prefix = points.slice(0, maxCodePoints);
  let sentenceEnd = -1;
  for (let index = 0; index < prefix.length; index += 1) {
    if (/[.!?。！？]/u.test(prefix[index])) sentenceEnd = index;
  }
  if (sentenceEnd >= 0) return prefix.slice(0, sentenceEnd + 1).join('').trim();
  return `${prefix.slice(0, Math.max(0, maxCodePoints - 1)).join('').trimEnd()}…`;
}

export function detailDescriptionFromRaw(value) {
  const normalized = normalizeOfficialDescription(value);
  return normalized ? truncateOfficialDescription(normalized) : '';
}

export function buildOfficialDetailDescriptionPlan(places, officialBySource) {
  const sourceRefPlaces = new Map();
  for (const place of places) {
    for (const evidence of place.sourceEvidence ?? []) {
      if (!OFFICIAL_DETAIL_SOURCES.has(evidence.source)) continue;
      const ref = `${evidence.source}:${String(evidence.sourceId)}`;
      const ids = sourceRefPlaces.get(ref) ?? new Set();
      ids.add(place.id);
      sourceRefPlaces.set(ref, ids);
    }
  }

  const candidates = new Map();
  for (const place of places) {
    for (const evidence of place.sourceEvidence ?? []) {
      const rows = officialBySource[evidence.source];
      const row = rows?.get(String(evidence.sourceId));
      const ref = `${evidence.source}:${String(evidence.sourceId)}`;
      if (!row || sourceRefPlaces.get(ref)?.size !== 1) continue;
      const detailDescription = detailDescriptionFromRaw(row.ITEMCNTNTS);
      if (!detailDescription) continue;
      candidates.set(place.id, { detailDescription, source: evidence.source, sourceId: String(evidence.sourceId) });
      break;
    }
  }

  const descriptionPlaces = new Map();
  for (const [placeId, candidate] of candidates) {
    const ids = descriptionPlaces.get(candidate.detailDescription) ?? new Set();
    ids.add(placeId);
    descriptionPlaces.set(candidate.detailDescription, ids);
  }
  const duplicateDescriptions = new Set(
    [...descriptionPlaces].filter(([, ids]) => ids.size > 1).map(([description]) => description),
  );
  const descriptions = new Map(
    [...candidates].filter(([, candidate]) => !duplicateDescriptions.has(candidate.detailDescription)),
  );
  return {
    descriptions,
    candidateCount: candidates.size,
    duplicateDescriptionCount: duplicateDescriptions.size,
    duplicatePlaceCount: [...descriptionPlaces]
      .filter(([description]) => duplicateDescriptions.has(description))
      .reduce((sum, [, ids]) => sum + ids.size, 0),
  };
}
