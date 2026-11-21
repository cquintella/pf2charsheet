import React, { useEffect, useState } from 'react';
import {
  AttributeKey,
  CharacterSpellcastingState,
  ClassItem,
  ProficiencyRank,
  SpellItem,
  Spellbook,
} from '../types/pf2e';
import { fetchSpellbookById, fetchSpellbooks } from '../services/api';
import { getProficiencyBonus } from '../utils/formatters';
import { ProficiencySelector } from './ProficiencySelector';
import { useI18n } from '../i18n/I18nContext';
import { attributeShort, signed } from '../i18n/gameTerms';
import { BookOpen, RotateCcw, Sparkles, Star } from 'lucide-react';

const CLASS_SPELLCASTING_DEFAULTS: Record<string, { tradition: string; ability: AttributeKey }> = {
  wizard: { tradition: 'arcane', ability: 'int' },
  cleric: { tradition: 'divine', ability: 'wis' },
  druid: { tradition: 'primal', ability: 'wis' },
  bard: { tradition: 'occult', ability: 'cha' },
  sorcerer: { tradition: 'arcane', ability: 'cha' },
  witch: { tradition: 'arcane', ability: 'int' },
  oracle: { tradition: 'divine', ability: 'cha' },
  psychic: { tradition: 'occult', ability: 'cha' },
  magus: { tradition: 'arcane', ability: 'int' },
  summoner: { tradition: 'arcane', ability: 'cha' },
  animist: { tradition: 'divine', ability: 'wis' },
};

export function standardSlotsForLevel(level: number): Record<number, number> {
  const slots: Record<number, number> = {};
  const maxRank = Math.min(10, Math.ceil(level / 2));
  for (let r = 1; r <= maxRank; r++) {
    const unlockLvl = r * 2 - 1;
    if (r === 10) {
      slots[r] = level >= 19 ? 1 : 0;
    } else if (level >= unlockLvl + 2) {
      slots[r] = 3;
    } else {
      slots[r] = 2;
    }
  }
  return slots;
}

export function deriveDefaultSpellcasting(
  selectedClass: ClassItem | null,
  level: number
): CharacterSpellcastingState {
  let isCaster = false;
  let defaultAbility: AttributeKey = 'int';
  let defaultTradition = '';

  if (selectedClass) {
    try {
      const sys = JSON.parse(selectedClass.system_json || '{}') as { spellcasting?: number };
      isCaster = typeof sys.spellcasting === 'number' && sys.spellcasting > 0;
    } catch { /* ignore */ }
    const slug = (selectedClass.slug || selectedClass.name || '').toLowerCase().trim();
    const mapped = CLASS_SPELLCASTING_DEFAULTS[slug];
    if (mapped) {
      isCaster = true;
      defaultTradition = mapped.tradition;
      defaultAbility = mapped.ability;
    }
  }

  const proficiency: ProficiencyRank = isCaster
    ? (level >= 19 ? 4 : level >= 15 ? 3 : level >= 7 ? 2 : 1)
    : 0;

  return {
    tradition: defaultTradition,
    ability: defaultAbility,
    proficiency,
    slotsMax: isCaster ? standardSlotsForLevel(level) : {},
    slotsUsed: {},
    signatureSpells: [],
  };
}

interface Props {
  spellcasting: CharacterSpellcastingState;
  attributes: Record<AttributeKey, number>;
  level: number;
  onChange: (next: CharacterSpellcastingState) => void;
}

