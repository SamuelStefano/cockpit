import type { ReactNode } from 'react';
import { Input } from '../components/primitives';

interface AgentFieldProps {
  label: string;
  help?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  mono?: boolean;
  disabled?: boolean;
  action?: ReactNode;
}

export function AgentField({ label, help, placeholder, value, onChange, error, mono, disabled, action }: AgentFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          size="sm" className="min-w-0 flex-1" mono={mono} placeholder={placeholder} value={value} disabled={disabled}
          error={!!error} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)}
        />
        {action}
      </span>
      {error ? <span role="alert" className="text-[12px] text-red-300">{error}</span> : help && <span className="text-[12px] text-neutral-500">{help}</span>}
    </label>
  );
}
