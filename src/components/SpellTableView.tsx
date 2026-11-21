import React, { useState, useMemo } from 'react';
import { SpellItem } from '../types/pf2e';
import { resolveSpellIcon } from '../utils/formatters';
import { Star, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';

export type SortField = 'favorite' | 'rank' | 'name' | 'time' | 'traditions' | 'range' | 'defense';
export type SortDirection = 'asc' | 'desc';

interface SpellTableViewProps {
  spells: SpellItem[];
  favoritesSet: Set<string>;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelectSpell: (spell: SpellItem) => void;
  onSelectTrait?: (trait: string) => void;
}

export const SpellTableView: React.FC<SpellTableViewProps> = ({ 
  spells, 
  favoritesSet,
  onToggleFavorite,
  onSelectSpell, 
  onSelectTrait 
}) => {
  const { t, translator } = useI18n();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSpells = useMemo(() => {
    const list = [...spells];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, translator.locale, { sensitivity: 'base' });
          break;
        case 'rank':
          cmp = a.rank - b.rank;
          break;
        case 'time':
          cmp = (a.time || '').localeCompare(b.time || '');
          break;
        case 'defense':
          cmp = (a.defense || '').localeCompare(b.defense || '');
          break;
        case 'range':
          cmp = (a.range || '').localeCompare(b.range || '');
          break;
        case 'traditions':
          cmp = (a.traditions || '').localeCompare(b.traditions || '');
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
  }, [spells, sortField, sortDirection, favoritesSet]);

  const renderActionBadge = (time: string) => {
    if (time === '1') return <span className="pf-action-icon text-[11px] px-1.5">◆ 1</span>;
    if (time === '2') return <span className="pf-action-icon text-[11px] px-1.5">◆◆ 2</span>;
    if (time === '3') return <span className="pf-action-icon text-[11px] px-1.5">◆◆◆ 3</span>;
    if (time === 'reaction') return <span className="pf-action-icon text-[11px] px-1.5 bg-status-danger-bg text-status-danger border-status-danger-border">↺ {t('action.reaction')}</span>;
    if (time === 'free') return <span className="pf-action-icon text-[11px] px-1.5 bg-status-success-bg text-status-success border-status-success-border">◇ {t('action.freeShort')}</span>;
    return <span className="pf-action-icon text-[11px] px-1.5">{time || '1'}</span>;
  };

  const renderSortHeader = (field: SortField, label: React.ReactNode, className: string = '') => {
    const isActive = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`py-3 px-3 cursor-pointer select-none transition-colors hover:bg-control hover:text-white group ${className}`}
        title={t(isActive && sortDirection === 'asc' ? 'table.sortByDesc' : 'table.sortByAsc', { column: typeof label === 'string' ? label : t('table.thisColumn') })}
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
        <thead className="bg-elevated text-text-secondary uppercase text-[11px] tracking-wider border-b border-border-strong">
          <tr>
            {renderSortHeader('favorite', '⭐', 'w-12 text-center')}
            {renderSortHeader('rank', t('common.levelLabel'), 'w-16 text-center')}
            {renderSortHeader('name', t('spellTable.name'), 'min-w-[200px]')}
            {renderSortHeader('time', t('spell.cast'), 'w-32 text-center')}
            {renderSortHeader('traditions', t('spellTable.traditions'), 'w-36')}
            {renderSortHeader('range', t('spellTable.rangeTarget'), 'w-36')}
            {renderSortHeader('defense', t('spellFilters.save'), 'w-32')}
            <th className="py-3 px-4">{t('common.traits')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {sortedSpells.map((spell) => {
            let traits: string[] = [];
            try {
              traits = JSON.parse(spell.traits || '[]');
            } catch (e) {}

            let traditions: string[] = [];
            try {
              traditions = JSON.parse(spell.traditions || '[]');
            } catch (e) {}

            const isCantrip = traits.includes('cantrip');
            const isFocus = traits.includes('focus');
            const isRitual = traits.includes('ritual') || spell.category === 'ritual';
            const isFav = favoritesSet.has(spell.id);
            const imageSrc = resolveSpellIcon(spell.img);

            return (
              <tr 
                key={spell.id}
                onClick={() => onSelectSpell(spell)}
                className={`hover:bg-elevated cursor-pointer transition-colors ${
                  isFav ? 'bg-surface' : ''
                }`}
              >
                {/* Favorite Star ⭐ */}
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(spell.id, e);
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

                {/* Level / Rank */}
                <td className="py-3 px-3 text-center">
                  <span className="inline-block font-bold text-xs px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong">
                    {isCantrip ? 'C' : isFocus ? 'F' : isRitual ? 'R' : spell.rank}
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
                          (e.target as HTMLImageElement).src = '/assets/icons/default-icons/spell.svg';
                        }}
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-white hover:text-accent-text transition-colors">
                        {spell.name}
                      </span>
                      {spell.rarity && spell.rarity !== 'common' && (
                        <span className={`ml-2 text-[11px] font-bold uppercase px-1 py-0.5 rounded ${
                          spell.rarity === 'uncommon' ? 'bg-status-warn-bg text-status-warn' :
                          spell.rarity === 'rare' ? 'bg-status-info-bg text-status-info' : 'bg-status-purple-bg text-status-purple'
                        }`}>
                          {rarityLabel(t, spell.rarity)}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-center">
                  {renderActionBadge(spell.time)}
                </td>

                {/* Traditions */}
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {traditions.map((trad) => (
                      <span key={trad} className="text-[11px] font-medium uppercase px-1.5 py-0.5 rounded bg-elevated text-status-info">
                        {trad}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Range / Target */}
                <td className="py-3 px-4 text-text-secondary">
                  <div className="truncate max-w-[150px]" title={spell.range || t('spell.touch')}>
                    {spell.range || t('spell.touch')}
                  </div>
                </td>

                {/* Defense */}
                <td className="py-3 px-4">
                  {spell.defense ? (
                    <span className="text-status-danger font-bold uppercase text-[11px] px-1.5 py-0.5 rounded bg-status-danger-bg border border-status-danger-border">
                      {spell.defense}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
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
                        className="text-[11px] uppercase px-1.5 py-0.5 rounded bg-status-danger-bg text-status-danger border border-status-danger-border hover:bg-status-danger-bg"
                      >
                        {t}
                      </span>
                    ))}
                    {traits.length > 4 && (
                      <span className="text-[11px] text-text-muted">
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