export const SpellsSheetTab: React.FC<Props> = ({
  spellcasting,
  attributes,
  level,
  onChange,
}) => {
  const { t } = useI18n();
  const [spellbooks, setSpellbooks] = useState<Spellbook[]>([]);
  const [linkedSpells, setLinkedSpells] = useState<SpellItem[]>([]);

  useEffect(() => {
    let active = true;
    fetchSpellbooks()
      .then((list) => { if (active) setSpellbooks(list); })
      .catch(() => { /* ignore */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!spellcasting.spellbookId) {
      setLinkedSpells([]);
      return;
    }
    fetchSpellbookById(spellcasting.spellbookId)
      .then((sb) => {
        if (!active) return;
        const items = (sb.spells || []).filter((s): s is SpellItem => typeof s !== 'string');
        setLinkedSpells(items);
      })
      .catch(() => { if (active) setLinkedSpells([]); });
    return () => { active = false; };
  }, [spellcasting.spellbookId]);

  const abilityMod = attributes[spellcasting.ability] || 0;
  const profBonus = getProficiencyBonus(spellcasting.proficiency, level);
  const spellAttack = abilityMod + profBonus;
  const spellDc = 10 + spellAttack;

  const toggleSignature = (spellName: string) => {
    const exists = spellcasting.signatureSpells.includes(spellName);
    const next = exists
      ? spellcasting.signatureSpells.filter((s) => s !== spellName)
      : [...spellcasting.signatureSpells, spellName];
    onChange({ ...spellcasting, signatureSpells: next });
  };

  const setSlotMax = (rank: number, value: number) => {
    const clean = Math.max(0, Math.min(99, Math.floor(value) || 0));
    const currentUsed = spellcasting.slotsUsed[rank] || 0;
    onChange({
      ...spellcasting,
      slotsMax: { ...spellcasting.slotsMax, [rank]: clean },
      slotsUsed: { ...spellcasting.slotsUsed, [rank]: Math.min(currentUsed, clean) },
    });
  };

  const adjustSlotUsed = (rank: number, delta: number) => {
    const max = spellcasting.slotsMax[rank] || 0;
    const current = spellcasting.slotsUsed[rank] || 0;
    const next = Math.max(0, Math.min(max, current + delta));
    onChange({
      ...spellcasting,
      slotsUsed: { ...spellcasting.slotsUsed, [rank]: next },
    });
  };

  const ranksWithSpells = Array.from(new Set(linkedSpells.map((s) => s.rank))).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Spell Attack, Spell DC & Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-3 bg-inset border border-border-strong rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-text-secondary">{t('sheet.spells.attack')}</span>
          <span className="text-2xl font-black text-accent-text tabular-nums mt-1">{signed(spellAttack)}</span>
          <span className="text-[11px] text-text-muted tabular-nums">
            {attributeShort(t, spellcasting.ability)} ({signed(abilityMod)}) + {profBonus}
          </span>
        </div>

        <div className="lg:col-span-3 bg-inset border border-border-strong rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold text-text-secondary">{t('sheet.spells.dc')}</span>
          <span className="text-2xl font-black text-white tabular-nums mt-1">{spellDc}</span>
          <span className="text-[11px] text-text-muted tabular-nums">
            10 + {attributeShort(t, spellcasting.ability)} ({signed(abilityMod)}) + {profBonus}
          </span>
        </div>

        <div className="lg:col-span-6 bg-inset border border-border-strong rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1">
              {t('sheet.spells.tradition')}
            </label>
            <select
              value={spellcasting.tradition}
              onChange={(e) => onChange({ ...spellcasting, tradition: e.target.value })}
              className="w-full bg-control border border-border-strong rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
            >
              <option value="">—</option>
              <option value="arcane">{t('tradition.arcane')}</option>
              <option value="divine">{t('tradition.divine')}</option>
              <option value="occult">{t('tradition.occult')}</option>
              <option value="primal">{t('tradition.primal')}</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1">
              {t('sheet.spells.ability')}
            </label>
            <select
              value={spellcasting.ability}
              onChange={(e) => onChange({ ...spellcasting, ability: e.target.value as AttributeKey })}
              className="w-full bg-control border border-border-strong rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
            >
              {(['int', 'wis', 'cha'] as const).map((attr) => (
                <option key={attr} value={attr}>
                  {attributeShort(t, attr)} ({signed(attributes[attr] || 0)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-[11px] uppercase font-bold text-text-secondary block mb-1">
              {t('sheet.spells.proficiency')}
            </span>
            <ProficiencySelector
              label={t('sheet.spells.proficiency')}
              value={spellcasting.proficiency}
              onChange={(proficiency) => onChange({ ...spellcasting, proficiency })}
            />
          </div>
        </div>
      </div>

      {/* Spell Slots (Ranks 1–10) */}
      <div className="bg-inset border border-border-strong rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent-text" />
            <span>{t('sheet.spells.slots')}</span>
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...spellcasting, slotsMax: standardSlotsForLevel(level), slotsUsed: {} })}
              className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-control border border-border-strong text-[11px] font-bold text-accent-text transition-colors"
            >
              {t('sheet.spells.autoSlots', { level })}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...spellcasting, slotsUsed: {} })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated hover:bg-control border border-border-strong text-[11px] font-bold text-text-secondary hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('sheet.spells.restoreSlots')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => {
            const max = spellcasting.slotsMax[rank] || 0;
            const used = spellcasting.slotsUsed[rank] || 0;
            const remaining = Math.max(0, max - used);
            return (
              <div key={rank} className="bg-surface border border-border-subtle rounded-xl p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{t('sheet.spells.rankLabel', { rank })}</span>
                  <span className={`font-black tabular-nums ${remaining > 0 ? 'text-accent-text' : 'text-text-muted'}`}>
                    {remaining}/{max}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <label className="text-[11px] text-text-muted flex items-center gap-1">
                    <span>{t('sheet.spells.max')}</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={max}
                      onChange={(e) => setSlotMax(rank, Number(e.target.value))}
                      className="w-11 bg-inset border border-border-strong rounded px-1.5 py-0.5 text-xs text-white text-center tabular-nums"
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={remaining <= 0}
                      onClick={() => adjustSlotUsed(rank, 1)}
                      className="w-6 h-6 rounded bg-control hover:bg-control-hover disabled:opacity-40 text-white font-bold"
                      title="-1"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      disabled={used <= 0}
                      onClick={() => adjustSlotUsed(rank, -1)}
                      className="w-6 h-6 rounded bg-control hover:bg-control-hover disabled:opacity-40 text-white font-bold"
                      title="+1"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Signature Spells & Linked Spellbook */}
      <div className="bg-inset border border-border-strong rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
            <Star className="w-4 h-4 text-accent-text" />
            <span>{t('sheet.spells.signatureSpells')}</span>
          </h4>
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-accent-text" />
            <select
              value={spellcasting.spellbookId || ''}
              onChange={(e) => onChange({ ...spellcasting, spellbookId: e.target.value || undefined })}
              aria-label={t('sheet.spells.linkedSpellbook')}
              className="bg-control border border-border-strong rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
            >
              <option value="">{t('sheet.spells.noSpellbook')}</option>
              {spellbooks.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.name} ({sb.tradition})
                </option>
              ))}
            </select>
          </div>
        </div>

        {spellcasting.signatureSpells.length === 0 ? (
          <p className="text-xs text-text-muted italic">{t('sheet.spells.noSignature')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {spellcasting.signatureSpells.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleSignature(name)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/40 text-xs font-bold text-accent-text hover:bg-accent/25 transition-colors"
              >
                <Star className="w-3 h-3 fill-current" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        )}

        {linkedSpells.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border-subtle max-h-[260px] overflow-y-auto pr-1">
            {ranksWithSpells.map((rank) => {
              const items = linkedSpells.filter((s) => s.rank === rank);
              return (
                <div key={rank} className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-text-muted">
                    {rank === 0 ? t('sheet.spells.cantrips') : t('sheet.spells.rankLabel', { rank })}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {items.map((sp) => {
                      const isSig = spellcasting.signatureSpells.includes(sp.name);
                      return (
                        <div
                          key={sp.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs"
                        >
                          <span className="font-semibold text-white truncate">{sp.name}</span>
                          {rank > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleSignature(sp.name)}
                              title={t('sheet.spells.markSignature')}
                              className={`p-1 rounded transition-colors flex-shrink-0 ${
                                isSig
                                  ? 'text-accent-text bg-accent/15'
                                  : 'text-text-muted hover:text-white'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${isSig ? 'fill-current' : ''}`} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
