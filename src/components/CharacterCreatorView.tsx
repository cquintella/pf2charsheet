import React, { useState, useEffect, useMemo } from 'react';
import { 
  AncestryItem, 
  BackgroundItem, 
  ClassItem, 
  AttributeKey, 
  CharacterABCState 
} from '../types/pf2e';
import { 
  fetchAncestries, 
  fetchBackgrounds, 
  fetchClasses, 
  fetchCharacters, 
  saveCharacter, 
  deleteCharacter 
} from '../services/api';
import { 
  resolvePf2eIcon, 
  cleanSnippetText, 
  cleanDescriptionHtml, 
  ALL_ATTRIBUTES, 
  ATTRIBUTE_INFO
} from '../utils/formatters';
import { useI18n } from '../i18n/I18nContext';
import { ConfirmDialog } from './ConfirmDialog';
import { PortraitPickerModal } from './PortraitPickerModal';
import { getCharacterPortrait, resolvePortraitSrc } from '../utils/portrait';
import { MessageKey } from '../i18n/Translator';
import { attributeName, attributeShort, proficiencyWithBonus, signed, toProficiencyRank, rarityLabel } from '../i18n/gameTerms';
import { 
  User, 
  Shield, 
  Heart, 
  Footprints, 
  Eye, 
  Sparkles, 
  Check, 
  RotateCcw, 
  Save, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle, 
  Award, 
  Search, 
  BookOpen,
  ArrowRight,
  Info
} from 'lucide-react';

interface SavedCharacterRecord {
  id: string;
  name: string;
  level: number;
  ancestry: string;
  heritage: string;
  background: string;
  class: string;
  subclass: string;
  data_json: string;
  created_at?: string;
  updated_at?: string;
}

const INITIAL_CHARACTER_STATE: CharacterABCState = {
  name: '',
  level: 1,
  ancestry: null,
  useAlternativeBoosts: false,
  ancestryBoostChoices: {},
  useVoluntaryFlaw: false,
  voluntaryFlaw: null,
  voluntaryBoost: null,
  background: null,
  backgroundBoostChoice1: null,
  backgroundBoostChoice2: null,
  selectedClass: null,
  classKeyAttributeChoice: null,
  level1FreeBoosts: []
};

interface CharacterCreatorViewProps {
  onNavigateToLevels?: () => void;
  onCharacterSaved?: (savedId: string) => void;
}

