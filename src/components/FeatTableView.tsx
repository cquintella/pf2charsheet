import { ActionSymbol } from './ActionSymbol';
import React, { useState, useMemo } from 'react';
import { FeatItem } from '../types/pf2e';
import { resolvePf2eIcon } from '../utils/formatters';
import { Star, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';

export type FeatSortField = 'favorite' | 'level' | 'name' | 'category' | 'action_type' | 'rarity';
export type FeatSortDirection = 'asc' | 'desc';

interface FeatTableViewProps {
  feats: FeatItem[];
  favoritesSet: Set<string>;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelectFeat: (feat: FeatItem) => void;
  onSelectTrait?: (trait: string) => void;
}

export const FeatTableView: React.FC<FeatTableViewProps> = ({
  feats,
  favoritesSet,
  onToggleFavorite,
  onSelectFeat,
  onSelectTrait
}) => {
  const { t, translator } = useI18n();
  const [sortField, setSortField] = useState<FeatSortField>('level');
  const [sortDirection, setSortDirection] = useState<FeatSortDirection>('asc');

  const handleSort = (field: FeatSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedFeats = useMemo(() => {
    const list = [...feats];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, translator.locale, { sensitivity: 'base' });
          break;
        case 'level':
          cmp = a.level - b.level;
          break;
        case 'category':
          cmp = (a.category || '').localeCompare(b.category || '');
          break;
        case 'action_type':
          cmp = (a.action_type || '').localeCompare(b.action_type || '');
          break;
        case 'rarity':
          cmp = (a.rarity || '').localeCompare(b.rarity || '');
          break;
        case 'favorite': {
          const favA = favoritesSet.has(a.id) ? 1 : 0;
          const favB = favoritesSet.has(b.id) ? 1 : 0;
          cmp = favA - favB;
          break;
        }
      }
      if (cmp === 0) {
        cmp = a.name.localeCompare(b.name, translator.locale, { sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [feats, sortField, sortDirection, favoritesSet]);

  const renderActionBadge = (feat: FeatItem) => {
    if (feat.action_type === 'passive') {
      return <span className="text-xs text-text-secondary">{t('action.passive')}</span>;
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

  const renderSortHeader = (field: FeatSortField, label: React.ReactNode, className: string = '') => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`py-3 px-3 cursor-pointer select-none transition-colors hover:bg-control hover:text-white group ${className}`}
        title={t('table.sortBy', { column: typeof label === 'string' ? label : t('table.thisColumn') })}
      >
        <div className={`flex items-center gap-1.5 ${className.includes('text-center') ? 'justify-center' : ''}`}>
          <span className={isActive ? 'text-accent-text font-bold' : ''}>{label}</span>
          <span className="flex-shrink-0">
            {isActive ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-accent-text" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-accent-text" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 opacity-25 group-hover:opacity-75 text-text-secondary" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-strong bg-surface shadow">
      <table className="w-full text-left text-xs text-text-primary">
        <thead className="bg-elevated text-text-secondary uppercase text-xs tracking-wider border-b border-border-strong">
          <tr>
            {renderSortHeader('favorite', '⭐', 'w-12 text-center')}
            {renderSortHeader('level', t('common.levelLabel'), 'w-16 text-center')}
            {renderSortHeader('name', t('featTable.name'), 'min-w-[220px]')}
            {renderSortHeader('category', t('feat.category'), 'w-32')}
            {renderSortHeader('action_type', t('featTable.cost'), 'w-28 text-center')}
            <th className="py-3 px-4 w-48">{t('feat.prerequisites')}</th>
            {renderSortHeader('rarity', t('filters.rarity'), 'w-24')}
            <th className="py-3 px-4">{t('common.traits')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {sortedFeats.map((feat) => {
            let traits: string[] = [];
            try {
              traits = JSON.parse(feat.traits || '[]');
            } catch (e) {}

            let prereqs: string[] = [];
            try {
              const parsed = JSON.parse(feat.prerequisites || '[]');
              prereqs = parsed.map((p: any) => (typeof p === 'string' ? p : p.value)).filter(Boolean);
            } catch (e) {}

            const isFav = favoritesSet.has(feat.id);
            const imageSrc = resolvePf2eIcon(feat.img, '/assets/icons/default-icons/feat.svg');

            return (
              <tr
                key={feat.id}
                onClick={() => onSelectFeat(feat)}
                className={`hover:bg-elevated cursor-pointer transition-colors ${
                  isFav ? 'bg-surface' : ''
                }`}
              >
                {/* Favorite Star ⭐ */}
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(feat.id, e);
                    }}
                    className="p-1 rounded hover:bg-control transition-colors"
                    title={isFav ? t('favorites.remove') : t('favorites.add')}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isFav
                          ? 'text-accent-text fill-accent'
                          : 'text-text-muted hover:text-accent-text'
                      }`}
                    />
                  </button>
                </td>

                {/* Level */}
                <td className="py-3 px-3 text-center">
                  <span className="inline-block font-bold text-xs px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong">
                    {feat.level}
                  </span>
                </td>

                {/* Name & Icon */}
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded bg-elevated border border-border-strong p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      <img
                        src={imageSrc}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/icons/default-icons/feat.svg';
                        }}
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-white hover:text-accent-text transition-colors">
                        {feat.name}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="py-3 px-4">
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-elevated text-status-info border border-border-strong">
                    {feat.category}
                  </span>
                </td>

                {/* Action Cost */}
                <td className="py-3 px-4 text-center">
                  {renderActionBadge(feat)}
                </td>

                {/* Prerequisites */}
                <td className="py-3 px-4 text-text-secondary">
                  {prereqs.length > 0 ? (
                    <span className="truncate block max-w-[180px] text-xs" title={prereqs.join('; ')}>
                      {prereqs.join('; ')}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>

                {/* Rarity */}
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${
                    feat.rarity === 'uncommon' ? 'bg-status-warn-bg text-status-warn' :
                    feat.rarity === 'rare' ? 'bg-status-info-bg text-status-info' :
                    feat.rarity === 'unique' ? 'bg-status-purple-bg text-status-purple' :
                    'text-text-secondary'
                  }`}>
                    {rarityLabel(t, feat.rarity)}
                  </span>
                </td>

                {/* Traits */}
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {traits.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        onClick={(e) => {
                          if (onSelectTrait) {
                            e.stopPropagation();
                            onSelectTrait(t);
                          }
                        }}
                        className="text-xs uppercase px-1.5 py-0.5 rounded bg-elevated text-status-info border border-border-strong hover:bg-control"
                      >
                        {t}
                      </span>
                    ))}
                    {traits.length > 4 && (
                      <span className="text-xs text-text-muted">
                        +{traits.length - 4}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
