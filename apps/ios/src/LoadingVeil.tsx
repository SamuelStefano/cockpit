import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SHELL_BACKGROUND } from './theme';

/** Covers the WebView until the first document is ready: no white flash on launch. */
export function LoadingVeil() {
  return (
    <View style={styles.veil} pointerEvents="none" accessibilityLabel="Loading Deck">
      <ActivityIndicator color="#e5e5e5" />
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: SHELL_BACKGROUND, alignItems: 'center', justifyContent: 'center' },
});
