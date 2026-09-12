// Display validation mirrors the existing profile repository; it never writes or
// infers a nickname from authentication metadata/email.
export function recordTitle(nickname: string | null | undefined): string {
  if (typeof nickname !== 'string' || /\p{Cc}|\p{Cf}|[\r\n\u2028\u2029]/u.test(nickname)) return '나의 자투리 기록';
  const value = nickname.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return value && [...value].length <= 20 ? `${value}님의 자투리 기록` : '나의 자투리 기록';
}
const listeners = new Set<(subject: string) => void>();
export const profileDisplayChanges = {
  notify(subject: string) { for (const listener of listeners) listener(subject); },
  subscribe(listener: (subject: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
