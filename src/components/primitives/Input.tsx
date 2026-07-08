import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type InputSize = 'sm' | 'md';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  error?: boolean;
  mono?: boolean;
  icon?: IconName;      // ícone à esquerda (ex: busca)
  suffix?: ReactNode;   // conteúdo à direita (ex: contador, atalho)
}

const sizes: Record<InputSize, string> = {
  sm: 'rounded-md px-2.5 py-1.5',
  md: 'rounded-lg px-3 py-2',
};

// Classe de texto separada de `sizes` pra evitar conflito de precedência entre
// dois text-[...] arbitrários no mesmo className.
const textSizes: Record<InputSize, string> = {
  sm: 'text-[12.5px]',
  md: 'text-[13px]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', error = false, mono = false, icon, suffix, className = '', ...rest },
  ref,
) {
  const text = mono ? 'font-mono text-[12.5px]' : textSizes[size];
  const border = error
    ? 'border-red-500/50 focus-within:border-red-500/60'
    : 'border-neutral-800 focus-within:border-orange-500/40';

  if (!icon && !suffix) {
    return (
      <input
        ref={ref}
        className={`w-full border bg-neutral-950 text-neutral-200 placeholder:text-neutral-600 outline-none transition ${sizes[size]} ${text} ${border} ${className}`}
        {...rest}
      />
    );
  }

  // Com adorno: um wrapper relativo desenha borda/foco/superfície; o input dentro
  // é transparente e sem borda, com padding pra não passar por baixo do ícone/suffix.
  const rounded = size === 'sm' ? 'rounded-md' : 'rounded-lg';
  const py = size === 'sm' ? 'py-1.5' : 'py-2';
  const iconSize = size === 'sm' ? 13 : 14;
  return (
    <div className={`relative flex w-full items-center border bg-neutral-950 transition ${rounded} ${border}`}>
      {icon && <Icon name={icon} size={iconSize} className="pointer-events-none absolute left-2.5 text-neutral-500" />}
      <input
        ref={ref}
        className={`w-full bg-transparent text-neutral-200 placeholder:text-neutral-600 outline-none ${py} ${icon ? 'pl-8' : 'pl-3'} ${suffix ? 'pr-9' : 'pr-3'} ${text} ${className}`}
        {...rest}
      />
      {suffix && <div className="absolute right-2.5 flex items-center">{suffix}</div>}
    </div>
  );
});
