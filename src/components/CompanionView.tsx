import React from 'react';
import { AttributeKey, CharacterCompanion, CompanionKind, VisionType, SkillKey } from '../types/pf2e';
import { ALL_ATTRIBUTES, ALL_SKILLS } from '../utils/formatters';
import { attributeShort, signed, skillName } from '../i18n/gameTerms';
import { useI18n } from '../i18n/I18nContext';
import { IconButton } from './IconButton';
import { Eye, Footprints, Heart, PawPrint, Plus, Save, Shield, Sparkles, Star, Swords, Trash2 } from 'lucide-react';

interface CompanionViewProps {
  companions: CharacterCompanion[];
  characterLevel: number;
  onChange: (next: CharacterCompanion[]) => void;
  onSave: () => Promise<boolean>;
  saving: boolean;
}

const COMPANION_KINDS: readonly CompanionKind[] = ['animal', 'familiar', 'eidolon', 'construct'];
const VISION_TYPES: readonly VisionType[] = ['normal', 'low-light-vision', 'darkvision', 'greater-darkvision'];

function createDefaultCompanion(level: number, defaultName: string): CharacterCompanion {
  return {
    id: `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: defaultName,
    kind: 'animal',
    species: '',
    level,
    size: 'med',
    speed: 25,
    vision: 'low-light-vision',
    visionRange: '',
    skills: {},
    senses: '',
    currentHp: 14,
    maxHp: 14,
    ac: 16,
    fortitude: 5,
    reflex: 6,
    will: 4,
    perception: 5,
    attributes: { str: 2, dex: 3, con: 2, int: -4, wis: 1, cha: 0 },
    attacks: '',
    support: '',
    notes: '',
  };
}

export const CompanionView: React.FC<CompanionViewProps> = ({ companions, characterLevel, onChange, onSave, saving }) => {
  const { t } = useI18n();

  const updateOne = (id: string, patch: Partial<CharacterCompanion>) => {
    onChange(companions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeOne = (id: string) => {
    onChange(companions.filter((c) => c.id !== id));
  };

  return (
    <div className="bg-surface border border-border-strong rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <PawPrint className="w-4 h-4 text-accent-text" />
          <span>{t('companion.title')}</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          disabled={saving}
          onClick={() => { void onSave(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-control hover:bg-control-hover text-text-primary text-xs font-bold disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? t('common.saving') : t('companion.save')}
        </button>
        <button
          type="button"
          onClick={() => onChange([...companions, createDefaultCompanion(characterLevel, t('companion.kind.animal'))])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-bold transition-colors print:hidden"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('companion.add')}</span>
        </button>
        </div>
      </div>

      {companions.length === 0 ? (
        <div className="py-10 text-center space-y-1.5 bg-inset border border-dashed border-border-strong rounded-xl px-4">
          <PawPrint className="w-8 h-8 text-text-muted mx-auto opacity-60" />
          <p className="text-xs font-semibold text-text-secondary">{t('companion.empty')}</p>
          <p className="text-xs text-text-muted max-w-md mx-auto">{t('companion.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {companions.map((comp) => {
            const hpPct = comp.maxHp > 0 ? Math.min(100, Math.max(0, (comp.currentHp / comp.maxHp) * 100)) : 0;
            return (
              <div key={comp.id} className="bg-inset border border-border-strong rounded-2xl p-4 space-y-4">
                {/* 1. Identidade */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-3 border-b border-border-subtle">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 flex-1">
                    <label className="sm:col-span-5 space-y-1">
                      <span className="text-xs font-bold uppercase text-text-muted block">{t('companion.name')}</span>
                      <input
                        type="text"
                        value={comp.name}
                        onChange={(e) => updateOne(comp.id, { name: e.target.value })}
                        className="w-full bg-surface border border-border-strong rounded-lg px-2.5 py-1.5 text-sm font-black text-white"
                      />
                    </label>

                    <label className="sm:col-span-3 space-y-1">
                      <span className="text-xs font-bold uppercase text-text-muted block">{t('companion.kind')}</span>
                      <select
                        value={comp.kind}
                        onChange={(e) => updateOne(comp.id, { kind: e.target.value as CompanionKind })}
                        className="w-full bg-surface border border-border-strong rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary"
                      >
                        {COMPANION_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`companion.kind.${kind}`)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="sm:col-span-3 space-y-1">
                      <span className="text-xs font-bold uppercase text-text-muted block">{t('companion.species')}</span>
                      <input
                        type="text"
                        value={comp.species}
                        placeholder={t('companion.speciesPlaceholder')}
                        onChange={(e) => updateOne(comp.id, { species: e.target.value })}
                        className="w-full bg-surface border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
                      />
                    </label>

                    <label className="sm:col-span-1 space-y-1">
                      <span className="text-xs font-bold uppercase text-text-muted block">{t('common.levelLabel')}</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={comp.level}
                        onChange={(e) => updateOne(comp.id, { level: Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))) })}
                        className="w-full bg-surface border border-border-strong rounded-lg px-2 py-1.5 text-xs font-black text-accent-text text-center tabular-nums"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end print:hidden">
                    <IconButton
                      icon={<Trash2 className="w-4 h-4" />}
                      label={t('companion.remove')}
                      variant="danger"
                      onClick={() => removeOne(comp.id)}
                    />
                  </div>
                </div>

                {/* 2. Sobrevivência & Defesas (Uso imediato na mesa) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                  {/* HP */}
                  <div className="lg:col-span-4 bg-surface border border-border-subtle rounded-xl p-3 space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-status-danger flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5" />
                        <span>{t('common.hp')}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          aria-label={t('session.currentHp')}
                          value={comp.currentHp}
                          onChange={(e) => updateOne(comp.id, { currentHp: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                          className="w-16 bg-inset border border-border-strong rounded-lg px-2 py-1 text-sm font-black text-white text-center tabular-nums"
                        />
                        <span className="text-xs font-bold text-text-muted">/</span>
                        <input
                          type="number"
                          min={1}
                          aria-label="Max HP"
                          value={comp.maxHp}
                          onChange={(e) => updateOne(comp.id, { maxHp: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                          className="w-16 bg-inset border border-border-strong rounded-lg px-2 py-1 text-xs font-bold text-text-secondary text-center tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
                      <div
                        className={`h-full transition-all duration-200 ${hpPct <= 25 ? 'bg-red-500' : hpPct <= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                  </div>

                  {/* AC */}
                  <label className="lg:col-span-2 bg-surface border border-border-subtle rounded-xl p-3 flex flex-col justify-between gap-1.5">
                    <span className="text-xs font-bold uppercase text-status-info flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>{t('common.ac')}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={comp.ac}
                      onChange={(e) => updateOne(comp.id, { ac: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2 py-1 text-base font-black text-white text-center tabular-nums"
                    />
                  </label>

                  {/* Saving Throws Capsule */}
                  <div className="lg:col-span-6 bg-surface border border-border-subtle rounded-xl p-3 space-y-2">
                    <span className="text-xs font-bold uppercase text-text-secondary flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-accent-text" />
                      <span>{t('creator.savingThrows')}</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="bg-inset border border-border-subtle rounded-lg px-2 py-1.5 flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold uppercase text-text-muted truncate">{t('sheet.fortitude')}</span>
                        <input
                          type="number"
                          value={comp.fortitude}
                          onChange={(e) => updateOne(comp.id, { fortitude: Math.floor(Number(e.target.value) || 0) })}
                          className="w-12 bg-surface border border-border-strong rounded px-1 py-0.5 text-xs font-black text-white text-center tabular-nums"
                        />
                      </label>
                      <label className="bg-inset border border-border-subtle rounded-lg px-2 py-1.5 flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold uppercase text-text-muted truncate">{t('sheet.reflex')}</span>
                        <input
                          type="number"
                          value={comp.reflex}
                          onChange={(e) => updateOne(comp.id, { reflex: Math.floor(Number(e.target.value) || 0) })}
                          className="w-12 bg-surface border border-border-strong rounded px-1 py-0.5 text-xs font-black text-white text-center tabular-nums"
                        />
                      </label>
                      <label className="bg-inset border border-border-subtle rounded-lg px-2 py-1.5 flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold uppercase text-text-muted truncate">{t('sheet.will')}</span>
                        <input
                          type="number"
                          value={comp.will}
                          onChange={(e) => updateOne(comp.id, { will: Math.floor(Number(e.target.value) || 0) })}
                          className="w-12 bg-surface border border-border-strong rounded px-1 py-0.5 text-xs font-black text-white text-center tabular-nums"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Percepção, Movimento & Sentidos */}
                <div className="bg-surface border border-border-subtle rounded-xl p-3 grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end">
                  <label className="sm:col-span-2 space-y-1">
                    <span className="text-xs font-bold uppercase text-status-purple flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> {t('sheet.perception')}
                    </span>
                    <input
                      type="number"
                      value={comp.perception}
                      onChange={(e) => updateOne(comp.id, { perception: Math.floor(Number(e.target.value) || 0) })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2 py-1.5 text-xs font-black text-white text-center tabular-nums"
                    />
                  </label>

                  <label className="sm:col-span-2 space-y-1">
                    <span className="text-xs font-bold uppercase text-status-warn flex items-center gap-1">
                      <Footprints className="w-3.5 h-3.5" /> {t('creator.speed')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={comp.speed}
                      onChange={(e) => updateOne(comp.id, { speed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2 py-1.5 text-xs font-black text-white text-center tabular-nums"
                    />
                  </label>

                  <label className="col-span-2 sm:col-span-3 space-y-1">
                    <span className="text-xs font-bold uppercase text-text-muted flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent-text" /> {t('sheet.vision')}
                    </span>
                    <select
                      value={comp.vision}
                      onChange={(e) => updateOne(comp.id, { vision: e.target.value as VisionType })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                    >
                      {VISION_TYPES.map((v) => (
                        <option key={v} value={v}>
                          {t(`sheet.vision.${v}`)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="col-span-1 sm:col-span-2 space-y-1">
                    <span className="text-xs font-bold uppercase text-text-muted block">{t('companion.visionRange')}</span>
                    <input
                      type="text"
                      value={comp.visionRange || ''}
                      onChange={(e) => updateOne(comp.id, { visionRange: e.target.value })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                    />
                  </label>

                  <label className="col-span-1 sm:col-span-3 space-y-1">
                    <span className="text-xs font-bold uppercase text-text-muted block">{t('sheet.sensesPlaceholder')}</span>
                    <input
                      type="text"
                      value={comp.senses}
                      placeholder={t('sheet.sensesPlaceholder')}
                      onChange={(e) => updateOne(comp.id, { senses: e.target.value })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
                    />
                  </label>
                </div>

                <div className="bg-surface border border-border-subtle rounded-xl p-3 space-y-2">
                  <span className="text-xs font-bold uppercase text-text-secondary">{t('companion.skills')}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ALL_SKILLS.map((skill: SkillKey) => {
                      const selected = Object.prototype.hasOwnProperty.call(comp.skills || {}, skill);
                      return (
                        <div key={skill} className="flex items-center justify-between gap-2 bg-inset border border-border-subtle rounded-lg px-2 py-1">
                          <label className="flex items-center gap-2 text-xs text-text-primary">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => {
                                const skills = { ...comp.skills };
                                if (event.target.checked) skills[skill] = 0;
                                else delete skills[skill];
                                updateOne(comp.id, { skills });
                              }}
                            />
                            {skillName(t, skill)}
                          </label>
                          {selected && (
                            <input
                              type="number"
                              aria-label={t('companion.skillModifier', { skill: skillName(t, skill) })}
                              value={comp.skills?.[skill] ?? 0}
                              onChange={(event) => updateOne(comp.id, {
                                skills: { ...comp.skills, [skill]: Math.trunc(Number(event.target.value) || 0) },
                              })}
                              className="w-16 bg-surface border border-border-strong rounded px-1 py-0.5 text-xs text-text-primary text-center"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Ações em Combate: Ataques & Benefício de Suporte */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="bg-surface border border-border-subtle rounded-xl p-3 space-y-1.5">
                    <span className="text-xs font-bold uppercase text-accent-text flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5" />
                      <span>{t('companion.attacks')}</span>
                    </span>
                    <textarea
                      rows={3}
                      value={comp.attacks}
                      placeholder={t('companion.attacksPlaceholder')}
                      onChange={(e) => updateOne(comp.id, { attacks: e.target.value })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
                    />
                  </label>

                  <label className="bg-surface border border-border-subtle rounded-xl p-3 space-y-1.5">
                    <span className="text-xs font-bold uppercase text-status-info flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('companion.support')}</span>
                    </span>
                    <textarea
                      rows={3}
                      value={comp.support}
                      placeholder={t('companion.supportPlaceholder')}
                      onChange={(e) => updateOne(comp.id, { support: e.target.value })}
                      className="w-full bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
                    />
                  </label>
                </div>

                {/* 5. Referência Secundária: Atributos & Notas */}
                <div className="bg-surface border border-border-subtle rounded-xl p-3 space-y-2.5">
                  <span className="text-xs font-bold uppercase text-text-secondary flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-accent-text" />
                    <span>{t('sheet.consolidatedAttributes')}</span>
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {ALL_ATTRIBUTES.map((attr: AttributeKey) => (
                      <label key={attr} className="bg-inset border border-border-subtle rounded-lg p-1.5 text-center space-y-1">
                        <span className="text-xs font-bold uppercase text-text-muted block">
                          {attributeShort(t, attr)}
                        </span>
                        <input
                          type="number"
                          value={comp.attributes[attr]}
                          onChange={(e) =>
                            updateOne(comp.id, {
                              attributes: { ...comp.attributes, [attr]: Math.floor(Number(e.target.value) || 0) },
                            })
                          }
                          aria-label={`${attributeShort(t, attr)} (${signed(comp.attributes[attr])})`}
                          className="w-full bg-surface border border-border-strong rounded px-1 py-0.5 text-xs font-black text-center text-white tabular-nums"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
