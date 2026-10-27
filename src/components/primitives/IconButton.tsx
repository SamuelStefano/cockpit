import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from './Button';
import { Tooltip, type TooltipSide } from './Tooltip';
import type { IconName } from './Icon';
import { tokens } from './tokens';

type ButtonProps = React.ComponentProps<typeof Button>;

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: IconName;
  // Required: it is the accessible name and the hover label in one.
  label: string;
  // Richer hover content (e.g. label + shortcut); the aria-label stays `label`.
  tip?: ReactNode;
  side?: TooltipSide;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  loading?: boolean;
}

export function IconButton({ icon, label, tip, side = 'top', variant = 'ghost', size = 'md', className = '', ...rest }: IconButtonProps) {
  return (
    <Tooltip label={tip ?? label} side={side}>
      <Button {...rest} square variant={variant} size={size} icon={icon} aria-label={label} className={`${tokens.touchTarget} ${className}`} />
    </Tooltip>
  );
}
