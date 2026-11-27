import { CharacterStrike, EquipmentItem, ProficiencyRank } from '../types/pf2e';

export interface WeaponStrikeData {
  dice: string;
  damageType: string;
  damageTypes: string[];
  itemBonus: number;
  traits: string[];
  rangeIncrement: number | null;
  strengthDamage: number;
  proficiency: ProficiencyRank | null;
}

/** `attackRanks` holds the character's current rank per weapon category (class base plus class features). */
export function calculateWeaponStrike(item: EquipmentItem, kind: CharacterStrike['kind'], strength: number, attackRanks: Partial<Record<string, ProficiencyRank>>): WeaponStrikeData | null {
  try {
    const system = JSON.parse(item.system_json);
    const baseTraits: string[] = Array.isArray(system.traits?.value) ? system.traits.value.filter((t: unknown): t is string => typeof t === 'string') : [];
    const meleeUsage = kind === 'melee' && baseTraits.includes('combination') ? system.meleeUsage : null;
    const damage = meleeUsage?.damage
      ? { dice: system.damage?.dice, die: meleeUsage.damage.die, damageType: meleeUsage.damage.type }
      : system.damage;
    if (!damage || !Number.isInteger(damage.dice) || damage.dice < 1 || typeof damage.die !== 'string' || !/^d\d+$/.test(damage.die)) return null;
    const traits: string[] = Array.isArray(meleeUsage?.traits)
      ? ['combination', ...meleeUsage.traits.filter((trait: unknown): trait is string => typeof trait === 'string')]
      : baseTraits;
    const thrownRange = traits.find(trait => /^thrown-\d+$/.test(trait));
    const rangeIncrement = kind !== 'ranged' ? null : Number.isSafeInteger(system.range) && system.range > 0
      ? Number(system.range)
      : thrownRange ? Number(thrownRange.slice('thrown-'.length)) : null;
    const typeMap: Record<string, string> = { bludgeoning: 'B', piercing: 'P', slashing: 'S' };
    const baseType: string = typeMap[damage.damageType] || damage.damageType || '';
    const damageTypes = [baseType, ...traits.filter(t => /^versatile-[bps]$/.test(t)).map(t => t.slice(-1).toUpperCase())].filter((value, index, array) => value && array.indexOf(value) === index);
    const striking = Number.isInteger(system.runes?.striking) && system.runes.striking > 0 ? system.runes.striking : 0;
    const itemBonus = Number.isInteger(system.runes?.potency) && system.runes.potency > 0 ? system.runes.potency : 0;
    const thrown = traits.some(t => t === 'thrown' || t.startsWith('thrown-'));
    const propulsive = traits.includes('propulsive');
    const strengthDamage = kind === 'melee' || thrown ? strength : propulsive ? (strength > 0 ? Math.floor(strength / 2) : strength) : 0;
    const proficiency: ProficiencyRank | null = typeof system.category === 'string' ? attackRanks[system.category] ?? null : null;
    return { dice: `${damage.dice + striking}${damage.die}`, damageType: baseType, damageTypes, itemBonus, traits, rangeIncrement, strengthDamage, proficiency };
  } catch { return null; }
}
