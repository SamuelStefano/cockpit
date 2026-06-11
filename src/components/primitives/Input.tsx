import { forwardRef, type InputHTMLAttributes } from 'react';

type InputSize = 'sm' | 'md';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  error?: boolean;
  mono?: boolean;
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
  { size = 'md', error = false, mono = false, className = '', ...rest },
  ref,
) {
  const text = mono ? 'font-mono text-[12.5px]' : textSizes[size];
  const border = error
    ? 'border-red-500/50 focus:border-red-500/60'
    : 'border-neutral-800 focus:border-orange-500/40';
  return (
    <input
      ref={ref}
      className={`w-full border bg-neutral-950 text-neutral-200 placeholder:text-neutral-600 outline-none transition ${sizes[size]} ${text} ${border} ${className}`}
      {...rest}
    />
  );
});
