import { SafeAreaView } from 'react-native-safe-area-context';
import { ShellWebView } from '../src/ShellWebView';
import { SHELL_BACKGROUND } from '../src/theme';

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SHELL_BACKGROUND }}>
      <ShellWebView path="/" />
    </SafeAreaView>
  );
}
