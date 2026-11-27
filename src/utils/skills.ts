import { BackgroundItem, ClassItem, LoreSkillEntry, SkillKey } from '../types/pf2e';
import { ALL_SKILLS } from './formatters';

const VALID_SKILL_SET = new Set<string>(ALL_SKILLS);

function toValidSkills(raw: unknown): SkillKey[] {
  if (!Array.isArray(raw)) return [];
  const result: SkillKey[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const normalized = item.toLowerCase().trim();
    if (VALID_SKILL_SET.has(normalized) && !result.includes(normalized as SkillKey)) {
      result.push(normalized as SkillKey);
    }
  }
  return result;
}

export interface BackgroundSkillInfo {
  fixed: SkillKey[];
  lore: string[];
}

export function parseBackgroundSkills(background: BackgroundItem | null): BackgroundSkillInfo {
  if (!background) return { fixed: [], lore: [] };
  let fixed: SkillKey[] = [];
  let lore: string[] = [];

  try {
    const sys = JSON.parse(background.system_json || '{}') as {
      trainedSkills?: { value?: unknown; lore?: unknown };
    };
    fixed = toValidSkills(sys.trainedSkills?.value);
    if (Array.isArray(sys.trainedSkills?.lore)) {
      lore = sys.trainedSkills.lore.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }
  } catch { /* fallback to column */ }

  if (fixed.length === 0 && background.skills) {
    try {
      fixed = toValidSkills(JSON.parse(background.skills));
    } catch { /* ignore */ }
  }

  return { fixed, lore };
}

export interface ClassSkillInfo {
  fixed: SkillKey[];
  additional: number;
  custom: string;
}

export function parseClassSkills(selectedClass: ClassItem | null): ClassSkillInfo {
  if (!selectedClass) return { fixed: [], additional: 0, custom: '' };
  try {
    const sys = JSON.parse(selectedClass.system_json || '{}') as {
      trainedSkills?: { value?: unknown; additional?: unknown; custom?: unknown };
    };
    const fixed = toValidSkills(sys.trainedSkills?.value);
    const additional = typeof sys.trainedSkills?.additional === 'number' ? sys.trainedSkills.additional : 0;
    const custom = typeof sys.trainedSkills?.custom === 'string' ? sys.trainedSkills.custom.trim() : '';
    return { fixed, additional, custom };
  } catch {
    return { fixed: [], additional: 0, custom: '' };
  }
}

export interface InitialSkillBudget {
  bgFixed: SkillKey[];
  bgLore: string[];
  classFixed: SkillKey[];
  classCustom: string;
  classAdditional: number;
  overlapCount: number;
  autoTrained: SkillKey[];
  freeBudget: number;
}

export function computeInitialSkillBudget(
  background: BackgroundItem | null,
  selectedClass: ClassItem | null,
  intMod: number
): InitialSkillBudget {
  const bg = parseBackgroundSkills(background);
  const cls = parseClassSkills(selectedClass);

  const autoTrained: SkillKey[] = [...bg.fixed];
  for (const skill of cls.fixed) {
    if (!autoTrained.includes(skill)) {
      autoTrained.push(skill);
    }
  }

  const overlapCount = bg.fixed.filter(s => cls.fixed.includes(s)).length;
  const freeBudget = selectedClass ? Math.max(0, cls.additional + intMod + overlapCount) : 0;

  return {
    bgFixed: bg.fixed,
    bgLore: bg.lore,
    classFixed: cls.fixed,
    classCustom: cls.custom,
    classAdditional: cls.additional,
    overlapCount,
    autoTrained,
    freeBudget,
  };
}

export function deriveDefaultLoreSkills(
  background: BackgroundItem | null,
  selectedClass: ClassItem | null
): LoreSkillEntry[] {
  const bg = parseBackgroundSkills(background);
  const cls = parseClassSkills(selectedClass);
  const names = [...bg.lore];
  if (cls.custom && !names.some(n => n.toLowerCase() === cls.custom.toLowerCase())) {
    names.push(cls.custom);
  }
  const entries: LoreSkillEntry[] = names.map((name, idx) => ({
    id: `lore_${idx}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name,
    rank: 1,
  }));
  if ((background?.slug || background?.name || '').toLowerCase() === 'scout') {
    entries.push({ id: 'lore_scout_terrain', name: '', rank: 1 });
  }
  return entries;
}
