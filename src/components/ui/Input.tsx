'use client';

import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconAlert } from './icons';

// Labelled text input following the forms spec: label above, help text below,
// validate-on-blur, rust error with a filled glyph. Placeholders are examples,
// never a substitute for the label.

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  help?: string;
  error?: string;
  optional?: boolean;
  /** Currency/unit symbol rendered inside the field (money inputs). Named
   * `leading` to avoid clashing with the native HTML `prefix` attribute. */
  leading?: ReactNode;
  /** Fires on blur so callers can validate-on-blur, not on keystroke. */
  onValidate?: (value: string) => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, help, error, optional, leading, onValidate, className, id, onBlur, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const errId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);
  const showError = touched && !!error;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-tertiary">(optional)</span>}
      </label>

      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-3 text-ink-tertiary tnum">{leading}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={showError || undefined}
          aria-describedby={cn(help && helpId, showError && errId) || undefined}
          onBlur={(e) => {
            setTouched(true);
            onValidate?.(e.target.value);
            onBlur?.(e);
          }}
          className={cn(
            'h-10 w-full rounded-input border bg-surface-card px-3 text-[15px] text-ink',
            'placeholder:text-ink-tertiary',
            'transition-colors duration-fast ease-standard',
            'focus:outline-none focus-visible:border-accent-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary',
            'disabled:bg-surface-sunken disabled:text-ink-tertiary',
            leading && 'pl-7',
            showError ? 'border-accent-alert' : 'border-border-default',
            className,
          )}
          {...props}
        />
      </div>

      {help && !showError && (
        <p id={helpId} className="text-[13px] text-ink-tertiary">
          {help}
        </p>
      )}
      {showError && (
        <p id={errId} className="flex items-center gap-1.5 text-[13px] text-accent-alert" role="alert">
          <IconAlert width={14} height={14} />
          {error}
        </p>
      )}
    </div>
  );
});
