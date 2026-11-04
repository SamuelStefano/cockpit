import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChromeState } from './chromeState';
import { SHELL_BACKGROUND } from './theme';

const COPY: Record<NonNullable<ChromeState['reason']>, string> = {
  error: 'Deck could not load. Check your connection and try again.',
  http: 'Deck is not answering right now. Try again in a moment.',
  timeout: 'Deck is taking too long to load. Check your connection and try again.',
  process: 'Deck stopped unexpectedly. Try again.',
};

export function OfflineCard({ reason, onRetry }: { reason: ChromeState['reason']; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>You are offline</Text>
      <Text style={styles.body}>{COPY[reason ?? 'error']}</Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...StyleSheet.absoluteFillObject, backgroundColor: SHELL_BACKGROUND, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: '#f5f5f5', fontSize: 20, fontWeight: '600' },
  body: { color: '#a3a3a3', fontSize: 15, textAlign: 'center' },
  button: { marginTop: 8, backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#101013', fontSize: 16, fontWeight: '600' },
});
