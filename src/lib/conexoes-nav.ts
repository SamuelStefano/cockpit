export const ADD_PROVIDER_HASH = '#adicionar';

export function openConexoes(addProvider = false): void {
  history.pushState(null, '', `/conexoes${addProvider ? ADD_PROVIDER_HASH : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
