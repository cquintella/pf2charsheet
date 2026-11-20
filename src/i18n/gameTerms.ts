import { AttributeKey, ProficiencyRank, SkillKey } from '../types/pf2e';
import { TranslateFn } from './Translator';

/** Localized names for PF2e game terms. Keys are built from typed unions, so a missing entry fails at compile time. */
export function attributeName(t: TranslateFn, attribute: AttributeKey): string {
  return t(`attr.${attribute}.name`);
}

export function attributeShort(t: TranslateFn, attribute: AttributeKey): string {
  return t(`attr.${attribute}.short`);
}

export function skillName(t: TranslateFn, skill: SkillKey): string {
  return t(`skill.${skill}`);
}

export function proficiencyName(t: TranslateFn, rank: ProficiencyRank): string {
  return t(`prof.${rank}`);
}

export function proficiencyShort(t: TranslateFn, rank: ProficiencyRank): string {
  return t(`prof.${rank}.short`);
}

/** Rank name with its bonus formula, e.g. "Trained (+2 + Lvl)". */
export function proficiencyWithBonus(t: TranslateFn, rank: ProficiencyRank): string {
  return t(`prof.${rank}.withBonus`);
}

export function toProficiencyRank(value: unknown): ProficiencyRank {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 ? value : 1;
}

/** Signed modifier: +2, +0, -1 (never "+-1"). */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

const RARITIES: readonly string[] = ['common', 'uncommon', 'rare', 'unique'];

/** Localized rarity; unknown values are shown as stored. */
export function rarityLabel(t: TranslateFn, rarity: string | undefined | null): string {
  const value = rarity || 'common';
  return RARITIES.includes(value) ? t(`rarity.${value as 'common' | 'uncommon' | 'rare' | 'unique'}`) : value;
}
