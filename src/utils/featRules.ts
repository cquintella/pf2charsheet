import { AttributeKey, FeatSelectionRecord, ProficiencyRank, SkillKey } from '../types/pf2e';
import { ALL_ATTRIBUTES, ALL_SKILLS, ATTRIBUTE_INFO, SKILL_INFO } from './formatters';

export interface RuleContext {
  attributes: Record<AttributeKey, number>;
  skills: Record<SkillKey, ProficiencyRank>;
  feats: FeatSelectionRecord[];
  orderNames?: string[];
  incompleteOrders?: boolean;
  heritageName?: string;
}
/** `unreadable` marks entries whose text could not be parsed; the UI shows a localized label instead of `text`. */
export interface RequirementResult { text: string; status: 'met' | 'unmet' | 'unknown'; unreadable?: boolean }

export function evaluatePrerequisites(raw: string, context: RuleContext): RequirementResult[] {
  let entries: unknown;
  try { entries = JSON.parse(raw || '[]'); } catch { return [{ text: '', status: 'unknown', unreadable: true }]; }
  if (!Array.isArray(entries)) return [{ text: '', status: 'unknown', unreadable: true }];
  return entries.map((entry: unknown): RequirementResult => {
    const text = typeof entry === 'string' ? entry : (entry && typeof entry === 'object' && 'value' in entry && typeof entry.value === 'string' ? entry.value : null);
    if (text === null) return { text: '', status: 'unknown', unreadable: true };
    const attribute = text.match(/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*\+(\d+)$/i);
    if (attribute) {
      const key = ALL_ATTRIBUTES.find(k => ATTRIBUTE_INFO[k].nameEn.toLowerCase() === attribute[1].toLowerCase());
      if (key) return { text, status: context.attributes[key] >= Number(attribute[2]) ? 'met' : 'unmet' };
    }
    const skill = text.match(/^(trained|expert|master|legendary) in (.+)$/i);
    if (skill) {
      const key = ALL_SKILLS.find(k => SKILL_INFO[k].nameEn.toLowerCase() === skill[2].toLowerCase());
      const rank = ['trained', 'expert', 'master', 'legendary'].indexOf(skill[1].toLowerCase()) + 1;
      if (key) return { text, status: context.skills[key] >= rank ? 'met' : 'unmet' };
    }
    const normalized = text.trim().toLowerCase();
    if (context.heritageName !== undefined && ['crystal elf heritage', 'psi-forged heritage'].includes(normalized)) {
      return { text, status: normalized === `${context.heritageName.trim().toLowerCase()} heritage` ? 'met' : 'unmet' };
    }
    if (context.feats.some(feat => feat.featName.toLowerCase() === normalized)) return { text, status: 'met' };
    if (context.orderNames && /\border\b/.test(normalized)) {
      const alternatives = normalized.split(/\s+or\s+/);
      const orderNames = new Set(context.orderNames.map(name => name.toLowerCase()));
      const statuses = alternatives.map(alternative => {
        if (context.feats.some(feat => feat.featName.toLowerCase() === alternative)) return 'met';
        const match = alternative.match(/^((?:(?:animal|cultivation|flame|leaf|spore|stone|storm|untamed|wave)\s+)+)order$/);
        if (!match) {
          const sharesOrderSuffix = alternatives.length > 1 && alternatives.at(-1)?.endsWith(' order');
          if (!sharesOrderSuffix || !/^(?:(?:animal|cultivation|flame|leaf|spore|stone|storm|untamed|wave)\s*)+$/.test(alternative)) return 'unknown';
        }
        const words = (match?.[1] || alternative).trim().split(/\s+/);
        if (words.some(word => orderNames.has(`${word} order`))) return 'met';
        return context.incompleteOrders ? 'unknown' : 'unmet';
      });
      if (statuses.includes('met')) return { text, status: 'met' };
      return { text, status: statuses.includes('unknown') ? 'unknown' : 'unmet' };
    }
    if (/^[\w'’ -]+ dedication$/i.test(normalized) || normalized === 'order explorer') {
      return { text, status: 'unmet' };
    }
    return { text, status: 'unknown' };
  });
}

function evalLevelFormula(raw: unknown, actorLevel: number): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (/^\d+$/.test(text)) return Number(text);
  const match = /^ternary\(\s*gte\(\s*@actor\.level\s*,\s*(\d+)\s*\)\s*,\s*([^,]+)\s*,\s*(.+)\s*\)$/.exec(text);
  if (!match) return null;
  const threshold = Number(match[1]);
  return evalLevelFormula(actorLevel >= threshold ? match[2] : match[3], actorLevel);
}

