// expo-notifications adds `aps-environment`, which requires a push-enabled profile. Deck only
// schedules local notifications (turn finished), so the entitlement is removed.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
