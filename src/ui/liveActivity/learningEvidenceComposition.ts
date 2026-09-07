import { createLearningEvidenceCoordinator } from './learningEvidenceCoordinator';
import { nativeLearningEvidencePort } from './nativeLiveActivityPort';

export const liveLearningEvidence = createLearningEvidenceCoordinator(() => import('../../services/releaseIdentitySupabase'), nativeLearningEvidencePort);
