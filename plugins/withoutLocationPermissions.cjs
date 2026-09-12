const { withInfoPlist } = require('@expo/config-plugins');

// Also cleans a non-clean prebuild that previously included expo-location.
function stripLocationPermissions(plist) {
  for (const key of ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'NSLocationTemporaryUsageDescriptionDictionary']) delete plist[key];
  if (Array.isArray(plist.UIBackgroundModes)) {
    plist.UIBackgroundModes = plist.UIBackgroundModes.filter(mode => mode !== 'location');
    if (!plist.UIBackgroundModes.length) delete plist.UIBackgroundModes;
  }
  return plist;
}
module.exports = config => withInfoPlist(config, mod => {
  stripLocationPermissions(mod.modResults);
  return mod;
});
module.exports.stripLocationPermissions = stripLocationPermissions;
