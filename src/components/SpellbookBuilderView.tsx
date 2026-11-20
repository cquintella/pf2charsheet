import React, { useState, useEffect, useMemo } from 'react';
import { SpellItem, Spellbook, SpellFilters, SpellMetadata } from '../types/pf2e';
import { 
  fetchSpells, 
  fetchSpellbooks, 
  fetchSpellbookById, 
  createSpellbook, 
  updateSpellbook, 
  deleteSpellbook 
} from '../services/api';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  X, 
  Sparkles, 
  Check, 
  FolderPlus, 
  Download, 
  FileText,
  Clock,
  Shield,
  Layers,
  ChevronRight,
  Printer
} from 'lucide-react';
import { resolveSpellIcon } from '../utils/formatters';
import { TarotPrintView } from './TarotPrintView';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './IconButton';
import { useI18n } from '../i18n/I18nContext';

interface SpellbookBuilderViewProps {
  metadata: SpellMetadata | null;
  onSelectSpellForDetail: (spell: SpellItem) => void;
}

export const SpellbookBuilderView: React.FC<SpellbookBuilderViewProps> = ({
  metadata,
  onSelectSpellForDetail
}) => {
  const { t } = useI18n();
  // Spellbooks list & active spellbook
  const [spellbooks, setSpellbooks] = useState<Spellbook[]>([]);
  const [activeSpellbook, setActiveSpellbook] = useState<Spellbook | null>(null);
  const [loadingBook, setLoadingBook] = useState<boolean>(false);
  const [showTarotPrint, setShowTarotPrint] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  // Search & Filter state for Left panel (66%)
  const [search, setSearch] = useState<string>('');
  const [selectedRank, setSelectedRank] = useState<string>('all');
  const [selectedTradition, setSelectedTradition] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [catalogSpells, setCatalogSpells] = useState<SpellItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState<number>(0);
  const [catalogOffset, setCatalogOffset] = useState<number>(0);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false);

  // Selected spells in active spellbook (Map of ID -> SpellItem)
  const [selectedSpellsMap, setSelectedSpellsMap] = useState<Record<string, SpellItem>>({});

  // Load list of spellbooks from SQLite on mount
  const loadSpellbooksList = async () => {
    try {
      const list = await fetchSpellbooks();
      setSpellbooks(list);
      if (list.length > 0 && !activeSpellbook) {
        loadSpellbookDetails(list[0].id);
      } else if (list.length === 0) {
        handleCreateNewSpellbook();
      }
    } catch (err) {
      console.error('Erro ao carregar lista de grimórios:', err);
    }
  };

  useEffect(() => {
    loadSpellbooksList();
  }, []);

  // Load single spellbook with hydrated spells
  const loadSpellbookDetails = async (id: string) => {
    setLoadingBook(true);
    try {
      const sb = await fetchSpellbookById(id);
      setActiveSpellbook(sb);
      const map: Record<string, SpellItem> = {};
      if (sb.spells) {
        for (const sp of sb.spells) {
          if (typeof sp !== 'string') {
            map[sp.id] = sp;
          }
        }
      }
      setSelectedSpellsMap(map);
      // Auto-filter by tradition if specified in spellbook
      if (sb.tradition && sb.tradition !== 'all') {
        setSelectedTradition(sb.tradition);
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes do grimório:', err);
    } finally {
      setLoadingBook(false);
    }
  };

  // Reset catalog pagination when filters change
  useEffect(() => {
    setCatalogOffset(0);
  }, [search, selectedRank, selectedTradition, selectedCategory]);

  // Search catalog spells for Left panel (with race-condition cancellation)
  useEffect(() => {
    let active = true;
    const isAppend = catalogOffset > 0;
    const filters: SpellFilters = {
      search,
      rank: selectedRank,
      tradition: selectedTradition,
      category: selectedCategory,
      defense: 'all',
      actions: 'all',
      trait: 'all',
      rarity: 'all',
      limit: 60,
      offset: catalogOffset
    };

    setLoadingCatalog(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetchSpells(filters);
        if (!active) return;
        if (isAppend) {
          setCatalogSpells(prev => {
            const seen = new Set(prev.map(s => s.id));
            return [...prev, ...res.spells.filter(s => !seen.has(s.id))];
          });
        } else {
          setCatalogSpells(res.spells);
        }
        setCatalogTotal(res.total);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoadingCatalog(false);
      }
    }, 200);

    return () => { active = false; clearTimeout(timeout); };
  }, [search, selectedRank, selectedTradition, selectedCategory, catalogOffset]);

  // Create new spellbook
  const handleCreateNewSpellbook = async () => {
    const newBook: Partial<Spellbook> = {
      name: t('spellbook.defaultName', { n: spellbooks.length + 1 }),
      tradition: 'arcane',
      caster_class: 'Wizard',
      description: t('spellbook.defaultDescription'),
      spells: []
    };
    try {
      const res = await createSpellbook(newBook);
      await loadSpellbooksList();
      await loadSpellbookDetails(res.id);
    } catch (err) {
      console.error('Erro ao criar novo grimório:', err);
    }
  };

  // Save current active spellbook to SQLite
  const handleSaveSpellbook = async () => {
    if (!activeSpellbook) return;
    setSaving(true);
    try {
      const spellIds = Object.keys(selectedSpellsMap);
      await updateSpellbook(activeSpellbook.id, {
        name: activeSpellbook.name,
        tradition: activeSpellbook.tradition,
        caster_class: activeSpellbook.caster_class,
        description: activeSpellbook.description,
        spells: spellIds
      });
      setSaveStatus(t('spellbook.savedOk'));
      setTimeout(() => setSaveStatus(''), 3000);
      loadSpellbooksList();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setSaveStatus(t('spellbook.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Delete active spellbook
  const handleDeleteSpellbook = async () => {
    if (!activeSpellbook) return;
    try {
      await deleteSpellbook(activeSpellbook.id);
      setActiveSpellbook(null);
      setSelectedSpellsMap({});
      setConfirmDeleteOpen(false);
      loadSpellbooksList();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  // Toggle adding/removing spell
  const toggleSpellInBook = (spell: SpellItem) => {
    setSelectedSpellsMap((prev) => {
      const next = { ...prev };
      if (next[spell.id]) {
        delete next[spell.id];
      } else {
        next[spell.id] = spell;
      }
      return next;
    });
  };

  // Export current spellbook to JSON
  const handleExportJson = () => {
    if (!activeSpellbook) return;
    const exportData = {
      ...activeSpellbook,
      spells: Object.values(selectedSpellsMap)
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSpellbook.name.toLowerCase().replace(/\s+/g, '_')}_spellbook.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group selected spells by rank
  const groupedSelectedSpells = useMemo(() => {
    const groups: Record<number, SpellItem[]> = {};
    for (const spell of Object.values(selectedSpellsMap)) {
      const isCantrip = spell.traits.includes('cantrip');
      const rankKey = isCantrip ? 0 : spell.rank;
      if (!groups[rankKey]) groups[rankKey] = [];
      groups[rankKey].push(spell);
    }
    // Sort within each rank
    for (const k of Object.keys(groups)) {
      groups[Number(k)].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [selectedSpellsMap]);

  const totalSelectedSpells = Object.keys(selectedSpellsMap).length;

  const ranks: { label: string; value: string }[] = [
    { label: t('common.all'), value: 'all' },
    { label: t('spell.cantrips'), value: '0' },
    ...Array.from({ length: 10 }, (_, index) => ({ label: t('spell.rankOrdinal', { n: index + 1 }), value: String(index + 1) }))
  ];
  const traditionLabel = (tradition: string): string =>
    tradition === 'arcane' || tradition === 'divine' || tradition === 'occult' || tradition === 'primal' ? t(`tradition.${tradition}`) : tradition;

  return (
    <div className="space-y-4">
      {showTarotPrint && <TarotPrintView spells={Object.values(groupedSelectedSpells).flat()} onClose={() => setShowTarotPrint(false)} />}
      {confirmDeleteOpen && activeSpellbook && (
        <ConfirmDialog
          title={t('spellbook.delete')}
          message={t('spellbook.confirmDelete', { name: activeSpellbook.name })}
          confirmLabel={t('common.remove')}
          variant="danger"
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={handleDeleteSpellbook}
        />
      )}
      {/* Spellbook Header & Management Bar */}
      <div className="bg-surface border border-border-strong rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Spellbook Selector & Info */}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-accent-text" />
            <select
              value={activeSpellbook?.id || ''}
              onChange={(e) => loadSpellbookDetails(e.target.value)}
              className="py-1.5 px-3 bg-elevated border border-border-strong rounded-lg text-sm font-semibold text-white focus:border-accent outline-none"
            >
              {spellbooks.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.name} ({sb.tradition})
                </option>
              ))}
            </select>
          </div>

          {activeSpellbook && (
            <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={activeSpellbook.name}
                onChange={(e) => setActiveSpellbook({ ...activeSpellbook, name: e.target.value })}
                placeholder={t('spellbook.namePlaceholder')}
                className="py-1.5 px-3 bg-elevated border border-border-strong focus:border-accent rounded-lg text-sm text-white font-medium outline-none flex-1"
              />
              <select
                value={activeSpellbook.tradition}
                onChange={(e) => {
                  const trad = e.target.value;
                  setActiveSpellbook({ ...activeSpellbook, tradition: trad });
                  setSelectedTradition(trad);
                }}
                className="py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs font-semibold text-white focus:border-accent outline-none capitalize"
              >
                <option value="arcane">{t('tradition.arcane')}</option>
                <option value="divine">{t('tradition.divine')}</option>
                <option value="occult">{t('tradition.occult')}</option>
                <option value="primal">{t('tradition.primal')}</option>
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <IconButton
            onClick={handleCreateNewSpellbook}
            label={t('spellbook.new')}
            icon={<FolderPlus className="w-4 h-4 text-accent-text" />}
          />
          <IconButton
            onClick={handleSaveSpellbook}
            disabled={saving || !activeSpellbook}
            variant="accent"
            label={saving ? t('common.saving') : t('spellbook.save')}
            icon={<Save className="w-4 h-4" />}
          />
          <IconButton
            onClick={() => setShowTarotPrint(true)}
            disabled={totalSelectedSpells === 0}
            label={t('spellbook.printCards')}
            icon={<Printer className="w-4 h-4 text-accent-text" />}
          />
          <IconButton
            onClick={handleExportJson}
            disabled={!activeSpellbook}
            label={t('spellbook.exportJson')}
            icon={<Download className="w-4 h-4" />}
          />
          <IconButton
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={!activeSpellbook}
            variant="danger"
            label={t('spellbook.delete')}
            icon={<Trash2 className="w-4 h-4" />}
          />
          {saveStatus && (
            <span className="text-xs text-status-success font-semibold animate-fadeIn">
              {saveStatus}
            </span>
          )}
        </div>
      </div>

      {/* 66% / 33% SPLIT WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (66% ~ 8 cols): Spells Catalog & Filter */}
        <div className="lg:col-span-8 bg-surface border border-border-strong rounded-xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-border-strong pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-accent-text" />
              <h2 className="text-base font-bold text-white tracking-wide">
                {t('spellbook.catalog')}
              </h2>
            </div>
            <span className="text-xs text-text-secondary">
              {t('spellbook.available', { count: catalogTotal })}
            </span>
          </div>

          {/* Quick Search & Filter Controls */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('spellbook.filterPlaceholder')}
                className="w-full pl-9 pr-9 py-2 bg-elevated border border-border-strong focus:border-accent rounded-lg text-sm text-white placeholder-text-muted outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Rank Selector */}
            <div className="flex flex-wrap gap-1">
              {ranks.map((r) => {
                const active = selectedRank === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setSelectedRank(r.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      active
                        ? 'bg-accent text-black font-bold shadow'
                        : 'bg-elevated text-text-primary hover:bg-control border border-border-strong'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Traditions & Category Filter */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <span className="text-text-secondary font-semibold">{t('spellbook.tradition')}</span>
                <select
                  value={selectedTradition}
                  onChange={(e) => setSelectedTradition(e.target.value)}
                  className="py-1 px-2 bg-elevated border border-border-strong rounded-md text-xs text-white outline-none"
                >
                  <option value="all">{t('common.allFem')}</option>
                  <option value="arcane">{t('tradition.arcane')}</option>
                  <option value="divine">{t('tradition.divine')}</option>
                  <option value="occult">{t('tradition.occult')}</option>
                  <option value="primal">{t('tradition.primal')}</option>
                </select>
              </div>

              <div className="flex items-center space-x-1">
                <span className="text-text-secondary font-semibold">{t('spellbook.type')}</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="py-1 px-2 bg-elevated border border-border-strong rounded-md text-xs text-white outline-none"
                >
                  <option value="all">{t('common.all')}</option>
                  <option value="spell">{t('spell.category.spell')}</option>
                  <option value="cantrip">{t('spell.badge.cantrip')}</option>
                  <option value="focus">{t('spell.badge.focus')}</option>
                  <option value="ritual">{t('spell.badge.ritual')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Catalog Spells List */}
          <div className="max-h-[620px] overflow-y-auto space-y-2 pr-1">
            {loadingCatalog ? (
              <div className="py-12 text-center text-xs text-text-secondary">
                {t('spellbook.searching')}
              </div>
            ) : catalogSpells.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-secondary">
                {t('spellbook.noResults')}
              </div>
            ) : (
              catalogSpells.map((spell) => {
                const isSelected = !!selectedSpellsMap[spell.id];
                const isCantrip = spell.traits.includes('cantrip');
                const imageSrc = resolveSpellIcon(spell.img);

                return (
                  <div
                    key={spell.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-status-success-bg border-status-success-border'
                        : 'bg-elevated hover:bg-elevated border-border-strong'
                    }`}
                  >
                    <div 
                      onClick={() => onSelectSpellForDetail(spell)}
                      className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded bg-elevated border border-border-strong p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        <img 
                          src={imageSrc} 
                          alt="" 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/icons/default-icons/spell.svg';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-white hover:text-accent-text transition-colors truncate">
                            {spell.name}
                          </span>
                          <span className="font-bold text-xs text-accent-text">
                            {isCantrip ? t('spell.badge.cantrip') : t('spell.rankOrdinal', { n: spell.rank })}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-secondary truncate">
                          {spell.time && `◆ ${spell.time} • `}
                          {spell.range ? `${spell.range} • ` : ''}
                          {spell.defense ? `${t('spellFilters.save')}: ${spell.defense}` : spell.duration || t('spell.instant')}
                        </div>
                      </div>
                    </div>

                    {/* Action Button: Add or Remove */}
                    <button
                      onClick={() => toggleSpellInBook(spell)}
                      className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                        isSelected
                          ? 'bg-status-success-border hover:bg-red-700 text-white'
                          : 'bg-control hover:bg-accent hover:text-black text-accent-text border border-border-strong'
                      }`}
                      title={isSelected ? t('spellbook.removeFromBook') : t('spellbook.addToBook')}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('spellbook.added')}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('spellbook.add')}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
            {catalogSpells.length < catalogTotal && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  disabled={loadingCatalog}
                  onClick={() => setCatalogOffset(prev => prev + 60)}
                  className="px-4 py-2 rounded-lg bg-elevated hover:bg-control text-xs font-semibold text-text-primary border border-border-strong disabled:opacity-50"
                >
                  {loadingCatalog ? t('common.loading') : t('app.loadMoreSpells', { shown: catalogSpells.length, total: catalogTotal })}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (33% ~ 4 cols): Active Spellbook Selected Spells */}
        <div className="lg:col-span-4 bg-surface border border-border-strong rounded-xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-border-strong pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide truncate">
                  {activeSpellbook?.name || t('spellbook.fallbackName')}
                </h2>
              </div>
              <p className="text-xs text-text-secondary">
                {t('spellbook.inscribed', { count: totalSelectedSpells })}
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-accent/20 text-accent-text border border-accent/40">
              {traditionLabel(activeSpellbook?.tradition || 'arcane')}
            </span>
          </div>

          {/* Selected Spells List Grouped by Rank */}
          <div className="max-h-[660px] overflow-y-auto space-y-4 pr-1">
            {totalSelectedSpells === 0 ? (
              <div className="py-16 text-center space-y-2">
                <BookOpen className="w-10 h-10 text-text-secondary mx-auto opacity-40" />
                <h3 className="text-sm font-semibold text-white">{t('spellbook.empty')}</h3>
                <p className="text-xs text-text-secondary max-w-[220px] mx-auto">
                  {t('spellbook.emptyHint')}
                </p>
              </div>
            ) : (
              [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rankNum) => {
                const spellsInRank = groupedSelectedSpells[rankNum];
                if (!spellsInRank || spellsInRank.length === 0) return null;

                const rankTitle = rankNum === 0 ? t('spellbook.cantripsHeader') : t('spellbook.rankHeader', { n: rankNum });

                return (
                  <div key={rankNum} className="space-y-1.5">
                    {/* Rank Group Header */}
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-accent-text border-b border-border-strong pb-1">
                      <span>{rankTitle}</span>
                      <span className="text-[11px] text-text-secondary font-normal">
                        {t('app.spellCount', { count: spellsInRank.length })}
                      </span>
                    </div>

                    {/* Spells in this Rank */}
                    <div className="space-y-1">
                      {spellsInRank.map((spell) => {
                        return (
                          <div
                            key={spell.id}
                            className="group flex items-center justify-between py-1.5 px-2 rounded-lg bg-elevated hover:bg-elevated border border-border-strong text-xs transition-colors"
                          >
                            <div 
                              onClick={() => onSelectSpellForDetail(spell)}
                              className="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer"
                              title={t('spellbook.clickForDetails')}
                            >
                              <ChevronRight className="w-3 h-3 text-accent-text flex-shrink-0" />
                              <span className="font-medium text-white group-hover:text-accent-text truncate">
                                {spell.name}
                              </span>
                              {spell.time && (
                                <span className="text-[11px] text-text-secondary flex-shrink-0">
                                  ({t('spellbook.actionCost', { time: spell.time })})
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => toggleSpellInBook(spell)}
                              className="p-1 rounded text-text-secondary hover:text-status-danger hover:bg-status-danger-bg transition-colors"
                              title={t('spellbook.removeFromBook')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            {catalogSpells.length < catalogTotal && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  disabled={loadingCatalog}
                  onClick={() => setCatalogOffset(prev => prev + 60)}
                  className="px-4 py-2 rounded-lg bg-elevated hover:bg-control text-xs font-semibold text-text-primary border border-border-strong disabled:opacity-50"
                >
                  {loadingCatalog ? t('common.loading') : t('app.loadMoreSpells', { shown: catalogSpells.length, total: catalogTotal })}
                </button>
              </div>
            )}
          </div>

          {/* Quick Footer Summary */}
          {totalSelectedSpells > 0 && (
            <div className="pt-2 border-t border-border-strong flex items-center justify-between text-xs text-text-secondary">
              <span>{t('spellbook.totalInBook')}</span>
              <span className="font-bold text-accent-text">{t('app.spellCount', { count: totalSelectedSpells })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
