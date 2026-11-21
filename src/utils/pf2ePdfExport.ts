import { PDFDocument } from 'pdf-lib';
import {
  ALL_ATTRIBUTES,
  ALL_SKILLS,
  SKILL_INFO,
  getProficiencyBonus,
} from './formatters';
import {
  AttributeKey,
  CharacterCompanion,
  CharacterInventory,
  CharacterSpellcastingState,
  CharacterStrike,
  LevelProgressionData,
  ProficiencyRank,
  SkillKey,
  VisionType,
} from '../types/pf2e';
import { SessionState } from './conditions';
import { resolvePortraitSrc } from './portrait';

export interface PdfExportPayload {
  charName: string;
  level: number;
  ancestryName: string;
  backgroundName: string;
  className: string;
  portrait?: string;
  vision: VisionType;
  senses: string;
  attributes: Record<AttributeKey, number>;
  maxHp: number;
  ac: number;
  acProfRank: ProficiencyRank;
  acItemBonus: number;
  fortitude: { total: number; profRank: ProficiencyRank };
  reflex: { total: number; profRank: ProficiencyRank };
  will: { total: number; profRank: ProficiencyRank };
  perception: { total: number; profRank: ProficiencyRank };
  speed: number;
  skillRanks: Record<SkillKey, ProficiencyRank>;
  strikes: CharacterStrike[];
  levelData: Record<number, LevelProgressionData>;
  inventory: CharacterInventory;
  session: SessionState;
  companions: CharacterCompanion[];
  spellcasting?: CharacterSpellcastingState;
}

const RANK_SUFFIXES: readonly { rank: ProficiencyRank; suffix: string }[] = [
  { rank: 1, suffix: 'TRAINED' },
  { rank: 2, suffix: 'EXPERT' },
  { rank: 3, suffix: 'MASTER' },
  { rank: 4, suffix: 'LEGENDARY' },
];

const PDF_SKILL_PREFIX: Partial<Record<SkillKey, string>> = {
  acrobatics: 'ACROBATICS',
  arcana: 'ARCANA',
  athletics: 'ATHLETICS',
  crafting: 'CRAFTING',
  deception: 'DECEPTION',
  diplomacy: 'DIPLOMACY',
  intimidation: 'INTIMIDATION',
  medicine: 'MEDICINE',
  nature: 'NATURE',
  occultism: 'OCCULTISM',
  performance: 'PERFORMANCE',
  religion: 'RELIGION',
  society: 'SOCIETY',
  stealth: 'STEALTH',
  survival: 'SURVIVAL',
  thievery: 'THIEVERY',
};

function signedStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

