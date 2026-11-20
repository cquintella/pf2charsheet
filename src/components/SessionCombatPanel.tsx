import React from 'react';
import { SessionState } from '../utils/conditions';
import { useI18n } from '../i18n/I18nContext';
import { Heart, Shield, Sparkles, Skull, AlertTriangle } from 'lucide-react';

interface SessionCombatPanelProps {
  session: SessionState;
  maxHp: number;
  equippedShield?: { name: string; acBonus: number } | null;
  onChange: (next: SessionState) => void;
}

const VALUE_CONDITIONS: readonly (keyof Omit<SessionState['conditions'], 'offGuard'>)[] = [
  'frightened',
  'sickened',
  'clumsy',
  'drained',
  'enfeebled',
  'slowed',
];

export const SessionCombatPanel: React.FC<SessionCombatPanelProps> = ({ session, maxHp, equippedShield, onChange }) => {
  const { t } = useI18n();
  const currentHp = session.currentHp ?? maxHp;
  const hpPct = maxHp > 0 ? Math.min(100, Math.max(0, (currentHp / maxHp) * 100)) : 0;
  const hasShield = Boolean(equippedShield);
  const shieldActive = hasShield && session.shieldRaised;

  return (
    <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border-subtle">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-status-danger" />
          <span>{t('session.title')}</span>
        </h3>

        <button
          type="button"
          disabled={!hasShield}
          title={hasShield ? `${equippedShield!.name} (+${equippedShield!.acBonus} ${t('common.ac')})` : t('session.needEquippedShield')}
          onClick={() => onChange({ ...session, shieldRaised: !session.shieldRaised })}
          aria-pressed={shieldActive}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
            shieldActive
              ? 'bg-status-info-bg text-status-info border-status-info-border'
              : 'bg-elevated hover:bg-control text-text-secondary border-border-strong'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            {shieldActive ? t('session.shieldRaised') : t('session.raiseShield')}
            {equippedShield ? ` (+${equippedShield.acBonus} ${t('common.ac')})` : ''}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* PV Atual + Temp */}
        <div className="lg:col-span-7 bg-inset border border-border-subtle rounded-xl p-3 space-y-2.5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                title={t('session.totalHp')}
                className="relative flex items-center justify-center w-12 h-12 flex-shrink-0 text-status-danger"
              >
                <Heart className="w-12 h-12 fill-status-danger-bg stroke-status-danger-border stroke-[1.75]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none -mt-0.5">
                  <span className="text-[11px] font-black text-text-primary tabular-nums">{currentHp + session.tempHp}</span>
                </div>
              </div>
              <label className="text-xs font-bold uppercase text-text-muted flex items-center gap-1.5">
                <span>{t('session.currentHp')}</span>
                <input
                  type="number"
                  min={0}
                  max={maxHp}
                  value={currentHp}
                  onChange={e => onChange({ ...session, currentHp: Math.max(0, Math.min(maxHp, Math.floor(Number(e.target.value) || 0))) })}
                  className="w-20 bg-surface border border-border-strong rounded-lg px-2 py-1 text-sm font-black text-text-primary tabular-nums"
                />
              </label>
              <span className="text-sm font-semibold text-text-muted tabular-nums">/ {maxHp}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary flex items-center gap-1">
                <span>{t('session.tempHp')}:</span>
                <input
                  type="number"
                  min={0}
                  value={session.tempHp}
                  onChange={e => onChange({ ...session, tempHp: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className="w-16 bg-surface border border-border-strong rounded-lg px-2 py-1 text-xs text-text-primary tabular-nums"
                />
              </label>
              <button
                type="button"
                onClick={() => onChange({ ...session, currentHp: maxHp, dying: 0 })}
                className="px-2.5 py-1 rounded-lg bg-status-success-bg text-status-success border border-status-success-border text-xs font-semibold"
              >
                {t('session.fullHeal')}
              </button>
            </div>
          </div>

          <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border-subtle">
            <div
              className={`h-full transition-all duration-200 ${hpPct <= 25 ? 'bg-red-500' : hpPct <= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>

        {/* Cápsula: Hero Points & Focus Points */}
        <div className="lg:col-span-5 bg-inset border border-border-subtle rounded-xl p-3 grid grid-cols-2 gap-2.5">
          <div className="bg-surface border border-border-subtle rounded-xl p-2.5 flex flex-col justify-between space-y-1.5">
            <span className="text-[11px] font-bold uppercase text-text-muted flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-accent-text" />
              {t('session.heroPoints')}
            </span>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onChange({ ...session, heroPoints: Math.max(0, session.heroPoints - 1) })} className="px-2.5 py-1 rounded bg-elevated text-text-primary text-xs font-bold">-</button>
              <span className="font-black text-base text-accent-text tabular-nums">{session.heroPoints}</span>
              <button type="button" onClick={() => onChange({ ...session, heroPoints: Math.min(3, session.heroPoints + 1) })} className="px-2.5 py-1 rounded bg-elevated text-text-primary text-xs font-bold">+</button>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl p-2.5 flex flex-col justify-between space-y-1.5">
            <span className="text-[11px] font-bold uppercase text-text-muted block truncate">{t('session.focusPoints')}</span>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onChange({ ...session, focusPoints: Math.max(0, session.focusPoints - 1) })} className="px-2.5 py-1 rounded bg-elevated text-text-primary text-xs font-bold">-</button>
              <span className="font-black text-base text-status-info tabular-nums">{session.focusPoints}</span>
              <button type="button" onClick={() => onChange({ ...session, focusPoints: Math.min(3, session.focusPoints + 1) })} className="px-2.5 py-1 rounded bg-elevated text-text-primary text-xs font-bold">+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Cápsula: Dying & Wounded (2 colunas) + Conditions (2 colunas abaixo) */}
      <div className="bg-inset border border-border-subtle rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-surface border border-border-subtle rounded-xl p-2.5 space-y-1">
            <span className="text-[11px] font-bold uppercase text-text-muted flex items-center gap-1">
              <Skull className="w-3.5 h-3.5 text-status-danger" />
              {t('session.dying')}
            </span>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onChange({ ...session, dying: Math.max(0, session.dying - 1) })} className="px-2.5 py-0.5 rounded bg-elevated text-text-primary text-xs font-bold">-</button>
              <span className="font-black text-base text-text-primary tabular-nums">{session.dying}</span>
              <button type="button" onClick={() => onChange({ ...session, dying: Math.min(4, session.dying + 1) })} className="px-2.5 py-0.5 rounded bg-elevated text-text-primary text-xs font-bold">+</button>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl p-2.5 space-y-1">
            <span className="text-[11px] font-bold uppercase text-text-muted flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-status-warn" />
              {t('session.wounded')}
            </span>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onChange({ ...session, wounded: Math.max(0, session.wounded - 1) })} className="px-2.5 py-0.5 rounded bg-elevated text-text-primary text-xs font-bold">-</button>
              <span className="font-black text-base text-text-primary tabular-nums">{session.wounded}</span>
              <button type="button" onClick={() => onChange({ ...session, wounded: Math.min(3, session.wounded + 1) })} className="px-2.5 py-0.5 rounded bg-elevated text-text-primary text-xs font-bold">+</button>
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-border-subtle space-y-2">
          <span className="text-[11px] font-bold uppercase text-text-muted block">{t('session.conditions')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...session, conditions: { ...session.conditions, offGuard: !session.conditions.offGuard } })}
              aria-pressed={session.conditions.offGuard}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors text-left ${
                session.conditions.offGuard
                  ? 'bg-status-danger-bg text-status-danger border-status-danger-border'
                  : 'bg-surface text-text-secondary border-border-subtle hover:border-border-strong'
              }`}
            >
              {t('session.condition.offGuard')}
            </button>

            {VALUE_CONDITIONS.map(key => {
              const val = session.conditions[key];
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                    val > 0
                      ? 'bg-status-warn-bg text-status-warn border-status-warn-border font-bold'
                      : 'bg-surface text-text-secondary border-border-subtle'
                  }`}
                >
                  <span className="truncate">{t(`session.condition.${key}`)}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      aria-label={`${t(`session.condition.${key}`)} -`}
                      onClick={() => onChange({ ...session, conditions: { ...session.conditions, [key]: Math.max(0, val - 1) } })}
                      className="px-1.5 py-0.5 rounded bg-elevated hover:bg-control font-bold"
                    >
                      -
                    </button>
                    <span className="tabular-nums min-w-[14px] text-center">{val}</span>
                    <button
                      type="button"
                      aria-label={`${t(`session.condition.${key}`)} +`}
                      onClick={() => onChange({ ...session, conditions: { ...session.conditions, [key]: Math.min(4, val + 1) } })}
                      className="px-1.5 py-0.5 rounded bg-elevated hover:bg-control font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
