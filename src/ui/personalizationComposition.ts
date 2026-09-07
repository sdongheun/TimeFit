import { createPersonalizationSessionController } from './personalizationSessionModel';
import type { PersonalizationSessionSnapshot } from './personalizationSessionModel';

export const recommendationPersonalizationSnapshots = new WeakMap<object, PersonalizationSessionSnapshot>();
export const isPersonalizationScopeCurrent = (session: object) => recommendationPersonalizationSnapshots.get(session)?.isCurrent() ?? true;

export const personalizationSession = createPersonalizationSessionController({
  async read(subject) {
    const ports = await import('../services/releaseIdentitySupabase');
    const identity = await ports.supabaseAccountIdentityResolver.resolve();
    if (identity.status !== 'account' || identity.identity.subject !== subject) return { enabled: false, samples: [] };
    const result = await ports.readOwnedDwellPersonalizationSamples();
    return { enabled: result.status === 'ok' || result.status === 'empty', samples: result.samples };
  },
});
