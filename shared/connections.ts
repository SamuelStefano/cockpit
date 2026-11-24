export type ConnectionState = 'connected' | 'expired' | 'error' | 'off';

export type ConnectionKind = 'provider' | 'tool' | 'machine' | 'device' | 'key';

export interface Connection {
  id: string;
  kind: ConnectionKind;
  label: string;
  state: ConnectionState;
  detail?: string;
  lastUsed?: number;
  usedBy?: string[];
}