// Extract unconditional, numeric (or level-ternary) minimum skill rank upgrades from a feat or feature.
export function extractFeatSkillGrants(feat: FeatSelectionRecord, actorLevel = 1): { skill: SkillKey; rank: ProficiencyRank }[] {
  if (!feat.system_json) return [];
  let system: unknown;
  try { system = JSON.parse(feat.system_json); } catch { return []; }
  if (!system || typeof system !== 'object' || !('rules' in system) || !Array.isArray(system.rules)) return [];
  const result: { skill: SkillKey; rank: ProficiencyRank }[] = [];
  for (const rule of system.rules) {
    if (!rule || typeof rule !== 'object' || rule.key !== 'ActiveEffectLike' || rule.mode !== 'upgrade' || rule.predicate !== undefined || typeof rule.path !== 'string') continue;
    const rank = evalLevelFormula(rule.value, actorLevel);
    if (rank === null || rank < 1 || rank > 4) continue;
    const match = /^system\.skills\.([a-z]+)\.rank$/.exec(rule.path);
    const skill = match && ALL_SKILLS.find(s => s === match[1]);
    if (skill) result.push({ skill, rank: rank as ProficiencyRank });
  }
  return result;
}

function upgradeTrainedOrExpert(ranks: Record<SkillKey, ProficiencyRank>, skill: SkillKey): void {
  const target = ranks[skill] >= 1 ? 2 : 1;
  ranks[skill] = Math.max(ranks[skill], target) as ProficiencyRank;
}

// Apply unconditional skill ranks, level-scaled upgrades, dedication-specific skill upgrades, and saved choices.
export function applyFeatSkillEffects(feat: FeatSelectionRecord, ranks: Record<SkillKey, ProficiencyRank>, actorLevel = 1): void {
  for (const { skill, rank } of extractFeatSkillGrants(feat, actorLevel)) {
    ranks[skill] = Math.max(ranks[skill], rank) as ProficiencyRank;
  }
  if (feat.featId === '4M5zIlJ8EvjQDtg9' || feat.featName === 'Dandy Dedication') {
    upgradeTrainedOrExpert(ranks, 'deception');
    upgradeTrainedOrExpert(ranks, 'society');
  } else if (feat.featId === 'UyyrFtPWOo0qvXOv' || feat.featName === 'Zephyr Guard Dedication') {
    upgradeTrainedOrExpert(ranks, 'society');
  } else if (feat.featId === 'pI97a5xSg4LbBY1g' || feat.featName === 'Aldori Duelist Dedication') {
    const chosen = ALL_SKILLS.find(s => s === feat.choices?.skillChoice);
    if (chosen) upgradeTrainedOrExpert(ranks, chosen);
    return;
  }
  if (feat.choices) {
    for (const [key, value] of Object.entries(feat.choices)) {
      if (key !== 'skillChoice' && key !== 'extraSkillChoice' && !key.startsWith('skillReplacement:')) continue;
      const skill = ALL_SKILLS.find(s => s === value);
      if (skill) ranks[skill] = Math.max(ranks[skill], 1) as ProficiencyRank;
    }
  }
}
