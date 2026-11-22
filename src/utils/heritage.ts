import { HeritageItem, VisionType } from '../types/pf2e';

const VISION_RANK: Record<VisionType, number> = {
  normal: 0,
  'low-light-vision': 1,
  darkvision: 2,
  'greater-darkvision': 3,
};

function parseHeritageRules(heritage: HeritageItem | null | undefined): Array<Record<string, unknown>> {
  if (!heritage?.system_json) return [];
  try {
    const sys = JSON.parse(heritage.system_json) as { rules?: unknown };
    return Array.isArray(sys.rules) ? (sys.rules as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

export function isVersatileHeritage(heritage: HeritageItem | null | undefined): boolean {
  return !heritage?.ancestry_slug;
}

/** Combine ancestry base vision with Sense rules granted by the selected heritage. */
export function resolveVisionWithHeritage(
  ancestryVision: VisionType,
  heritage: HeritageItem | null | undefined
): VisionType {
  let best = ancestryVision;
  const rules = parseHeritageRules(heritage);
  for (const rule of rules) {
    if (rule.key !== 'Sense' || typeof rule.selector !== 'string') continue;
    const predicate = Array.isArray(rule.predicate) ? rule.predicate : [];
    const requiresAncestryLowLight = predicate.includes('self:low-light-vision:from-ancestry');
    if (requiresAncestryLowLight && ancestryVision !== 'low-light-vision') continue;

    const selector = rule.selector as VisionType;
    if (selector in VISION_RANK && VISION_RANK[selector] > VISION_RANK[best]) {
      best = selector;
    }
  }
  return best;
}

/** Extract extra ancestry traits granted by a heritage (e.g. Aiuvarin -> elf + aiuvarin, Dromaar -> orc + dromaar). */
export function getHeritageExtraTraits(heritage: HeritageItem | null | undefined): string[] {
  if (!heritage) return [];
  const traits = new Set<string>();
  if (isVersatileHeritage(heritage) && heritage.slug) {
    traits.add(heritage.slug.toLowerCase());
  }
  const rules = parseHeritageRules(heritage);
  for (const rule of rules) {
    if (rule.key === 'ActorTraits' && Array.isArray(rule.add)) {
      rule.add.forEach((t) => {
        if (typeof t === 'string' && t.trim()) traits.add(t.trim().toLowerCase());
      });
    }
    if (
      rule.key === 'ActiveEffectLike' &&
      rule.path === 'system.details.ancestry.countsAs' &&
      typeof rule.value === 'string' &&
      rule.value.trim()
    ) {
      traits.add(rule.value.trim().toLowerCase());
    }
  }
  return Array.from(traits);
}

/** True when heritage grants a bonus Level 1 General Feat (e.g. Versatile Human). */
export function hasVersatileHumanGeneralFeat(heritage: HeritageItem | null | undefined): boolean {
  if (!heritage) return false;
  if (heritage.slug === 'versatile-human') return true;
  return parseHeritageRules(heritage).some(
    (rule) => rule.key === 'ChoiceSet' && rule.flag === 'versatileHeritage'
  );
}

/** True when heritage grants an extra trained skill (e.g. Skilled Human). */
export function hasSkilledHumanSkill(heritage: HeritageItem | null | undefined): boolean {
  if (!heritage) return false;
  if (heritage.slug === 'skilled-human') return true;
  return parseHeritageRules(heritage).some(
    (rule) =>
      rule.key === 'ChoiceSet' &&
      rule.choices &&
      typeof rule.choices === 'object' &&
      (rule.choices as Record<string, unknown>).config === 'skills'
  );
}
