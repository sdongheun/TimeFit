const { withEntitlementsPlist } = require('@expo/config-plugins');

// TimeFit uses device-local notifications only; it does not register for APNs.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
