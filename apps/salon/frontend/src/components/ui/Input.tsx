import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-warm-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border bg-white text-warm-800 placeholder-warm-400',
            'focus:outline-none focus:ring-2 transition-all duration-150',
            error
              ? 'border-error-400 focus:ring-error-300 focus:border-error-400'
              : 'border-warm-300 focus:ring-primary-300 focus:border-primary-400',
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1 text-sm text-warm-500">{hint}</p>
        )}
        {error && (
          <p className="mt-1 text-sm text-error-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
