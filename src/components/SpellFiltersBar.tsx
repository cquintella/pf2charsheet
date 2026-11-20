import React from 'react';
import { SpellFilters, SpellMetadata } from '../types/pf2e';
import { Search, X, Filter, RotateCcw, LayoutGrid, List, Star } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { IconButton } from './IconButton';

interface SpellFiltersBarProps {
  filters: SpellFilters;
  onChange: (filters: Partial<SpellFilters>) => void;
  onReset: () => void;
  metadata: SpellMetadata | null;
  totalMatches: number;
  favoritesCount: number;
  viewMode: 'grid' | 'table';
  onToggleViewMode: (mode: 'grid' | 'table') => void;
}

export const SpellFiltersBar: React.FC<SpellFiltersBarProps> = ({
  filters,
  onChange,
  onReset,
  metadata,
  totalMatches,
  favoritesCount,
  viewMode,
  onToggleViewMode
}) => {
  const { t } = useI18n();
  const ranks: { label: string; value: string }[] = [
    { label: t('common.all'), value: 'all' },
    { label: t('spell.cantrips'), value: '0' },
    ...Array.from({ length: 10 }, (_, index) => ({ label: t('spell.rankOrdinal', { n: index + 1 }), value: String(index + 1) }))
  ];

  const traditions = [
    { label: t('common.allFem'), value: 'all' },
    { label: t('tradition.arcane'), value: 'arcane', color: 'border-blue-700 text-status-info' },
    { label: t('tradition.divine'), value: 'divine', color: 'border-amber-600 text-status-warn' },
    { label: t('tradition.occult'), value: 'occult', color: 'border-purple-600 text-status-purple' },
    { label: t('tradition.primal'), value: 'primal', color: 'border-emerald-600 text-status-success' }
  ];

  const hasActiveFilters = 
    filters.search !== '' ||
    filters.rank !== 'all' ||
    filters.tradition !== 'all' ||
    filters.category !== 'all' ||
    filters.defense !== 'all' ||
    filters.actions !== 'all' ||
    filters.trait !== 'all' ||
    filters.rarity !== 'all' ||
    !!filters.onlyFavorites;

  return (
    <div className="bg-surface border border-border-strong rounded-xl p-4 shadow-lg space-y-4">
      {/* Top Row: Search Input + Favorites Filter + View Mode Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, offset: 0 })}
            placeholder={t('spellFilters.searchPlaceholder')}
            className="w-full pl-10 pr-10 py-2.5 bg-elevated border border-border-strong focus:border-accent rounded-lg text-sm text-white placeholder-text-muted outline-none transition-colors"
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

        <div className="flex items-center gap-2 flex-wrap">
          <IconButton
            onClick={() => onChange({ onlyFavorites: !filters.onlyFavorites, offset: 0 })}
            active={!!filters.onlyFavorites}
            label={t('spellFilters.favorites', { count: favoritesCount })}
            badge={favoritesCount}
            icon={<Star className={`w-4 h-4 ${filters.onlyFavorites ? 'fill-current' : 'fill-accent text-accent-text'}`} />}
          />
          {hasActiveFilters && (
            <IconButton
              onClick={onReset}
              variant="danger"
              label={t('filters.clearAllTitle')}
              icon={<RotateCcw className="w-4 h-4" />}
            />
          )}
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
        </div>
      </div>

      {/* Rank / Level Selector Tabs */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
          {t('spellFilters.rank')}
        </label>
        <div className="flex flex-wrap gap-1">
          {ranks.map((r) => {
            const active = filters.rank === r.value;
            return (
              <button
                key={r.value}
                onClick={() => onChange({ rank: r.value, offset: 0 })}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-accent text-accent-contrast font-bold shadow-md'
                    : 'bg-elevated text-text-primary hover:bg-control border border-border-strong'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Traditions Row */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
          {t('spellFilters.tradition')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {traditions.map((tradition) => {
            const active = filters.tradition === tradition.value;
            return (
              <button
                key={tradition.value}
                onClick={() => onChange({ tradition: tradition.value, offset: 0 })}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  active
                    ? 'bg-accent text-black border-accent font-bold shadow-md'
                    : `bg-elevated ${tradition.color || 'border-border-strong text-text-primary'} hover:bg-control`
                }`}
              >
                {tradition.label}
              </button>
            );
          })}
        </div>
      </div>


      {/* Advanced Filter Selectors Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-2 border-t border-border-strong">
        {/* Category */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block mb-1">
            {t('spellFilters.type')}
          </label>
          <select
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value, offset: 0 })}
            className="w-full py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs text-white focus:border-accent outline-none"
          >
            <option value="all">{t('spellFilters.allTypes')}</option>
            <option value="spell">{t('spell.category.spell')}</option>
            <option value="cantrip">{t('spell.category.cantrip')}</option>
            <option value="focus">{t('spell.category.focus')}</option>
            <option value="ritual">{t('spell.category.ritual')}</option>
          </select>
        </div>

        {/* Action Cost */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block mb-1">
            {t('spell.cast')}
          </label>
          <select
            value={filters.actions}
            onChange={(e) => onChange({ actions: e.target.value, offset: 0 })}
            className="w-full py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs text-white focus:border-accent outline-none"
          >
            <option value="all">{t('spellFilters.anyCost')}</option>
            <option value="1">{t('action.1')} (◆)</option>
            <option value="2">{t('action.2')} (◆◆)</option>
            <option value="3">{t('action.3')} (◆◆◆)</option>
            <option value="reaction">{t('action.reaction')} (↺)</option>
            <option value="free">{t('action.free')} (◇)</option>
          </select>
        </div>

        {/* Defense / Save */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block mb-1">
            {t('spellFilters.save')}
          </label>
          <select
            value={filters.defense}
            onChange={(e) => onChange({ defense: e.target.value, offset: 0 })}
            className="w-full py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs text-white focus:border-accent outline-none"
          >
            <option value="all">{t('spellFilters.allDefenses')}</option>
            <option value="fortitude">{t('sheet.fortitude')}</option>
            <option value="reflex">{t('sheet.reflex')}</option>
            <option value="will">{t('sheet.will')}</option>
            <option value="ac">{t('creator.acLabel')}</option>
          </select>
        </div>

        {/* Traits Filter */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block mb-1">
            {t('filters.trait')}
          </label>
          <select
            value={filters.trait}
            onChange={(e) => onChange({ trait: e.target.value, offset: 0 })}
            className="w-full py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs text-white focus:border-accent outline-none"
          >
            <option value="all">{t('filters.anyTrait')}</option>
            {metadata?.traits.map((trait) => (
              <option key={trait.name} value={trait.name}>
                {trait.name} ({trait.count})
              </option>
            ))}
          </select>
        </div>

        {/* Rarity */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block mb-1">
            {t('filters.rarity')}
          </label>
          <select
            value={filters.rarity}
            onChange={(e) => onChange({ rarity: e.target.value, offset: 0 })}
            className="w-full py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs text-white focus:border-accent outline-none"
          >
            <option value="all">{t('filters.anyRarity')}</option>
            <option value="common">{t('rarity.common')}</option>
            <option value="uncommon">{t('rarity.uncommon')}</option>
            <option value="rare">{t('rarity.rare')}</option>
            <option value="unique">{t('rarity.unique')}</option>
          </select>
        </div>
      </div>

      {/* Results Counter Bar */}
      <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
        <div>
          {t('spellFilters.showing')} <span className="font-bold text-accent-text">{totalMatches}</span> {t('spellFilters.spellsFound')}
          {filters.onlyFavorites && (
            <span className="text-accent-text font-semibold"> {t('spellFilters.favoritesActive')}</span>
          )}
          {metadata && !filters.onlyFavorites && (
            <span> {t('spellFilters.ofTotal', { total: metadata.totalSpells })}</span>
          )}
        </div>
        {hasActiveFilters && (
          <div className="flex items-center space-x-1 text-accent-text">
            <Filter className="w-3 h-3" />
            <span>{t('filters.active')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
