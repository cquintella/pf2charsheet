import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FeatFilters, FeatItem, FeatMetadata } from '../types/pf2e';
import { deleteFeat, fetchFeatById, fetchFeats, fetchFeatMetadata } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import { FeatFiltersBar } from './FeatFiltersBar';
import { FeatCard } from './FeatCard';
import { FeatTableView } from './FeatTableView';
import { FeatDetailModal } from './FeatDetailModal';
import { Loader2, Award, Plus } from 'lucide-react';
import { FeatEditorModal } from './FeatEditorModal';
import { ConfirmDialog } from './ConfirmDialog';

const INITIAL_FEAT_FILTERS: FeatFilters = {
  search: '',
  category: 'all',
  level: 'all',
  action_type: 'all',
  actions: 'all',
  rarity: 'all',
  trait: 'all',
  onlyFavorites: false,
  limit: 48,
  offset: 0
};

export const FeatExplorerView: React.FC<{ characterLevel?: number }> = ({ characterLevel }) => {
  const { t } = useI18n();
  const [filters, setFilters] = useState<FeatFilters>(INITIAL_FEAT_FILTERS);
  const [metadata, setMetadata] = useState<FeatMetadata | null>(null);
  const [feats, setFeats] = useState<FeatItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [selectedFeat, setSelectedFeat] = useState<FeatItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editor, setEditor] = useState<{ feat: FeatItem | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeatItem | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pf2e_favorite_feats');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Falha ao ler favoritos de talentos:', e);
    }
    return new Set<string>();
  });

  const toggleFavorite = (featId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(featId)) {
        next.delete(featId);
      } else {
        next.add(featId);
      }
      try {
        localStorage.setItem('pf2e_favorite_feats', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
  };

  // Load metadata on mount
  useEffect(() => {
    fetchFeatMetadata()
      .then(setMetadata)
      .catch((err) => console.error('Erro ao carregar metadados de talentos:', err));
  }, []);

  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  // Fetch feats whenever filters change
  const loadFeats = useCallback(async (currentFilters: FeatFilters, isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true);
    else setLoading(true);

    try {
      const favList = Array.from(favoritesRef.current);
      const data = await fetchFeats(currentFilters, favList);
      if (isAppend) {
        setFeats((prev) => {
          const seen = new Set(prev.map(f => f.id));
          return [...prev, ...data.feats.filter(f => !seen.has(f.id))];
        });
      } else {
        setFeats(data.feats);
      }
      setTotal(data.total);
    } catch (err) {
      console.error('Erro ao buscar talentos:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadFeats(filters, filters.offset > 0);
  }, [filters, loadFeats]);

  useEffect(() => {
    if (filters.onlyFavorites) {
      setFilters((prev) => ({ ...prev, offset: 0 }));
    }
  }, [favorites, filters.onlyFavorites]);

  const handleFilterChange = (updates: Partial<FeatFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FEAT_FILTERS);
  };

  const handleSelectTrait = (trait: string) => {
    setFilters((prev) => ({ ...prev, trait, offset: 0 }));
  };

  const handleLoadMore = () => {
    setFilters((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const refresh = () => {
    void fetchFeatMetadata().then(setMetadata).catch(console.error);
    setFilters(previous => ({ ...previous, offset: 0 }));
  };

  const editFeat = async (feat: FeatItem) => {
    setWorking(true);
    setError('');
    try {
      const fullFeat = await fetchFeatById(feat.id);
      setSelectedFeat(null);
      setEditor({ feat: fullFeat });
    } catch { setSelectedFeat(null); setError(t('featEditor.loadError')); }
    finally { setWorking(false); }
  };

  const removeFeat = async () => {
    if (!deleteTarget || working) return;
    setWorking(true);
    setError('');
    try {
      await deleteFeat(deleteTarget.id);
      setFavorites(previous => {
        const next = new Set(previous);
        next.delete(deleteTarget.id);
        try { localStorage.setItem('pf2e_favorite_feats', JSON.stringify(Array.from(next))); } catch { /* Ignore unavailable storage. */ }
        return next;
      });
      setDeleteTarget(null);
      setSelectedFeat(null);
      refresh();
    } catch { setDeleteTarget(null); setError(t('featEditor.deleteError')); }
    finally { setWorking(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><button type="button" onClick={() => setEditor({ feat: null })} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-contrast"><Plus className="w-4 h-4" />{t('featEditor.create')}</button></div>
      {error && <p role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-status-danger">{error}</p>}
      {editor && <FeatEditorModal feat={editor.feat} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh(); }} />}
      {deleteTarget && <ConfirmDialog title={t('featEditor.delete')} message={t('featEditor.deleteConfirm', { name: deleteTarget.name })} variant="danger" confirmLabel={t('common.remove')} onCancel={() => { setSelectedFeat(deleteTarget); setDeleteTarget(null); }} onConfirm={() => { void removeFeat(); }} />}
      {/* Filters Bar */}
      <FeatFiltersBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        metadata={metadata}
        totalMatches={total}
        favoritesCount={favorites.size}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
      />

      {/* Content Area */}
      {loading && feats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="w-8 h-8 text-accent-text animate-spin" />
          <p className="text-sm text-text-secondary">{t('featExplorer.querying')}</p>
        </div>
      ) : feats.length === 0 ? (
        <div className="bg-surface border border-border-strong rounded-xl p-12 text-center space-y-3">
          <Award className="w-10 h-10 text-text-secondary mx-auto opacity-50" />
          <h3 className="text-lg font-bold text-white">
            {filters.onlyFavorites ? t('featExplorer.noFavorites') : t('featExplorer.noResults')}
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {filters.onlyFavorites ? t('featExplorer.noFavoritesHint') : t('featExplorer.noResultsHint')}
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-2 px-4 py-2 bg-control hover:bg-control-hover text-sm text-accent-text font-semibold rounded-lg border border-border-strong transition-colors"
          >
            {t('common.resetFilters')}
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="compendium-cards">
          {feats.map((feat) => (
            <FeatCard
              key={feat.id}
              feat={feat}
              characterLevel={characterLevel}
              isFavorite={favorites.has(feat.id)}
              onToggleFavorite={() => toggleFavorite(feat.id)}
              onClick={() => setSelectedFeat(feat)}
              onSelectTrait={handleSelectTrait}
            />
          ))}
        </div>
      ) : (
        <FeatTableView
          feats={feats}
          favoritesSet={favorites}
          onToggleFavorite={(id) => toggleFavorite(id)}
          onSelectFeat={(feat) => setSelectedFeat(feat)}
          onSelectTrait={handleSelectTrait}
        />
      )}

      {/* Pagination Load More */}
      {feats.length < total && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center space-x-2 px-6 py-2.5 bg-elevated hover:bg-control text-white font-semibold text-sm rounded-xl border border-border-strong hover:border-accent transition-all shadow-md disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-accent-text" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <span>{t('featExplorer.loadMore', { shown: feats.length, total })}</span>
            )}
          </button>
        </div>
      )}

      {/* Feat Detail Modal */}
      {selectedFeat && (
        <FeatDetailModal
          feat={selectedFeat}
          characterLevel={characterLevel}
          isFavorite={favorites.has(selectedFeat.id)}
          onToggleFavorite={() => toggleFavorite(selectedFeat.id)}
          onClose={() => setSelectedFeat(null)}
          onSelectTrait={handleSelectTrait}
          onEdit={working ? undefined : () => { void editFeat(selectedFeat); }}
          onDelete={working ? undefined : () => { setDeleteTarget(selectedFeat); setSelectedFeat(null); }}
        />
      )}
    </div>
  );
};