export const CharacterCreatorView: React.FC<CharacterCreatorViewProps> = ({
  onNavigateToLevels,
  onCharacterSaved
}) => {
  const { t } = useI18n();
  // Wizard steps: 1: Ancestry, 2: Background, 3: Class, 4: Free Boosts, 5: Sheet & Save
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Compendium data from SQLite
  const [ancestries, setAncestries] = useState<AncestryItem[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{
    title: string;
    message: string;
    variant: 'alert' | 'danger';
    deleteId?: string;
  } | null>(null);

  // Character creation state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [charState, setCharState] = useState<CharacterABCState>(() => ({ ...INITIAL_CHARACTER_STATE, name: t('creator.defaultName') }));
  const [portrait, setPortrait] = useState<string | undefined>(undefined);
  const [isPortraitPickerOpen, setIsPortraitPickerOpen] = useState(false);

  // Search filters inside steps
  const [ancestrySearch, setAncestrySearch] = useState('');
  const [ancestryRarityFilter, setAncestryRarityFilter] = useState('all');
  const [backgroundSearch, setBackgroundSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');

  // Load compendiums and saved characters on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [aData, bData, cData, chars] = await Promise.all([
          fetchAncestries(),
          fetchBackgrounds(),
          fetchClasses(),
          fetchCharacters()
        ]);
        setAncestries(aData);
        setBackgrounds(bData);
        setClasses(cData);
        setSavedCharacters(chars);
      } catch (err) {
        console.error('Erro ao carregar dados de criação:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Parse Ancestry Boosts and Flaws
  const parsedAncestryBoosts = useMemo(() => {
    if (!charState.ancestry) return [];
    try {
      const obj = JSON.parse(charState.ancestry.boosts || '{}');
      return Object.entries(obj).map(([slotKey, item]: [string, any]) => ({
        slotKey,
        options: (item.value || []) as AttributeKey[]
      })).filter(b => b.options.length > 0);
    } catch (e) {
      return [];
    }
  }, [charState.ancestry]);

  const parsedAncestryFlaws = useMemo(() => {
    if (!charState.ancestry) return [];
    try {
      const obj = JSON.parse(charState.ancestry.flaws || '{}');
      return Object.entries(obj).map(([slotKey, item]: [string, any]) => ({
        slotKey,
        options: (item.value || []) as AttributeKey[]
      })).filter(f => f.options.length > 0);
    } catch (e) {
      return [];
    }
  }, [charState.ancestry]);

  // Parse Background Boosts
  const parsedBackgroundBoosts = useMemo(() => {
    if (!charState.background) return { specific: [] as AttributeKey[], free: false };
    try {
      const obj = JSON.parse(charState.background.boosts || '{}');
      const specific = (obj['0']?.value || []) as AttributeKey[];
      const hasFree = (obj['1']?.value || []).length >= 6;
      return { specific, free: hasFree };
    } catch (e) {
      return { specific: [], free: false };
    }
  }, [charState.background]);

  // Parse Class Key Abilities
  const parsedClassKeyAbilities = useMemo(() => {
    if (!charState.selectedClass) return [] as AttributeKey[];
    try {
      const arr = JSON.parse(charState.selectedClass.key_ability || '[]');
      return arr as AttributeKey[];
    } catch (e) {
      return [] as AttributeKey[];
    }
  }, [charState.selectedClass]);

  // Handle Ancestry Selection
  const handleSelectAncestry = (ancestry: AncestryItem) => {
    let defaultBoostChoices: Record<string, AttributeKey> = {};
    try {
      const bObj = JSON.parse(ancestry.boosts || '{}');
      Object.entries(bObj).forEach(([slot, val]: [string, any]) => {
        const opts = (val.value || []) as AttributeKey[];
        if (opts.length === 1) {
          defaultBoostChoices[slot] = opts[0];
        }
      });
    } catch (e) {}

    setCharState(prev => ({
      ...prev,
      ancestry,
      useAlternativeBoosts: false,
      ancestryBoostChoices: defaultBoostChoices,
      useVoluntaryFlaw: false,
      voluntaryFlaw: null,
      voluntaryBoost: null
    }));
  };

  // Handle Background Selection
  const handleSelectBackground = (bg: BackgroundItem) => {
    let initialChoice1: AttributeKey | null = null;
    try {
      const bObj = JSON.parse(bg.boosts || '{}');
      const spec = (bObj['0']?.value || []) as AttributeKey[];
      if (spec.length > 0) initialChoice1 = spec[0];
    } catch (e) {}

    setCharState(prev => ({
      ...prev,
      background: bg,
      backgroundBoostChoice1: initialChoice1,
      backgroundBoostChoice2: null
    }));
  };

  // Handle Class Selection
  const handleSelectClass = (cls: ClassItem) => {
    let initialKey: AttributeKey | null = null;
    try {
      const arr = JSON.parse(cls.key_ability || '[]');
      if (arr.length > 0) initialKey = arr[0];
    } catch (e) {}

    setCharState(prev => ({
      ...prev,
      selectedClass: cls,
      classKeyAttributeChoice: initialKey
    }));
  };

  // Toggle Level 1 Free Boosts (up to 4 distinct attributes)
  const toggleLevel1FreeBoost = (attr: AttributeKey) => {
    setCharState(prev => {
      const current = prev.level1FreeBoosts;
      if (current.includes(attr)) {
        return { ...prev, level1FreeBoosts: current.filter(a => a !== attr) };
      } else {
        if (current.length >= 4) return prev;
        return { ...prev, level1FreeBoosts: [...current, attr] };
      }
    });
  };

  // Calculate final modifiers and attribute scores
  const calculatedAttributes = useMemo(() => {
    const scores: Record<AttributeKey, { 
      mod: number; 
      score: number; 
      sources: { labelKey: MessageKey; type: 'boost' | 'flaw' }[] 
    }> = {
      str: { mod: 0, score: 10, sources: [] },
      dex: { mod: 0, score: 10, sources: [] },
      con: { mod: 0, score: 10, sources: [] },
      int: { mod: 0, score: 10, sources: [] },
      wis: { mod: 0, score: 10, sources: [] },
      cha: { mod: 0, score: 10, sources: [] }
    };

    // A: Ancestry
    if (charState.ancestry) {
      if (charState.useAlternativeBoosts) {
        // Alternative: 2 free boosts chosen in ancestryBoostChoices slots 'alt0' and 'alt1'
        const b0 = charState.ancestryBoostChoices['alt0'];
        const b1 = charState.ancestryBoostChoices['alt1'];
        if (b0) scores[b0].sources.push({ labelKey: 'creator.source.ancestryAlt', type: 'boost' });
        if (b1) scores[b1].sources.push({ labelKey: 'creator.source.ancestryAlt', type: 'boost' });
      } else {
        // Standard boosts
        Object.entries(charState.ancestryBoostChoices).forEach(([slot, attr]) => {
          if (attr && !slot.startsWith('alt')) {
            scores[attr].sources.push({ labelKey: 'creator.source.ancestry', type: 'boost' });
          }
        });
        // Standard flaws
        parsedAncestryFlaws.forEach(f => {
          if (f.options.length === 1) {
            scores[f.options[0]].sources.push({ labelKey: 'creator.source.ancestry', type: 'flaw' });
          }
        });
      }

      // Voluntary flaw: -1 to one attribute, +1 to another
      if (charState.useVoluntaryFlaw) {
        if (charState.voluntaryFlaw) {
          scores[charState.voluntaryFlaw].sources.push({ labelKey: 'creator.source.voluntaryFlaw', type: 'flaw' });
        }
        if (charState.voluntaryBoost) {
          scores[charState.voluntaryBoost].sources.push({ labelKey: 'creator.source.voluntaryBoost', type: 'boost' });
        }
      }
    }

    // B: Background
    if (charState.background) {
      if (charState.backgroundBoostChoice1) {
        scores[charState.backgroundBoostChoice1].sources.push({ labelKey: 'creator.source.backgroundSpecific', type: 'boost' });
      }
      if (charState.backgroundBoostChoice2) {
        scores[charState.backgroundBoostChoice2].sources.push({ labelKey: 'creator.source.backgroundFree', type: 'boost' });
      }
    }

    // C: Class
    if (charState.selectedClass && charState.classKeyAttributeChoice) {
      scores[charState.classKeyAttributeChoice].sources.push({ labelKey: 'creator.source.classKey', type: 'boost' });
    }

    // Free 4 Boosts
    charState.level1FreeBoosts.forEach(attr => {
      scores[attr].sources.push({ labelKey: 'creator.source.freeBoosts', type: 'boost' });
    });

    // Compute final modifier and score
    ALL_ATTRIBUTES.forEach(attr => {
      let mod = 0;
      scores[attr].sources.forEach(src => {
        if (src.type === 'boost') mod += 1;
        else if (src.type === 'flaw') mod -= 1;
      });
      scores[attr].mod = mod;
      scores[attr].score = 10 + (mod * 2);
    });

    return scores;
  }, [
    charState, 
    parsedAncestryFlaws
  ]);

  // Derived Statistics
  const derivedStats = useMemo(() => {
    const ancestryHp = charState.ancestry?.hp || 0;
    const classHp = charState.selectedClass?.hp || 0;
    const conMod = calculatedAttributes.con.mod;
    const dexMod = calculatedAttributes.dex.mod;
    const wisMod = calculatedAttributes.wis.mod;

    const maxHp = ancestryHp + classHp + conMod;
    // Remaster AC: 10 + Dex + Trained (2 + Level 1 = 3)
    const baseAc = 10 + dexMod + 3;
    // Perception: Wis mod + perception rank (1=trained: 2+1=3, 2=expert: 4+1=5)
    const perceptionProfRank = charState.selectedClass?.perception || 1;
    const perceptionBonus = wisMod + (perceptionProfRank * 2) + 1;

    // Saving throws
    const fortRank = charState.selectedClass?.fortitude || 1;
    const fortBonus = conMod + (fortRank * 2) + 1;

    const refRank = charState.selectedClass?.reflex || 1;
    const refBonus = dexMod + (refRank * 2) + 1;

    const willRank = charState.selectedClass?.will || 1;
    const willBonus = wisMod + (willRank * 2) + 1;

    const speed = charState.ancestry?.speed || 25;

    return {
      maxHp: Math.max(1, maxHp),
      ac: baseAc,
      perception: perceptionBonus,
      fortitude: fortBonus,
      reflex: refBonus,
      will: willBonus,
      speed
    };
  }, [charState, calculatedAttributes]);

  // Save Character to SQLite (returns true on success)
  const handleSaveCharacter = async (): Promise<boolean> => {
    setSaving(true);
    setSaveSuccessMsg(null);
    try {
      const baseAttributes = Object.fromEntries(
        ALL_ATTRIBUTES.map(attr => [attr, calculatedAttributes[attr].mod])
      ) as Record<AttributeKey, number>;

      const initLevels: Record<number, { level: number; attributeBoosts: AttributeKey[]; skillIncreases: string[]; feats: Record<string, unknown> }> = {};
      for (let i = 1; i <= 20; i++) {
        initLevels[i] = { level: i, attributeBoosts: [], skillIncreases: [], feats: {} };
      }

      const initialTrainedSkills: string[] = [];
      try {
        const bgSkills = JSON.parse(charState.background?.skills || '[]');
        if (Array.isArray(bgSkills)) {
          bgSkills.forEach((s: unknown) => {
            if (typeof s === 'string') initialTrainedSkills.push(s.toLowerCase());
          });
        }
      } catch { /* ignore */ }

      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: charState.name || t('creator.unnamedHero'),
        level: 1,
        ancestry: charState.ancestry?.name || '',
        heritage: '',
        background: charState.background?.name || '',
        class: charState.selectedClass?.name || '',
        subclass: '',
        data: {
          charState,
          portrait,
          baseAttributes,
          calculatedAttributes,
          derivedStats,
          progressionLevels: initLevels,
          initialTrainedSkills: Array.from(new Set(initialTrainedSkills)),
        }
      };

      const res = await saveCharacter(payload);
      if (res.success) {
        setEditingId(res.id);
        setSaveSuccessMsg(t('creator.savedOk'));
        const updatedList = await fetchCharacters();
        setSavedCharacters(updatedList);
        onCharacterSaved?.(res.id);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Falha ao salvar personagem:', err);
      setDialogState({
        title: t('common.save'),
        message: t('creator.saveError'),
        variant: 'alert',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Load a Saved Character
  const handleLoadCharacter = (rec: SavedCharacterRecord) => {
    try {
      const data = JSON.parse(rec.data_json || '{}');
      if (data.charState) {
        setEditingId(rec.id);
        setCharState(data.charState);
        setPortrait(typeof data.portrait === 'string' && data.portrait.trim() !== '' ? data.portrait : undefined);
        setCurrentStep(5);
      }
    } catch (e) {
      console.error('Erro ao ler dados do personagem salvo:', e);
    }
  };

  // Delete a Saved Character
  const handleDeleteCharacter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogState({
      title: t('creator.deleteCharacter'),
      message: t('creator.confirmDelete'),
      variant: 'danger',
      deleteId: id,
    });
  };

  const sizeLabel = (size: string): string => {
    const known: readonly string[] = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'];
    return known.includes(size) ? t(`size.${size as 'tiny' | 'sm' | 'med' | 'lg' | 'huge' | 'grg'}`) : size;
  };

  // Filtered compendium lists
  const filteredAncestries = useMemo(() => {
    return ancestries.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(ancestrySearch.toLowerCase());
      const matchRarity = ancestryRarityFilter === 'all' || a.rarity === ancestryRarityFilter;
      return matchSearch && matchRarity;
    });
  }, [ancestries, ancestrySearch, ancestryRarityFilter]);

  const filteredBackgrounds = useMemo(() => {
    return backgrounds.filter(b => {
      const term = backgroundSearch.toLowerCase();
      const matchName = b.name.toLowerCase().includes(term);
      const matchSkill = (b.skills || '').toLowerCase().includes(term);
      return matchName || matchSkill;
    });
  }, [backgrounds, backgroundSearch]);

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      return c.name.toLowerCase().includes(classSearch.toLowerCase());
    });
  }, [classes, classSearch]);

  return (
    <div className="space-y-6">
      {/* Real-time Attribute Header Bar */}
      <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-3 border-b border-border-strong">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-control border border-accent/40 flex items-center justify-center text-accent-text font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={charState.name}
                  onChange={(e) => setCharState(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-canvas text-white font-bold text-lg px-2.5 py-1 rounded-lg border border-border-strong focus:border-accent outline-none"
                  placeholder={t('sheet.characterNamePlaceholder')}
                />
                <span className="text-xs px-2 py-0.5 rounded bg-elevated text-status-info font-semibold border border-border-strong">
                  {t('common.level', { level: charState.level })}
                </span>
              </div>
              <div className="text-xs text-text-secondary mt-0.5 flex items-center space-x-2">
                <span>{charState.ancestry?.name || `${t('common.ancestry')} ?`}</span>
                <span>•</span>
                <span>{charState.background?.name || `${t('common.background')} ?`}</span>
                <span>•</span>
                <span>{charState.selectedClass?.name || `${t('common.class')} ?`}</span>
              </div>
            </div>
          </div>

          {/* Quick Combat Badges */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-elevated rounded-xl border border-border-strong text-xs">
              <Heart className="w-4 h-4 text-status-danger" />
              <span className="text-text-secondary">{t('common.hp')}:</span>
              <span className="font-bold text-white text-sm">{derivedStats.maxHp}</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-elevated rounded-xl border border-border-strong text-xs">
              <Shield className="w-4 h-4 text-status-info" />
              <span className="text-text-secondary">{t('common.ac')}:</span>
              <span className="font-bold text-white text-sm">{derivedStats.ac}</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-elevated rounded-xl border border-border-strong text-xs">
              <Eye className="w-4 h-4 text-status-success" />
              <span className="text-text-secondary">{t('sheet.perception')}:</span>
              <span className="font-bold text-white text-sm">{signed(derivedStats.perception)}</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-elevated rounded-xl border border-border-strong text-xs">
              <Footprints className="w-4 h-4 text-status-warn" />
              <span className="text-text-secondary">{t('creator.speedShort')}</span>
              <span className="font-bold text-white text-sm">{t('common.feet', { value: derivedStats.speed })}</span>
            </div>
          </div>
        </div>

        {/* 6 Attributes Badges in Real Time */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-3">
          {ALL_ATTRIBUTES.map(attr => {
            const info = ATTRIBUTE_INFO[attr];
            const data = calculatedAttributes[attr];
            const sign = data.mod >= 0 ? `+${data.mod}` : `${data.mod}`;
            return (
              <div 
                key={attr} 
                className="bg-canvas border border-border-strong rounded-xl p-2.5 flex flex-col items-center justify-center text-center hover:border-text-muted transition-all"
              >
                <span className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                  {attributeShort(t, attr)}
                </span>
                <span 
                  className="text-2xl font-black mt-0.5" 
                  style={{ color: info.color }}
                >
                  {sign}
                </span>
                <span className="text-[11px] text-text-muted font-mono">
                  {t('creator.score', { score: data.score })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Steps Navigation Bar */}
      <div className="flex items-center justify-between bg-surface border border-border-strong rounded-2xl p-2 overflow-x-auto">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {[
            { num: 1, label: t('creator.step.ancestry'), icon: Sparkles, done: !!charState.ancestry },
            { num: 2, label: t('creator.step.background'), icon: BookOpen, done: !!charState.background },
            { num: 3, label: t('creator.step.class'), icon: Award, done: !!charState.selectedClass },
            { num: 4, label: t('creator.step.freeBoosts'), icon: CheckCircle2, done: charState.level1FreeBoosts.length === 4 },
            { num: 5, label: t('creator.step.summary'), icon: Save, done: false }
          ].map(step => (
            <button
              key={step.num}
              onClick={() => setCurrentStep(step.num)}
              className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                currentStep === step.num
                  ? 'bg-accent text-black font-bold shadow-md'
                  : step.done
                  ? 'bg-elevated text-status-success hover:bg-control'
                  : 'text-text-secondary hover:text-white hover:bg-elevated'
              }`}
            >
              <step.icon className={`w-4 h-4 ${step.done && currentStep !== step.num ? 'text-status-success' : ''}`} />
              <span>{step.label}</span>
              {step.done && currentStep !== step.num && (
                <Check className="w-3.5 h-3.5 text-status-success stroke-[3]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 pl-4">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-elevated hover:bg-control text-xs font-semibold text-white border border-border-strong"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.previous')}</span>
            </button>
          )}
          {currentStep < 5 && (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-xs font-bold text-black shadow"
            >
              <span className="hidden sm:inline">{t('creator.next')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: ANCESTRALIDADE (A) */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Ancestry Picker */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={ancestrySearch}
                  onChange={(e) => setAncestrySearch(e.target.value)}
                  placeholder={t('creator.searchAncestries', { count: ancestries.length })}
                  className="w-full bg-surface border border-border-strong pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <select
                value={ancestryRarityFilter}
                onChange={(e) => setAncestryRarityFilter(e.target.value)}
                className="bg-surface border border-border-strong px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-accent"
              >
                <option value="all">{t('creator.allRarities')}</option>
                <option value="common">{t('rarity.common')}</option>
                <option value="uncommon">{t('rarity.uncommon')}</option>
                <option value="rare">{t('rarity.rare')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredAncestries.map(ancestry => {
                const isSelected = charState.ancestry?.id === ancestry.id;

                return (
                  <button
                    key={ancestry.id}
                    type="button"
                    onClick={() => handleSelectAncestry(ancestry)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-between gap-2.5 text-center ${
                      isSelected
                        ? 'bg-elevated border-accent ring-1 ring-accent shadow-lg'
                        : 'bg-surface border-border-strong hover:bg-elevated'
                    }`}
                  >
                    <span className="font-bold text-white text-xs sm:text-sm leading-snug break-words w-full">
                      {ancestry.name}
                    </span>
                    <img
                      src={resolvePf2eIcon(ancestry.img, '/assets/icons/default-icons/mystery-man.svg')}
                      alt={ancestry.name}
                      className="w-4/5 aspect-square rounded-xl object-contain bg-canvas border border-border-strong p-1.5 flex-shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Ancestry Configurator */}
          <div className="lg:col-span-5 bg-surface border border-border-strong rounded-2xl p-5 space-y-5">
            {charState.ancestry ? (
              <>
                <div className="flex items-center space-x-3 pb-4 border-b border-border-strong">
                  <img
                    src={resolvePf2eIcon(charState.ancestry.img, '/assets/icons/default-icons/mystery-man.svg')}
                    alt={charState.ancestry.name}
                    className="w-14 h-14 rounded-xl object-contain bg-canvas border border-accent/50 p-1 shadow"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {charState.ancestry.name}
                      <Check className="w-5 h-5 text-status-success" />
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {t('creator.ancestrySummary', { hp: charState.ancestry.hp, speed: charState.ancestry.speed })}
                    </p>
                  </div>
                </div>

                {/* Boost Mode Toggle: Standard vs Alternative */}
                <div className="bg-elevated border border-border-strong rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {t('creator.boostRule')}
                      </h4>
                      <p className="text-[11px] text-text-secondary">
                        {t('creator.boostRuleHint')}
                      </p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={charState.useAlternativeBoosts}
                        onChange={(e) => setCharState(prev => ({ 
                          ...prev, 
                          useAlternativeBoosts: e.target.checked,
                          ancestryBoostChoices: {} 
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-control peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent relative"></div>
                    </label>
                  </div>

                  {charState.useAlternativeBoosts ? (
                    /* ALTERNATIVE ANCESTRY BOOSTS (2 Free Boosts, 0 Flaws) */
                    <div className="pt-2 border-t border-border-strong space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-accent-text font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('creator.altBoosts')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['alt0', 'alt1'].map((slotKey, idx) => (
                          <div key={slotKey} className="space-y-1">
                            <label className="text-[11px] text-text-secondary">{t('creator.freeBoostN', { n: idx + 1 })}</label>
                            <select
                              value={charState.ancestryBoostChoices[slotKey] || ''}
                              onChange={(e) => {
                                const val = e.target.value as AttributeKey;
                                setCharState(prev => ({
                                  ...prev,
                                  ancestryBoostChoices: { ...prev.ancestryBoostChoices, [slotKey]: val }
                                }));
                              }}
                              className="w-full bg-canvas border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                            >
                              <option value="">{t('creator.select')}</option>
                              {ALL_ATTRIBUTES.map(attr => (
                                <option 
                                  key={attr} 
                                  value={attr}
                                  disabled={
                                    idx === 0 
                                      ? charState.ancestryBoostChoices['alt1'] === attr 
                                      : charState.ancestryBoostChoices['alt0'] === attr
                                  }
                                >
                                  {attributeName(t, attr)} (+1 {attributeShort(t, attr)})
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* STANDARD ANCESTRY BOOSTS & FLAWS */
                    <div className="pt-2 border-t border-border-strong space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-status-success block mb-1">
                          {t('creator.standardBoosts')}
                        </span>
                        <div className="space-y-2">
                          {parsedAncestryBoosts.map((boost, idx) => {
                            const isFree = boost.options.length >= 6;
                            const isFixed = boost.options.length === 1;

                            if (isFixed) {
                              const attr = boost.options[0];
                              return (
                                <div key={boost.slotKey} className="flex items-center justify-between text-xs bg-canvas px-3 py-1.5 rounded-lg border border-border-strong">
                                  <span className="text-white font-medium">{attributeName(t, attr)}</span>
                                  <span className="px-2 py-0.5 rounded bg-status-success-bg text-status-success font-bold border border-status-success-border text-[11px]">
                                    +1 {attributeShort(t, attr)} ({t('creator.fixed')})
                                  </span>
                                </div>
                              );
                            }

                            // Free / Choice boost
                            return (
                              <div key={boost.slotKey} className="space-y-1">
                                <label className="text-[11px] text-text-secondary">
                                  {isFree ? t('creator.ancestryFreeBoost') : t('creator.boostChoice')}
                                </label>
                                <select
                                  value={charState.ancestryBoostChoices[boost.slotKey] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value as AttributeKey;
                                    setCharState(prev => ({
                                      ...prev,
                                      ancestryBoostChoices: { ...prev.ancestryBoostChoices, [boost.slotKey]: val }
                                    }));
                                  }}
                                  className="w-full bg-canvas border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                                >
                                  <option value="">{t('creator.selectAttribute')}</option>
                                  {boost.options.map(attr => (
                                    <option key={attr} value={attr}>
                                      {attributeName(t, attr)} (+1 {attributeShort(t, attr)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Flaws Display */}
                      {parsedAncestryFlaws.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-status-danger block mb-1">
                            {t('creator.standardFlaw')}
                          </span>
                          <div className="space-y-1">
                            {parsedAncestryFlaws.map(flaw => {
                              const attr = flaw.options[0];
                              if (!attr) return null;
                              return (
                                <div key={flaw.slotKey} className="flex items-center justify-between text-xs bg-canvas px-3 py-1.5 rounded-lg border border-red-950/60">
                                  <span className="text-white font-medium">{attributeName(t, attr)}</span>
                                  <span className="px-2 py-0.5 rounded bg-status-danger-bg text-status-danger font-bold border border-status-danger-border text-[11px]">
                                    -1 {attributeShort(t, attr)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* VOLUNTARY FLAW SECTION */}
                <div className="bg-elevated border border-border-strong rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>{t('creator.voluntaryFlaw')}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-control text-accent-text">{t('creator.optional')}</span>
                      </h4>
                      <p className="text-[11px] text-text-secondary">
                        {t('creator.voluntaryFlawHint')}
                      </p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={charState.useVoluntaryFlaw}
                        onChange={(e) => setCharState(prev => ({ 
                          ...prev, 
                          useVoluntaryFlaw: e.target.checked,
                          voluntaryFlaw: null,
                          voluntaryBoost: null
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-control peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500 relative"></div>
                    </label>
                  </div>

                  {charState.useVoluntaryFlaw && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-strong">
                      <div className="space-y-1">
                        <label className="text-[11px] text-status-danger font-semibold">
                          {t('creator.decrease')}
                        </label>
                        <select
                          value={charState.voluntaryFlaw || ''}
                          onChange={(e) => {
                            const val = e.target.value as AttributeKey;
                            setCharState(prev => ({ ...prev, voluntaryFlaw: val }));
                          }}
                          className="w-full bg-canvas border border-red-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-400"
                        >
                          <option value="">{t('creator.select')}</option>
                          {ALL_ATTRIBUTES.map(attr => (
                            <option 
                              key={attr} 
                              value={attr}
                              disabled={charState.voluntaryBoost === attr}
                            >
                              {attributeName(t, attr)} (-1 {attributeShort(t, attr)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-status-success font-semibold">
                          {t('creator.increase')}
                        </label>
                        <select
                          value={charState.voluntaryBoost || ''}
                          onChange={(e) => {
                            const val = e.target.value as AttributeKey;
                            setCharState(prev => ({ ...prev, voluntaryBoost: val }));
                          }}
                          className="w-full bg-canvas border border-emerald-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                        >
                          <option value="">{t('creator.select')}</option>
                          {ALL_ATTRIBUTES.map(attr => (
                            <option 
                              key={attr} 
                              value={attr}
                              disabled={charState.voluntaryFlaw === attr}
                            >
                              {attributeName(t, attr)} (+1 {attributeShort(t, attr)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description Preview */}
                <div className="text-xs text-text-secondary bg-canvas p-3 rounded-xl border border-border-strong max-h-32 overflow-y-auto leading-relaxed">
                  <p>{cleanSnippetText(charState.ancestry.description)}</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl shadow"
                  >
                    <span>{t('creator.confirmAncestry')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-16 space-y-2 text-text-secondary">
                <Sparkles className="w-10 h-10 mx-auto opacity-40 text-accent-text" />
                <h4 className="font-bold text-white text-base">{t('creator.noAncestry')}</h4>
                <p className="text-xs max-w-xs mx-auto">
                  {t('creator.noAncestryHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ANTECEDENTE (B) */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Background Picker */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={backgroundSearch}
                onChange={(e) => setBackgroundSearch(e.target.value)}
                placeholder={t('creator.searchBackgrounds', { count: backgrounds.length })}
                className="w-full bg-surface border border-border-strong pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredBackgrounds.map(bg => {
                const isSelected = charState.background?.id === bg.id;
                let parsedSkills: string[] = [];
                try { parsedSkills = JSON.parse(bg.skills || '[]'); } catch (e) {}

                return (
                  <div
                    key={bg.id}
                    onClick={() => handleSelectBackground(bg)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-elevated border-accent ring-1 ring-accent shadow-lg'
                        : 'bg-surface border-border-strong hover:border-border-strong hover:bg-elevated'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-canvas border border-border-strong flex items-center justify-center flex-shrink-0 text-accent-text">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{bg.name}</h4>
                      <div className="flex items-center space-x-1 mt-1">
                        {parsedSkills.length > 0 ? (
                          parsedSkills.map(sk => (
                            <span key={sk} className="text-[11px] bg-elevated text-status-info px-1.5 py-0.5 rounded border border-border-strong capitalize">
                              {sk}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-text-muted">{t('creator.skillTbd')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Background Configurator */}
          <div className="lg:col-span-5 bg-surface border border-border-strong rounded-2xl p-5 space-y-5">
            {charState.background ? (
              <>
                <div className="flex items-center space-x-3 pb-4 border-b border-border-strong">
                  <div className="w-14 h-14 rounded-xl bg-canvas border border-accent/50 flex items-center justify-center text-accent-text shadow">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {charState.background.name}
                      <Check className="w-5 h-5 text-status-success" />
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {t('creator.backgroundGrants')}
                    </p>
                  </div>
                </div>

                {/* Background Boosts Configuration */}
                <div className="bg-elevated border border-border-strong rounded-xl p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {t('creator.backgroundBoosts')}
                  </h4>

                  {/* Boost 1: Choice between the 2 specific attributes */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-text-secondary">
                      {t('creator.specificBoost')}
                    </label>
                    <select
                      value={charState.backgroundBoostChoice1 || ''}
                      onChange={(e) => {
                        const val = e.target.value as AttributeKey;
                        setCharState(prev => ({ ...prev, backgroundBoostChoice1: val }));
                      }}
                      className="w-full bg-canvas border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="">{t('creator.select')}</option>
                      {parsedBackgroundBoosts.specific.map(attr => (
                        <option key={attr} value={attr}>
                          {attributeName(t, attr)} (+1 {attributeShort(t, attr)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Boost 2: Free boost among any of the 6 */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-text-secondary">
                      {t('creator.freeBoostAny')}
                    </label>
                    <select
                      value={charState.backgroundBoostChoice2 || ''}
                      onChange={(e) => {
                        const val = e.target.value as AttributeKey;
                        setCharState(prev => ({ ...prev, backgroundBoostChoice2: val }));
                      }}
                      className="w-full bg-canvas border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="">{t('creator.select')}</option>
                      {ALL_ATTRIBUTES.map(attr => (
                        <option 
                          key={attr} 
                          value={attr}
                          disabled={charState.backgroundBoostChoice1 === attr}
                        >
                          {attributeName(t, attr)} (+1 {attributeShort(t, attr)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description Preview */}
                <div className="text-xs text-text-secondary bg-canvas p-3 rounded-xl border border-border-strong max-h-36 overflow-y-auto leading-relaxed">
                  <p>{cleanSnippetText(charState.background.description)}</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl shadow"
                  >
                    <span>{t('creator.confirmBackground')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-16 space-y-2 text-text-secondary">
                <BookOpen className="w-10 h-10 mx-auto opacity-40 text-accent-text" />
                <h4 className="font-bold text-white text-base">{t('creator.noBackground')}</h4>
                <p className="text-xs max-w-xs mx-auto">
                  {t('creator.noBackgroundHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: CLASSE (C) */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Class Picker */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder={t('creator.searchClasses', { count: classes.length })}
                className="w-full bg-surface border border-border-strong pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredClasses.map(cls => {
                const isSelected = charState.selectedClass?.id === cls.id;
                let keyAbils: AttributeKey[] = [];
                try { keyAbils = JSON.parse(cls.key_ability || '[]'); } catch (e) {}

                return (
                  <div
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-elevated border-accent ring-1 ring-accent shadow-lg'
                        : 'bg-surface border-border-strong hover:border-border-strong hover:bg-elevated'
                    }`}
                  >
                    <img
                      src={resolvePf2eIcon(cls.img, '/assets/icons/default-icons/class.svg')}
                      alt={cls.name}
                      className="w-12 h-12 rounded-lg object-contain bg-canvas border border-border-strong p-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{cls.name}</h4>
                      <div className="flex items-center space-x-2 text-xs text-text-secondary mt-1">
                        <span className="font-semibold text-status-danger">{t('creator.hpPerLevel', { hp: cls.hp })}</span>
                        <span>•</span>
                        <span className="text-status-info">
                          {t('creator.keyAttrShort')} {keyAbils.map(k => (k in ATTRIBUTE_INFO ? attributeShort(t, k) : k)).join('/')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Class Configurator */}
          <div className="lg:col-span-5 bg-surface border border-border-strong rounded-2xl p-5 space-y-5">
            {charState.selectedClass ? (
              <>
                <div className="flex items-center space-x-3 pb-4 border-b border-border-strong">
                  <img
                    src={resolvePf2eIcon(charState.selectedClass.img, '/assets/icons/default-icons/class.svg')}
                    alt={charState.selectedClass.name}
                    className="w-14 h-14 rounded-xl object-contain bg-canvas border border-accent/50 p-1 shadow"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {charState.selectedClass.name}
                      <Check className="w-5 h-5 text-status-success" />
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {t('creator.classHpSummary', { hp: charState.selectedClass.hp })}
                    </p>
                  </div>
                </div>

                {/* Key Ability Selection */}
                <div className="bg-elevated border border-border-strong rounded-xl p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {t('creator.classKeyAttr')}
                  </h4>
                  <p className="text-[11px] text-text-secondary">
                    {t('creator.classKeyAttrHint')}
                  </p>

                  <select
                    value={charState.classKeyAttributeChoice || ''}
                    onChange={(e) => {
                      const val = e.target.value as AttributeKey;
                      setCharState(prev => ({ ...prev, classKeyAttributeChoice: val }));
                    }}
                    className="w-full bg-canvas border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">{t('creator.selectKeyAttr')}</option>
                    {parsedClassKeyAbilities.map(attr => (
                      <option key={attr} value={attr}>
                        {attributeName(t, attr)} (+1 {attributeShort(t, attr)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Saving Throws & Proficiencies Grid */}
                <div className="bg-elevated border border-border-strong rounded-xl p-3.5 space-y-2.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {t('creator.initialSaves')}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-canvas p-2 rounded-lg border border-border-strong">
                      <span className="text-text-secondary block text-[11px]">{t('sheet.fortitude')}:</span>
                      <span className="font-bold text-white">
                        {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass.fortitude))}
                      </span>
                    </div>
                    <div className="bg-canvas p-2 rounded-lg border border-border-strong">
                      <span className="text-text-secondary block text-[11px]">{t('sheet.reflex')}:</span>
                      <span className="font-bold text-white">
                        {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass.reflex))}
                      </span>
                    </div>
                    <div className="bg-canvas p-2 rounded-lg border border-border-strong">
                      <span className="text-text-secondary block text-[11px]">{t('sheet.will')}:</span>
                      <span className="font-bold text-white">
                        {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass.will))}
                      </span>
                    </div>
                    <div className="bg-canvas p-2 rounded-lg border border-border-strong">
                      <span className="text-text-secondary block text-[11px]">{t('sheet.perception')}:</span>
                      <span className="font-bold text-white">
                        {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass.perception))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description Preview */}
                <div className="text-xs text-text-secondary bg-canvas p-3 rounded-xl border border-border-strong max-h-36 overflow-y-auto leading-relaxed">
                  <p>{cleanSnippetText(charState.selectedClass.description)}</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl shadow"
                  >
                    <span>{t('creator.confirmClass')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-16 space-y-2 text-text-secondary">
                <Award className="w-10 h-10 mx-auto opacity-40 text-accent-text" />
                <h4 className="font-bold text-white text-base">{t('creator.noClass')}</h4>
                <p className="text-xs max-w-xs mx-auto">
                  {t('creator.noClassHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: 4 AUMENTOS LIVRES DO 1º NÍVEL */}
      {currentStep === 4 && (
        <div className="bg-surface border border-border-strong rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-strong">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent-text" />
                {t('creator.freeBoostsTitle')}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {t('creator.freeBoostsHint')}
              </p>
            </div>
            <div className={`px-4 py-1.5 rounded-xl border font-bold text-sm ${
              charState.level1FreeBoosts.length === 4
                ? 'bg-status-success-bg/80 text-status-success border-status-success-border'
                : 'bg-elevated text-accent-text border-border-strong'
            }`}>
              {t('sheet.selectedOf4', { count: charState.level1FreeBoosts.length })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ALL_ATTRIBUTES.map(attr => {
              const info = ATTRIBUTE_INFO[attr];
              const isSelected = charState.level1FreeBoosts.includes(attr);
              const isDisabled = !isSelected && charState.level1FreeBoosts.length >= 4;

              return (
                <div
                  key={attr}
                  onClick={() => !isDisabled && toggleLevel1FreeBoost(attr)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-elevated border-accent ring-2 ring-accent shadow-lg'
                      : isDisabled
                      ? 'bg-canvas border-border-subtle opacity-40 cursor-not-allowed'
                      : 'bg-elevated border-border-strong hover:border-border-strong hover:bg-elevated'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: `${info.color}20`, color: info.color }}
                    >
                      {attributeShort(t, attr)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{attributeName(t, attr)}</h4>
                    </div>
                  </div>

                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-accent border-accent text-black font-bold'
                      : 'border-border-strong bg-canvas'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-4 border-t border-border-strong">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 bg-elevated hover:bg-control text-xs font-semibold text-white rounded-xl border border-border-strong"
            >
              {t('creator.backToClass')}
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="flex items-center space-x-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl shadow"
            >
              <span>{t('creator.viewSummary')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: FICHA RESUMIDA & SALVAR (SUMMARY) */}
      {currentStep === 5 && (
        <div className="space-y-6">
          {saveSuccessMsg && (
            <div className="p-4 bg-status-success-bg/80 border border-status-success-border rounded-xl text-status-success text-sm font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-status-success flex-shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Complete Character Sheet Breakdown */}
            <div className="lg:col-span-8 space-y-6">
              {/* Header Card */}
              <div className="bg-surface border border-border-strong rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsPortraitPickerOpen(true)}
                      title={t('portrait.change')}
                      aria-label={t('portrait.change')}
                      className="w-32 h-32 rounded-2xl overflow-hidden border border-border-strong hover:border-accent bg-inset flex items-center justify-center flex-shrink-0 transition-colors group"
                    >
                      {portrait ? (
                        <img src={resolvePortraitSrc(portrait)} alt={charState.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-text-muted group-hover:text-accent-text transition-colors" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black text-white tracking-tight truncate">
                        {charState.name}
                      </h2>
                      <p className="text-sm text-accent-text font-semibold mt-0.5">
                        {charState.ancestry?.name || `${t('common.ancestry')} ?`} • {charState.background?.name || `${t('common.background')} ?`} • {charState.selectedClass?.name || `${t('common.class')} ?`} {t('creator.firstLevel')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    <button
                      onClick={handleSaveCharacter}
                      disabled={saving}
                      className="flex items-center space-x-2 px-4 py-2.5 bg-control hover:bg-control-hover text-white font-bold text-xs rounded-xl border border-text-muted shadow transition-all disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 text-accent-text" />
                      <span>{saving ? t('common.saving') : t('creator.saveCharacter')}</span>
                    </button>
                    {onNavigateToLevels && (
                      <button
                        onClick={async () => {
                          const ok = await handleSaveCharacter();
                          if (ok) onNavigateToLevels();
                        }}
                        disabled={saving}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
                      >
                        <span>{t('creator.saveAndOpen')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Core Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border-strong">
                  <div className="bg-canvas p-3 rounded-xl border border-border-strong text-center">
                    <span className="text-[11px] text-text-secondary uppercase font-bold">{t('creator.hpLabel')}</span>
                    <span className="text-2xl font-black text-status-danger block mt-0.5">{derivedStats.maxHp}</span>
                    <span className="text-[11px] text-text-muted">
                      {charState.ancestry?.hp || 0} + {charState.selectedClass?.hp || 0} + {attributeShort(t, 'con')} ({signed(calculatedAttributes.con.mod)})
                    </span>
                  </div>

                  <div className="bg-canvas p-3 rounded-xl border border-border-strong text-center">
                    <span className="text-[11px] text-text-secondary uppercase font-bold">{t('creator.acLabel')}</span>
                    <span className="text-2xl font-black text-status-info block mt-0.5">{derivedStats.ac}</span>
                    <span className="text-[11px] text-text-muted">{t('creator.acFormula', { dex: attributeShort(t, 'dex'), mod: signed(calculatedAttributes.dex.mod) })}</span>
                  </div>

                  <div className="bg-canvas p-3 rounded-xl border border-border-strong text-center">
                    <span className="text-[11px] text-text-secondary uppercase font-bold">{t('sheet.perception')}</span>
                    <span className="text-2xl font-black text-status-success block mt-0.5">{signed(derivedStats.perception)}</span>
                    <span className="text-[11px] text-text-muted">{attributeShort(t, 'wis')} ({signed(calculatedAttributes.wis.mod)}) + {t('creator.levelProf')}</span>
                  </div>

                  <div className="bg-canvas p-3 rounded-xl border border-border-strong text-center">
                    <span className="text-[11px] text-text-secondary uppercase font-bold">{t('creator.speed')}</span>
                    <span className="text-2xl font-black text-status-warn block mt-0.5">{t('common.feet', { value: derivedStats.speed })}</span>
                    <span className="text-[11px] text-text-muted">{sizeLabel(charState.ancestry?.size || 'med')}</span>
                  </div>
                </div>
              </div>

              {/* Attributes & Sources Breakdown Table */}
              <div className="bg-surface border border-border-strong rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent-text" />
                  {t('creator.attributeBreakdown')}
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-strong text-text-secondary">
                        <th className="py-2.5 px-3">{t('creator.attribute')}</th>
                        <th className="py-2.5 px-3 text-center">{t('creator.modifier')}</th>
                        <th className="py-2.5 px-3 text-center">{t('creator.scoreHeader')}</th>
                        <th className="py-2.5 px-3">{t('creator.sourcesHeader')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {ALL_ATTRIBUTES.map(attr => {
                        const info = ATTRIBUTE_INFO[attr];
                        const data = calculatedAttributes[attr];
                        const sign = data.mod >= 0 ? `+${data.mod}` : `${data.mod}`;

                        return (
                          <tr key={attr} className="hover:bg-elevated/50">
                            <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                              <span 
                                className="w-2.5 h-2.5 rounded-full" 
                                style={{ backgroundColor: info.color }}
                              />
                              <span>{attributeName(t, attr)} ({attributeShort(t, attr)})</span>
                            </td>
                            <td className="py-3 px-3 text-center font-black text-sm" style={{ color: info.color }}>
                              {sign}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-text-secondary">
                              {data.score}
                            </td>
                            <td className="py-3 px-3">
                              {data.sources.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {data.sources.map((src, i) => (
                                    <span
                                      key={i}
                                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                        src.type === 'boost'
                                          ? 'bg-status-success-bg/80 text-status-success border-status-success-border'
                                          : 'bg-status-danger-bg/80 text-status-danger border-status-danger-border'
                                      }`}
                                    >
                                      {src.type === 'boost' ? '+1' : '-1'} {t(src.labelKey)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-text-muted">{t('creator.noModifiers')}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Saving Throws Detail Card */}
              <div className="bg-surface border border-border-strong rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-status-info" />
                  {t('creator.savingThrows')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-canvas p-3 rounded-xl border border-border-strong">
                    <span className="text-xs font-bold text-text-secondary block">{t('sheet.fortitude')} ({attributeShort(t, 'con')})</span>
                    <span className="text-2xl font-black text-white mt-1 block">{signed(derivedStats.fortitude)}</span>
                    <span className="text-[11px] text-text-muted">
                      {attributeName(t, 'con')} ({signed(calculatedAttributes.con.mod)}) + {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass?.fortitude))}
                    </span>
                  </div>
                  <div className="bg-canvas p-3 rounded-xl border border-border-strong">
                    <span className="text-xs font-bold text-text-secondary block">{t('sheet.reflex')} ({attributeShort(t, 'dex')})</span>
                    <span className="text-2xl font-black text-white mt-1 block">{signed(derivedStats.reflex)}</span>
                    <span className="text-[11px] text-text-muted">
                      {attributeName(t, 'dex')} ({signed(calculatedAttributes.dex.mod)}) + {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass?.reflex))}
                    </span>
                  </div>
                  <div className="bg-canvas p-3 rounded-xl border border-border-strong">
                    <span className="text-xs font-bold text-text-secondary block">{t('sheet.will')} ({attributeShort(t, 'wis')})</span>
                    <span className="text-2xl font-black text-white mt-1 block">{signed(derivedStats.will)}</span>
                    <span className="text-[11px] text-text-muted">
                      {attributeName(t, 'wis')} ({signed(calculatedAttributes.wis.mod)}) + {proficiencyWithBonus(t, toProficiencyRank(charState.selectedClass?.will))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Saved Characters in SQLite */}
            <div className="lg:col-span-4 bg-surface border border-border-strong rounded-2xl p-5 space-y-4 h-fit">
              <div className="flex items-center justify-between pb-3 border-b border-border-strong">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4 text-accent-text" />
                  {t('creator.savedCharacters', { count: savedCharacters.length })}
                </h3>
              </div>

              {savedCharacters.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-secondary space-y-1">
                  <p>{t('creator.noSavedCharacters')}</p>
                  <p className="text-[11px] text-text-muted">
                    {t('creator.noSavedCharactersHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {savedCharacters.map(char => {
                    const charPortrait = resolvePortraitSrc(getCharacterPortrait(char));
                    return (
                    <div
                      key={char.id}
                      onClick={() => handleLoadCharacter(char)}
                      className="p-3 bg-elevated hover:bg-control border border-border-strong rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        {charPortrait ? (
                          <img src={charPortrait} alt={char.name} className="w-9 h-9 rounded-lg object-cover border border-border-strong flex-shrink-0 bg-inset" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-inset border border-border-strong flex items-center justify-center flex-shrink-0 text-text-muted">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-white text-xs truncate group-hover:text-accent-text">
                            {char.name}
                          </h4>
                          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                            {char.ancestry} • {char.class} • {t('common.levelShort', { level: char.level })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 pl-2">
                        <button
                          onClick={(e) => handleDeleteCharacter(char.id, e)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-status-danger hover:bg-status-danger-bg/40 transition-colors"
                          title={t('creator.deleteCharacter')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isPortraitPickerOpen && (
        <PortraitPickerModal
          currentPortrait={portrait}
          characterAncestry={charState.ancestry?.name}
          onSelect={setPortrait}
          onClose={() => setIsPortraitPickerOpen(false)}
        />
      )}
      {dialogState && (
        <ConfirmDialog
          title={dialogState.title}
          message={dialogState.message}
          variant={dialogState.variant}
          confirmLabel={dialogState.variant === 'danger' ? t('common.remove') : t('common.close')}
          onCancel={() => setDialogState(null)}
          onConfirm={async () => {
            const targetId = dialogState.deleteId;
            setDialogState(null);
            if (!targetId) return;
            try {
              await deleteCharacter(targetId);
              setSavedCharacters(prev => prev.filter(c => c.id !== targetId));
            } catch (err) {
              console.error('Erro ao excluir:', err);
            }
          }}
        />
      )}
    </div>
  );
};
