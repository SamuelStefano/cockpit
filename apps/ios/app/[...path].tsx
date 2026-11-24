import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShellWebView } from '../src/ShellWebView';
import { SHELL_BACKGROUND } from '../src/theme';

// Required catch-all next to `index`: every deep link path is one route of the web app.
export default function CatchAll() {
  const { path } = useLocalSearchParams<{ path: string | string[] }>();
  const segments = Array.isArray(path) ? path : path ? [path] : [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SHELL_BACKGROUND }}>
      <ShellWebView path={`/${segments.map(encodeURIComponent).join('/')}`} />
    </SafeAreaView>
  );
}
