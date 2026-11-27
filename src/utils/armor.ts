import { InventoryEntry, ProficiencyRank } from '../types/pf2e';
import { getProficiencyBonus } from './formatters';
import { MessageKey } from '../i18n/Translator';

export interface ArmorClassResult {
  value: number;
  /** Equipped armor name, or null when unarmored (the UI shows a localized label). */
  armorName: string | null;
  /** Message keys describing incomplete data; translated by the caller. */
  warnings: MessageKey[];
}

/** `defenseRanks` holds the character's current rank per armor category (class base plus class features). */
export function calculateArmorClass(dexterity: number, level: number, defenseRanks: Partial<Record<string, ProficiencyRank>>, items: InventoryEntry[]): ArmorClassResult {
  const armor = items.find(entry => entry.equipped && entry.item.item_type === 'armor');
  let category = 'unarmored';
  let armorBonus = 0;
  let dexterityBonus = dexterity;
  const warnings: MessageKey[] = [];
  if (armor) {
    try {
      const data = JSON.parse(armor.item.system_json);
      if (!['unarmored', 'light', 'medium', 'heavy'].includes(data.category) || typeof data.acBonus !== 'number' || typeof data.dexCap !== 'number') throw new Error('Invalid armor');
      category = data.category;
      dexterityBonus = Math.min(dexterity, data.dexCap);
      armorBonus = data.acBonus + (typeof data.runes?.potency === 'number' ? data.runes.potency : 0);
    } catch {
      warnings.push('armor.incompleteData');
    }
  }
  let rank = 0;
  const value = defenseRanks[category];
  if (value === undefined) warnings.push('armor.missingProficiency');
  else rank = value;
  return { value: 10 + dexterityBonus + armorBonus + getProficiencyBonus(rank as ProficiencyRank, level), armorName: armor?.item.name || null, warnings };
}
