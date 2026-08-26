#!/usr/bin/env node
// 운영시간 원문을 한 번만 보수적으로 구조화한다. 코스 빌더는 이 산출물만 읽고 원문을 재해석하지 않는다.
import fs from 'node:fs';

const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/부산_장소_구조화_운영시간.json';
const profile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
const minute = (hour, min) => Number(hour) * 60 + Number(min);
const normalize = (value = '') => String(value).replaceAll('∼', '~').replaceAll('－', '-').replace(/\s+/g, ' ').trim();

function structure(place) {
  const evidence = place.evidence.filter((item) => item.field === 'availability');
  const sourceText = evidence.map((item) => item.sourceText).filter(Boolean).join(' / ');
  const text = normalize(sourceText);
  const base = { placeId: place.id, sourceText, sourceEvidence: evidence, version: '2026-08-24 availability normalization' };
  if (!text) return { ...base, status: 'needs_review', reason: 'empty_source_text' };
  if (/상시\s*(개방|이용)|24시간|00:00\s*(?:~|-)\s*24:00/.test(text)) return { ...base, status: 'structured', dayTypes: ['weekday', 'weekend'], alwaysAccessible: true, windows: [{ startMin: 0, endMin: 1440 }] };
  // 정기 휴무·기간·입장마감 등은 단순 시각 범위만으로 안전하게 판정할 수 없으므로 수동 검토로 남긴다.
  if (/휴무|입장\s*마감|동절기|하절기|기간|예약|문의/.test(text)) return { ...base, status: 'needs_review', reason: 'exception_or_closure_rule' };
  const windows = [...text.matchAll(/(\d{1,2}):(\d{2})\s*(?:~|-)\s*(\d{1,2}):(\d{2})/g)].map((match) => {
    const startMin = minute(match[1], match[2]); let endMin = minute(match[3], match[4]); if (endMin === 0) endMin = 1440;
    return { startMin, endMin };
  }).filter((window) => window.startMin < window.endMin && window.endMin <= 1440);
  if (!windows.length) return { ...base, status: 'needs_review', reason: 'unparseable_time_range' };
  const weekdayOnly = /평일|월\s*(?:~|-)\s*금/.test(text), weekendOnly = /주말|토\s*(?:~|-)\s*일/.test(text);
  if (weekdayOnly && weekendOnly) return { ...base, status: 'needs_review', reason: 'multiple_day_rules_need_manual_split' };
  return { ...base, status: 'structured', dayTypes: weekdayOnly ? ['weekday'] : weekendOnly ? ['weekend'] : ['weekday', 'weekend'], alwaysAccessible: false, windows };
}

const data = profile.data.map(structure);
const summary = { total: data.length, structured: data.filter((item) => item.status === 'structured').length, needsReview: data.filter((item) => item.status !== 'structured').length };
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: '2026-08-24', source: PROFILE, policy: '원문 정규식 해석은 이 단계에서만 수행하며 코스 fixture 빌드 단계에서는 구조화 산출물만 사용한다.' }, summary, data }, null, 2)}\n`);
console.log(`구조화 운영시간: ${summary.structured}/${summary.total} -> ${OUTPUT}`);
