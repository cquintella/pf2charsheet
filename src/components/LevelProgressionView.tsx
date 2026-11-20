import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  AncestryItem, 
  BackgroundItem, 
  ClassItem, 
  AttributeKey, 
  SkillKey,
  ProficiencyRank,
  FeatItem,
  FeatSelectionRecord,
  LevelProgressionData,
  SavedCharacterRecord,
  CharacterInventory,
  CharacterStrike,
  CharacterCompanion,
  VisionType
} from '../types/pf2e';
import { 
  fetchAncestries, 
  fetchBackgrounds, 
  fetchClasses, 
  fetchCharacters, 
  fetchFeatById,
  saveCharacter 
} from '../services/api';
import { 
  ALL_ATTRIBUTES, 
  ATTRIBUTE_INFO, 
  ALL_SKILLS, 
  SKILL_INFO, 
  getProficiencyBonus,
  resolvePf2eIcon,
  cleanSnippetText,
  cleanDescriptionHtml
} from '../utils/formatters';
import { calculateArmorClass } from '../utils/armor';
import { applyFeatSkillEffects } from '../utils/featRules';
import { ProficiencySelector } from './ProficiencySelector';
import { StrikesView } from './StrikesView';
import { InventoryView } from './InventoryView';
import { FeatPickerModal } from './FeatPickerModal';
import { GeneralSettingsFields, ThemeName } from './SettingsModal';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './IconButton';
import { SessionCombatPanel } from './SessionCombatPanel';
import { CompanionView } from './CompanionView';
import { PortraitPickerModal } from './PortraitPickerModal';
import { resolvePortraitSrc } from '../utils/portrait';
import { exportCharacterToFillablePdf } from '../utils/pf2ePdfExport';
import { DEFAULT_SESSION_STATE, SessionState, computeConditionPenalties } from '../utils/conditions';
import { useModalFocus } from '../utils/useModalFocus';
import { useI18n } from '../i18n/I18nContext';
import { TranslateFn } from '../i18n/Translator';
import { attributeName, attributeShort, skillName, proficiencyWithBonus, proficiencyShort, proficiencyName, signed } from '../i18n/gameTerms';
import { 
  Shield, 
  Heart, 
  Award, 
  Sparkles, 
  BookOpen, 
  User, 
  Check, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  RotateCcw, 
  Save, 
  Trash2, 
  ArrowRight, 
  Info, 
  AlertCircle, 
  Layers, 
  CheckCircle2, 
  Star,
  Zap,
  Footprints,
  Eye,
  Crosshair,
  Users,
  ArrowUpCircle,
  ArrowDownCircle,
  UserCheck,
  Printer,
  FileDown,
  Settings,
  Camera
} from 'lucide-react';

export interface SheetGuard { dirty: boolean; save: () => Promise<boolean>; }

interface LevelProgressionViewProps {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  onGuardChange?: (guard: SheetGuard | null) => void;
  activeCharId?: string | null;
  onNavigateToCreator?: () => void;
  onCharacterSelected?: (char: SavedCharacterRecord) => void;
  onCharactersChanged?: () => void;
  onOpenCharModal?: () => void;
}

// Feat slot definition by level
interface LevelSlotDefinition {
  id: string;
  title: string;
  category: 'ancestry' | 'class' | 'skill' | 'general' | 'archetype';
}

function getFeatSlotsForLevel(t: TranslateFn, level: number, className: string = '', freeArchetype: boolean = false): LevelSlotDefinition[] {
  const slots: LevelSlotDefinition[] = [];

  // Ancestry Feats at 1, 5, 9, 13, 17
  if ([1, 5, 9, 13, 17].includes(level)) {
    slots.push({
      id: `ancestry_${level}`,
      title: t('sheet.slot.ancestry', { level }),
      category: 'ancestry'
    });
  }

  // Class Feats at 1 (for Fighter/Gunslinger/etc.), and even levels: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
  const isFighterOrCombatant = ['guerreiro', 'fighter', 'gunslinger'].some(c => className.toLowerCase().includes(c));
  if ((level === 1 && isFighterOrCombatant) || (level > 1 && level % 2 === 0)) {
    slots.push({
      id: `class_${level}`,
      title: t('sheet.slot.class', { level }),
      category: 'class'
    });
  }

  // Skill Feats at even levels: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
  // (Rogue & Investigator get skill feats every level, handled gracefully)
  const isRogueOrInvestigator = ['ladino', 'rogue', 'investigador', 'investigator'].some(c => className.toLowerCase().includes(c));
  if ((level > 1 && level % 2 === 0) || (isRogueOrInvestigator && level > 1)) {
    slots.push({
      id: `skill_${level}`,
      title: t('sheet.slot.skill', { level }),
      category: 'skill'
    });
  }

  // General Feats at odd levels: 3, 7, 11, 15, 19
  if ([3, 7, 11, 15, 19].includes(level)) {
    slots.push({
      id: `general_${level}`,
      title: t('sheet.slot.general', { level }),
      category: 'general'
    });
  }

  if (freeArchetype && level >= 2 && level % 2 === 0) {
    slots.push({ id: `archetype_${level}`, title: t('sheet.slot.archetype', { level }), category: 'archetype' });
  }

  return slots;
}

