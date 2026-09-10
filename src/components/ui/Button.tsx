import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// House-style button. Variants: primary (one per view), secondary, ghost,
// destructive. Labels are verbs in sentence case ("Upload statements"). Pill
// shape, Montserrat 600. Loading holds width and swaps the label for a spinner.

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-heading font-semibold ' +
  'transition-colors duration-fast ease-standard select-none ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary ' +
  'disabled:opacity-40 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary: 'bg-accent-primary text-white hover:bg-accent-primary-hover',
  secondary:
    'bg-surface-card text-ink border border-border-default hover:bg-surface-cream',
  ghost: 'text-ink hover:bg-surface-sunken',
  destructive: 'bg-accent-alert text-white hover:bg-accent-alert-hover',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-4 text-[14px]',
  md: 'h-10 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[15px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
});

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      role="status"
      aria-label="Loading"
    />
  );
}
