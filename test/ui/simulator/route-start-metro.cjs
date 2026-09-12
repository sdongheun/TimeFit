// Explicit test-only Metro config. Production builds never reference this file.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const root = path.resolve(__dirname, '../../..');
const config = getDefaultConfig(root);
const stubs = new Set(['./AppFlowContext', './KakaoRouteMap', './mainTabNavigation', './privateWalkConnectorComposition', './courseCompletionComposition', './ownedCourseLifecycle', './liveActivity/courseProgressComposition', './liveActivity/courseProgressNotifications', './liveActivity/nativeLiveActivityPort', './liveActivity/liveActivityDiagnostics', './personalizationComposition', '@react-navigation/native', './execution/schedule']);
config.resolver.resolveRequest = (ctx, name, platform) => {
  if (ctx.originModulePath.endsWith('/src/ui/CourseConfirmScreen.tsx')) {
    if (stubs.has(name)) return { type: 'sourceFile', filePath: path.join(__dirname, 'route-start-ports.jsx') };
    if (name === '../data/busan_poi_catalog.json') return { type: 'sourceFile', filePath: path.join(__dirname, 'route-start-catalog.json') };
  }
  return ctx.resolveRequest(ctx, name, platform);
};
module.exports = config;
