import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'accent' | 'danger';
  active?: boolean;
  badge?: string | number;
  tooltipPosition?: 'top' | 'bottom';
}

/**
 * Botão padronizado apenas com ícone e tooltip flutuante no hover/focus-visible.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  icon,
  variant = 'default',
  active = false,
  badge,
  tooltipPosition = 'bottom',
  className = '',
  type = 'button',
  ...rest
}) => {
  const variantClass =
    variant === 'accent' || active
      ? 'bg-accent hover:bg-accent-hover text-accent-contrast border-accent shadow-md'
      : variant === 'danger'
      ? 'bg-status-danger-bg hover:opacity-90 text-status-danger border-status-danger-border'
      : 'bg-elevated hover:bg-control text-text-secondary hover:text-text-primary border-border-strong hover:border-accent/60';

  const tooltipPosClass =
    tooltipPosition === 'top'
      ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
      : 'top-full mt-2 left-1/2 -translate-x-1/2';

  return (
    <div className="relative inline-flex group">
      <button
        type={type}
        aria-label={label}
        className={`relative inline-flex items-center justify-center p-2.5 rounded-xl border transition-all disabled:opacity-45 disabled:cursor-not-allowed ${variantClass} ${className}`}
        {...rest}
      >
        {icon}
        {badge !== undefined && (
          <span className="ml-1 text-[11px] font-bold tabular-nums leading-none">
            {badge}
          </span>
        )}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${tooltipPosClass} z-50 whitespace-nowrap rounded-lg bg-canvas border border-border-strong px-2.5 py-1 text-xs font-semibold text-text-primary shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150`}
      >
        {label}
      </span>
    </div>
  );
};