async function loadImageAsPngBytes(src: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 256;
        canvas.height = img.naturalHeight || img.height || 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(null); return; }
          blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(() => resolve(null));
        }, 'image/png');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function exportCharacterToFillablePdf(data: PdfExportPayload): Promise<void> {
  const pdfUrl =
    typeof window !== 'undefined' && window.location.protocol === 'file:'
      ? './assets/pf2e-sheet-fillable.pdf'
      : '/assets/pf2e-sheet-fillable.pdf';

  const res = await fetch(pdfUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch fillable PDF template (${res.status})`);
  }

  const templateBytes = await res.arrayBuffer();
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form = doc.getForm();

  const setText = (fieldName: string, value: string | number) => {
    try {
      form.getTextField(fieldName).setText(String(value));
    } catch {
      /* Field absent in template */
    }
  };

  const checkRankBoxes = (prefix: string, rank: ProficiencyRank) => {
    for (const item of RANK_SUFFIXES) {
      try {
        const box = form.getCheckBox(`${prefix} ${item.suffix}`);
        if (rank >= item.rank) box.check();
        else box.uncheck();
      } catch {
        /* Field absent in template */
      }
    }
  };

  // 1. Identity
  setText('Character Name', data.charName);
  setText('Level', data.level);
  setText('Ancestry', data.ancestryName);
  setText('Background1', data.backgroundName);
  setText('Class', data.className);

  // 2. Attributes (Score + Mod)
  const attrScoreFields: Record<AttributeKey, string> = {
    str: 'STRENGTH',
    dex: 'DEXTERITY',
    con: 'CONSTITUTION',
    int: 'INTELLIGENCE',
    wis: 'WISDOM',
    cha: 'CHARISMA',
  };
  const attrModFields: Record<AttributeKey, string> = {
    str: 'STR Mod',
    dex: 'DEX Mod',
    con: 'CON Mod',
    int: 'INT Mod',
    wis: 'WIS Mod',
    cha: 'CHA Mod',
  };
  ALL_ATTRIBUTES.forEach((attr) => {
    const mod = data.attributes[attr];
    setText(attrScoreFields[attr], 10 + mod * 2);
    setText(attrModFields[attr], signedStr(mod));
  });

  // 3. HP & Session
  setText('Max HP', data.maxHp);
  setText('CURRENT', data.session.currentHp ?? data.maxHp);
  setText('TEMPORARY', data.session.tempHp || '');
  setText('DYING', data.session.dying || '');
  setText('WOUNDED', data.session.wounded || '');
  setText('Hero Point', data.session.heroPoints);

  const activeConditions: string[] = [];
  if (data.session.conditions.offGuard) activeConditions.push('Off-Guard');
  (Object.entries(data.session.conditions) as [string, unknown][]).forEach(([k, v]) => {
    if (k !== 'offGuard' && typeof v === 'number' && v > 0) {
      activeConditions.push(`${k} ${v}`);
    }
  });
  if (activeConditions.length > 0) {
    setText('CONDITIONS', activeConditions.join(', '));
  }

  // 4. AC & Saving Throws
  const acProfBonus = getProficiencyBonus(data.acProfRank, data.level);
  setText('AC', data.ac);
  setText('AC DEX Mod', signedStr(data.attributes.dex));
  setText('AC PROF', signedStr(acProfBonus));
  setText('AC ITEM', signedStr(data.acItemBonus));
  checkRankBoxes('AC', data.acProfRank);

  const setSave = (
    prefix: string,
    attr: AttributeKey,
    saveData: { total: number; profRank: ProficiencyRank }
  ) => {
    setText(`${prefix} Mod`, signedStr(saveData.total));
    setText(`${prefix} ABILITY`, signedStr(data.attributes[attr]));
    setText(`${prefix} PROF`, signedStr(getProficiencyBonus(saveData.profRank, data.level)));
    checkRankBoxes(prefix, saveData.profRank);
  };
  setSave('FORT', 'con', data.fortitude);
  setSave('REFLEX', 'dex', data.reflex);
  setSave('WILL', 'wis', data.will);

  // 5. Perception, Speed & Senses
  setText('PERCEPTION Mod', signedStr(data.perception.total));
  setText('PERCEPTION ABILITY', signedStr(data.attributes.wis));
  setText('PERCEPTION PROF', signedStr(getProficiencyBonus(data.perception.profRank, data.level)));
  checkRankBoxes('PERCEPTION', data.perception.profRank);
  setText('SPEED', `${data.speed} ft.`);

  const visionLabel =
    data.vision === 'normal' ? 'Normal Vision' : data.vision.replace(/-/g, ' ');
  setText('SENSES', [visionLabel, data.senses].filter(Boolean).join(', '));

  // 6. Skills
  ALL_SKILLS.forEach((skill) => {
    const prefix = PDF_SKILL_PREFIX[skill];
    if (!prefix) return;
    const rank = (data.skillRanks[skill] ?? 0) as ProficiencyRank;
    const attrKey = SKILL_INFO[skill].attribute;
    const abilityMod = data.attributes[attrKey];
    const profBonus = getProficiencyBonus(rank, data.level);
    setText(`${prefix} Mod`, signedStr(abilityMod + profBonus));
    setText(`${prefix} ABILITY`, signedStr(abilityMod));
    setText(`${prefix} PROF`, signedStr(profBonus));
    checkRankBoxes(prefix, rank);
  });

  // 7. Strikes (Melee top 3, Ranged top 3)
  const melee = data.strikes.filter((s) => s.kind === 'melee').slice(0, 3);
  const ranged = data.strikes.filter((s) => s.kind === 'ranged').slice(0, 3);
  const meleeSlots = [
    { name: 'Weapon', dice: 'DICE', str: 'STR_2', traits: 'TRAITS' },
    { name: 'Weapon_2', dice: 'DICE_2', str: 'STR_5', traits: 'TRAITS_2' },
    { name: 'Weapon_3', dice: 'DICE_3', str: 'STR_7', traits: 'TRAITS_3' },
  ];
  const rangedSlots = [
    { name: 'Weapon_4', dice: 'DICE_4', spec: 'SPECIAL', traits: 'TRAITS_4' },
    { name: 'Weapon_5', dice: 'DICE_5', spec: 'SPECIAL_2', traits: 'TRAITS_5' },
    { name: 'Weapon_6', dice: 'DICE_6', spec: 'SPECIAL_3', traits: 'TRAITS_6' },
  ];

  melee.forEach((s, idx) => {
    const slot = meleeSlots[idx];
    const totalAtk = data.attributes[s.attribute] + getProficiencyBonus(s.proficiency, data.level) + s.itemBonus;
    setText(slot.name, `${s.weapon} (${signedStr(totalAtk)})`);
    setText(slot.dice, `${s.dice} ${s.damageType}`);
    setText(slot.str, signedStr(s.strengthDamage));
    setText(slot.traits, s.traits);
  });

  ranged.forEach((s, idx) => {
    const slot = rangedSlots[idx];
    const totalAtk = data.attributes[s.attribute] + getProficiencyBonus(s.proficiency, data.level) + s.itemBonus;
    setText(slot.name, `${s.weapon} (${signedStr(totalAtk)})`);
    setText(slot.dice, `${s.dice} ${s.damageType}`);
    setText(slot.spec, signedStr(s.otherDamage));
    setText(slot.traits, s.traits);
  });

  // 8. Feats across levels
  const archetypeFeats: string[] = [];
  for (let lvl = 1; lvl <= data.level; lvl++) {
    const feats = data.levelData[lvl]?.feats || {};
    Object.entries(feats).forEach(([slotId, feat]) => {
      if (slotId.startsWith('ancestry_')) setText(`ANCESTRY ${lvl}`, feat.featName);
      else if (slotId.startsWith('skill_')) setText(`SKILL FEAT ${lvl}`, feat.featName);
      else if (slotId.startsWith('general_')) setText(`GENERAL FEAT ${lvl}`, feat.featName);
      else if (slotId.startsWith('class_')) setText(`CLASS FEAT ${lvl}`, feat.featName);
      else if (slotId.startsWith('archetype_')) archetypeFeats.push(`Lv ${lvl}: ${feat.featName}`);
    });
  }
  if (archetypeFeats[0]) setText('BONUS FEAT 1', archetypeFeats[0]);
  if (archetypeFeats[1]) setText('BONUS FEAT 2', archetypeFeats[1]);

  // 9. Inventory & Coins
  setText('COPPER PIECES', data.inventory.coins.cp);
  setText('SILVER PIECES', data.inventory.coins.sp);
  setText('GOLD PIECES', data.inventory.coins.gp);
  setText('PLATINUM PIECES', data.inventory.coins.pp);

  data.inventory.items.slice(0, 19).forEach((entry, idx) => {
    const label = entry.quantity > 1 ? `${entry.item.name} (x${entry.quantity})` : entry.item.name;
    setText(`WORN ITEM NAME.${idx}`, label);
    setText(`WORN ITEM BULK.${idx}`, entry.item.bulk || '');
    try {
      const box = form.getCheckBox(`WORN ITEM INVESTED.${idx}`);
      if (entry.equipped) box.check();
      else box.uncheck();
    } catch {
      /* ignore */
    }
  });

  // 10. Notes / Companions / Extra Archetype Feats
  const noteSections: string[] = [];
  if (archetypeFeats.length > 2) {
    noteSections.push(`Free Archetype:\n${archetypeFeats.slice(2).join('\n')}`);
  }
  if (data.companions.length > 0) {
    const compLines = data.companions.map(
      (c) =>
        `${c.name} (${c.kind}${c.species ? `, ${c.species}` : ''}, Lv ${c.level}) — HP ${c.currentHp}/${c.maxHp}, AC ${c.ac}, Fort ${signedStr(c.fortitude)}, Ref ${signedStr(c.reflex)}, Will ${signedStr(c.will)}, Perc ${signedStr(c.perception)}, Speed ${c.speed} ft.${c.attacks ? `\nAttacks: ${c.attacks}` : ''}${c.support ? `\nSupport: ${c.support}` : ''}`
    );
    noteSections.push(`Companions:\n${compLines.join('\n\n')}`);
  }
  if (noteSections.length > 0) {
    setText('NOTES_2', noteSections.join('\n\n'));
  }

  // 11. Spellcasting (Spell Attack, Spell DC, Spell Slots)
  if (data.spellcasting && data.spellcasting.proficiency > 0) {
    const sc = data.spellcasting;
    const scAbilityMod = data.attributes[sc.ability] || 0;
    const scProfBonus = getProficiencyBonus(sc.proficiency, data.level);
    const spellAttack = scAbilityMod + scProfBonus;
    const spellDc = 10 + spellAttack;

    setText('SPELL ATTACK MOD', signedStr(spellAttack));
    setText('SPELL ATTACK ABILITY', signedStr(scAbilityMod));
    setText('SPELL ATTACK PROF', signedStr(scProfBonus));
    checkRankBoxes('SPELL ATTACK', sc.proficiency);

    setText('SPELL DC Mod', spellDc);
    setText('SPELL DC ABILITY', signedStr(scAbilityMod));
    setText('SPELL DC PROF', signedStr(scProfBonus));
    checkRankBoxes('SPELL DC', sc.proficiency);

    for (let rank = 1; rank <= 10; rank++) {
      const maxSlots = sc.slotsMax[rank] || 0;
      const usedSlots = sc.slotsUsed[rank] || 0;
      if (maxSlots > 0) {
        setText(`SPELL SLOTS ${rank}`, maxSlots);
        setText(`SPELL SLOTS REMAINING ${rank}`, Math.max(0, maxSlots - usedSlots));
      }
    }
  }

  // 12. Embed Portrait Image into Page 3 (Image163_af_image)
  const resolvedPortrait = resolvePortraitSrc(data.portrait);
  if (resolvedPortrait && typeof document !== 'undefined') {
    try {
      const pngBytes = await loadImageAsPngBytes(resolvedPortrait);
      if (pngBytes) {
        const embedded = await doc.embedPng(pngBytes);
        const btn = form.getButton('Image163_af_image');
        const widget = btn.acroField.getWidgets()[0];
        const pages = doc.getPages();
        const pageIdx = widget ? pages.findIndex(p => p.ref === widget.P()) : -1;
        const rect = widget?.getRectangle();
        if (pageIdx >= 0 && rect) {
          const scale = Math.min(rect.width / embedded.width, rect.height / embedded.height);
          const drawW = embedded.width * scale;
          const drawH = embedded.height * scale;
          const drawX = rect.x + (rect.width - drawW) / 2;
          const drawY = rect.y + (rect.height - drawH) / 2;
          pages[pageIdx].drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });
        }
      }
    } catch {
      /* Ignore portrait embedding failure */
    }
  }

  const outBytes = await doc.save();
  const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.charName || 'character').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  a.href = url;
  a.download = `${safeName}-pf2e.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
