/**
 * Utilitários de formatação e resolução de recursos do sistema PF2e.
 * Nomes exibidos ao usuário ficam em src/i18n; aqui ficam só os nomes em inglês usados pelas regras.
 */

import { AttributeKey, SkillKey, ProficiencyRank } from '../types/pf2e';

export const ALL_ATTRIBUTES: AttributeKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ATTRIBUTE_INFO: Record<AttributeKey, { nameEn: string; shortEn: string; color: string }> = {
  str: { nameEn: 'Strength', shortEn: 'STR', color: '#e74c3c' },
  dex: { nameEn: 'Dexterity', shortEn: 'DEX', color: '#2ecc71' },
  con: { nameEn: 'Constitution', shortEn: 'CON', color: '#e67e22' },
  int: { nameEn: 'Intelligence', shortEn: 'INT', color: '#3498db' },
  wis: { nameEn: 'Wisdom', shortEn: 'WIS', color: '#9b59b6' },
  cha: { nameEn: 'Charisma', shortEn: 'CHA', color: '#f1c40f' }
};

export const ALL_SKILLS: SkillKey[] = [
  'acrobatics',
  'arcana',
  'athletics',
  'crafting',
  'deception',
  'diplomacy',
  'intimidation',
  'medicine',
  'nature',
  'occultism',
  'performance',
  'religion',
  'society',
  'stealth',
  'survival',
  'thievery'
];

export const SKILL_INFO: Record<SkillKey, { nameEn: string; attribute: AttributeKey }> = {
  acrobatics: { nameEn: 'Acrobatics', attribute: 'dex' },
  arcana: { nameEn: 'Arcana', attribute: 'int' },
  athletics: { nameEn: 'Athletics', attribute: 'str' },
  crafting: { nameEn: 'Crafting', attribute: 'int' },
  deception: { nameEn: 'Deception', attribute: 'cha' },
  diplomacy: { nameEn: 'Diplomacy', attribute: 'cha' },
  intimidation: { nameEn: 'Intimidation', attribute: 'cha' },
  medicine: { nameEn: 'Medicine', attribute: 'wis' },
  nature: { nameEn: 'Nature', attribute: 'wis' },
  occultism: { nameEn: 'Occultism', attribute: 'int' },
  performance: { nameEn: 'Performance', attribute: 'cha' },
  religion: { nameEn: 'Religion', attribute: 'wis' },
  society: { nameEn: 'Society', attribute: 'int' },
  stealth: { nameEn: 'Stealth', attribute: 'dex' },
  survival: { nameEn: 'Survival', attribute: 'wis' },
  thievery: { nameEn: 'Thievery', attribute: 'dex' }
};

export function getProficiencyBonus(rank: ProficiencyRank, level: number): number {
  if (rank === 0) return 0;
  if (rank === 1) return 2 + level;
  if (rank === 2) return 4 + level;
  if (rank === 3) return 6 + level;
  if (rank === 4) return 8 + level;
  return 0;
}

export function resolveSpellIcon(img: string | undefined): string {
  if (!img || img.trim() === '') {
    return '/assets/icons/default-icons/spell.svg';
  }
  return img
    .replace('systems/pf2e/icons/', '/assets/icons/')
    .replace(/^icons\//, '/assets/icons/');
}

export function resolvePf2eIcon(img: string | undefined, defaultIcon: string = '/assets/icons/default-icons/mystery-man.svg'): string {
  if (!img || img.trim() === '') {
    return defaultIcon;
  }
  return img
    .replace('systems/pf2e/icons/', '/assets/icons/')
    .replace(/^icons\//, '/assets/icons/');
}

import { FormulaContext, formatFoundryInlineTokens } from './foundryFormula';

export function cleanDescriptionHtml(html: string, ctx: FormulaContext = {}): string {
  if (!html) return '';
  return formatFoundryInlineTokens(html, ctx, true);
}

export function cleanSnippetText(html: string, ctx: FormulaContext = {}): string {
  if (!html) return '';
  return formatFoundryInlineTokens(html, ctx, false)
    .replace(/<hr\s*\/?>/gi, ' — ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}
