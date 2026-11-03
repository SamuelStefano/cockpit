// Dynamic layer over app.json (app.json stays the one source for tests and the store build).
//
// APP_VARIANT=development (EAS profile `development`) builds a SEPARATE app: its own bundle id,
// name and URL scheme, so it installs beside the TestFlight app. The dev-client plugin runs only
// in this variant, so the store build claims no `exp+...` scheme.
//
// DECK_WEB_BUNDLE=1 (EAS profile `production-bundle`) is the store variant: the WebView loads the
// web build that `npm run bundle:web` copied into the app, on `<scheme>://localhost`, through the
// WKURLSchemeHandler of `modules/dfl-web-bundle`. Without the flag, `webOrigin` stays the https
// origin (profile `production`, TestFlight only) and the module is inert. `publicWebOrigin` keeps
// the https URL as the fallback.
//
// Scene life cycle (plugins/withSceneLifecycle.js): on for every variant but the development one.
// An app built with the iOS 27 SDK does not launch without it. expo-dev-launcher 57 has no scene code.
const DEV = process.env.APP_VARIANT === 'development';
const BUNDLE = process.env.DECK_WEB_BUNDLE === '1';

const withScenes = (config) => ({ ...config, plugins: [
    // Registered first and last: mod order differs by type, and the entitlement must be gone whichever runs last.
    './plugins/withoutPushEntitlement',
    ...(config.plugins ?? []),
    './plugins/withSceneLifecycle',
    './plugins/withoutPushEntitlement',
  ],
});

function withWebBundle(config) {
  if (!BUNDLE) return config;
  const scheme = String(config.scheme);
  const publicWebOrigin = config.extra?.webOrigin;
  return {
    ...config,
    ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, DflWebBundleScheme: scheme } },
    extra: { ...config.extra, webOrigin: `${scheme}://localhost`, publicWebOrigin },
  };
}

module.exports = ({ config }) => {
  if (!DEV) return withWebBundle(withScenes(config));
  return withWebBundle({
    ...config,
    name: 'Deck Dev',
    scheme: 'deck-dev',
    ios: { ...config.ios, bundleIdentifier: 'com.tainanfidelis.deck.dev' },
    plugins: [...(config.plugins ?? []), ['expo-dev-client', { addGeneratedScheme: false }]],
  });
};
