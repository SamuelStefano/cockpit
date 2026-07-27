import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError: (message: string) => void;
}

// Um throw no render do sandbox derrubaria a rota inteira, já que o modo App roda
// na mesma árvore React do Deck. A barreira transforma isso em mensagem. Quem
// monta passa uma `key` que muda a cada versão do código — é assim que ela volta
// a tentar depois de um erro.
export class SandboxBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const where = info.componentStack?.trim().split('\n')[0]?.trim();
    this.props.onError(where ? `${error.message}\n  em ${where}` : error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
