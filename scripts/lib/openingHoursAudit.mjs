export function cleanHoursText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyHoursText(value) {
  const text = cleanHoursText(value);
  if (!text) return { status: 'missing', text: '', hasTimeRange: false };

  const hasTimeRange = /(?:[01]?\d|2[0-4])[:시]\s*\d{0,2}\s*(?:~|∼|-)\s*(?:[01]?\d|2[0-4])[:시]\s*\d{0,2}/.test(text);
  const hasAlwaysOpen = /24시간|연중무휴|상시/.test(text);
  const hasConditionalNotice = /가게별|매장별|점포별|상이|문의|홈페이지\s*참조|행사별|프로그램별/.test(text);

  if (hasTimeRange && hasConditionalNotice) return { status: 'conditional', text, hasTimeRange };
  if (hasTimeRange || (hasAlwaysOpen && !hasConditionalNotice)) return { status: 'structured', text, hasTimeRange };
  return { status: 'ambiguous', text, hasTimeRange };
}

export function countBy(items, selector) {
  return Object.fromEntries([...items.reduce((counts, item) => {
    const key = selector(item) ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ko')));
}
