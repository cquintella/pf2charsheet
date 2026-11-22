import React from 'react';
import { ChevronDown } from 'lucide-react';
import { CharacterStrike, ProficiencyRank } from '../types/pf2e';
import { useI18n } from '../i18n/I18nContext';
import { signed } from '../i18n/gameTerms';

const MANEUVERS = [
  { trait: 'trip', mode: 'melee', defense: 'reflex' },
  { trait: 'disarm', mode: 'melee', defense: 'reflex' },
  { trait: 'grapple', mode: 'melee', defense: 'fortitude' },
  { trait: 'shove', mode: 'melee', defense: 'fortitude' },
  { trait: 'ranged-trip', mode: 'ranged', defense: 'reflex' },
] as const;

const SPECIAL_ACTIONS = [
  { trait: 'parry', mode: 'both' },
  { trait: 'combination', mode: 'melee' },
  { trait: 'double-barrel', mode: 'ranged' },
  { trait: 'critical-fusion', mode: 'melee' },
  { trait: 'tethered', mode: 'ranged' },
] as const;

interface WeaponActionsProps {
  kind: CharacterStrike['kind'];
  traits: string[];
  athletics: number;
  athleticsRank: ProficiencyRank;
  weaponRank: ProficiencyRank;
  rangeIncrement: number | null;
}

export const WeaponActions: React.FC<WeaponActionsProps> = ({
  kind, traits, athletics, athleticsRank, weaponRank, rangeIncrement,
}) => {
  const { t } = useI18n();
  const traitSet = new Set(traits.map(trait => trait.trim().toLowerCase().replace(/\s+/g, '-')));
  const maneuvers = MANEUVERS.filter(action => action.mode === kind && traitSet.has(action.trait));
  const special = SPECIAL_ACTIONS.filter(action =>
    (action.mode === kind || action.mode === 'both') && traitSet.has(action.trait));

  if (!maneuvers.length && !special.length) return null;

  return (
    <div className="grid gap-2 border-t border-border-subtle pt-2 text-xs">
      {maneuvers.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-text-primary">{t('strikes.maneuvers')}</p>
          {maneuvers.map(({ trait, defense }) => {
            const ranged = trait === 'ranged-trip';
            const modifier = athletics - (ranged ? 2 : 0);
            return (
              <details key={trait} className="group rounded-lg border border-border-subtle bg-surface">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2.5 py-1.5 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                  <span className="font-semibold text-accent-text">{t(`strikes.maneuver.${trait}`)}</span>
                  <span className="tabular-nums text-text-secondary">{t('strikes.maneuverCheck', { modifier: signed(modifier) })}</span>
                  <ChevronDown aria-hidden="true" className="ml-auto size-3.5 text-text-muted group-open:rotate-180" />
                </summary>
                <div className="space-y-1 px-2.5 pb-2 text-text-secondary">
                  <p>{t(`strikes.maneuverTarget.${defense}`)} {t('strikes.maneuverMap')}</p>
                  {ranged ? (
                    <p>{rangeIncrement
                      ? t('strikes.rangedTripDistance', { distance: rangeIncrement })
                      : t('strikes.rangedTripFirstIncrement')}</p>
                  ) : <p>{t('strikes.meleeManeuverReach')}</p>}
                  {trait === 'disarm' && athleticsRank === 0 && <p className="text-status-warn">{t('strikes.disarmTraining')}</p>}
                </div>
              </details>
            );
          })}
        </div>
      )}
      {special.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-text-primary">{t('strikes.specialActions')}</p>
          {special.map(({ trait }) => (
            <details key={trait} className="group rounded-lg border border-border-subtle bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-1.5 font-semibold text-accent-text marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                {t(`strikes.special.${trait}`)}
                <ChevronDown aria-hidden="true" className="ml-auto size-3.5 text-text-muted group-open:rotate-180" />
              </summary>
              <div className="space-y-1 px-2.5 pb-2 text-text-secondary">
                <p>{t(`strikes.specialHint.${trait}`)}</p>
                {trait === 'parry' && weaponRank === 0 && <p className="text-status-warn">{t('strikes.parryTraining')}</p>}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};
