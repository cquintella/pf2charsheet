import { AttributeKey } from '../types/pf2e';

/** Key attribute granted by each psychic subconscious mind (lowercase name). */
export const PSYCHIC_MIND_ATTRIBUTES: Readonly<Record<string, AttributeKey>> = {
  'gathered lore': 'int',
  'precise discipline': 'int',
  'emotional acceptance': 'cha',
  'wandering reverie': 'cha',
};

/** Extract standard and level-unlocked unique psi cantrip names from a conscious mind description. */
export function parseConsciousMindCantrips(description: string, level: number): {
  standardCantrips: string[];
  uniqueCantrips: string[];
} {
  const standardSection = description.split('<strong>Standard Psi Cantrips</strong>')[1]?.split('<strong>Unique Psi Cantrips</strong>')[0] || '';
  const standardCantrips = Array.from(standardSection.matchAll(/@UUID\[Compendium\.pf2e\.spells-srd\.Item\.[^\]]+\]\{([^}]+)\}/g)).map(match => match[1]);
  const uniqueSection = description.split('<strong>Unique Psi Cantrips</strong>')[1] || '';
  const uniqueCantrips = Array.from(uniqueSection.matchAll(/(surface|deeper|deepest):\s*@UUID\[Compendium\.pf2e\.spells-srd\.Item\.[^\]]+\]\{([^}]+)\}/gi))
    .filter(match => level >= (match[1].toLowerCase() === 'deepest' ? 10 : match[1].toLowerCase() === 'deeper' ? 6 : 1))
    .map(match => match[2]);
  return { standardCantrips, uniqueCantrips };
}

/** Psychic spell slots from Dark Archive, including Infinite Mind at level 19. */
export function psychicSlotsForLevel(level: number): Record<number, number> {
  const slots: Record<number, number> = {};
  for (let rank = 1; rank <= Math.min(9, Math.ceil(level / 2)); rank++) {
    slots[rank] = level >= rank * 2 ? 2 : 1;
  }
  if (level >= 19) slots[10] = 1;
  return slots;
}

/** Update default slots while retaining manually edited values and expended slots. */
export function advancePsychicSlots(existing: Record<number, number>, previousLevel: number, nextLevel: number): Record<number, number> {
  const previous = psychicSlotsForLevel(previousLevel);
  const next = psychicSlotsForLevel(nextLevel);
  const result = { ...existing };
  for (const [rankText, amount] of Object.entries(next)) {
    const rank = Number(rankText);
    if (existing[rank] === undefined || existing[rank] === previous[rank]) result[rank] = amount;
  }
  for (const rankText of Object.keys(previous)) {
    const rank = Number(rankText);
    if (next[rank] === undefined && existing[rank] === previous[rank]) delete result[rank];
  }
  return result;
}
