import { ClassItem, InventoryEntry, ProficiencyRank } from '../types/pf2e';
import { getProficiencyBonus } from './formatters';
import { MessageKey } from '../i18n/Translator';

export interface ArmorClassResult {
  value: number;
  /** Equipped armor name, or null when unarmored (the UI shows a localized label). */
  armorName: string | null;
  /** Message keys describing incomplete data; translated by the caller. */
  warnings: MessageKey[];
}

export function calculateArmorClass(dexterity: number, level: number, characterClass: ClassItem | null, items: InventoryEntry[]): ArmorClassResult {
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
  try {
    const defenses = JSON.parse(characterClass?.defenses || '{}');
    const value = defenses[category];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 4) throw new Error('Missing proficiency');
    rank = value;
  } catch {
    warnings.push('armor.missingProficiency');
  }
  return { value: 10 + dexterityBonus + armorBonus + getProficiencyBonus(rank as ProficiencyRank, level), armorName: armor?.item.name || null, warnings };
}
