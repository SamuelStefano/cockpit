import type { ReactNode } from 'react';
import { tokens } from './tokens';

export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`mb-2 mt-7 first:mt-0 ${tokens.text.sectionTitle} ${className}`}>{children}</h3>;
}
