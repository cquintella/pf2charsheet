import { ActionSymbol } from './ActionSymbol';
import React, { useState, useEffect, useRef } from 'react';
import { FeatItem, FeatFilters, FeatSelectionRecord, AttributeKey, SkillKey, ProficiencyRank, ClassItem } from '../types/pf2e';
import { evaluatePrerequisites, RequirementResult } from '../utils/featRules';
import { fetchClasses, fetchFeats } from '../services/api';
import { resolvePf2eIcon, cleanDescriptionHtml } from '../utils/formatters';
import { X, Search, Award, Check, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { ConfirmDialog } from './ConfirmDialog';
import { useModalFocus, clickableProps } from '../utils/useModalFocus';

interface FeatPickerModalProps {
  ruleAttributes: Record<AttributeKey, number>;
  ruleSkills: Record<SkillKey, ProficiencyRank>;
  orderNames?: string[];
  incompleteOrders?: boolean;
  existingFeats: (FeatSelectionRecord & { takenAt: number })[];
  slotTitle: string;
  slotCategory: 'ancestry' | 'class' | 'skill' | 'general' | string;
  maxLevel: number;
  characterLevel?: number;
  selectedFeatId?: string | null;
  ancestryTrait?: string | null;
  ancestryName?: string | null;
  heritageName?: string;
  characterClass?: ClassItem | null;
  extraAncestryTraits?: string[];
  onSelectFeat: (feat: FeatItem) => void;
  onClose: () => void;
}

export const FeatPickerModal: React.FC<FeatPickerModalProps> = ({
  existingFeats,
  ruleAttributes,
  ruleSkills,
  orderNames,
  incompleteOrders,
  slotTitle,
  slotCategory,
  maxLevel,
  characterLevel,
  selectedFeatId,
  ancestryTrait,
  ancestryName,
  heritageName,
  characterClass,
  extraAncestryTraits = [],
  onSelectFeat,
  onClose
}) => {
  const { t } = useI18n();
  const requirementText = (result: RequirementResult): string => result.unreadable ? t('picker.unreadable') : result.text;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(slotCategory === 'archetype' ? 'all' : slotCategory);
  const [traitFilter, setTraitFilter] = useState<'all' | 'archetype' | 'multiclass' | 'dedication'>(
    slotCategory === 'archetype' ? 'archetype' : 'all'
  );
  const [ancestryScope, setAncestryScope] = useState<string>('character');
  const [classScope, setClassScope] = useState<string>(() => (characterClass?.slug || characterClass?.name || '').toLowerCase() || 'all');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [limit, setLimit] = useState(60);
  const [feats, setFeats] = useState<FeatItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewFeat, setPreviewFeat] = useState<FeatItem | null>(null);
  const [dialogState, setDialogState] = useState<{
    title: string;
    message: string;
    variant: 'alert' | 'primary';
    feat?: FeatItem;
  } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef, onClose, !dialogState);

  useEffect(() => {
    let active = true;
    fetchClasses().then(items => { if (active) setClasses(items); }).catch(error => { if (active) console.error('Erro ao carregar classes:', error); });
    return () => { active = false; };
  }, []);

  // Load feats matching slot constraints
  useEffect(() => {
    let active = true;
    setLoading(true);

    // When category is ancestry and scoped to character ancestry, lock trait; otherwise apply archetype/multiclass/dedication filter
    const isAncestry = category === 'ancestry';
    const effectiveTrait = slotCategory === 'archetype'
      ? (traitFilter === 'all' ? 'archetype' : traitFilter)
      : traitFilter !== 'all'
      ? traitFilter
      : (isAncestry && ancestryScope !== 'all')
      ? (ancestryScope === 'character' ? (ancestryTrait || 'all') : ancestryScope)
      : category === 'class' && classScope !== 'all'
      ? classScope
      : 'all';

    const filters: FeatFilters = {
      search,
      category: category === 'all' ? 'all' : category,
      level: 'all',
      max_level: String(maxLevel),
      action_type: 'all',
      actions: 'all',
      rarity: 'all',
      trait: effectiveTrait,
      limit,
      offset: 0
    };

    fetchFeats(filters)
      .then((data) => {
        if (!active) return;
        setFeats(data.feats);
        setTotal(data.total);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Erro ao buscar talentos para o slot:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, category, traitFilter, maxLevel, ancestryTrait, ancestryScope, classScope, slotCategory, limit]);

  const selectFeat = (feat: FeatItem) => {
    let traits: string[] = [];
    try { traits = JSON.parse(feat.traits || '[]'); } catch { /* Dados ausentes. */ }
    if (slotCategory === 'archetype' && !traits.includes('archetype')) return;
    const results = evaluatePrerequisites(feat.prerequisites, { attributes: ruleAttributes, skills: ruleSkills, feats: existingFeats, orderNames, incompleteOrders, heritageName });
    const unmet = results.filter(result => result.status === 'unmet');
    if (unmet.length) {
      setDialogState({
        title: t('feat.prerequisites'),
        message: t('picker.unmet', { list: unmet.map(requirementText).join('; ') }),
        variant: 'alert',
      });
      return;
    }
    const sortedExisting = [...existingFeats].sort((a, b) => a.takenAt - b.takenAt);
    const dedications = sortedExisting.filter(f => {
      try { return (JSON.parse(f.traits || '[]') as string[]).includes('dedication'); } catch { return false; }
    });
    const lastDedication = dedications[dedications.length - 1];
    const archetypeFeatsAfterLast = lastDedication
      ? sortedExisting.filter(f => {
          if (f.takenAt < lastDedication.takenAt || f.featId === lastDedication.featId) return false;
          try {
            const ft = JSON.parse(f.traits || '[]') as string[];
            return ft.includes('archetype') && !ft.includes('dedication');
          } catch { return false; }
        }).length
      : 0;
    const messages = results.filter(result => result.status === 'unknown').map(result => t('picker.check', { text: requirementText(result) }));
    if (traits.includes('dedication') && dedications.length) {
      messages.push(t('picker.previousDedications', { list: dedications.map(f => f.featName).join(', ') }));
      if (archetypeFeatsAfterLast < 2) {
        messages.push(t('picker.dedicationLimitWarning', { count: archetypeFeatsAfterLast }));
      }
    }
    if (traits.includes('archetype') && !traits.includes('dedication') && !results.some(result => /dedication$/i.test(result.text))) messages.push(t('picker.checkDedication'));
    if (messages.length) {
      setDialogState({
        title: t('feat.prerequisites'),
        message: `${messages.join('\n')}\n\n${t('picker.confirmAfterCheck')}`,
        variant: 'primary',
        feat,
      });
      return;
    }
    onSelectFeat(feat);
  };

  const renderActionBadge = (feat: FeatItem) => {
    if (feat.action_type === 'passive') {
      return <span className="text-xs text-text-secondary px-1.5 py-0.5 rounded bg-elevated border border-border-strong">{t('action.passive')}</span>;
    }
    if (feat.action_type === 'reaction') {
      return <span className="pf-action-icon text-xs px-1.5 bg-status-danger-bg text-status-danger border-status-danger-border"><ActionSymbol kind="reaction" /> {t('action.reaction')}</span>;
    }
    if (feat.action_type === 'free') {
      return <span className="pf-action-icon text-xs px-1.5 bg-status-success-bg text-status-success border-status-success-border"><ActionSymbol kind="free" /> {t('action.freeShort')}</span>;
    }
    if (feat.actions === '1') return <span className="pf-action-icon text-xs px-1.5"><ActionSymbol kind="one" /> 1</span>;
    if (feat.actions === '2') return <span className="pf-action-icon text-xs px-1.5"><ActionSymbol kind="two" /> 2</span>;
    if (feat.actions === '3') return <span className="pf-action-icon text-xs px-1.5"><ActionSymbol kind="three" /> 3</span>;
    return <span className="text-xs text-text-secondary">{t('action.generic')}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={slotTitle}
        className="relative w-full max-w-4xl max-h-[90vh] bg-surface border border-border-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-strong bg-elevated">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-control border border-text-muted flex items-center justify-center text-accent-text">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                <span>{slotTitle}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong">
                  {t('picker.maxLevel', { level: maxLevel })}
                </span>
                {slotCategory === 'ancestry' && ancestryName && (
                  <span className="text-xs px-2 py-0.5 rounded bg-status-success-bg text-status-success border border-status-success-border font-bold">
                    {t('common.ancestry')}: {ancestryName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-text-secondary">
                {slotCategory === 'ancestry' && ancestryName
                  ? t('picker.ancestryOnly', { ancestry: ancestryName })
                  : t('picker.selectHint')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-control transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-border-strong bg-inset flex flex-col gap-3">
          {/* Search Input */}
          <div className="relative min-w-0 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('picker.searchPlaceholder')}
              className="w-full bg-elevated border border-border-strong pl-9 pr-8 py-2 rounded-xl text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {slotCategory === 'archetype' ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'archetype', label: t('picker.archetypeFeats') },
                    { id: 'multiclass', label: t('picker.filterMulticlass') },
                    { id: 'dedication', label: t('picker.filterDedication') },
                  ] as const
                ).map(tf => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => { setTraitFilter(tf.id); setLimit(60); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                      traitFilter === tf.id
                        ? 'bg-accent text-black shadow'
                        : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            ) : slotCategory === 'ancestry' ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setAncestryScope('character'); setLimit(60); }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    ancestryScope === 'character'
                      ? 'bg-accent text-black shadow'
                      : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{t('picker.featsOf', { ancestry: ancestryName || t('common.ancestry') })}</span>
                </button>
                {extraAncestryTraits
                  .filter(tr => tr && tr !== ancestryTrait?.toLowerCase())
                  .map(tr => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => { setAncestryScope(tr); setLimit(60); }}
                      className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all whitespace-nowrap ${
                        ancestryScope === tr
                          ? 'bg-accent text-black shadow'
                          : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
                      }`}
                    >
                      {tr}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => { setAncestryScope('all'); setLimit(60); }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                    ancestryScope === 'all'
                      ? 'bg-accent text-black shadow'
                      : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
                  }`}
                >
                  {t('picker.allAncestries')}
                </button>
              </div>
            ) : (
              [
                { id: slotCategory, label: t('picker.defaultCategory', { category: slotCategory }) },
                { id: 'class', label: t('featCategory.class') },
                { id: 'skill', label: t('featCategory.skill') },
                { id: 'general', label: t('featCategory.general') },
                { id: 'ancestry', label: t('featCategory.ancestry') },
                { id: 'all', label: t('common.all') }
              ].filter((v, i, a) => a.findIndex(other => other.id === v.id) === i).map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id); setTraitFilter('all'); }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                    category === c.id && traitFilter === 'all'
                      ? 'bg-accent text-black shadow'
                      : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
                  }`}
                >
                  {c.label}
                </button>
              )).concat(
                (['archetype', 'multiclass', 'dedication'] as const).map(tf => (
                  <button
                    key={`trait_${tf}`}
                    type="button"
                    onClick={() => { setCategory('all'); setTraitFilter(prev => prev === tf ? 'all' : tf); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                      traitFilter === tf
                        ? 'bg-accent text-black shadow'
                        : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
                    }`}
                  >
                    {t(tf === 'archetype' ? 'picker.filterArchetype' : tf === 'multiclass' ? 'picker.filterMulticlass' : 'picker.filterDedication')}
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {slotCategory !== 'archetype' && category === 'class' && traitFilter === 'all' && (
          <div className="px-4 py-3 border-b border-border-strong bg-inset flex flex-wrap items-center gap-3">
            <label htmlFor="feat-picker-class" className="text-sm font-semibold text-text-secondary">{t('picker.classFilter')}</label>
            <select id="feat-picker-class" value={classScope} onChange={event => { setClassScope(event.target.value); setLimit(60); }} className="rounded-lg border border-border-strong bg-elevated px-3 py-1.5 text-text-primary">
              <option value="all">{t('picker.allClasses')}</option>
              {characterClass && !classes.some(item => (item.slug || item.name).toLowerCase() === classScope) && classScope !== 'all' && <option value={classScope}>{characterClass.name}</option>}
              {[...classes].sort((a, b) => a.name.localeCompare(b.name)).map(item => <option key={item.id} value={(item.slug || item.name).toLowerCase()}>{item.name}</option>)}
            </select>
          </div>
        )}

        {/* Feat List Content (Master-Detail) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          <div className="lg:col-span-6 overflow-y-auto p-4 space-y-2 border-b lg:border-b-0 lg:border-r border-border-subtle">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-accent-text animate-spin" />
              <p className="text-xs text-text-secondary">{t('picker.loading')}</p>
            </div>
          ) : feats.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Award className="w-10 h-10 text-text-secondary mx-auto opacity-50" />
              <h3 className="text-sm font-bold text-white">{t('featExplorer.noResults')}</h3>
              <p className="text-xs text-text-secondary">
                {t('picker.noResultsHint')}
              </p>
            </div>
          ) : (
            feats.map((feat) => {
              let traits: string[] = [];
              try { traits = JSON.parse(feat.traits || '[]'); } catch { /* ignore */ }
              const requirementResults = evaluatePrerequisites(feat.prerequisites, { attributes: ruleAttributes, skills: ruleSkills, feats: existingFeats, orderNames, incompleteOrders, heritageName });
              const isSelected = selectedFeatId === feat.id;
              const isPreviewed = previewFeat?.id === feat.id;
              const hasUnmet = requirementResults.some(r => r.status === 'unmet');
              const imageSrc = resolvePf2eIcon(feat.img, '/assets/icons/default-icons/feat.svg');

              return (
                <div
                  key={feat.id}
                  {...clickableProps(() => setPreviewFeat(feat))}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isPreviewed
                      ? 'bg-elevated border-accent shadow-md'
                      : isSelected
                      ? 'bg-control/50 border-accent/60'
                      : 'bg-surface hover:bg-elevated border-border-subtle hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-elevated border border-border-strong p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      <img
                        src={imageSrc}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/icons/default-icons/feat.svg'; }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-bold text-sm text-text-primary">{feat.name}</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-elevated text-accent-text border border-border-strong tabular-nums">
                          {t('common.levelShort', { level: feat.level })}
                        </span>
                        {renderActionBadge(feat)}
                        {hasUnmet && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-status-danger-bg text-status-danger border border-status-danger-border">
                            ✗
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-1 line-clamp-1">
                        {traits.slice(0, 4).join(' · ') || feat.category}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>

          <div className="lg:col-span-6 overflow-y-auto p-5 bg-inset">
            {previewFeat ? (() => {
              let traits: string[] = [];
              try { traits = JSON.parse(previewFeat.traits || '[]'); } catch { /* ignore */ }
              const reqs = evaluatePrerequisites(previewFeat.prerequisites, { attributes: ruleAttributes, skills: ruleSkills, feats: existingFeats, orderNames, incompleteOrders, heritageName });
              const isSelected = selectedFeatId === previewFeat.id;
              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-bold text-text-primary">{previewFeat.name}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong">
                          {t('common.level', { level: previewFeat.level })}
                        </span>
                        <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-status-info-bg text-status-info border border-status-info-border">
                          {previewFeat.category}
                        </span>
                        {renderActionBadge(previewFeat)}
                        {traits.map(tr => (
                          <span key={tr} className="text-xs uppercase px-2 py-0.5 rounded bg-elevated text-text-secondary border border-border-subtle">
                            {tr}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => selectFeat(previewFeat)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent-hover text-accent-contrast shadow flex items-center gap-1.5 flex-shrink-0"
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      <span>{isSelected ? t('picker.selected') : t('common.choose')}</span>
                    </button>
                  </div>

                  {reqs.length > 0 && (
                    <div className="p-3 rounded-xl bg-surface border border-border-strong text-xs space-y-1.5">
                      <span className="font-bold uppercase text-xs text-accent-text block">{t('feat.prerequisites')}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {reqs.map((r, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded border ${
                              r.status === 'met'
                                ? 'bg-status-success-bg text-status-success border-status-success-border'
                                : r.status === 'unmet'
                                ? 'bg-status-danger-bg text-status-danger border-status-danger-border'
                                : 'bg-status-warn-bg text-status-warn border-status-warn-border'
                            }`}
                          >
                            {r.status === 'met' ? '✓' : r.status === 'unmet' ? '✗' : '?'} {requirementText(r)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className="pf-prose text-sm text-text-secondary bg-surface p-4 rounded-xl border border-border-subtle"
                    dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(previewFeat.description || '', { actorLevel: characterLevel }) }}
                  />
                </div>
              );
            })() : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-text-muted space-y-2">
                <Award className="w-10 h-10 opacity-40 text-accent-text" />
                <p className="text-sm max-w-xs">{t('picker.selectToPreview')}</p>
              </div>
            )}
          </div>
        </div>

        <p className="px-4 py-2 text-xs text-text-secondary">{t('picker.legend')}</p>
      {/* Footer */}
        <div className="p-4 border-t border-border-strong bg-elevated flex items-center justify-between text-xs text-text-secondary">
          <span>{t('spellFilters.showing')} {feats.length} / <strong>{total}</strong></span>
          {feats.length < total && <button onClick={() => setLimit(previous => previous + 60)} className="px-3 py-2 bg-control rounded-lg text-white">{t('picker.loadMore')}</button>}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-control hover:bg-control-hover text-white font-medium rounded-xl text-xs transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
      {dialogState && (
        <ConfirmDialog
          title={dialogState.title}
          message={dialogState.message}
          variant={dialogState.variant}
          confirmLabel={dialogState.variant === 'primary' ? t('common.choose') : t('common.close')}
          onCancel={() => setDialogState(null)}
          onConfirm={() => {
            const chosen = dialogState.feat;
            setDialogState(null);
            if (chosen) onSelectFeat(chosen);
          }}
        />
      )}
    </div>
  );
};
