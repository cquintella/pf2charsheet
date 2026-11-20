import React, { useId } from 'react';
import { ProficiencyRank } from '../types/pf2e';
import { useI18n } from '../i18n/I18nContext';
import { proficiencyName, proficiencyShort } from '../i18n/gameTerms';

interface Props {
  value: ProficiencyRank;
  onChange: (rank: ProficiencyRank) => void;
  label: string;
}

const RANKS: readonly ProficiencyRank[] = [0, 1, 2, 3, 4];

export const ProficiencySelector: React.FC<Props> = ({ value, onChange, label }) => {
  const name = useId();
  const { t } = useI18n();
  const options = RANKS.map(rank => ({ rank, short: proficiencyShort(t, rank), name: proficiencyName(t, rank) }));
  return <fieldset className="min-w-0">
    <legend className="text-[11px] font-semibold text-text-secondary uppercase mb-1">{label}</legend>
    <div className="flex gap-1" aria-label={label}>
      {options.map(option => <label key={option.rank} title={option.name} className="w-7 flex-none cursor-pointer">
        <input type="radio" name={name} value={option.rank} checked={value === option.rank} onChange={() => onChange(option.rank)} aria-label={option.name} className="peer sr-only" />
        <span className="flex h-7 items-center justify-center rounded border border-border-strong bg-inset text-[11px] font-bold text-text-secondary tabular-nums peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">{option.short}</span>
      </label>)}
    </div>
  </fieldset>;
};
