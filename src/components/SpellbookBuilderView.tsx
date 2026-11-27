import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
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
  Download, 
  ChevronRight,
  Printer
} from 'lucide-react';
import { resolveSpellIcon } from '../utils/formatters';
import { TarotPrintView } from './TarotPrintView';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './IconButton';
import { useI18n } from '../i18n/I18nContext';
import { SheetGuard } from './LevelProgressionView';
import { useModalFocus, clickableProps } from '../utils/useModalFocus';

interface SpellbookBuilderViewProps {
  metadata: SpellMetadata | null;
  onSelectSpellForDetail: (spell: SpellItem) => void;
  onGuardChange?: (guard: SheetGuard | null) => void;
}

export const SpellbookBuilderView: React.FC<SpellbookBuilderViewProps> = ({
  metadata,
  onSelectSpellForDetail,
  onGuardChange
}) => {
  const { t } = useI18n();
  // Spellbooks list & active spellbook
  const [spellbooks, setSpellbooks] = useState<Spellbook[]>([]);
  const [activeSpellbook, setActiveSpellbook] = useState<Spellbook | null>(null);
  const [loadingBook, setLoadingBook] = useState<boolean>(false);
  const [showTarotPrint, setShowTarotPrint] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [errorStatus, setErrorStatus] = useState<string>('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState(false);
  const [pendingBookAction, setPendingBookAction] = useState<(() => void) | null>(null);
  const pendingDialogRef = useRef<HTMLDivElement>(null);
  const loadSequence = useRef(0);
  useModalFocus(pendingDialogRef, () => { if (!saving) setPendingBookAction(null); }, Boolean(pendingBookAction));

  // Search & Filter state for Left panel (66%)
  const [search, setSearch] = useState<string>('');
  const [selectedRank, setSelectedRank] = useState<string>('all');
  const [selectedTradition, setSelectedTradition] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [addingAll, setAddingAll] = useState(false);
  const [catalogSpells, setCatalogSpells] = useState<SpellItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState<number>(0);
  const [catalogOffset, setCatalogOffset] = useState<number>(0);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false);

  // Selected spells in active spellbook (Map of ID -> SpellItem)
  const [selectedSpellsMap, setSelectedSpellsMap] = useState<Record<string, SpellItem>>({});
  const [unavailableSpellIds, setUnavailableSpellIds] = useState<string[]>([]);
  const [invalidSpellList, setInvalidSpellList] = useState(false);
  const savedSnapshot = useRef<string | null>(null);
  const needsBaseline = useRef(true);

  // Load list of spellbooks from SQLite on mount
  const loadSpellbooksList = async (): Promise<Spellbook[]> => {
    const list = await fetchSpellbooks();
    setSpellbooks(list);
    return list;
  };

  useEffect(() => {
    void loadSpellbooksList().then(list => {
      if (list.length > 0) void loadSpellbookDetails(list[0].id);
    }).catch(err => {
      console.error('Erro ao carregar lista de grimórios:', err);
      setErrorStatus(t('spellbook.loadError'));
    });
  }, []);

  // Load single spellbook with hydrated spells
  const loadSpellbookDetails = async (id: string) => {
    const request = ++loadSequence.current;
    setErrorStatus('');
    setLoadingBook(true);
    try {
      const sb = await fetchSpellbookById(id);
      if (request !== loadSequence.current) return;
      needsBaseline.current = true;
      setActiveSpellbook(sb);
      const map: Record<string, SpellItem> = {};
      if (sb.spells) {
        for (const sp of sb.spells) {
          if (typeof sp !== 'string') {
            map[sp.id] = sp;
          }
        }
      }
      try {
        const storedIds: unknown = JSON.parse(sb.spells_json || '[]');
        if (!Array.isArray(storedIds) || storedIds.some(id => typeof id !== 'string')) throw new Error('Invalid spell list');
        setUnavailableSpellIds(storedIds.filter((spellId: string) => !map[spellId]));
        setInvalidSpellList(false);
      } catch {
        setUnavailableSpellIds([]);
        setInvalidSpellList(true);
      }
      setSelectedSpellsMap(map);
      // Auto-filter by tradition if specified in spellbook
      setSelectedTradition(sb.tradition || 'all');
    } catch (err) {
      console.error('Erro ao carregar detalhes do grimório:', err);
      if (request === loadSequence.current) setErrorStatus(t('spellbook.loadError'));
    } finally {
      if (request === loadSequence.current) setLoadingBook(false);
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
    if (creating) return;
    setCreating(true);
    setErrorStatus('');
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
      setErrorStatus(t('spellbook.createError'));
    } finally {
      setCreating(false);
    }
  };

  const spellbookSnapshot = () => JSON.stringify({
    id: activeSpellbook?.id || '',
    name: activeSpellbook?.name || '',
    tradition: activeSpellbook?.tradition || '',
    caster_class: activeSpellbook?.caster_class || '',
    description: activeSpellbook?.description || '',
    spellIds: [...Object.keys(selectedSpellsMap), ...unavailableSpellIds].sort(),
  });
  const currentSpellbookSnapshot = spellbookSnapshot();
  const isDirty = Boolean(activeSpellbook && savedSnapshot.current !== null && savedSnapshot.current !== currentSpellbookSnapshot);
  const requestBookAction = (action: () => void) => {
    if (isDirty) setPendingBookAction(() => action);
    else action();
  };

  // Save current active spellbook to SQLite
  const handleSaveSpellbook = async (): Promise<boolean> => {
    if (!activeSpellbook) return true;
    if (invalidSpellList) { setErrorStatus(t('spellbook.invalidSpellList')); return false; }
    const savedState = spellbookSnapshot();
    setErrorStatus('');
    setSaving(true);
    try {
      const spellIds = [...Object.keys(selectedSpellsMap), ...unavailableSpellIds];
      await updateSpellbook(activeSpellbook.id, {
        name: activeSpellbook.name,
        tradition: activeSpellbook.tradition,
        caster_class: activeSpellbook.caster_class,
        description: activeSpellbook.description,
        spells: spellIds
      });
      savedSnapshot.current = savedState;
      setSaveStatus(t('spellbook.savedOk'));
      setTimeout(() => setSaveStatus(''), 3000);
      void loadSpellbooksList().catch(err => console.error('Erro ao atualizar grimórios:', err));
      return true;
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setErrorStatus(t('spellbook.saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    if (loadingBook) return;
    if (!activeSpellbook) { onGuardChange?.(null); return; }
    if (needsBaseline.current) {
      savedSnapshot.current = currentSpellbookSnapshot;
      needsBaseline.current = false;
    }
    onGuardChange?.({
      dirty: savedSnapshot.current !== null && savedSnapshot.current !== currentSpellbookSnapshot,
      save: handleSaveSpellbook,
    });
  });

  useEffect(() => () => onGuardChange?.(null), [onGuardChange]);

  // Delete active spellbook
  const handleDeleteSpellbook = async () => {
    if (!activeSpellbook) return;
    try {
      await deleteSpellbook(activeSpellbook.id);
      loadSequence.current++;
      setActiveSpellbook(null);
      setSelectedSpellsMap({});
      setUnavailableSpellIds([]);
      setInvalidSpellList(false);
      setConfirmDeleteOpen(false);
      const remaining = await loadSpellbooksList();
      if (remaining.length > 0) await loadSpellbookDetails(remaining[0].id);
    } catch (err) {
      console.error('Erro ao excluir:', err);
      setErrorStatus(t('spellbook.deleteError'));
    }
  };

  // Toggle adding/removing spell
  const toggleSpellInBook = (spell: SpellItem) => {
    if (!activeSpellbook || loadingBook) return;
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

  const addAllSpells = async () => {
    if (!activeSpellbook || addingAll || loadingBook) return;
    const request = loadSequence.current;
    setAddingAll(true);
    try {
      const all: SpellItem[] = [];
      let total = 0;
      do {
        const result = await fetchSpells({ search, rank: selectedRank, tradition: selectedTradition, category: selectedCategory, defense: 'all', actions: 'all', trait: 'all', rarity: 'all', limit: 60, offset: all.length });
        total = result.total;
        if (!result.spells.length) throw new Error('Incomplete spell catalog');
        all.push(...result.spells);
      } while (all.length < total);
      if (request === loadSequence.current) setSelectedSpellsMap(previous => {
        const next = { ...previous };
        all.forEach(spell => { next[spell.id] = spell; });
        return next;
      });
    } catch (error) {
      console.error(error);
      setErrorStatus(t('spellbook.addAllError'));
    } finally {
      setAddingAll(false);
    }
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
      {pendingBookAction && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="spellbook-unsaved-title">
        <div ref={pendingDialogRef} className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 space-y-4 shadow-2xl">
          <h2 id="spellbook-unsaved-title" className="text-lg font-bold text-text-primary">{t('app.unsavedTitle')}</h2>
          <p className="text-sm text-text-primary">{t('spellbook.unsavedBody')}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setPendingBookAction(null)} className="px-3 py-2 rounded-lg bg-control text-sm">{t('common.cancel')}</button>
            <button type="button" disabled={saving} onClick={() => { const action = pendingBookAction; setPendingBookAction(null); action(); }} className="px-3 py-2 rounded-lg bg-status-danger-bg text-sm text-status-danger">{t('app.dontSave')}</button>
            <button type="button" disabled={saving} onClick={async () => { const action = pendingBookAction; if (await handleSaveSpellbook()) { setPendingBookAction(null); action(); } }} className="px-3 py-2 rounded-lg bg-accent text-accent-contrast text-sm">{saving ? t('common.saving') : t('common.save')}</button>
          </div>
        </div>
      </div>}
      {showTarotPrint && <TarotPrintView spells={Object.values(groupedSelectedSpells).flat()} onClose={() => setShowTarotPrint(false)} />}
      {errorStatus && <div role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-bg px-4 py-2 text-status-danger">{errorStatus}</div>}
      {(unavailableSpellIds.length > 0 || invalidSpellList) && <div role="alert" className="rounded-lg border border-status-warn-border bg-status-warn-bg px-4 py-2 text-status-warn">{invalidSpellList ? t('spellbook.invalidSpellList') : t('spellbook.unavailableSpells', { count: unavailableSpellIds.length })}</div>}
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
      <div className="bg-surface border border-border-strong rounded-xl p-4 shadow-lg flex flex-col items-stretch gap-4">
        {/* Spellbook Selector & Info */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center space-x-2">
            <BookOpen className="w-5 h-5 text-accent-text" />
            <select
              value={activeSpellbook?.id || ''}
              aria-label={t('spellbook.chooseBook')}
              disabled={creating || loadingBook}
              onChange={(e) => {
                const id = e.target.value;
                if (id === '__new_spellbook__') requestBookAction(() => { void handleCreateNewSpellbook(); });
                else if (id && id !== activeSpellbook?.id) requestBookAction(() => { void loadSpellbookDetails(id); });
              }}
              className="min-w-0 max-w-full py-1.5 px-3 bg-elevated border border-border-strong rounded-lg text-sm font-semibold text-white focus:border-accent outline-none"
            >
              {!activeSpellbook && <option value="">{loadingBook ? t('common.loading') : t('spellbook.noBook')}</option>}
              {spellbooks.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.name} ({sb.tradition})
                </option>
              ))}
              <option value="__new_spellbook__">{t('spellbook.newBook')}</option>
            </select>
          </div>

          {activeSpellbook && (
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={activeSpellbook.name}
                onChange={(e) => setActiveSpellbook({ ...activeSpellbook, name: e.target.value })}
                placeholder={t('spellbook.namePlaceholder')}
                className="py-1.5 px-3 bg-elevated border border-border-strong focus:border-accent rounded-lg text-sm text-white font-medium outline-none flex-1 min-w-[160px]"
              />
              <select
                value={activeSpellbook.caster_class || 'Wizard'}
                aria-label={t('spellbook.casterPreset')}
                onChange={(e) => {
                  const caster = e.target.value;
                  const presetTraditions: Record<string, string> = {
                    Wizard: 'arcane',
                    'Wizard Dedication': 'arcane',
                    Magus: 'arcane',
                    'Magus Dedication': 'arcane',
                    Cleric: 'divine',
                    'Cleric Dedication': 'divine',
                    Oracle: 'divine',
                    'Oracle Dedication': 'divine',
                    Druid: 'primal',
                    'Druid Dedication': 'primal',
                    Bard: 'occult',
                    'Bard Dedication': 'occult',
                    Psychic: 'occult',
                    'Psychic Dedication': 'occult',
                    Sorcerer: 'all',
                    'Sorcerer Dedication': 'all',
                    Witch: 'all',
                    'Witch Dedication': 'all',
                    Summoner: 'all',
                    'Summoner Dedication': 'all',
                    'Multiclass Archetype': 'all',
                  };
                  const nextTrad = presetTraditions[caster] ?? activeSpellbook.tradition;
                  setActiveSpellbook({ ...activeSpellbook, caster_class: caster, tradition: nextTrad });
                  setSelectedTradition(nextTrad);
                }}
                className="py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs font-semibold text-white focus:border-accent outline-none"
              >
                <option value="Wizard">Wizard (Arcane)</option>
                <option value="Cleric">Cleric (Divine)</option>
                <option value="Druid">Druid (Primal)</option>
                <option value="Bard">Bard (Occult)</option>
                <option value="Sorcerer">Sorcerer</option>
                <option value="Witch">Witch</option>
                <option value="Oracle">Oracle (Divine)</option>
                <option value="Psychic">Psychic (Occult)</option>
                <option value="Magus">Magus (Arcane)</option>
                <option value="Summoner">Summoner</option>
                <option value="Wizard Dedication">Wizard Dedication</option>
                <option value="Cleric Dedication">Cleric Dedication</option>
                <option value="Druid Dedication">Druid Dedication</option>
                <option value="Bard Dedication">Bard Dedication</option>
                <option value="Sorcerer Dedication">Sorcerer Dedication</option>
                <option value="Witch Dedication">Witch Dedication</option>
                <option value="Oracle Dedication">Oracle Dedication</option>
                <option value="Psychic Dedication">Psychic Dedication</option>
                <option value="Magus Dedication">Magus Dedication</option>
                <option value="Summoner Dedication">Summoner Dedication</option>
                <option value="Multiclass Archetype">Multiclass Archetype</option>
              </select>
              <select
                value={activeSpellbook.tradition}
                onChange={(e) => {
                  const trad = e.target.value;
                  setActiveSpellbook({ ...activeSpellbook, tradition: trad });
                  setSelectedTradition(trad);
                }}
                className="py-1.5 px-2 bg-elevated border border-border-strong rounded-lg text-xs font-semibold text-white focus:border-accent outline-none capitalize"
              >
                <option value="all">{t('tradition.all')}</option>
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
          {isDirty && <span className="text-sm text-status-warn font-semibold">{t('sheet.unsavedBadge')}</span>}
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
                data-shortcut-search
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

          <button type="button" onClick={() => { void addAllSpells(); }} disabled={!activeSpellbook || loadingBook || creating || loadingCatalog || addingAll || catalogTotal === 0} className="px-3 py-2 rounded-lg bg-control text-accent-text border border-border-strong disabled:opacity-50">
            {addingAll ? t('common.loading') : t('spellbook.addAll')}
          </button>

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
                        ? 'bg-accent/10 border-accent/50'
                        : 'bg-elevated hover:bg-elevated border-border-strong'
                    }`}
                  >
                    <div
                      {...clickableProps(() => onSelectSpellForDetail(spell))}
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
                        <div className="text-xs text-text-secondary truncate">
                          {spell.time && `◆ ${spell.time} • `}
                          {spell.range ? `${spell.range} • ` : ''}
                          {spell.defense ? `${t('spellFilters.save')}: ${spell.defense}` : spell.duration || t('spell.instant')}
                        </div>
                      </div>
                    </div>

                    {/* Action Button: Add or Remove */}
                    <button
                      onClick={() => toggleSpellInBook(spell)}
                      aria-label={t(isSelected ? 'spellbook.removeNamed' : 'spellbook.addNamed', { name: spell.name })}
                      disabled={!activeSpellbook || loadingBook || creating}
                      className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-accent hover:bg-accent-hover text-accent-contrast'
                          : 'bg-control hover:bg-accent hover:text-black text-accent-text border border-border-strong'
                      }`}
                      title={isSelected ? t('spellbook.removeFromBook') : t('spellbook.addToBook')}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
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
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-accent/20 text-accent-text border border-accent/40">
              {traditionLabel(activeSpellbook?.tradition || 'arcane')}
            </span>
          </div>

          {/* Selected Spells List Grouped by Rank */}
          <div className="max-h-[660px] overflow-y-auto space-y-4 pr-1">
            {totalSelectedSpells === 0 ? (
              <div className="py-16 text-center space-y-2">
                <BookOpen className="w-10 h-10 text-text-secondary mx-auto opacity-40" />
                <h3 className="text-sm font-semibold text-white">{activeSpellbook ? t('spellbook.empty') : t('spellbook.noBook')}</h3>
                <p className="text-xs text-text-secondary max-w-[220px] mx-auto">
                  {activeSpellbook ? t('spellbook.emptyHint') : t('spellbook.createHint')}
                </p>
                {!activeSpellbook && <button type="button" disabled={creating || loadingBook} onClick={() => { void handleCreateNewSpellbook(); }} className="px-4 py-2 rounded-lg bg-accent text-accent-contrast font-semibold disabled:opacity-50">{creating ? t('common.loading') : t('spellbook.new')}</button>}
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
                      <span className="text-xs text-text-secondary font-normal">
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
                              {...clickableProps(() => onSelectSpellForDetail(spell))}
                              className="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer"
                              title={t('spellbook.clickForDetails')}
                            >
                              <ChevronRight className="w-3 h-3 text-accent-text flex-shrink-0" />
                              <span className="font-medium text-white group-hover:text-accent-text truncate">
                                {spell.name}
                              </span>
                              {spell.time && (
                                <span className="text-xs text-text-secondary flex-shrink-0">
                                  ({t('spellbook.actionCost', { time: spell.time })})
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => toggleSpellInBook(spell)}
                              aria-label={t('spellbook.removeNamed', { name: spell.name })}
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
