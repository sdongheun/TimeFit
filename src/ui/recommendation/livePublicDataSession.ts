import type { CourseV1RouteReceiptAdapter } from '../../engine';
import type { createMultiSourceLiveSession } from '../../engine/liveMultiSourceOrchestrator';
import type { projectMultiSourceLiveCatalog } from '../../data/busanLiveProjection';
import type { buildApprovedLiveMultiSourceInput, projectLiveSessionDetails, projectLiveSessionInitial } from '../../data/liveSessionBridge';
import type { createSupabaseLiveMultiSourceFacade } from '../../services/liveMultiSourceSupabaseProduction';
import { LivePublicDataUnavailableError } from './livePublicDataError';

export { LivePublicDataUnavailableError };

type FacadeResult = Awaited<ReturnType<typeof createSupabaseLiveMultiSourceFacade>>;
type LiveContext = Parameters<typeof createMultiSourceLiveSession>[0]['context'];
function busanReferenceDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export type LivePublicDataPorts = {
  createFacade: () => Promise<FacadeResult>;
  buildApprovedInput: typeof buildApprovedLiveMultiSourceInput;
  projectInitial: typeof projectLiveSessionInitial;
  projectDetails: typeof projectLiveSessionDetails;
  projectCatalog: typeof projectMultiSourceLiveCatalog;
  createSession: typeof createMultiSourceLiveSession;
};

export async function productionLivePublicDataPorts(): Promise<LivePublicDataPorts> {
  const [production, data, projection, engine] = await Promise.all([
    import('../../services/liveMultiSourceSupabaseProduction'),
    import('../../data/liveSessionBridge'),
    import('../../data/busanLiveProjection'),
    import('../../engine/liveMultiSourceOrchestrator'),
  ]);
  return {
    createFacade: production.createSupabaseLiveMultiSourceFacade,
    buildApprovedInput: data.buildApprovedLiveMultiSourceInput,
    projectInitial: data.projectLiveSessionInitial,
    projectDetails: data.projectLiveSessionDetails,
    projectCatalog: projection.projectMultiSourceLiveCatalog,
    createSession: engine.createMultiSourceLiveSession,
  };
}

/** A single facade and engine session own the whole initial 12→6→30 loop. */
export async function runLivePublicDataInitial(input: {
  context: LiveContext;
  receiptRoutes: CourseV1RouteReceiptAdapter;
  isCurrent: () => boolean;
  signal?: AbortSignal;
  ports: LivePublicDataPorts;
}) {
  const active = () => input.isCurrent() && !input.signal?.aborted;
  if (!active()) throw new Error('recommendation_scope_changed');
  const created = await input.ports.createFacade();
  if (created.status !== 'ready') throw new LivePublicDataUnavailableError();
  const facade = created.facade;
  const cancel = () => facade.cancel();
  input.signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (!active()) throw new Error('recommendation_scope_changed');
    const approved = input.ports.buildApprovedInput();
    const initial = await facade.initialize(approved);
    if (!active()) throw new Error('recommendation_scope_changed');
    if (initial.status !== 'active') throw new LivePublicDataUnavailableError();
    const projected = input.ports.projectInitial(initial);
    if (projected.status !== 'accepted') throw new LivePublicDataUnavailableError();
    const session = input.ports.createSession({
      sources: projected.sources,
      context: input.context,
      projector: input.ports.projectCatalog,
      receiptRoutes: input.receiptRoutes,
    });
    const tourSupplements: NonNullable<Parameters<typeof input.ports.projectCatalog>[0]['tourSupplements']>[number][] = [];
    // Busan-only sources have no Tour detail queue; evaluate them directly.
    for (;;) {
      if (!active()) throw new Error('recommendation_scope_changed');
      const reservation = session.reserveDetails();
      if (reservation.reason === 'request' && reservation.reservation) {
        const detail = await facade.loadDetails(reservation.reservation);
        if (!active()) throw new Error('recommendation_scope_changed');
        if (detail.status !== 'accepted') throw new LivePublicDataUnavailableError();
        const normalized = input.ports.projectDetails({
          reservation: reservation.reservation,
          response: detail,
          referenceDate: busanReferenceDate(input.context.now),
        });
        if (normalized.status !== 'accepted'
          || session.acceptDetails(reservation.reservation, normalized.supplements, { nextBatchMax: normalized.nextBatchMax }) !== 'accepted') {
          throw new LivePublicDataUnavailableError();
        }
        tourSupplements.push(...normalized.supplements);
      } else if (reservation.reason !== 'queue_exhausted' && reservation.reason !== 'unavailable'
        && reservation.reason !== 'detail_cap' && reservation.reason !== 'detail_provider_limit'
        && reservation.reason !== 'route_budget_exhausted' && reservation.reason !== 'provider_unavailable'
        && reservation.reason !== 'sufficient') {
        throw new LivePublicDataUnavailableError();
      }
      const view = await session.evaluate();
      if (!active()) throw new Error('recommendation_scope_changed');
      if (view.state === 'unavailable') throw new LivePublicDataUnavailableError();
      if (view.state === 'ready' || view.state === 'empty' || view.state === 'partial' && view.stopReason) {
        const displayProjection = input.ports.projectCatalog({ ...projected.sources, tourSupplements });
        if (displayProjection.status === 'unavailable' || displayProjection.liveSourceSnapshotId !== view.liveSourceSnapshotId) throw new LivePublicDataUnavailableError();
        return { bridge: session.sealRuntime(), state: view.state, displayProjection } as const;
      }
    }
  } catch (error) {
    facade.cancel();
    throw error;
  } finally {
    input.signal?.removeEventListener('abort', cancel);
    facade.close();
  }
}

export type LivePublicDataBridge = Awaited<ReturnType<typeof runLivePublicDataInitial>>['bridge'];
