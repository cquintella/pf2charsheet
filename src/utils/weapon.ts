import { EquipmentItem } from '../types/pf2e';
import { MessageKey, TranslateFn } from '../i18n/Translator';

const DAMAGE_TYPE_KEYS: Record<string, MessageKey> = {
  bludgeoning: 'damage.bludgeoning', piercing: 'damage.piercing', slashing: 'damage.slashing',
  acid: 'damage.acid', cold: 'damage.cold', electricity: 'damage.electricity', fire: 'damage.fire',
  force: 'damage.force', mental: 'damage.mental', poison: 'damage.poison', sonic: 'damage.sonic',
  spirit: 'damage.spirit', vitality: 'damage.vitality', void: 'damage.void'
};

const ITEM_TYPE_KEYS: Record<string, MessageKey> = {
  weapon: 'itemType.weapon', armor: 'itemType.armor', shield: 'itemType.shield', equipment: 'itemType.equipment',
  consumable: 'itemType.consumable', ammo: 'itemType.ammo', backpack: 'itemType.backpack', treasure: 'itemType.treasure', kit: 'itemType.kit'
};

export const ITEM_TYPES: readonly string[] = Object.keys(ITEM_TYPE_KEYS);

/** Localized label for a compendium item type; unknown types are shown as stored. */
export function itemTypeLabel(t: TranslateFn, type: string): string {
  const key = ITEM_TYPE_KEYS[type];
  return key ? t(key) : type;
}

/** Localized base-damage line for a weapon, or null when the item is not a weapon. */
export function weaponDamage(item: EquipmentItem, t: TranslateFn): string | null {
  if (item.item_type !== 'weapon') return null;
  try {
    const data = JSON.parse(item.system_json);
    const damage = data.damage;
    if (!damage || !Number.isInteger(damage.dice) || damage.dice < 1 || typeof damage.die !== 'string' || !/^d\d+$/.test(damage.die)) return t('weapon.noDamage');
    const typeKey = typeof damage.damageType === 'string' ? DAMAGE_TYPE_KEYS[damage.damageType] : undefined;
    const type = typeKey ? t(typeKey) : typeof damage.damageType === 'string' ? damage.damageType : '';
    const striking = Number.isInteger(data.runes?.striking) && data.runes.striking > 0 ? t('weapon.striking', { dice: data.runes.striking }) : '';
    return t('weapon.baseDamage', { dice: `${damage.dice}${damage.die}${type ? ` ${type}` : ''}`, striking });
  } catch {
    return t('weapon.noDamage');
  }
}
