/** Main input geometry excludes internal tools. Native measurements override the footer estimate. */
export function unifiedSetupLayout(height: number, top: number, bottom: number, fontScale: number, measuredFooter = 0) {
  const wheelRowHeight = Math.max(44, Math.ceil(28 * fontScale));
  const footerHeight = measuredFooter || 8 + 52 + Math.max(bottom, 12);
  return { wheelRowHeight, footerHeight, viewportHeight: Math.max(0, height - top - footerHeight) };
}

/** One auto attempt per setup mount. Manual interaction or leaving invalidates both GPS and label. */
export function createSetupGpsInitialization() {
  let attempted = false, epoch = 0;
  return {
    begin() { if (attempted) return null; attempted = true; return ++epoch; },
    isCurrent(request: number) { return request === epoch; },
    invalidate() { attempted = true; epoch++; },
  };
}

/** Synchronous lock spanning auth/CAPTCHA and recommendation; cancel/failure explicitly release it. */
export function createSetupRunGuard() {
  let state: 'idle' | 'captcha' | 'running' = 'idle';
  return {
    begin(captcha: boolean) { if (state !== 'idle') return false; state = captcha ? 'captcha' : 'running'; return true; },
    verifyCaptcha() { if (state !== 'captcha') return false; state = 'running'; return true; },
    reset() { state = 'idle'; },
    busy() { return state !== 'idle'; },
  };
}
