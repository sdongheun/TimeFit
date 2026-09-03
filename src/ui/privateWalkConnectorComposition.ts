import type { PrivateWalkConnectorPort } from '../services/privateWalkConnector';
import { createSupabasePrivateWalkConnectorPort } from '../services/privateWalkConnectorProduction';

/** 앱 모듈 수명에 한 번만 만들어 화면 재진입에서도 in-flight·10분 메모리를 공유한다. */
export const appPrivateWalkConnectorPort: PrivateWalkConnectorPort | null =
  process.env.EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true'
    ? createSupabasePrivateWalkConnectorPort()
    : null;
