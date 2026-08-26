import { SelectHTMLAttributes, forwardRef, useId } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string | number; label: string }>;
}

/**
 * F-3 (Restbefunde der Abnahme, Plan 14.2-04): `Select` war die einzige der drei
 * Formular-Primitiven (`Input`, `Textarea`, `Select`) ohne das WR-16-Muster (Code-Review
 * Phase 12) — kein `htmlFor`/`id`-Paar, keine `aria-invalid`/`aria-describedby`-Anbindung von
 * Fehler und Hilfetext. Ein Aufrufer, der keine `id` uebergab, bekam ein Label ohne
 * `htmlFor` und ein Feld ohne zugaenglichen Namen.
 *
 * Die Ergaenzung ist rein additiv — kein Aufrufer muss etwas uebergeben, die Prop-Signatur
 * nach aussen ist unveraendert, und die DOM-Struktur (Label direkt gefolgt vom Feld) bleibt
 * gleich, damit bestehende Selektoren weiter greifen. Uebergibt ein Aufrufer eine eigene
 * `id`, gewinnt sie: `htmlFor` folgt ihr, und das nachgestellte `{...props}` ueberschreibt
 * die generierte — identisch zu `Input.tsx` und `Textarea.tsx`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = '', ...props }, ref) => {
    const generatedId = useId();
    const selectId = props.id ?? generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;
    const showHelper = !!helperText && !error;

    const selectStyles = error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600';

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {props.required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : showHelper ? helperId : undefined}
          className={`
            block w-full h-[42px] px-4 py-2.5 rounded-lg
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            text-sm font-medium
            border-2
            shadow-sm
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            hover:border-gray-400 dark:hover:border-gray-500
            hover:shadow-md
            cursor-pointer
            ${selectStyles}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {showHelper && (
          <p id={helperId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
