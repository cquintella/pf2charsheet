import React, { useState } from 'react';
import { FeatFilters, FeatMetadata } from '../types/pf2e';
import { 
  Search, 
  X, 
  RotateCcw, 
  SlidersHorizontal, 
  Star, 
  LayoutGrid, 
  List, 
  Award,
  Zap,
  Shield,
  BookOpen
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { MessageKey } from '../i18n/Translator';
import { IconButton } from './IconButton';

interface FeatFiltersBarProps {
  filters: FeatFilters;
  onChange: (updates: Partial<FeatFilters>) => void;
  onReset: () => void;
  metadata: FeatMetadata | null;
  totalMatches: number;
  favoritesCount: number;
  viewMode: 'grid' | 'table';
  onToggleViewMode: (mode: 'grid' | 'table') => void;
}

export const FeatFiltersBar: React.FC<FeatFiltersBarProps> = ({
  filters,
  onChange,
  onReset,
  metadata,
  totalMatches,
  favoritesCount,
  viewMode,
  onToggleViewMode
}) => {
  const { t, translator } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [traitSearch, setTraitSearch] = useState<string>('');

  const categoryLabels: Record<string, MessageKey> = {
    class: 'featCategory.class',
    ancestry: 'featCategory.ancestry',
    skill: 'featCategory.skill',
    general: 'featCategory.general',
    classfeature: 'featCategory.classfeature',
    ancestryfeature: 'featCategory.ancestryfeature'
  };

  const actionTypes = [
    { id: 'all', label: t('featFilters.allActions') },
    { id: 'passive', label: `⚙ ${t('action.passive')}` },
    { id: '1', label: `◆ ${t('action.1')}`, isAction: true },
    { id: '2', label: `◆◆ ${t('action.2')}`, isAction: true },
    { id: '3', label: `◆◆◆ ${t('action.3')}`, isAction: true },
    { id: 'reaction', label: `↺ ${t('action.reaction')}` },
    { id: 'free', label: `◇ ${t('action.free')}` }
  ];

  const handleActionSelect = (act: typeof actionTypes[0]) => {
    if (act.id === 'all') {
      onChange({ action_type: 'all', actions: 'all', offset: 0 });
    } else if (act.isAction) {
      onChange({ action_type: 'action', actions: act.id, offset: 0 });
    } else {
      onChange({ action_type: act.id, actions: 'all', offset: 0 });
    }
  };

  const isActionActive = (act: typeof actionTypes[0]) => {
    if (act.id === 'all') {
      return (filters.action_type === 'all' || !filters.action_type) && (filters.actions === 'all' || !filters.actions);
    }
    if (act.isAction) {
      return filters.actions === act.id;
    }
    return filters.action_type === act.id;
  };

  return (
    <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-xl space-y-4">
      {/* Top Bar: Search, Favorites, Mode, Results */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, offset: 0 })}
            placeholder={t('featFilters.searchPlaceholder')}
            className="w-full bg-canvas border border-border-strong pl-10 pr-9 py-2 rounded-xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: '', offset: 0 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <IconButton
            onClick={() => onChange({ onlyFavorites: !filters.onlyFavorites, offset: 0 })}
            active={!!filters.onlyFavorites}
            label={t('featFilters.favorites', { count: favoritesCount })}
            badge={favoritesCount}
            icon={<Star className={`w-4 h-4 ${filters.onlyFavorites ? 'fill-current' : 'fill-accent text-accent-text'}`} />}
          />
          <IconButton
            onClick={() => onToggleViewMode('grid')}
            active={viewMode === 'grid'}
            label={t('filters.gridView')}
            icon={<LayoutGrid className="w-4 h-4" />}
          />
          <IconButton
            onClick={() => onToggleViewMode('table')}
            active={viewMode === 'table'}
            label={t('filters.tableView')}
            icon={<List className="w-4 h-4" />}
          />
          <IconButton
            onClick={() => setShowAdvanced(!showAdvanced)}
            active={showAdvanced}
            label={t('featFilters.filters')}
            icon={<SlidersHorizontal className="w-4 h-4" />}
          />
          <IconButton
            onClick={onReset}
            label={t('filters.clearAllTitle')}
            icon={<RotateCcw className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => onChange({ category: 'all', offset: 0 })}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            filters.category === 'all'
              ? 'bg-accent text-black shadow'
              : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
          }`}
        >
          {t('featFilters.allCategories')}
        </button>
        {['class', 'ancestry', 'skill', 'general', 'classfeature', 'ancestryfeature'].map((cat) => (
          <button
            key={cat}
            onClick={() => onChange({ category: cat, offset: 0 })}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
              filters.category === cat
                ? 'bg-accent text-black font-bold shadow'
                : 'bg-elevated text-text-secondary hover:text-white border border-border-strong'
            }`}
          >
            {cat in categoryLabels ? t(categoryLabels[cat]) : cat}
          </button>
        ))}
      </div>

      {/* Action Cost Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
        {actionTypes.map((act) => (
          <button
            key={act.id}
            onClick={() => handleActionSelect(act)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
              isActionActive(act)
                ? 'bg-control text-accent-text border border-accent/50'
                : 'bg-canvas text-text-secondary hover:text-white border border-border-subtle'
            }`}
          >
            {act.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters Expandable Area */}
      {showAdvanced && (
        <div className="pt-3 border-t border-border-strong grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Level Filter */}
          <div>
            <label className="text-[11px] font-bold text-text-secondary uppercase block mb-1">
              {t('featFilters.level')}
            </label>
            <select
              value={filters.level}
              onChange={(e) => onChange({ level: e.target.value, offset: 0 })}
              className="w-full bg-canvas border border-border-strong px-2.5 py-1.5 rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="all">{t('featFilters.allLevels')}</option>
              {Array.from({ length: 21 }, (_, i) => i).map((lvl) => (
                <option key={lvl} value={String(lvl)}>
                  {t('common.level', { level: lvl })}
                </option>
              ))}
            </select>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="text-[11px] font-bold text-text-secondary uppercase block mb-1">
              {t('filters.rarity')}
            </label>
            <select
              value={filters.rarity}
              onChange={(e) => onChange({ rarity: e.target.value, offset: 0 })}
              className="w-full bg-canvas border border-border-strong px-2.5 py-1.5 rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="all">{t('creator.allRarities')}</option>
              <option value="common">{t('rarity.common')}</option>
              <option value="uncommon">{t('rarity.uncommon')}</option>
              <option value="rare">{t('rarity.rare')}</option>
              <option value="unique">{t('rarity.unique')}</option>
            </select>
          </div>

          {/* Trait Filter */}
          <div>
            <label className="text-[11px] font-bold text-text-secondary uppercase block mb-1">
              {t('filters.trait')}
            </label>
            <div className="space-y-1">
              <input
                type="text"
                value={traitSearch}
                onChange={(e) => setTraitSearch(e.target.value)}
                placeholder={t('filters.anyTrait')}
                aria-label={t('filters.trait')}
                className="w-full bg-canvas border border-border-strong px-2.5 py-1 rounded-lg text-xs text-text-primary focus:border-accent"
              />
              <select
                value={filters.trait}
                onChange={(e) => onChange({ trait: e.target.value, offset: 0 })}
                className="w-full bg-canvas border border-border-strong px-2.5 py-1.5 rounded-lg text-white focus:border-accent"
              >
                <option value="all">{t('filters.anyTrait')}</option>
                {(metadata?.traits || [])
                  .filter((trait) => !traitSearch.trim() || trait.name.toLowerCase().includes(traitSearch.toLowerCase()))
                  .slice(0, 100)
                  .map((trait) => (
                    <option key={trait.name} value={trait.name}>
                      {trait.name} ({trait.count})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Reset & Summary Status */}
          <div className="flex flex-col justify-end">
            <span className="text-[11px] text-text-secondary">
              {t('featFilters.totalInCompendium')} <strong className="text-white">{metadata ? translator.formatNumber(metadata.totalFeats) : '—'}</strong>
            </span>
            <span className="text-[11px] text-accent-text font-semibold">
              {t('featFilters.found', { count: totalMatches })}
            </span>
          </div>
        </div>
      )}

      {/* Matches Indicator Footer */}
      <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
        <div className="flex items-center space-x-2">
          <Award className="w-3.5 h-3.5 text-accent-text" />
          <span>
            {t('spellFilters.showing')} <strong>{totalMatches}</strong> {t('featFilters.matching')}
          </span>
        </div>
      </div>
    </div>
  );
};
