import { CharacterStrike, ClassItem, EquipmentItem, ProficiencyRank } from '../types/pf2e';

export interface WeaponStrikeData {
  dice: string;
  damageType: string;
  damageTypes: string[];
  itemBonus: number;
  traits: string[];
  strengthDamage: number;
  proficiency: ProficiencyRank | null;
}

export function calculateWeaponStrike(item: EquipmentItem, kind: CharacterStrike['kind'], strength: number, characterClass: ClassItem | null): WeaponStrikeData | null {
  try {
    const system = JSON.parse(item.system_json);
    const damage = system.damage;
    if (!damage || !Number.isInteger(damage.dice) || damage.dice < 1 || typeof damage.die !== 'string' || !/^d\d+$/.test(damage.die)) return null;
    const traits: string[] = Array.isArray(system.traits?.value) ? system.traits.value.filter((t: unknown): t is string => typeof t === 'string') : [];
    const typeMap: Record<string, string> = { bludgeoning: 'B', piercing: 'P', slashing: 'S' };
    const baseType: string = typeMap[damage.damageType] || damage.damageType || '';
    const damageTypes = [baseType, ...traits.filter(t => /^versatile-[bps]$/.test(t)).map(t => t.slice(-1).toUpperCase())].filter((value, index, array) => value && array.indexOf(value) === index);
    const striking = Number.isInteger(system.runes?.striking) && system.runes.striking > 0 ? system.runes.striking : 0;
    const itemBonus = Number.isInteger(system.runes?.potency) && system.runes.potency > 0 ? system.runes.potency : 0;
    const thrown = traits.some(t => t === 'thrown' || t.startsWith('thrown-'));
    const propulsive = traits.includes('propulsive');
    const strengthDamage = kind === 'melee' || thrown ? strength : propulsive ? (strength > 0 ? Math.floor(strength / 2) : strength) : 0;
    let proficiency: ProficiencyRank | null = null;
    try {
      const attacks = JSON.parse(characterClass?.attacks || '{}');
      const rank = attacks[system.category];
      if (Number.isInteger(rank) && rank >= 0 && rank <= 4) proficiency = rank as ProficiencyRank;
    } catch { /* Proficiência não disponível para esta classe. */ }
    return { dice: `${damage.dice + striking}${damage.die}`, damageType: baseType, damageTypes, itemBonus, traits, strengthDamage, proficiency };
  } catch { return null; }
}
