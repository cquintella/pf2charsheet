import React, { useRef, useState } from 'react';
import { Dices, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';
import { parseAndRollFormula } from '../utils/diceRoller';

interface DiceRollerModalProps {
  onClose: () => void;
  initialFormula?: string;
  initialLabel?: string;
  autoRoll?: boolean;
}

interface RollEntry {
  id: number;
  label?: string;
  formula: string;
  total: number;
  breakdown: string;
}

const QUICK_DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'] as const;

/** Modal dialog for rolling arbitrary dice formulas and inspecting roll results. */
export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
  onClose,
  initialFormula = '1d20',
  initialLabel,
  autoRoll = false,
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);

  const [formula, setFormula] = useState(initialFormula);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<RollEntry[]>(() => {
    if (!autoRoll) return [];
    const res = parseAndRollFormula(initialFormula);
    return res.ok
      ? [{ id: Date.now() + Math.random(), label: initialLabel, formula: res.formula, total: res.total, breakdown: res.breakdown }]
      : [];
  });

  const handleRoll = (expr: string = formula, label?: string) => {
    const res = parseAndRollFormula(expr);
    if (!res.ok) {
      setErrorMsg(t('dice.invalidFormula'));
      return;
    }
    setErrorMsg(null);
    setHistory(prev => [
      { id: Date.now() + Math.random(), label, formula: res.formula, total: res.total, breakdown: res.breakdown },
      ...prev.slice(0, 29),
    ]);
  };

  const resultsText = history.map(entry => `${entry.label ? `${entry.label}: ` : ''}${entry.formula} -> ${entry.breakdown}`).join('\n');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dice-roller-title"
        className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl space-y-4"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="dice-roller-title" className="text-lg font-bold text-white flex items-center gap-2">
            <Dices className="w-5 h-5 text-accent-text" />
            <span>{t('dice.title')}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-control hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRoll();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <label htmlFor="dice-formula-input" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('dice.formula')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="dice-formula-input"
                autoFocus
                type="text"
                value={formula}
                onChange={(e) => {
                  setFormula(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={t('dice.formulaPlaceholder')}
                className="flex-1 rounded-xl border border-border-strong bg-canvas px-3 py-2 text-sm font-mono text-white placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-bold text-black shadow transition-colors"
              >
                <Dices className="w-4 h-4" />
                <span>{t('dice.roll')}</span>
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-status-danger">{errorMsg}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_DICE.map(die => (
              <button
                key={die}
                type="button"
                onClick={() => {
                  setFormula(die);
                  handleRoll(die);
                }}
                className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-control border border-border-strong text-xs font-mono font-semibold text-text-primary transition-colors"
              >
                {die}
              </button>
            ))}
          </div>
        </form>

        <div className="space-y-1.5 border-t border-border-strong pt-3">
          <div className="flex items-center justify-between">
            <label htmlFor="dice-results-output" className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('dice.results')}
            </label>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-status-danger transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>{t('dice.clear')}</span>
              </button>
            )}
          </div>
          <textarea
            id="dice-results-output"
            readOnly
            rows={5}
            value={resultsText}
            placeholder={t('dice.noResults')}
            className="w-full rounded-xl border border-border-strong bg-canvas p-3 text-xs font-mono text-text-primary placeholder:text-text-muted resize-none focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