export const LevelProgressionView: React.FC<LevelProgressionViewProps> = ({ 
  activeCharId,
  theme,
  onThemeChange,
  onGuardChange,
  onNavigateToCreator,
  onCharacterSelected,
  onCharactersChanged,
  onOpenCharModal
}) => {
  const { t } = useI18n();
  // Compendium lists
  const [ancestries, setAncestries] = useState<AncestryItem[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected character base setup
  const [charId, setCharId] = useState<string>('char_' + Date.now().toString(36));
  const [strikes, setStrikes] = useState<CharacterStrike[]>([]);
  const [inventory, setInventory] = useState<CharacterInventory>({ items: [], coins: { pp: 0, gp: 0, sp: 0, cp: 0 } });
  const [session, setSession] = useState<SessionState>(DEFAULT_SESSION_STATE);
  const [companions, setCompanions] = useState<CharacterCompanion[]>([]);
  const [visionOverride, setVisionOverride] = useState<VisionType | ''>('');
  const [senses, setSenses] = useState('');
  const [portrait, setPortrait] = useState<string | undefined>(undefined);
  const [isPortraitPickerOpen, setIsPortraitPickerOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<'combat' | 'skills' | 'feats' | 'inventory' | 'companion'>('combat');
  const [freeArchetype, setFreeArchetype] = useState(false);
  const [charName, setCharName] = useState<string>(() => t('sheet.defaultCharacterName'));
  const [selectedAncestry, setSelectedAncestry] = useState<AncestryItem | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundItem | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Current Level being inspected / active level (1 to 20)
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [inspectLevel, setInspectLevel] = useState<number>(1);

  // Base Level 1 Modifiers (STR, DEX, CON, INT, WIS, CHA)
  const [baseAttributes, setBaseAttributes] = useState<Record<AttributeKey, number>>({
    str: 4,
    dex: 2,
    con: 2,
    int: 0,
    wis: 1,
    cha: 0
  });

  // Level 1 Initial Trained Skills
  const [initialTrainedSkills, setInitialTrainedSkills] = useState<Set<SkillKey>>(
    new Set(['athletics', 'acrobatics', 'intimidation', 'survival'])
  );

  // Level data store: 1 to 20
  const [levelData, setLevelData] = useState<Record<number, LevelProgressionData>>(() => {
    const init: Record<number, LevelProgressionData> = {};
    for (let i = 1; i <= 20; i++) {
      init[i] = {
        level: i,
        attributeBoosts: [],
        skillIncreases: [],
        feats: {}
      };
    }
    return init;
  });

  // Sheet View Mode: 'consolidated' (unified view of all feats, skills, stats) or 'planner' (level-by-level evolution)
  const [sheetViewMode, setSheetViewMode] = useState<'consolidated' | 'planner'>('consolidated');

  // Modal Feat Picker State
  const [activeSlotModal, setActiveSlotModal] = useState<{
    slotId: string;
    slotTitle: string;
    slotCategory: string;
    maxLevel: number;
    level: number;
    ancestryTrait?: string | null;
    ancestryName?: string | null;
  } | null>(null);

  // Notification / Save status
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savedSnapshot = useRef<string | null>(null);
  const needsBaseline = useRef(true);

  // Load compendia and characters on mount
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [a, b, c, chars] = await Promise.all([
          fetchAncestries(),
          fetchBackgrounds(),
          fetchClasses(),
          fetchCharacters()
        ]);
        setAncestries(a);
        setBackgrounds(b);
        setClasses(c);

        if (chars.length > 0) {
          setSavedCharacters(chars);
          const initialTarget = (activeCharId && chars.find(c => c.id === activeCharId)) || chars[0];
          loadSavedCharacterRecord(initialTarget);
          onCharacterSelected?.(initialTarget);
        } else if (a.length && b.length && c.length) {
          // Auto-seed default iconic character (Valeros) so database has an active character ready
          const defaultAncestry = a.find(item => item.name.toLowerCase().includes('humano') || item.slug === 'human') || a[0];
          const defaultBackground = b.find(item => item.name.toLowerCase().includes('guerreiro') || item.slug === 'warrior') || b[0];
          const defaultClass = c.find(item => item.name.toLowerCase().includes('guerreiro') || item.slug === 'fighter') || c[0];

          if (defaultAncestry) setSelectedAncestry(defaultAncestry);
          if (defaultBackground) setSelectedBackground(defaultBackground);
          if (defaultClass) setSelectedClass(defaultClass);

          const initLevels: Record<number, any> = {};
          for (let i = 1; i <= 20; i++) {
            initLevels[i] = { level: i, attributeBoosts: [], skillIncreases: [], feats: {} };
          }

          const defaultValeros = {
            id: 'char_valeros',
            name: t('sheet.defaultCharacterName'),
            level: 1,
            ancestry: defaultAncestry?.name || 'Human',
            heritage: '',
            background: defaultBackground?.name || '',
            class: defaultClass?.name || 'Fighter',
            subclass: '',
            data: {
              charState: {
                name: t('sheet.defaultCharacterName'),
                level: 1,
                ancestry: defaultAncestry,
                background: defaultBackground,
                selectedClass: defaultClass
              },
              calculatedAttributes: {
                str: { mod: 4, score: 18 },
                dex: { mod: 2, score: 14 },
                con: { mod: 2, score: 14 },
                int: { mod: 0, score: 10 },
                wis: { mod: 1, score: 12 },
                cha: { mod: 0, score: 10 }
              },
              progressionLevels: initLevels,
              initialTrainedSkills: ['athletics', 'acrobatics', 'intimidation', 'survival'],
              combatStats: {
                ac: 15,
                perception: 4,
                fortitude: 5,
                reflex: 5,
                will: 4,
                speed: 25
              },
              hpStats: {
                ancestryHp: 8,
                classHp: 10,
                conMod: 2,
                perLevelHp: 12,
                totalHp: 20
              }
            }
          };

          await saveCharacter(defaultValeros);
          const refreshed = await fetchCharacters();
          setSavedCharacters(refreshed);
          if (refreshed.length > 0) {
            loadSavedCharacterRecord(refreshed[0]);
          }
        }
      } catch (err) {
        console.error('Erro ao inicializar progressão:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Sync with activeCharId from parent if it changes
  useEffect(() => {
    if (activeCharId && savedCharacters.length > 0) {
      const match = savedCharacters.find(c => c.id === activeCharId);
      if (match && match.id !== charId) {
        loadSavedCharacterRecord(match);
      }
    }
  }, [activeCharId, savedCharacters, charId]);

  // Load saved character record (full reset to prevent cross-character data leakage)
  const loadSavedCharacterRecord = (rec: SavedCharacterRecord) => {
    try {
      needsBaseline.current = true;
      setCharId(rec.id);
      setCharName(rec.name);
      setCurrentLevel(rec.level || 1);
      setInspectLevel(rec.level || 1);

      const emptyLevels: Record<number, LevelProgressionData> = {};
      for (let i = 1; i <= 20; i++) {
        emptyLevels[i] = { level: i, attributeBoosts: [], skillIncreases: [], feats: {} };
      }
      const emptyBase: Record<AttributeKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

      const parsed = JSON.parse(rec.data_json || '{}');
      setPortrait(typeof parsed.portrait === 'string' && parsed.portrait.trim() !== '' ? parsed.portrait : undefined);
      setCompanions(Array.isArray(parsed.companions) ? parsed.companions : []);
      setVisionOverride(typeof parsed.visionOverride === 'string' ? (parsed.visionOverride as VisionType | '') : '');
      setSenses(typeof parsed.senses === 'string' ? parsed.senses : '');
      setFreeArchetype(parsed.freeArchetype === true);
      setStrikes(Array.isArray(parsed.strikes) ? parsed.strikes : []);
      setInventory({ items: Array.isArray(parsed.inventory?.items) ? parsed.inventory.items : [], coins: { pp: 0, gp: 0, sp: 0, cp: 0, ...parsed.inventory?.coins } });
      setSession(parsed.session ? { ...DEFAULT_SESSION_STATE, ...parsed.session, conditions: { ...DEFAULT_SESSION_STATE.conditions, ...parsed.session?.conditions } } : DEFAULT_SESSION_STATE);

      const cs = parsed.charState || {};
      setSelectedAncestry(cs.ancestry || null);
      setSelectedBackground(cs.background || null);
      setSelectedClass(cs.selectedClass || null);

      const ca = parsed.calculatedAttributes || {};
      const newBase: Record<AttributeKey, number> = { ...emptyBase };
      ALL_ATTRIBUTES.forEach(attr => {
        if (parsed.baseAttributes?.[attr] !== undefined) {
          newBase[attr] = parsed.baseAttributes[attr];
        } else if (ca[attr]?.mod !== undefined) {
          newBase[attr] = ca[attr].mod;
        }
      });
      setBaseAttributes(newBase);

      setLevelData(parsed.progressionLevels ? { ...emptyLevels, ...parsed.progressionLevels } : emptyLevels);
      setInitialTrainedSkills(Array.isArray(parsed.initialTrainedSkills) ? new Set(parsed.initialTrainedSkills) : new Set());
    } catch (e) {
      console.error('Erro ao carregar registro salvo:', e);
    }
  };

  // Older saved selections contain only a summary; recover their rules and description from the compendium.
  useEffect(() => {
    let cancelled = false;
    const missing = Array.from(new Set(Object.values(levelData).flatMap(level => Object.values(level.feats || {})).filter(feat => !feat.system_json || feat.description === undefined).map(feat => feat.featId)));
    if (missing.length === 0) return;
    Promise.all(missing.map(async id => {
      try { return await fetchFeatById(id); } catch { return null; }
    })).then(feats => {
      if (cancelled) return;
      const byId = new Map(feats.filter((feat): feat is FeatItem => feat !== null).map(feat => [feat.id, feat]));
      if (!byId.size) return;
      setLevelData(previous => Object.fromEntries(Object.entries(previous).map(([level, data]) => [level, {
        ...data,
        feats: Object.fromEntries(Object.entries(data.feats || {}).map(([slot, feat]) => {
          const source = byId.get(feat.featId);
          return [slot, source ? {
            ...feat,
            system_json: feat.system_json || source.system_json,
            prerequisites: feat.prerequisites ?? source.prerequisites,
            description: feat.description ?? source.description,
          } : feat];
        }))
      }])));
    });
    return () => { cancelled = true; };
  }, [charId, levelData]);

  // Resolved Active Ancestry for feat filtering
  const activeAncestry = useMemo(() => {
    if (selectedAncestry?.slug) return selectedAncestry;
    const nameToMatch = selectedAncestry?.name || savedCharacters.find(c => c.id === charId)?.ancestry || '';
    if (!nameToMatch) return null;
    const clean = nameToMatch.toLowerCase().trim();
    const found = ancestries.find(a => 
      a.slug.toLowerCase() === clean || 
      a.name.toLowerCase() === clean ||
      (clean === 'humano' && a.slug === 'human') ||
      (clean === 'elfo' && a.slug === 'elf') ||
      (clean === 'anão' && a.slug === 'dwarf') ||
      (clean === 'gnomo' && a.slug === 'gnome') ||
      (clean === 'halfling' && a.slug === 'halfling') ||
      (clean === 'goblin' && a.slug === 'goblin') ||
      (clean === 'centauro' && a.slug === 'centaur') ||
      (clean === 'orc' && a.slug === 'orc')
    );
    return found || null;
  }, [selectedAncestry, ancestries, savedCharacters, charId]);

  // Active Level for calculations (in consolidated mode uses character's official level; in planner mode uses inspectLevel)
  const activeLevel = sheetViewMode === 'consolidated' ? currentLevel : inspectLevel;

  // Attribute Boosts calculation per level up to activeLevel
  const currentAttributes = useMemo(() => {
    const mods: Record<AttributeKey, number> = { ...baseAttributes };

    // Apply boosts at levels 5, 10, 15, 20 up to activeLevel
    [5, 10, 15, 20].forEach(lvl => {
      if (activeLevel >= lvl) {
        const boosts = levelData[lvl]?.attributeBoosts || [];
        boosts.forEach(attr => {
          // In standard PF2e Remaster: +1 modifier
          mods[attr] = (mods[attr] || 0) + 1;
        });
      }
    });

    return mods;
  }, [baseAttributes, activeLevel, levelData]);

  // Check if character has Toughness or Diehard feats (both recalculate and award bonus HP)
  const hpBonusInfo = useMemo(() => {
    let toughnessCount = 0;
    let diehardCount = 0;

    for (let l = 1; l <= activeLevel; l++) {
      const feats = levelData[l]?.feats || {};
      for (const f of Object.values(feats)) {
        const name = (f.featName || '').toLowerCase();
        if (name.includes('toughness') || name.includes('robustez')) {
          toughnessCount++;
        }
        if (name.includes('diehard') || name.includes('die hard') || name.includes('duro de matar')) {
          diehardCount++;
        }
      }
    }

    const hasToughness = toughnessCount > 0;
    const hasDiehard = diehardCount > 0;
    // Toughness awards +1 HP per level; Diehard only raises the dying threshold
    const bonusPerLevel = hasToughness ? 1 : 0;

    return {
      hasToughness,
      hasDiehard,
      bonusPerLevel
    };
  }, [activeLevel, levelData]);

  // Hit Points calculation per level
  const hpStats = useMemo(() => {
    const ancestryHp = selectedAncestry?.hp || 8;
    const classHp = selectedClass?.hp || 10;
    const conMod = currentAttributes.con || 0;

    // Per level HP gain
    const perLevelHp = Math.max(1, classHp + conMod) + hpBonusInfo.bonusPerLevel;

    // Total HP at active level
    const totalHp = ancestryHp + (activeLevel * Math.max(1, classHp + conMod)) + (hpBonusInfo.bonusPerLevel * activeLevel);

    return {
      ancestryHp,
      classHp,
      conMod,
      perLevelHp,
      totalHp
    };
  }, [selectedAncestry, selectedClass, currentAttributes.con, activeLevel, hpBonusInfo]);

  // Skill ranks calculated up to activeLevel
  const skillRanks = useMemo(() => {
    const ranks: Record<SkillKey, ProficiencyRank> = {
      acrobatics: 0,
      arcana: 0,
      athletics: 0,
      crafting: 0,
      deception: 0,
      diplomacy: 0,
      intimidation: 0,
      medicine: 0,
      nature: 0,
      occultism: 0,
      performance: 0,
      religion: 0,
      society: 0,
      stealth: 0,
      survival: 0,
      thievery: 0
    };

    // Apply Level 1 Initial Trained Skills
    initialTrainedSkills.forEach(s => {
      ranks[s] = 1;
    });

    // Apply selected effects and increases in level order.
    for (let l = 1; l <= activeLevel; l++) {
      Object.values(levelData[l]?.feats || {}).forEach(feat => applyFeatSkillEffects(feat, ranks));
      const incs = levelData[l]?.skillIncreases || [];
      incs.forEach(s => {
        if (ranks[s] < 4) {
          ranks[s] = (ranks[s] + 1) as ProficiencyRank;
        }
      });
      Object.entries(levelData[l]?.skillRankOverrides || {}).forEach(([skill, rank]) => {
        if (rank !== undefined) ranks[skill as SkillKey] = rank;
      });
    }

    return ranks;
  }, [initialTrainedSkills, activeLevel, levelData]);

  // Combat Stats at activeLevel
  const combatStats = useMemo(() => {
    const dexMod = currentAttributes.dex || 0;
    const wisMod = currentAttributes.wis || 0;
    const conMod = currentAttributes.con || 0;

    const armorClass = calculateArmorClass(dexMod, activeLevel, selectedClass, inventory.items);
    const ac = armorClass.value;

    // Perception: Class perception rank (default trained = 2 + Level) + Wis
    const percRank = selectedClass?.perception || 1;
    const percBonus = wisMod + getProficiencyBonus(percRank as ProficiencyRank, activeLevel);

    // Saves
    const fortRank = (selectedClass?.fortitude || 1) as ProficiencyRank;
    const fortBonus = conMod + getProficiencyBonus(fortRank, activeLevel);

    const refRank = (selectedClass?.reflex || 1) as ProficiencyRank;
    const refBonus = dexMod + getProficiencyBonus(refRank, activeLevel);

    const willRank = (selectedClass?.will || 1) as ProficiencyRank;
    const willBonus = wisMod + getProficiencyBonus(willRank, activeLevel);

    const speed = selectedAncestry?.speed || 25;

    return {
      ac,
      armorClass,
      perception: percBonus,
      fortitude: fortBonus,
      reflex: refBonus,
      will: willBonus,
      speed
    };
  }, [currentAttributes, activeLevel, selectedClass, selectedAncestry, inventory.items]);

  const conditionPenalties = useMemo(
    () => computeConditionPenalties(session, activeLevel),
    [session, activeLevel]
  );

  const effectiveMaxHp = Math.max(1, hpStats.totalHp - conditionPenalties.maxHpReduction);
  const effectiveCombatStats = useMemo(() => ({
    ac: combatStats.ac + conditionPenalties.ac,
    perception: combatStats.perception + conditionPenalties.perception,
    fortitude: combatStats.fortitude + conditionPenalties.fortitude,
    reflex: combatStats.reflex + conditionPenalties.reflex,
    will: combatStats.will + conditionPenalties.will,
  }), [combatStats, conditionPenalties]);

  // Group all feat slots across all 20 levels into 4 unified categories
  const allSlotsGrouped = useMemo(() => {
    const groups: {
      archetype: { level: number; slot: LevelSlotDefinition; feat?: FeatSelectionRecord }[];
      class: { level: number; slot: LevelSlotDefinition; feat?: FeatSelectionRecord }[];
      ancestry: { level: number; slot: LevelSlotDefinition; feat?: FeatSelectionRecord }[];
      general: { level: number; slot: LevelSlotDefinition; feat?: FeatSelectionRecord }[];
      skill: { level: number; slot: LevelSlotDefinition; feat?: FeatSelectionRecord }[];
    } = {
      archetype: [],
      class: [],
      ancestry: [],
      general: [],
      skill: []
    };

    const className = selectedClass?.name || '';
    for (let lvl = 1; lvl <= 20; lvl++) {
      const slots = getFeatSlotsForLevel(t, lvl, className, freeArchetype);
      slots.forEach(slot => {
        const feat = levelData[lvl]?.feats?.[slot.id];
        if (slot.category in groups) {
          groups[slot.category].push({ level: lvl, slot, feat });
        }
      });
    }

    return groups;
  }, [selectedClass, levelData, freeArchetype, t]);

  const pendingChoicesCount = useMemo(() => {
    let missing = 0;
    const className = selectedClass?.name || '';
    for (let lvl = 1; lvl <= currentLevel; lvl++) {
      const slots = getFeatSlotsForLevel(t, lvl, className, freeArchetype);
      slots.forEach(s => { if (!levelData[lvl]?.feats?.[s.id]) missing++; });
      if ([5, 10, 15, 20].includes(lvl) && (levelData[lvl]?.attributeBoosts?.length || 0) < 4) missing++;
      if ([3, 5, 7, 9, 11, 13, 15, 17, 19].includes(lvl) && !(levelData[lvl]?.skillIncreases?.length)) missing++;
    }
    return missing;
  }, [selectedClass, currentLevel, levelData, freeArchetype, t]);

  // Handle toggling attribute boost at 5, 10, 15, 20
  const toggleAttributeBoost = (level: number, attr: AttributeKey) => {
    setLevelData(prev => {
      const current = prev[level]?.attributeBoosts || [];
      let updated: AttributeKey[];
      if (current.includes(attr)) {
        updated = current.filter(a => a !== attr);
      } else {
        if (current.length >= 4) return prev;
        updated = [...current, attr];
      }
      return {
        ...prev,
        [level]: {
          ...prev[level],
          attributeBoosts: updated
        }
      };
    });
  };

  const setSkillRank = (level: number, skill: SkillKey, rank: ProficiencyRank) => {
    setLevelData(previous => ({ ...previous, [level]: { ...previous[level], skillRankOverrides: { ...previous[level]?.skillRankOverrides, [skill]: rank } } }));
  };

  // Handle setting skill increase at a level
  const setLevelSkillIncrease = (level: number, skill: SkillKey) => {
    setLevelData(prev => {
      const current = prev[level]?.skillIncreases || [];
      return {
        ...prev,
        [level]: {
          ...prev[level],
          skillIncreases: [skill]
        }
      };
    });
  };

  // Handle removing a skill increase
  const removeLevelSkillIncrease = (level: number) => {
    setLevelData(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        skillIncreases: []
      }
    }));
  };

  // Handle binding feat to slot
  const handleSelectFeatForSlot = (feat: FeatItem) => {
    if (!activeSlotModal) return;
    const { slotId, level } = activeSlotModal;

    const record: FeatSelectionRecord = {
      prerequisites: feat.prerequisites,
      system_json: feat.system_json,
      description: feat.description,
      featId: feat.id,
      featName: feat.name,
      featImg: feat.img,
      level: feat.level,
      category: feat.category,
      action_type: feat.action_type,
      actions: feat.actions,
      traits: feat.traits
    };

    setLevelData(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        feats: {
          ...prev[level].feats,
          [slotId]: record
        }
      }
    }));

    setActiveSlotModal(null);
  };

  // Remove feat from slot
  const handleRemoveFeatFromSlot = (level: number, slotId: string) => {
    setLevelData(prev => {
      const updatedFeats = { ...prev[level].feats };
      delete updatedFeats[slotId];
      return {
        ...prev,
        [level]: {
          ...prev[level],
          feats: updatedFeats
        }
      };
    });
  };

  // Toggle Level 1 Initial Trained Skill
  const toggleInitialTrainedSkill = (s: SkillKey) => {
    setInitialTrainedSkills(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const ancestryVision: VisionType = useMemo(() => {
    try {
      const sys = JSON.parse(selectedAncestry?.system_json || '{}') as { vision?: string };
      if (sys.vision === 'low-light-vision' || sys.vision === 'darkvision' || sys.vision === 'greater-darkvision') {
        return sys.vision;
      }
    } catch { /* ignore */ }
    return 'normal';
  }, [selectedAncestry]);
  const effectiveVision: VisionType = visionOverride || ancestryVision;

  const snapshot = (level: number = currentLevel) => JSON.stringify({
    charId, charName, level, portrait, companions, visionOverride, senses, selectedAncestry, selectedBackground, selectedClass, baseAttributes,
    initialTrainedSkills: [...initialTrainedSkills].sort(), freeArchetype, inventory, strikes, session,
    levelData: Object.fromEntries(Object.entries(levelData).map(([key, data]) => [key, {
      ...data, feats: Object.fromEntries(Object.entries(data.feats || {}).map(([slot, feat]) => {
        const { system_json, prerequisites, ...selection } = feat;
        return [slot, selection];
      }))
    }]))
  });
  const currentSnapshot = snapshot();
  const isDirty = !loading && savedSnapshot.current !== null && savedSnapshot.current !== currentSnapshot;
  useLayoutEffect(() => {
    if (loading) return;
    if (needsBaseline.current) { savedSnapshot.current = currentSnapshot; needsBaseline.current = false; }
    onGuardChange?.({ dirty: savedSnapshot.current !== currentSnapshot, save: () => handleSaveProgress() });
  });
  useEffect(() => () => onGuardChange?.(null), [onGuardChange]);

  // Save Progress to SQLite
  const handleSaveProgress = async (overrideLvl?: number) => {
    setSaving(true);
    setSaveMsg(null);
    const targetLevel = overrideLvl || currentLevel;
    const savedState = snapshot(targetLevel);
    try {
      const payload = {
        id: charId,
        name: charName,
        level: targetLevel,
        ancestry: selectedAncestry?.name || '',
        heritage: '',
        background: selectedBackground?.name || '',
        class: selectedClass?.name || '',
        subclass: '',
        data: {
          charState: {
            name: charName,
            level: targetLevel,
            ancestry: selectedAncestry,
            background: selectedBackground,
            selectedClass: selectedClass
          },
          baseAttributes,
          calculatedAttributes: Object.fromEntries(
            ALL_ATTRIBUTES.map(attr => [attr, { mod: currentAttributes[attr], score: 10 + currentAttributes[attr] * 2 }])
          ),
          freeArchetype,
          portrait,
          companions,
          visionOverride,
          senses,
          inventory,
          strikes,
          session,
          progressionLevels: levelData,
          initialTrainedSkills: Array.from(initialTrainedSkills),
          combatStats,
          hpStats
        }
      };

      const res = await saveCharacter(payload);
      if (res.success) {
        savedSnapshot.current = savedState;
        setSaveMsg(t('sheet.savedOk'));
        const updated = await fetchCharacters();
        setSavedCharacters(updated);
        onCharactersChanged?.();
        setTimeout(() => setSaveMsg(null), 4000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao salvar progressão:', err);
      setSaveErrorMsg(t('sheet.saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const pendingLevelSave = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingLevelSave.current || loading) return;
    const msg = pendingLevelSave.current;
    pendingLevelSave.current = null;
    void handleSaveProgress().then((ok) => {
      if (ok) setSaveMsg(msg);
    });
  }, [currentLevel, levelData, loading]);

  // Passar de Nível (+1 Nível Oficial)
  const handleLevelUp = async () => {
    if (currentLevel >= 20) return;
    const nextLvl = currentLevel + 1;
    pendingLevelSave.current = t('sheet.levelUpMsg', { name: charName, level: nextLvl });
    setCurrentLevel(nextLvl);
    setInspectLevel(nextLvl);
  };

  // Descer Nível (-1 Nível Oficial): remove escolhas do nível desfeito
  const handleLevelDown = async () => {
    if (currentLevel <= 1) return;
    const removedLevel = currentLevel;
    const prevLvl = currentLevel - 1;
    pendingLevelSave.current = t('sheet.levelDownMsg', { name: charName, level: prevLvl });
    setLevelData(prev => ({
      ...prev,
      [removedLevel]: {
        level: removedLevel,
        attributeBoosts: [],
        skillIncreases: [],
        feats: {}
      }
    }));
    setCurrentLevel(prevLvl);
    setInspectLevel(prevLvl);
  };

  // Set Official Level to a target level
  const handleSetOfficialLevel = async (targetLvl: number) => {
    pendingLevelSave.current = t('sheet.officialLevelMsg', { name: charName, level: targetLvl });
    setCurrentLevel(targetLvl);
    setInspectLevel(targetLvl);
  };

  // Render Grouped Feats for a Category in Consolidated View
  const renderGroupedFeatCategoryCard = (
    title: string,
    categoryKey: 'class' | 'ancestry' | 'general' | 'skill' | 'archetype',
    items: { level: number; slot: LevelSlotDefinition; feat?: FeatSelectionRecord }[],
    icon: React.ReactNode
  ) => {
    // Only display feats and slots up to the character's current official level
    const visibleItems = items.filter(it => it.level <= currentLevel);
    const filledCount = visibleItems.filter(it => it.feat).length;
    const totalSlots = visibleItems.length;

    return (
      <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-3 flex flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-border-strong">
          <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
            {icon}
            <span>{title}</span>
          </h4>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-accent-text font-bold border border-border-strong">
            {t('sheet.filledOf', { filled: filledCount, total: totalSlots })}
          </span>
        </div>

        <div className="space-y-3 flex-1">
          {visibleItems.length === 0 ? (
            <p className="text-xs text-text-muted italic p-3 text-center">{t('sheet.noFeatsUntil', { level: currentLevel })}</p>
          ) : (
            visibleItems.map(({ level, slot, feat }) => {
              const isAssigned = !!feat;

              if (isAssigned && feat) {
                const featIcon = resolvePf2eIcon(feat.featImg, '/assets/icons/default-icons/feat.svg');
                let featTraits: string[] = [];
                try { featTraits = JSON.parse(feat.traits || '[]'); } catch { featTraits = []; }
                const actionLabel =
                  feat.action_type === 'reaction' ? `↺ ${t('action.reaction')}` :
                  feat.action_type === 'free' ? `◇ ${t('action.freeShort')}` :
                  feat.action_type === 'passive' ? `⚙ ${t('action.passive')}` :
                  feat.actions === '1' ? '◆ 1' :
                  feat.actions === '2' ? '◆◆ 2' :
                  feat.actions === '3' ? '◆◆◆ 3' : null;

                return (
                  <article
                    key={`${level}_${slot.id}`}
                    className="p-3.5 rounded-xl bg-inset border border-border-strong space-y-2.5 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={featIcon}
                        alt=""
                        className="w-8 h-8 rounded-lg bg-elevated p-0.5 object-contain flex-shrink-0 border border-border-strong mt-0.5"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <h5 className="font-bold text-sm text-text-primary leading-snug">
                            {feat.featName}
                          </h5>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {actionLabel && (
                              <span className="pf-action-icon text-[11px]">{actionLabel}</span>
                            )}
                            <span className="text-[11px] text-accent-text font-bold px-2 py-0.5 rounded bg-elevated border border-border-strong tabular-nums">
                              {t('common.levelShort', { level })}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {feat.category && (
                            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-status-info-bg text-status-info border border-status-info-border">
                              {feat.category}
                            </span>
                          )}
                          {featTraits.map(trait => (
                            <span
                              key={trait}
                              className="text-[11px] font-medium uppercase px-2 py-0.5 rounded-full bg-elevated text-text-secondary border border-border-subtle"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {feat.description && (
                      <div
                        className="pf-prose text-xs text-text-secondary leading-relaxed pt-2 border-t border-border-subtle"
                        dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(feat.description) }}
                      />
                    )}
                  </article>
                );
              }

              // Slot is empty and available at current level
              return (
                <div
                  key={`${level}_${slot.id}`}
                  onClick={() => setActiveSlotModal({
                    slotId: slot.id,
                    slotTitle: slot.title,
                    slotCategory: slot.category,
                    maxLevel: level,
                    level,
                    ancestryTrait: slot.category === 'ancestry' ? (activeAncestry?.slug || 'human') : undefined,
                    ancestryName: slot.category === 'ancestry' ? (activeAncestry?.name || selectedAncestry?.name || t('common.ancestry')) : undefined
                  })}
                  className="p-2.5 rounded-xl border bg-surface hover:bg-elevated border-accent/50 hover:border-accent text-white shadow-sm flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs bg-accent/20 text-accent-text">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate text-white">
                        {slot.title}
                      </span>
                      <span className="text-[11px] text-text-secondary block">
                        {t('sheet.availableForSelection', { level })}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 bg-accent text-black shadow">
                    {t('common.choose')}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const handleExportPdf = async () => {
    try {
      let acProfRank: ProficiencyRank = 1;
      let acItemBonus = 0;
      try {
        const armor = inventory.items.find((entry) => entry.equipped && entry.item.item_type === 'armor');
        let category = 'unarmored';
        if (armor) {
          const armorSys = JSON.parse(armor.item.system_json || '{}') as { category?: string; acBonus?: number; runes?: { potency?: number } };
          if (armorSys.category) category = armorSys.category;
          acItemBonus = (typeof armorSys.acBonus === 'number' ? armorSys.acBonus : 0) + (typeof armorSys.runes?.potency === 'number' ? armorSys.runes.potency : 0);
        }
        const defenses = JSON.parse(selectedClass?.defenses || '{}') as Record<string, unknown>;
        const raw = defenses[category];
        if (typeof raw === 'number' && raw >= 0 && raw <= 4) acProfRank = raw as ProficiencyRank;
      } catch { /* fallback to trained */ }

      await exportCharacterToFillablePdf({
        charName,
        level: currentLevel,
        ancestryName: selectedAncestry?.name || '',
        backgroundName: selectedBackground?.name || '',
        className: selectedClass?.name || '',
        vision: effectiveVision,
        senses,
        attributes: currentAttributes,
        maxHp: effectiveMaxHp,
        ac: effectiveCombatStats.ac,
        acProfRank,
        acItemBonus,
        fortitude: {
          total: effectiveCombatStats.fortitude,
          profRank: (selectedClass?.fortitude || 1) as ProficiencyRank,
        },
        reflex: {
          total: effectiveCombatStats.reflex,
          profRank: (selectedClass?.reflex || 1) as ProficiencyRank,
        },
        will: {
          total: effectiveCombatStats.will,
          profRank: (selectedClass?.will || 1) as ProficiencyRank,
        },
        perception: {
          total: effectiveCombatStats.perception,
          profRank: (selectedClass?.perception || 1) as ProficiencyRank,
        },
        speed: combatStats.speed,
        skillRanks,
        strikes,
        levelData,
        inventory,
        session,
        companions,
      });
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      setSaveErrorMsg(t('sheet.exportPdfError'));
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Banner & Character Switcher */}
      <div className="bg-surface border border-border-strong rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Character Identity & Status */}
          <div className="flex items-center space-x-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsPortraitPickerOpen(true)}
              title={t('portrait.change')}
              aria-label={t('portrait.change')}
              className="relative w-28 h-28 rounded-2xl overflow-hidden border border-border-strong hover:border-accent bg-inset flex items-center justify-center flex-shrink-0 transition-colors group print:border-border-subtle"
            >
              {portrait ? (
                <img
                  src={resolvePortraitSrc(portrait)}
                  alt={charName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-text-muted group-hover:text-accent-text transition-colors" />
              )}
              <span className="absolute inset-x-0 bottom-0 h-5 bg-black/65 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                <Camera className="w-3 h-3 text-white" />
              </span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="text-xl font-black text-white bg-transparent border-b border-transparent hover:border-border-strong focus:border-accent focus:outline-none transition-colors max-w-sm truncate"
                  placeholder={t('sheet.characterNamePlaceholder')}
                />
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-black flex items-center gap-1 shadow">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>{t('common.level', { level: currentLevel })}</span>
                </span>
                {inspectLevel !== currentLevel && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent text-black">
                    {t('sheet.inspecting', { level: inspectLevel })}
                  </span>
                )}
                {isDirty && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-status-warn-bg text-status-warn border border-status-warn-border">
                    {t('sheet.unsavedBadge')}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-0.5 flex items-center space-x-2 truncate">
                <span>{selectedAncestry?.name || t('common.ancestry')}</span>
                <span>•</span>
                <span>{selectedBackground?.name || t('common.background')}</span>
                <span>•</span>
                <span className="text-status-info font-semibold">{selectedClass?.name || t('common.class')}</span>
              </p>
            </div>
          </div>

          {/* Action buttons: Level Up, Level Down, Save, Print, Settings */}
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <IconButton
              onClick={handleLevelUp}
              disabled={currentLevel >= 20}
              variant="accent"
              label={t('sheet.levelUp')}
              icon={<ArrowUpCircle className="w-4 h-4 stroke-[2.5]" />}
            />
            {currentLevel > 1 && (
              <IconButton
                onClick={handleLevelDown}
                label={t('sheet.levelDown')}
                icon={<ArrowDownCircle className="w-4 h-4" />}
              />
            )}
            <IconButton
              onClick={() => handleSaveProgress()}
              disabled={saving}
              label={saving ? t('common.saving') : t('common.save')}
              icon={<Save className="w-4 h-4 text-accent-text" />}
            />
            <IconButton
              onClick={() => window.print()}
              label={t('sheet.print')}
              icon={<Printer className="w-4 h-4 text-accent-text" />}
            />
            <IconButton
              onClick={handleExportPdf}
              label={t('sheet.exportPdf')}
              icon={<FileDown className="w-4 h-4 text-accent-text" />}
            />
          </div>
        </div>

        {saveMsg && (
          <div className="p-3 bg-status-success-bg/60 border border-status-success-border/60 rounded-xl text-xs text-status-success flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-status-success" />
            <span>{saveMsg}</span>
          </div>
        )}

        {/* Live Combat Stats Summary: Defesas vs Percepção & Movimento */}
        <div className="space-y-3 pt-3 border-t border-border-strong tabular-nums">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Hit Points */}
            <div className="lg:col-span-3 bg-inset border border-border-strong rounded-xl p-3 flex items-center space-x-2.5">
              <Heart className="w-5 h-5 text-status-danger flex-shrink-0" />
              <div>
                <span className="text-[11px] uppercase font-bold text-text-secondary block">{t('sheet.hitPoints')}</span>
                <span className="text-base font-black text-white">{session.currentHp ?? effectiveMaxHp}/{effectiveMaxHp} {t('common.hp')}</span>
                <span className="text-[11px] text-text-muted block">
                  {t('sheet.perLevel', { value: hpStats.perLevelHp })}
                  {hpBonusInfo.hasDiehard && <span className="text-status-warn ml-1 font-bold" title={t('sheet.diehardTitle')}>• {t('sheet.diehard')}</span>}
                  {hpBonusInfo.hasToughness && <span className="text-status-success ml-1 font-bold" title={t('sheet.toughnessTitle')}>• {t('sheet.toughness')}</span>}
                </span>
              </div>
            </div>

            {/* Armor Class */}
            <div className="lg:col-span-3 bg-inset border border-border-strong rounded-xl p-3 flex items-center space-x-2.5">
              <Shield className="w-5 h-5 text-status-info flex-shrink-0" />
              <div>
                <span className="text-[11px] uppercase font-bold text-text-secondary block">{t('sheet.armorClass')}</span>
                <span className="text-base font-black text-white">{effectiveCombatStats.ac} {t('common.ac')}</span>
                <span className="text-[11px] text-text-muted block">{combatStats.armorClass.armorName ?? t('armor.none')}</span>
                {combatStats.armorClass.warnings.length > 0 && <span className="text-[11px] text-status-warn block">{combatStats.armorClass.warnings.map(key => t(key)).join(' ')}</span>}
              </div>
            </div>

            {/* Saving Throws Capsule (Fortitude, Reflex, Will) */}
            <div className="sm:col-span-2 lg:col-span-6 bg-inset border border-border-strong rounded-xl p-3 flex flex-col justify-between gap-2">
              <span className="text-[11px] uppercase font-bold text-text-secondary tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-accent-text" />
                <span>{t('creator.savingThrows')}</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-status-warn flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] uppercase font-bold text-text-secondary block truncate">{t('sheet.fortitude')}</span>
                    <span className="text-sm font-black text-white">{signed(effectiveCombatStats.fortitude)}</span>
                    <span className="text-[11px] text-text-muted block">{attributeShort(t, 'con')}</span>
                  </div>
                </div>
                <div className="bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-status-success flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] uppercase font-bold text-text-secondary block truncate">{t('sheet.reflex')}</span>
                    <span className="text-sm font-black text-white">{signed(effectiveCombatStats.reflex)}</span>
                    <span className="text-[11px] text-text-muted block">{attributeShort(t, 'dex')}</span>
                  </div>
                </div>
                <div className="bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-status-purple flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] uppercase font-bold text-text-secondary block truncate">{t('sheet.will')}</span>
                    <span className="text-sm font-black text-white">{signed(effectiveCombatStats.will)}</span>
                    <span className="text-[11px] text-text-muted block">{attributeShort(t, 'wis')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Percepção & Movimento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-inset border border-border-strong rounded-xl p-3 flex items-center space-x-2.5">
              <Eye className="w-5 h-5 text-status-purple flex-shrink-0" />
              <div>
                <span className="text-[11px] uppercase font-bold text-text-secondary block">{t('sheet.perception')}</span>
                <span className="text-base font-black text-white">{signed(effectiveCombatStats.perception)}</span>
                <span className="text-[11px] text-text-muted block">{t('sheet.initiative')}</span>
              </div>
            </div>

            <div className="bg-inset border border-border-strong rounded-xl p-3 flex items-center space-x-2.5">
              <Footprints className="w-5 h-5 text-status-warn flex-shrink-0" />
              <div>
                <span className="text-[11px] uppercase font-bold text-text-secondary block">{t('creator.speed')}</span>
                <span className="text-base font-black text-white">{t('common.feet', { value: combatStats.speed })}</span>
                <span className="text-[11px] text-text-muted block">{selectedAncestry?.name || t('common.ancestry')}</span>
              </div>
            </div>

            {/* Visão & Sentidos */}
            <div className="col-span-2 bg-inset border border-border-strong rounded-xl p-3 flex items-start space-x-2.5">
              <Sparkles className="w-5 h-5 text-accent-text flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-[11px] uppercase font-bold text-text-secondary block">{t('sheet.vision')}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={t('sheet.vision')}
                    value={effectiveVision}
                    onChange={(e) => {
                      const val = e.target.value as VisionType;
                      setVisionOverride(val === ancestryVision ? '' : val);
                    }}
                    className="bg-surface border border-border-strong rounded-lg px-2 py-1 text-xs font-bold text-white"
                  >
                    <option value="normal">{t('sheet.vision.normal')}</option>
                    <option value="low-light-vision">{t('sheet.vision.low-light-vision')}</option>
                    <option value="darkvision">{t('sheet.vision.darkvision')}</option>
                    <option value="greater-darkvision">{t('sheet.vision.greater-darkvision')}</option>
                  </select>
                  <input
                    type="text"
                    value={senses}
                    onChange={(e) => setSenses(e.target.value)}
                    placeholder={t('sheet.sensesPlaceholder')}
                    className="flex-1 min-w-[140px] bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary placeholder:text-text-muted"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Attribute Modifiers fixos junto aos dados do personagem */}
        <div className="pt-3 border-t border-border-subtle space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-accent-text" />
              <span>{t('sheet.consolidatedAttributes')}</span>
            </h4>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {ALL_ATTRIBUTES.map(attr => {
              const mod = currentAttributes[attr];
              return (
                <div key={attr} className="bg-inset border border-border-strong rounded-xl p-2">
                  <span className="text-[11px] uppercase font-bold text-text-secondary block">{attributeShort(t, attr)}</span>
                  <span className="text-lg font-black text-white tabular-nums">{signed(mod)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sub-abas seletoras de fichas (fora do card de dados do personagem) */}
      <div className="flex flex-wrap items-end gap-1 px-1 border-b border-border-strong print:hidden" role="tablist">
        {(
          [
            { id: 'combat', label: t('sheet.tab.combat') },
            { id: 'skills', label: t('sheet.tab.skills') },
            { id: 'feats', label: t('sheet.tab.feats'), badge: pendingChoicesCount > 0 ? pendingChoicesCount : undefined },
            { id: 'inventory', label: t('sheet.tab.inventory') },
            { id: 'companion', label: t('sheet.tab.companion'), badge: companions.length > 0 ? companions.length : undefined },
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={sheetTab === tab.id}
            onClick={() => setSheetTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl border border-b-0 text-xs font-bold transition-all ${
              sheetTab === tab.id
                ? 'bg-surface text-accent-text border-border-strong border-t-2 border-t-accent -mb-px pb-2.5 shadow-sm'
                : 'bg-inset/70 hover:bg-surface/70 text-text-secondary hover:text-text-primary border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            {'badge' in tab && tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                sheetTab === tab.id
                  ? 'bg-accent/20 text-accent-text'
                  : 'bg-status-warn-bg text-status-warn border border-status-warn-border'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {sheetTab === 'combat' && (
        <div className="space-y-3">
          <SessionCombatPanel session={session} maxHp={effectiveMaxHp} onChange={setSession} />

          <StrikesView
            strikes={strikes}
            inventory={inventory.items}
            characterClass={selectedClass}
            attributes={currentAttributes}
            level={activeLevel}
            strAttackPenalty={conditionPenalties.strChecks}
            dexAttackPenalty={conditionPenalties.dexChecks}
            strDamagePenalty={conditionPenalties.strDamage}
            onChange={setStrikes}
          />
        </div>
      )}

      {sheetTab === 'skills' && (
        <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Award className="w-4 h-4 text-accent-text" />
            <span>{t('sheet.consolidatedSkills')}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {ALL_SKILLS.map(s => {
              const info = SKILL_INFO[s];
              const rank = skillRanks[s];
              const attrMod = currentAttributes[info.attribute] || 0;
              const profBonus = getProficiencyBonus(rank, currentLevel);
              const condPenalty = info.attribute === 'str' ? conditionPenalties.strChecks : info.attribute === 'dex' ? conditionPenalties.dexChecks : conditionPenalties.allChecks;
              const total = attrMod + profBonus + condPenalty;

              return (
                <div
                  key={s}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-inset border border-border-subtle text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-text-primary block truncate">{skillName(t, s)}</span>
                    <span className="text-[11px] text-text-muted uppercase tabular-nums">
                      {attributeShort(t, info.attribute)} ({signed(attrMod)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      title={proficiencyName(t, rank)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                        rank > 0
                          ? 'bg-accent/15 text-accent-text border-accent/40'
                          : 'bg-elevated text-text-muted border-border-subtle'
                      }`}
                    >
                      {proficiencyShort(t, rank)}
                    </span>
                    <span className="font-bold text-sm text-accent-text min-w-[32px] text-right tabular-nums">
                      {signed(total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sheetTab === 'inventory' && (
        <InventoryView inventory={inventory} onChange={setInventory} />
      )}

      {sheetTab === 'companion' && (
        <CompanionView companions={companions} characterLevel={currentLevel} onChange={setCompanions} />
      )}

      {sheetTab === 'feats' && (
        <div className="space-y-3">
          {/* Toggle direto Ficha vs Planejador 1-20 */}
          <div className="bg-surface border border-border-strong rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent-text" />
              <span className="text-sm font-bold text-text-primary">{t('sheet.feats')}</span>
              {pendingChoicesCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-warn-bg text-status-warn border border-status-warn-border font-bold tabular-nums">
                  {t('sheet.pendingChoices')}: {pendingChoicesCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                role="switch"
                aria-label={t('sheet.freeArchetypeOption')}
                aria-checked={freeArchetype}
                onClick={() => setFreeArchetype(value => !value)}
                title={t('sheet.freeArchetypeHint')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                  freeArchetype
                    ? 'bg-status-success-bg text-status-success border-status-success-border'
                    : 'bg-elevated text-text-secondary hover:text-text-primary border-border-strong'
                }`}
              >
                {t('sheet.freeArchetype')}: {freeArchetype ? t('common.on') : t('common.off')}
              </button>
              <div className="flex items-center rounded-xl border border-border-strong bg-elevated p-0.5">
              <button
                type="button"
                onClick={() => setSheetViewMode('consolidated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  sheetViewMode === 'consolidated'
                    ? 'bg-accent text-accent-contrast shadow'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t('sheet.modeConsolidated')}
              </button>
              <button
                type="button"
                onClick={() => setSheetViewMode('planner')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  sheetViewMode === 'planner'
                    ? 'bg-accent text-accent-contrast shadow'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t('sheet.modePlanner')}
              </button>
              </div>
            </div>
          </div>

          {sheetViewMode === 'consolidated' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {renderGroupedFeatCategoryCard(
                t('sheet.classFeats'),
                'class',
                allSlotsGrouped.class,
                <Award className="w-4 h-4 text-accent-text" />
              )}

              {freeArchetype && renderGroupedFeatCategoryCard(t('sheet.freeArchetype'), 'archetype', allSlotsGrouped.archetype, <Layers className="w-4 h-4 text-accent-text" />)}

              {renderGroupedFeatCategoryCard(
                t('sheet.ancestryFeats', { ancestry: activeAncestry?.name || selectedAncestry?.name || t('common.ancestry') }),
                'ancestry',
                allSlotsGrouped.ancestry,
                <User className="w-4 h-4 text-status-success" />
              )}

              {renderGroupedFeatCategoryCard(
                t('sheet.generalFeats'),
                'general',
                allSlotsGrouped.general,
                <Star className="w-4 h-4 text-status-purple" />
              )}

              {renderGroupedFeatCategoryCard(
                t('sheet.skillFeats'),
                'skill',
                allSlotsGrouped.skill,
                <Zap className="w-4 h-4 text-status-warn" />
              )}
            </div>
          ) : (
        /* ================= LEVEL PLANNER VIEW (LEVEL BY LEVEL) ================= */
        <div className="space-y-3">
          {/* Level Navigator Pills (1 to 20) */}
          <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
          <span className="font-bold uppercase tracking-wider">
            {t('sheet.selectLevel')}
          </span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1.5 text-status-success font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              {t('sheet.officialLevel')} <strong className="text-white ml-0.5">{currentLevel}</strong>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-[repeat(20,minmax(0,1fr))] gap-1.5">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => {
            const isSelected = inspectLevel === lvl;
            const isOfficial = currentLevel === lvl;
            const isPast = lvl <= currentLevel;
            const hasBoost = [5, 10, 15, 20].includes(lvl);
            const hasSkillInc = [3, 5, 7, 9, 11, 13, 15, 17, 19].includes(lvl);
            return (
              <button
                key={lvl}
                onClick={() => setInspectLevel(lvl)}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${
                  isSelected
                    ? 'bg-accent text-black border-accent font-black shadow-lg scale-105 z-10'
                    : isOfficial
                    ? 'bg-status-success-bg hover:bg-status-success-bg text-status-success border-status-success-border font-bold'
                    : isPast
                    ? 'bg-elevated hover:bg-control text-white border-border-strong'
                    : 'bg-inset hover:bg-elevated text-text-muted border-border-subtle'
                }`}
              >
                <span className="text-xs">{lvl}</span>
                {isOfficial && !isSelected && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black shadow" title={t('sheet.currentOfficialLevel')} />
                )}
                <div className="flex items-center space-x-0.5 mt-0.5 text-[11px]">
                  {hasBoost && <span title={t('sheet.attributeBoosts')}>★</span>}
                  {hasSkillInc && <span title={t('sheet.skillIncrease')}>◆</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column (7 cols): Selected Level Detail & Customization */}
        <div className="lg:col-span-7 space-y-2.5">
          {/* Level Header Card */}
          <div className="bg-surface border border-border-strong rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-strong">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>{t('sheet.levelCustomizations', { level: inspectLevel })}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong">
                    {inspectLevel === 1 ? t('sheet.initialLevel') : t('sheet.advanceTo', { level: inspectLevel })}
                  </span>
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {t('sheet.hpGained')} <strong className="text-white">+{hpStats.perLevelHp} {t('common.hp')}</strong> ({t('sheet.hpBreakdown', { classHp: hpStats.classHp, con: signed(hpStats.conMod), conShort: attributeShort(t, 'con') })}{hpBonusInfo.hasToughness ? ` + 1 ${t('sheet.toughness')}` : ''}).
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-text-secondary block">{t('sheet.totalAtLevel')}</span>
                <span className="text-xl font-black text-accent-text">{hpStats.totalHp} {t('common.hp')}</span>
              </div>
            </div>

            {/* Level Discrepancy Prompt */}
            {inspectLevel > currentLevel && (
              <div className="p-3 bg-elevated border border-border-strong rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-status-info">
                  <ArrowUpCircle className="w-4 h-4 text-accent-text flex-shrink-0" />
                  <span>
                    {t('sheet.planningNotice', { level: inspectLevel, name: charName, official: currentLevel })}
                  </span>
                </div>
                <button
                  onClick={() => handleSetOfficialLevel(inspectLevel)}
                  className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-black font-bold rounded-lg shadow whitespace-nowrap text-xs transition-colors flex-shrink-0"
                >
                  {t('sheet.makeOfficial', { level: inspectLevel })}
                </button>
              </div>
            )}

            {/* 1. Attribute Boosts at 5, 10, 15, 20 */}
            {[5, 10, 15, 20].includes(inspectLevel) && (
              <div className="p-4 bg-status-warn-bg border border-status-warn-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-accent-text flex items-center gap-1.5 tracking-wider">
                    <Star className="w-4 h-4 fill-accent" />
                    <span>{t('sheet.attributeBoostsAt', { level: inspectLevel })}</span>
                  </h4>
                  <span className="text-xs font-bold text-white">
                    {t('sheet.selectedOf4', { count: (levelData[inspectLevel]?.attributeBoosts || []).length })}
                  </span>
                </div>
                <p className="text-xs text-status-warn">
                  {t('sheet.chooseBoosts')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {ALL_ATTRIBUTES.map(attr => {
                    const info = ATTRIBUTE_INFO[attr];
                    const selected = (levelData[inspectLevel]?.attributeBoosts || []).includes(attr);
                    return (
                      <button
                        key={attr}
                        onClick={() => toggleAttributeBoost(inspectLevel, attr)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          selected
                            ? 'bg-accent text-black border-accent font-bold shadow-md'
                            : 'bg-surface hover:bg-elevated text-white border-border-strong'
                        }`}
                      >
                        <span>{attributeName(t, attr)} ({attributeShort(t, attr)})</span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-black ${
                          selected ? 'bg-black text-white' : 'bg-control text-accent-text'
                        }`}>
                          {signed(currentAttributes[attr])}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Skill Increase at 3, 5, 7, 9, 11, 13, 15, 17, 19 */}
            {[3, 5, 7, 9, 11, 13, 15, 17, 19].includes(inspectLevel) && (
              <div className="p-4 bg-surface border border-border-strong rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-status-info flex items-center gap-1.5 tracking-wider">
                    <Award className="w-4 h-4" />
                    <span>{t('sheet.skillIncreaseAt', { level: inspectLevel })}</span>
                  </h4>
                  {levelData[inspectLevel]?.skillIncreases?.[0] && (
                    <button
                      onClick={() => removeLevelSkillIncrease(inspectLevel)}
                      className="text-[11px] text-status-danger hover:text-status-danger font-semibold"
                    >
                      {t('common.remove')}
                    </button>
                  )}
                </div>
                <p className="text-xs text-text-secondary">
                  {t('sheet.skillIncreaseHint')}
                </p>
                <select
                  value={levelData[inspectLevel]?.skillIncreases?.[0] || ''}
                  onChange={(e) => {
                    if (e.target.value) setLevelSkillIncrease(inspectLevel, e.target.value as SkillKey);
                    else removeLevelSkillIncrease(inspectLevel);
                  }}
                  className="w-full bg-elevated border border-border-strong px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-status-info"
                >
                  <option value="">{t('sheet.selectSkillToIncrease')}</option>
                  {ALL_SKILLS.map(s => {
                    const info = SKILL_INFO[s];
                    const currentRank = skillRanks[s];
                    const nextRank = Math.min(4, currentRank + 1) as ProficiencyRank;
                    return (
                      <option key={s} value={s}>
                        {skillName(t, s)} ({proficiencyWithBonus(t, currentRank)} ➔ {proficiencyWithBonus(t, nextRank)})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* 3. Feat Slots for this Level */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-accent-text" />
                <span>{t('sheet.featsGrantedAt', { level: inspectLevel })}</span>
              </h4>

              {(() => {
                const slots = getFeatSlotsForLevel(t, inspectLevel, selectedClass?.name || '', freeArchetype);
                if (slots.length === 0) {
                  return (
                    <p className="text-xs text-text-muted italic p-3 bg-inset rounded-xl border border-border-subtle">
                      {t('sheet.noFeatsAtLevel')}
                    </p>
                  );
                }

                return slots.map(slot => {
                  const assignedFeat = levelData[inspectLevel]?.feats?.[slot.id];

                  if (assignedFeat) {
                    const iconSrc = resolvePf2eIcon(assignedFeat.featImg, '/assets/icons/default-icons/feat.svg');
                    return (
                      <div
                        key={slot.id}
                        className="p-3.5 bg-surface border border-text-muted rounded-xl flex items-center justify-between gap-3 shadow-md"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-elevated border border-text-muted p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            <img
                              src={iconSrc}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/icons/default-icons/feat.svg';
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] uppercase font-bold text-accent-text block">
                              {slot.title}
                            </span>
                            <span className="font-bold text-sm text-white truncate block">
                              {assignedFeat.featName}
                            </span>
                            <span className="text-[11px] text-text-secondary">
                              {t('common.level', { level: assignedFeat.level })} • {assignedFeat.category}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            onClick={() => setActiveSlotModal({
                              slotId: slot.id,
                              slotTitle: slot.title,
                              slotCategory: slot.category,
                              maxLevel: inspectLevel,
                              level: inspectLevel,
                              ancestryTrait: slot.category === 'ancestry' ? (activeAncestry?.slug || 'human') : undefined,
                              ancestryName: slot.category === 'ancestry' ? (activeAncestry?.name || selectedAncestry?.name || t('common.ancestry')) : undefined
                            })}
                            className="px-3 py-1.5 bg-control hover:bg-control-hover text-white text-xs font-semibold rounded-lg border border-text-muted transition-colors"
                          >
                            {t('common.change')}
                          </button>
                          <button
                            onClick={() => handleRemoveFeatFromSlot(inspectLevel, slot.id)}
                            className="p-1.5 text-status-danger hover:text-status-danger hover:bg-status-danger-bg/40 rounded-lg transition-colors"
                            title={t('sheet.removeFeat')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slot.id}
                      onClick={() => setActiveSlotModal({
                        slotId: slot.id,
                        slotTitle: slot.title,
                        slotCategory: slot.category,
                        maxLevel: inspectLevel,
                        level: inspectLevel,
                        ancestryTrait: slot.category === 'ancestry' ? (activeAncestry?.slug || 'human') : undefined,
                        ancestryName: slot.category === 'ancestry' ? (activeAncestry?.name || selectedAncestry?.name || t('common.ancestry')) : undefined
                      })}
                      className="p-3.5 bg-inset hover:bg-elevated border border-dashed border-border-strong hover:border-accent rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-elevated group-hover:bg-accent/20 text-text-secondary group-hover:text-accent-text flex items-center justify-center transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white group-hover:text-accent-text transition-colors block">
                            {slot.title}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {t('sheet.clickToSearchFeats')}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-elevated text-text-primary group-hover:bg-accent group-hover:text-black transition-colors">
                        {t('sheet.chooseFeat')}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Level 1 Initial Trained Skills Selection if inspecting Level 1 */}
          {inspectLevel === 1 && (
            <div className="bg-surface border border-border-strong rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-accent-text" />
                <span>{t('sheet.initialTrainedSkills')}</span>
              </h4>
              <p className="text-xs text-text-secondary">
                {t('sheet.initialTrainedSkillsHint')}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {ALL_SKILLS.map(s => {
                  const info = SKILL_INFO[s];
                  const trained = initialTrainedSkills.has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleInitialTrainedSkill(s)}
                      className={`p-2 rounded-lg text-xs font-semibold border flex items-center justify-between transition-all ${
                        trained
                          ? 'bg-elevated text-status-info border-status-info-border'
                          : 'bg-inset text-text-muted border-border-subtle hover:text-white'
                      }`}
                    >
                      <span>{skillName(t, s)}</span>
                      <span className="text-[11px]">{trained ? t('prof.1') : '—'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Live Skills Matrix & Feats Summary */}
        <div className="lg:col-span-5 space-y-2.5">
          {/* Attributes Matrix at inspectLevel */}
          <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center justify-between">
              <span>{t('sheet.attributesAt', { level: inspectLevel })}</span>
              <span className="text-[11px] text-accent-text">{t('sheet.currentModifier')}</span>
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {ALL_ATTRIBUTES.map(attr => {
                const info = ATTRIBUTE_INFO[attr];
                const mod = currentAttributes[attr];
                const score = 10 + mod * 2;
                return (
                  <div key={attr} className="bg-inset border border-border-strong rounded-xl p-2.5">
                    <span className="text-[11px] uppercase font-bold text-text-secondary block">{attributeShort(t, attr)}</span>
                    <span className="text-lg font-black text-white">{mod >= 0 ? `+${mod}` : mod}</span>
                    <span className="text-[11px] text-text-muted block">({score})</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Skills Table (16 Perícias) */}
          <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-accent-text" />
                <span>{t('sheet.skillsAt', { level: inspectLevel })}</span>
              </h4>
              <span className="text-[11px] text-text-secondary">
                {t('sheet.bonusFormula')}
              </span>
            </div>

            <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
              {ALL_SKILLS.map(s => {
                const info = SKILL_INFO[s];
                const rank = skillRanks[s];
                const attrMod = currentAttributes[info.attribute] || 0;
                const profBonus = getProficiencyBonus(rank, inspectLevel);
                const total = attrMod + profBonus;

                return (
                  <div
                    key={s}
                    className="flex items-center justify-between p-2 rounded-lg bg-inset hover:bg-surface border border-border-subtle text-xs transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">{skillName(t, s)}</span>
                      <span className="text-[11px] text-text-muted uppercase">({attributeShort(t, info.attribute)})</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <ProficiencySelector label={t('sheet.proficiencyIn', { skill: skillName(t, s) })} value={rank} onChange={value => setSkillRank(inspectLevel, s, value)} />
                      <span className="font-black text-sm text-white w-8 text-right">
                        {total >= 0 ? `+${total}` : total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Feats Cumulative Summary */}
          <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-accent-text" />
              <span>{t('sheet.featsAcquiredUntil', { level: inspectLevel })}</span>
            </h4>

            {(() => {
              const acquired: { level: number; feat: FeatSelectionRecord; slotKey: string }[] = [];
              for (let l = 1; l <= inspectLevel; l++) {
                const feats = levelData[l]?.feats || {};
                Object.entries(feats).forEach(([slotKey, feat]) => {
                  acquired.push({ level: l, feat, slotKey });
                });
              }

              if (acquired.length === 0) {
                return (
                  <p className="text-xs text-text-muted italic p-3 text-center">
                    {t('sheet.noFeatsSelectedUntil', { level: inspectLevel })}
                  </p>
                );
              }

              return (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {acquired.map(({ level, feat, slotKey }) => {
                    const icon = resolvePf2eIcon(feat.featImg, '/assets/icons/default-icons/feat.svg');
                    return (
                      <div
                        key={`${level}_${slotKey}`}
                        className="p-2 rounded-lg bg-inset border border-border-subtle flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <img src={icon} alt="" className="w-6 h-6 rounded bg-elevated p-0.5 object-contain flex-shrink-0" />
                          <span className="font-semibold text-white truncate">{feat.featName}</span>
                        </div>
                        <span className="text-[11px] text-accent-text font-bold px-1.5 py-0.5 rounded bg-elevated ml-2 flex-shrink-0">
                          {t('common.levelShort', { level })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
          )}
        </div>
      )}

      {/* Feat Picker Dialog Modal */}
      {activeSlotModal && (
        <FeatPickerModal
          slotTitle={activeSlotModal.slotTitle}
          slotCategory={activeSlotModal.slotCategory}
          maxLevel={activeSlotModal.maxLevel}
          ruleAttributes={Object.fromEntries(ALL_ATTRIBUTES.map(attr => [attr, baseAttributes[attr] + [5, 10, 15, 20].filter(level => level <= activeSlotModal.level && levelData[level]?.attributeBoosts.includes(attr)).length])) as Record<AttributeKey, number>}
          ruleSkills={(() => {
            const ranks = Object.fromEntries(ALL_SKILLS.map(skill => [skill, initialTrainedSkills.has(skill) ? 1 : 0])) as Record<SkillKey, ProficiencyRank>;
            for (let level = 1; level <= activeSlotModal.level; level++) {
              Object.entries(levelData[level]?.feats || {}).forEach(([slot, feat]) => { if (level !== activeSlotModal.level || slot !== activeSlotModal.slotId) applyFeatSkillEffects(feat, ranks); });
              (levelData[level]?.skillIncreases || []).forEach(skill => { ranks[skill] = Math.min(4, ranks[skill] + 1) as ProficiencyRank; });
              Object.entries(levelData[level]?.skillRankOverrides || {}).forEach(([skill, rank]) => { if (rank !== undefined) ranks[skill as SkillKey] = rank; });
            }
            return ranks;
          })()}
          existingFeats={Object.entries(levelData).flatMap(([level, data]) => Object.entries(data.feats || {}).filter(([slot]) => !(Number(level) === activeSlotModal.level && slot === activeSlotModal.slotId)).map(([, feat]) => ({ ...feat, takenAt: Number(level) })).filter(feat => feat.takenAt <= activeSlotModal.level))}
          selectedFeatId={levelData[activeSlotModal.level]?.feats?.[activeSlotModal.slotId]?.featId}
          ancestryTrait={activeSlotModal.ancestryTrait}
          ancestryName={activeSlotModal.ancestryName}
          onSelectFeat={handleSelectFeatForSlot}
          onClose={() => setActiveSlotModal(null)}
        />
      )}
      {isPortraitPickerOpen && (
        <PortraitPickerModal
          currentPortrait={portrait}
          characterAncestry={selectedAncestry?.name}
          onSelect={setPortrait}
          onClose={() => setIsPortraitPickerOpen(false)}
        />
      )}
      {saveErrorMsg && (
        <ConfirmDialog
          title={t('common.save')}
          message={saveErrorMsg}
          variant="alert"
          onCancel={() => setSaveErrorMsg(null)}
          onConfirm={() => setSaveErrorMsg(null)}
        />
      )}
    </div>
  );
};
