import React, { useEffect, useState, useRef, useMemo } from 'react';
import { EquipmentItem } from '../types/pf2e';
import { ITEM_TYPES, itemTypeLabel, weaponDamage } from '../utils/weapon';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';
import { deleteCatalogEntry, fetchEquipment } from '../services/api';
import { cleanDescriptionHtml, cleanSnippetText, resolvePf2eIcon } from '../utils/formatters';
import { useModalFocus, clickableProps } from '../utils/useModalFocus';
import { IconButton } from './IconButton';
import { Package, Search, Star, X, LayoutGrid, List, RotateCcw, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Plus, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { CatalogEditorModal } from './CatalogEditorModal';
import { ConfirmDialog } from './ConfirmDialog';

const control = 'bg-inset border border-border-strong rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent';

type EquipSortField = 'favorite' | 'name' | 'item_type' | 'level' | 'price' | 'rarity';

interface EquipmentExplorerViewProps {
  activeCharacterName?: string | null;
  onAddToInventory?: (item: EquipmentItem) => Promise<void> | void;
}

export const EquipmentExplorerView: React.FC<EquipmentExplorerViewProps> = ({
  activeCharacterName,
  onAddToInventory,
}) => {
  const { t, locale, translator } = useI18n();
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const handleAdd = async (item: EquipmentItem) => {
    if (!onAddToInventory) return;
    await onAddToInventory(item);
    if (activeCharacterName) {
      setAddedFeedback(t('compendium.addedToInventory', { name: activeCharacterName }));
      window.setTimeout(() => setAddedFeedback(null), 3000);
    }
  };
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pf2e_favorite_equipment') || '[]')); } catch { return new Set(); }
  });
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<EquipmentItem | null>(null);
  const [editor, setEditor] = useState<{ item: EquipmentItem | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentItem | null>(null);
  const [actionError, setActionError] = useState('');
  const [working, setWorking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [sortField, setSortField] = useState<EquipSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const detailRef = useRef<HTMLDivElement>(null);
  useModalFocus(detailRef, () => setSelected(null), Boolean(selected));

  useEffect(() => {
    let active = true;
    const isAppend = offset > 0;
    if (isAppend) setLoadingMore(true);
    else setLoading(true);

    const timer = window.setTimeout(() => {
      fetchEquipment(search, type, offset, { level, rarity, ids: onlyFavorites ? [...favoritesRef.current] : undefined })
        .then(data => {
          if (!active) return;
          if (isAppend) {
            setItems(prev => {
              const seen = new Set(prev.map(i => i.id));
              return [...prev, ...data.items.filter(i => !seen.has(i.id))];
            });
          } else {
            setItems(data.items);
          }
          setTotal(data.total);
          setError(false);
        })
        .catch(() => {
          if (!active) return;
          if (!isAppend) { setItems([]); setTotal(0); }
          setError(true);
        })
        .finally(() => {
          if (active) { setLoading(false); setLoadingMore(false); }
        });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, type, level, rarity, offset, onlyFavorites, revision]);

  useEffect(() => {
    if (onlyFavorites) {
      setOffset(0);
    }
  }, [favorites, onlyFavorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem('pf2e_favorite_equipment', JSON.stringify([...next])); } catch { /* A interface continua funcional sem armazenamento local. */ }
      return next;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setType('all');
    setLevel('all');
    setRarity('all');
    setOnlyFavorites(false);
    setOffset(0);
    setSelected(null);
  };

  const refreshCatalog = () => { setOffset(0); setRevision(value => value + 1); };
  const removeItem = async () => {
    if (!deleteTarget || working) return;
    setWorking(true); setActionError('');
    try {
      await deleteCatalogEntry('equipment', deleteTarget.id);
      if (favorites.has(deleteTarget.id)) toggleFavorite(deleteTarget.id);
      setDeleteTarget(null); refreshCatalog();
    } catch { setDeleteTarget(null); setActionError(t('catalogEditor.deleteError')); }
    finally { setWorking(false); }
  };

  const handleSort = (field: EquipSortField) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, translator.locale, { sensitivity: 'base' }); break;
        case 'item_type': cmp = (a.item_type || '').localeCompare(b.item_type || ''); break;
        case 'level': cmp = a.level - b.level; break;
        case 'price': cmp = (a.price || '').localeCompare(b.price || ''); break;
        case 'rarity': cmp = (a.rarity || '').localeCompare(b.rarity || ''); break;
        case 'favorite': cmp = (favorites.has(a.id) ? 1 : 0) - (favorites.has(b.id) ? 1 : 0); break;
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name, translator.locale, { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [items, sortField, sortDir, favorites, translator.locale]);

  const favoriteButton = (item: EquipmentItem) => (
    <button
      type="button"
      aria-label={favorites.has(item.id) ? t('common.unfavorite', { name: item.name }) : t('common.favorite', { name: item.name })}
      onClick={event => { event.stopPropagation(); toggleFavorite(item.id); }}
      className="p-1 rounded-md hover:bg-elevated transition-colors"
    >
      <Star className={`w-4 h-4 ${favorites.has(item.id) ? 'fill-accent text-accent-text' : 'text-text-muted hover:text-accent-text'}`} />
    </button>
  );

  const renderSortHeader = (field: EquipSortField, label: React.ReactNode, className = '') => {
    const active = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`py-3 px-3 cursor-pointer select-none transition-colors hover:bg-elevated hover:text-text-primary ${className}`}
      >
        <div className={`flex items-center gap-1.5 ${className.includes('text-center') ? 'justify-center' : ''}`}>
          <span className={active ? 'text-accent-text font-bold' : ''}>{label}</span>
          {active ? (
            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-accent-text" /> : <ArrowDown className="w-3.5 h-3.5 text-accent-text" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 opacity-25 text-text-muted" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-5">
      {editor && <CatalogEditorModal kind="equipment" entry={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refreshCatalog(); }} />}
      {deleteTarget && <ConfirmDialog title={t('catalogEditor.deleteItem')} message={t('catalogEditor.deleteConfirm', { name: deleteTarget.name })} variant="danger" confirmLabel={t('common.remove')} onCancel={() => { setSelected(deleteTarget); setDeleteTarget(null); }} onConfirm={() => { void removeItem(); }} />}
      {actionError && <p role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-status-danger">{actionError}</p>}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-accent-text" />
            <h1 className="text-xl font-bold text-text-primary">{t('nav.items')}</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button type="button" onClick={() => setEditor({ item: null })} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-contrast"><Plus className="w-4 h-4" />{t('catalogEditor.newItem')}</button>
            <IconButton
              onClick={() => { setOnlyFavorites(v => !v); setOffset(0); }}
              active={onlyFavorites}
              label={t('common.onlyFavorites', { count: favorites.size })}
              badge={favorites.size}
              icon={<Star className={`w-4 h-4 ${onlyFavorites ? 'fill-current' : 'fill-accent text-accent-text'}`} />}
            />
            <IconButton
              onClick={resetFilters}
              label={t('common.clearFilters')}
              icon={<RotateCcw className="w-4 h-4" />}
            />
            <IconButton
              onClick={() => setView('grid')}
              active={view === 'grid'}
              label={t('common.gridView')}
              icon={<LayoutGrid className="w-4 h-4" />}
            />
            <IconButton
              onClick={() => setView('table')}
              active={view === 'table'}
              label={t('common.tableView')}
              icon={<List className="w-4 h-4" />}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
            <input
              className={`${control} w-full pl-9 pr-8`}
              value={search}
              data-shortcut-search
              placeholder={t('items.searchPlaceholder')}
              onChange={e => { setSearch(e.target.value); setOffset(0); }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setOffset(0); }}
                aria-label={t('common.clearFilters')}
                className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select aria-label={t('inventory.typeLabel')} className={control} value={type} onChange={e => { setType(e.target.value); setOffset(0); }}>
            <option value="all">{t('spellFilters.allTypes')}</option>
            {ITEM_TYPES.map(id => <option key={id} value={id}>{itemTypeLabel(t, id)}</option>)}
          </select>
          <select aria-label={t('items.levelLabel')} className={control} value={level} onChange={e => { setLevel(e.target.value); setOffset(0); }}>
            <option value="all">{t('items.allLevels')}</option>
            {Array.from({ length: 29 }, (_, i) => <option key={i} value={i}>{t('common.level', { level: i })}</option>)}
          </select>
          <select aria-label={t('filters.rarity')} className={control} value={rarity} onChange={e => { setRarity(e.target.value); setOffset(0); }}>
            <option value="all">{t('creator.allRarities')}</option>
            <option value="common">{t('rarity.common')}</option>
            <option value="uncommon">{t('rarity.uncommon')}</option>
            <option value="rare">{t('rarity.rare')}</option>
            <option value="unique">{t('rarity.unique')}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
          <span>{t('items.found', { count: total })}</span>
          {locale === 'pt-BR' && <span className="text-xs">{t('compendium.englishNotice')}</span>}
        </div>
        {addedFeedback && (
          <div className="p-2.5 rounded-xl bg-status-success-bg border border-status-success-border text-xs text-status-success flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{addedFeedback}</span>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-status-danger text-sm">{t('items.loadError')}</p>}

      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 text-accent-text animate-spin" />
          <p className="text-sm text-text-muted">{t('items.loading')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
          <p className="text-sm text-text-muted">{t('items.noResults')}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="compendium-cards">
          {items.map(item => (
            <article
              key={item.id}
              {...clickableProps(() => setSelected(item))}
              className="bg-surface hover:bg-elevated border-2 border-border-subtle hover:border-accent/60 rounded-xl p-4 flex flex-col gap-2.5 cursor-pointer transition-all shadow-md"
            >
              <div className="flex justify-between items-center text-xs text-accent-text">
                <span className="font-bold tabular-nums">{t('common.level', { level: item.level })} · {itemTypeLabel(t, item.item_type)}</span>
                {favoriteButton(item)}
              </div>
              <div className="flex gap-3 items-center">
                <img
                  className="w-10 h-10 object-contain rounded bg-inset p-1 border border-border-subtle"
                  src={resolvePf2eIcon(item.img, '/assets/icons/default-icons/feat.svg')}
                  alt=""
                  onError={e => { e.currentTarget.src = '/assets/icons/default-icons/feat.svg'; }}
                />
                <span className="font-bold text-text-primary text-sm line-clamp-2">{item.name}</span>
              </div>
              <p className="text-xs text-text-muted">{rarityLabel(t, item.rarity)} · {item.price || '—'} · {t('item.bulk')} {item.bulk || '—'}</p>
              {weaponDamage(item, t) && <p className="text-xs font-semibold text-accent-text">{weaponDamage(item, t)}</p>}
              <p className="text-xs text-text-secondary line-clamp-3 flex-1">{cleanSnippetText(item.description || '')}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-elevated text-text-muted uppercase text-xs tracking-wider border-b border-border-strong">
              <tr>
                {renderSortHeader('favorite', '⭐', 'w-12 text-center')}
                {renderSortHeader('level', t('common.levelLabel'), 'w-20 text-center')}
                {renderSortHeader('name', t('featTable.name'), 'min-w-[200px]')}
                {renderSortHeader('item_type', t('inventory.typeLabel'), 'w-32')}
                {renderSortHeader('price', t('item.price'), 'w-28')}
                {renderSortHeader('rarity', t('filters.rarity'), 'w-28')}
                <th className="py-3 px-4">{t('item.bulk')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedItems.map(item => (
                <tr key={item.id} onClick={() => setSelected(item)} className="hover:bg-elevated cursor-pointer transition-colors">
                  <td className="py-2.5 px-3 text-center">{favoriteButton(item)}</td>
                  <td className="py-2.5 px-3 text-center tabular-nums font-bold text-accent-text">{item.level}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{item.name}</td>
                  <td className="py-2.5 px-4">{itemTypeLabel(t, item.item_type)}</td>
                  <td className="py-2.5 px-4 tabular-nums">{item.price || '—'}</td>
                  <td className="py-2.5 px-4">{rarityLabel(t, item.rarity)}</td>
                  <td className="py-2.5 px-4 tabular-nums">{item.bulk || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length < total && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            onClick={() => setOffset(prev => prev + 40)}
            disabled={loadingMore}
            className="flex items-center space-x-2 px-6 py-2.5 bg-elevated hover:bg-control text-text-primary font-semibold text-sm rounded-xl border border-border-strong hover:border-accent transition-all shadow-md disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-accent-text" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <span>{t('common.rangeOf', { from: 1, to: items.length, total })} · {t('common.next')}</span>
            )}
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setSelected(null)}>
          <div
            ref={detailRef}
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            className="w-full max-w-2xl max-h-[85vh] bg-surface border border-border-strong rounded-xl p-5 shadow-2xl overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between gap-3 items-start">
              <div>
                <h2 className="text-xl font-bold text-text-primary">{selected.name}</h2>
                <p className="text-xs text-text-muted">{itemTypeLabel(t, selected.item_type)} · {t('common.level', { level: selected.level })} · {rarityLabel(t, selected.rarity)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setEditor({ item: selected }); setSelected(null); }} aria-label={t('catalogEditor.editItem')} title={t('catalogEditor.editItem')} className="p-2 rounded-lg border border-border-strong bg-control text-text-primary"><Pencil className="w-5 h-5" /></button>
                <button type="button" onClick={() => { setDeleteTarget(selected); setSelected(null); }} aria-label={t('catalogEditor.deleteItem')} title={t('catalogEditor.deleteItem')} className="p-2 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger"><Trash2 className="w-5 h-5" /></button>
                {onAddToInventory && (
                  <button
                    type="button"
                    onClick={() => handleAdd(selected)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('compendium.addToInventory')}</span>
                  </button>
                )}
                {favoriteButton(selected)}
                <button type="button" aria-label={t('common.closeDetails')} onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-elevated">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {weaponDamage(selected, t) && <p className="text-sm font-semibold text-accent-text">{weaponDamage(selected, t)}</p>}
            <p className="text-sm text-text-secondary">{t('item.price')}: {selected.price || '—'} · {t('item.bulk')}: {selected.bulk || '—'}</p>
            <div className="pf-prose text-sm text-text-secondary bg-inset p-4 rounded-lg border border-border-subtle" dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(selected.description || '') }} />
          </div>
        </div>
      )}
    </div>
  );
};
