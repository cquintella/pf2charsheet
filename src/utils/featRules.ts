import { AttributeKey, FeatSelectionRecord, ProficiencyRank, SkillKey } from '../types/pf2e';
import { ALL_ATTRIBUTES, ALL_SKILLS, ATTRIBUTE_INFO, SKILL_INFO } from './formatters';

export interface RuleContext {
  attributes: Record<AttributeKey, number>;
  skills: Record<SkillKey, ProficiencyRank>;
  feats: FeatSelectionRecord[];
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
    if (/^[\w'’ -]+ Dedication$/i.test(text)) {
      return { text, status: context.feats.some(f => f.featName.toLowerCase() === text.toLowerCase()) ? 'met' : 'unmet' };
    }
    return { text, status: 'unknown' };
  });
}

// Apply only unconditional, numeric minimum skill ranks. Other Foundry rules need dedicated handlers.
export function applyFeatSkillEffects(feat: FeatSelectionRecord, ranks: Record<SkillKey, ProficiencyRank>): void {
  if (!feat.system_json) return;
  let system: unknown;
  try { system = JSON.parse(feat.system_json); } catch { return; }
  if (!system || typeof system !== 'object' || !('rules' in system) || !Array.isArray(system.rules)) return;
  for (const rule of system.rules) {
    if (!rule || typeof rule !== 'object' || rule.key !== 'ActiveEffectLike' || rule.mode !== 'upgrade' || rule.predicate !== undefined || typeof rule.path !== 'string' || !Number.isInteger(rule.value) || rule.value < 1 || rule.value > 4) continue;
    const match = /^system\.skills\.([a-z]+)\.rank$/.exec(rule.path);
    const skill = match && ALL_SKILLS.find(s => s === match[1]);
    if (skill) ranks[skill] = Math.max(ranks[skill], rule.value) as ProficiencyRank;
  }
}
