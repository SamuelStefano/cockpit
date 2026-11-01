import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { BackHandler, Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { loadWebBundleStatus } from '../modules/dfl-web-bundle';
import { isTrustedSender, parseBridgeMessage } from './bridge';
import { runBridgeMessage } from './bridgeHandlers';
import { chromeReducer, initialChrome, LOAD_TIMEOUT_MS, webViewHandlesBack } from './chromeState';
import { LoadingVeil } from './LoadingVeil';
import { OfflineCard } from './OfflineCard';
import { navigationDecision, resolveShellOrigin } from './origin';
import { SHELL_BACKGROUND } from './theme';

const extra = (Constants.expoConfig?.extra ?? {}) as { webOrigin?: unknown; publicWebOrigin?: unknown };
const SHELL = resolveShellOrigin(extra.webOrigin, extra.publicWebOrigin ?? extra.webOrigin, loadWebBundleStatus());

/** The one WebView of the app. `path` is the route inside the web app, e.g. `/dashboard`. */
export function ShellWebView({ path }: { path: string }) {
  const [chrome, dispatch] = useReducer(chromeReducer, initialChrome);
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const uri = useMemo(() => `${SHELL.origin}${path.startsWith('/') ? path : `/${path}`}`, [path]);

  useEffect(() => {
    if (chrome.phase !== 'loading') return;
    const t = setTimeout(() => dispatch({ type: 'timeout' }), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [chrome.phase, chrome.attempt]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!webViewHandlesBack(chrome, canGoBack.current)) return false;
      webRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [chrome]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    if (!isTrustedSender(e.nativeEvent.url, SHELL.origin)) return;
    const message = parseBridgeMessage(e.nativeEvent.data);
    if (message) void runBridgeMessage(message);
  }, []);

  return (
    <View style={styles.root}>
      <WebView
        key={chrome.attempt}
        ref={webRef}
        source={{ uri }}
        style={styles.web}
        // `originWhitelist` is not an allow-list: a URL that misses it is opened by the OS before the
        // handler runs. The one decision is `navigationDecision`.
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          const decision = navigationDecision(req.url, SHELL.origin, req.isTopFrame ?? true);
          if (decision === 'external') void Linking.openURL(req.url).catch(() => undefined);
          return decision === 'load';
        }}
        onMessage={onMessage}
        onNavigationStateChange={(s) => {
          canGoBack.current = s.canGoBack;
        }}
        onLoadStart={() => dispatch({ type: 'loadStart' })}
        onLoadEnd={() => dispatch({ type: 'loadEnd' })}
        onError={() => dispatch({ type: 'error' })}
        onHttpError={(e) => dispatch({ type: 'httpError', status: e.nativeEvent.statusCode, mainFrame: e.nativeEvent.url === uri })}
        onContentProcessDidTerminate={() => dispatch({ type: 'processGone' })}
        mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
        allowsBackForwardNavigationGestures
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsLinkPreview={false}
        pullToRefreshEnabled={false}
        webviewDebuggingEnabled={__DEV__}
        accessibilityLabel="Deck"
      />
      {chrome.phase === 'loading' && <LoadingVeil />}
      {chrome.phase === 'failed' && <OfflineCard reason={chrome.reason} onRetry={() => dispatch({ type: 'retry' })} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHELL_BACKGROUND },
  web: { flex: 1, backgroundColor: SHELL_BACKGROUND },
});
