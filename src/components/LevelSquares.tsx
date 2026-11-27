import React from 'react';
import { useI18n } from '../i18n/I18nContext';

interface LevelSquaresProps {
  label: string;
  value: number;
  max: 1 | 2 | 3 | 4 | 5;
  onChange: (level: number) => void;
}

export const LevelSquares: React.FC<LevelSquaresProps> = ({ label, value, max, onChange }) => {
  const { t } = useI18n();

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-0 shrink-0">
      {Array.from({ length: max }, (_, index) => {
        const level = index + 1;
        const selected = level === value;
        const filled = level <= value;

        return (
          <button
            key={level}
            type="button"
            aria-pressed={selected}
            aria-label={t('common.level', { level })}
            title={selected ? t('session.clearCondition', { condition: label }) : t('common.level', { level })}
            onClick={() => onChange(selected ? 0 : level)}
            className="group relative grid h-7 w-[21px] place-items-center rounded text-xs font-bold tabular-nums focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span
              aria-hidden="true"
              className={`absolute size-[17px] rotate-12 rounded-[2px] border transition-colors ${
                filled
                  ? 'border-accent bg-accent group-hover:bg-accent-hover'
                  : 'border-border-strong bg-elevated group-hover:border-accent'
              }`}
            />
            <span aria-hidden="true" className={`relative ${filled ? 'text-accent-contrast' : 'text-text-secondary'}`}>
              {level}
            </span>
          </button>
        );
      })}
    </div>
  );
};
