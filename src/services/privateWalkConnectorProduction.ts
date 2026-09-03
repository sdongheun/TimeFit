import { createPrivateWalkConnectorPort, type PrivateWalkConnectorPort } from './privateWalkConnector';
import { createSupabaseRouteProxyPorts } from './routeProxyProductionPorts';

/** Production composition for detail screens; deliberately reuses only the current Auth session. */
export function createSupabasePrivateWalkConnectorPort(): PrivateWalkConnectorPort {
  const { auth, edge } = createSupabaseRouteProxyPorts();
  return createPrivateWalkConnectorPort({ auth, edge });
}
