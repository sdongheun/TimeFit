import type { DwellPersonalizationSampleV1 } from '../engine';

export type PersonalizationSessionSnapshot = Readonly<{
  samples: readonly DwellPersonalizationSampleV1[];
  isCurrent(): boolean;
}>;

/** Identity stays in this process. Navigation/engine inputs receive sample values only. */
export function createPersonalizationSessionController(deps: {
  read(subject: string): Promise<{ enabled: boolean; samples: readonly DwellPersonalizationSampleV1[] }>;
  timeoutMs?: number;
}) {
  let subject: string | null = null, version = 0;
  const listeners = new Set<() => void>();
  const invalidate = () => { version++; listeners.forEach(fn => fn()); };
  return {
    setAccount(next: string | null) { if (next !== subject) { subject = next; invalidate(); } },
    invalidate,
    version: () => version,
    subject: () => subject,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async snapshot(): Promise<PersonalizationSessionSnapshot> {
      const owner = subject, captured = version;
      const isCurrent = () => captured === version;
      let samples: readonly DwellPersonalizationSampleV1[] = [];
      if (owner) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const empty = { enabled: false, samples: [] as const };
        try {
          const result = await Promise.race([
            deps.read(owner).catch(() => empty),
            new Promise<typeof empty>(resolve => { timer = setTimeout(() => resolve(empty), deps.timeoutMs ?? 1500); }),
          ]);
          if (isCurrent() && result.enabled) samples = result.samples;
        } finally { if (timer) clearTimeout(timer); }
      }
      return Object.freeze({ samples: Object.freeze(samples.map(s => Object.freeze({ category: s.category, subCategory: s.subCategory, dwellMin: s.dwellMin }))), isCurrent });
    },
  };
}
