import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  SpellFilters, 
  SpellItem, 
  SpellMetadata, 
  SavedCharacterRecord
} from './types/pf2e';
import { 
  fetchSpells, 
  fetchSpellMetadata, 
  fetchCharacters, 
  saveCharacter,
  deleteCharacter 
} from './services/api';
import { EquipmentItem } from './types/pf2e';
import { SpellFiltersBar } from './components/SpellFiltersBar';
import { SpellCard } from './components/SpellCard';
import { SpellTableView } from './components/SpellTableView';
import { SpellDetailModal } from './components/SpellDetailModal';
import { SpellbookBuilderView } from './components/SpellbookBuilderView';
import { CharacterCreatorView } from './components/CharacterCreatorView';
import { LevelProgressionView, SheetGuard } from './components/LevelProgressionView';
import { EquipmentExplorerView } from './components/EquipmentExplorerView';
import { FeatExplorerView } from './components/FeatExplorerView';
import { SettingsModal, ThemeName } from './components/SettingsModal';
import { HpProgressionMode } from './types/pf2e';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SplashScreen } from './components/SplashScreen';
import { useI18n } from './i18n/I18nContext';
import { clickableProps } from './utils/useModalFocus';
import { getCharacterPortrait, getSelectedPortraitDb, PortraitDbSource, resolvePortraitSrc, setSelectedPortraitDb } from './utils/portrait';
import { 
  BookOpen, 
  Sparkles, 
  Database, 
  Loader2, 
  ArrowUpCircle, 
  Library, 
  Search, 
  User, 
  Award, 
  Plus,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  Trash2,
  Heart,
  Shield,
  ChevronDown,
  Check,
  FileText,
  Package,
  Settings,
  Image as ImageIcon
} from 'lucide-react';

const INITIAL_FILTERS: SpellFilters = {
  search: '',
  rank: 'all',
  tradition: 'all',
  category: 'all',
  defense: 'all',
  actions: 'all',
  trait: 'all',
  rarity: 'all',
  onlyFavorites: false,
  limit: 48,
  offset: 0
};

export const App: React.FC = () => {
  const { t, locale } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashDone = useCallback(() => setShowSplash(false), []);
  const [activeTab, setActiveTabValue] = useState<'creator' | 'levels' | 'catalog' | 'feats' | 'items' | 'spellbooks'>('levels');
  const [theme, setTheme] = useState<ThemeName>(() => {
    try { const value = localStorage.getItem('pf2e_theme'); return value === 'light' || value === 'dark' ? value : 'current'; } catch { return 'current'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('pf2e_theme', theme); } catch { /* A escolha permanece ativa nesta sessão. */ }
  }, [theme]);
  const [portraitDb, setPortraitDb] = useState<PortraitDbSource>(() => getSelectedPortraitDb());
  useEffect(() => {
    setSelectedPortraitDb(portraitDb);
  }, [portraitDb]);
  const [hpMode, setHpMode] = useState<HpProgressionMode>(() => {
    try {
      const value = localStorage.getItem('pf2e_hp_mode');
      return value === 'average' || value === 'roll' ? value : 'full';
    } catch {
      return 'full';
    }
  });
  useEffect(() => {
    try { localStorage.setItem('pf2e_hp_mode', hpMode); } catch { /* ignore */ }
  }, [hpMode]);
  const [filters, setFilters] = useState<SpellFilters>(INITIAL_FILTERS);
  const [metadata, setMetadata] = useState<SpellMetadata | null>(null);
  const [spells, setSpells] = useState<SpellItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [selectedSpell, setSelectedSpell] = useState<SpellItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const sheetGuard = useRef<SheetGuard | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [guardSaving, setGuardSaving] = useState(false);
  const onGuardChange = useCallback((guard: SheetGuard | null) => { sheetGuard.current = guard; }, []);
  const requestTransition = (action: () => void) => {
    if (sheetGuard.current?.dirty) setPendingAction(() => action);
    else action();
  };
  const setActiveTab = (tab: typeof activeTab) => {
    if (tab === activeTab) return;
    requestTransition(() => setActiveTabValue(tab));
  };
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (sheetGuard.current?.dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    const cleanup = window.electronAPI?.onCloseRequested(() => {
      if (sheetGuard.current?.dirty) setPendingAction(() => () => window.electronAPI?.allowClose());
      else window.electronAPI?.allowClose();
    });
    return () => { window.removeEventListener('beforeunload', beforeUnload); cleanup?.(); };
  }, []);

  // Global Character Management
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>([]);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [confirmDeleteChar, setConfirmDeleteChar] = useState<SavedCharacterRecord | null>(null);

  // Character Popover State
  const [isCharPopoverOpen, setIsCharPopoverOpen] = useState(false);
  const [charSearchQuery, setCharSearchQuery] = useState('');
  const charPopoverRef = useRef<HTMLDivElement>(null);

  // Left Sidebar: Resizable Width & Collapse State
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('pf2e_sidebar_width');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val >= 200 && val <= 480) return val;
      }
    } catch (e) {}
    return 280;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('pf2e_sidebar_collapsed');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return false;
  });

  const [isResizing, setIsResizing] = useState<boolean>(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pf2e_sidebar_collapsed', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);

    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(mouseMoveEvent.clientX, 200), 480);
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setSidebarWidth((current) => {
        try {
          localStorage.setItem('pf2e_sidebar_width', String(current));
        } catch (e) {}
        return current;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (charPopoverRef.current && !charPopoverRef.current.contains(event.target as Node)) {
        setIsCharPopoverOpen(false);
      }
    };
    if (isCharPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCharPopoverOpen]);

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pf2e_favorite_spells');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Falha ao ler favoritos do localStorage:', e);
    }
    return new Set<string>();
  });

  const toggleFavorite = (spellId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(spellId)) {
        next.delete(spellId);
      } else {
        next.add(spellId);
      }
      try {
        localStorage.setItem('pf2e_favorite_spells', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
  };

  const handleUpdateSpellIcon = (spellId: string, newImgPath: string) => {
    setSpells((prev) =>
      prev.map((s) => (s.id === spellId ? { ...s, img: newImgPath } : s))
    );
    if (selectedSpell && selectedSpell.id === spellId) {
      setSelectedSpell((prev) => (prev ? { ...prev, img: newImgPath } : null));
    }
  };

  // Refresh saved characters list
  const refreshCharacters = useCallback(async () => {
    try {
      const chars = await fetchCharacters();
      setSavedCharacters(chars);
      setActiveCharId((prev) => (chars.length > 0 && !prev ? chars[0].id : prev));
    } catch (e) {
      console.error('Falha ao carregar lista de personagens:', e);
    }
  }, []);

  const handleDeleteCharacter = useCallback(async (id: string) => {
    try {
      await deleteCharacter(id);
      const chars = await fetchCharacters();
      setSavedCharacters(chars);
      if (activeCharId === id) {
        setActiveCharId(chars.length > 0 ? chars[0].id : '');
      }
    } catch (err) {
      console.error('Falha ao excluir personagem:', err);
    }
  }, [activeCharId]);

  // Load metadata and characters on mount
  useEffect(() => {
    fetchSpellMetadata()
      .then(setMetadata)
      .catch((err) => console.error('Erro ao carregar metadados:', err));

    refreshCharacters();
  }, [refreshCharacters]);

  // Active character record computed
  const activeCharacter = useMemo(() => {
    if (!savedCharacters.length) return null;
    return savedCharacters.find((c) => c.id === activeCharId) || savedCharacters[0];
  }, [savedCharacters, activeCharId]);

  const handleAddEquipmentToActiveChar = useCallback(async (item: EquipmentItem) => {
    if (!activeCharacter) return;
    try {
      const data = JSON.parse(activeCharacter.data_json || '{}');
      const currentInv = data.inventory || { items: [], coins: { pp: 0, gp: 0, sp: 0, cp: 0 } };
      const items = Array.isArray(currentInv.items) ? [...currentInv.items] : [];
      const idx = items.findIndex((entry: any) => entry.item?.id === item.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: (items[idx].quantity || 1) + 1 };
      } else {
        items.push({ id: crypto.randomUUID(), item, quantity: 1, equipped: false });
      }
      await saveCharacter({
        id: activeCharacter.id,
        name: activeCharacter.name,
        level: activeCharacter.level,
        ancestry: activeCharacter.ancestry,
        heritage: activeCharacter.heritage,
        background: activeCharacter.background,
        class: activeCharacter.class,
        subclass: activeCharacter.subclass,
        data: { ...data, inventory: { ...currentInv, items } },
      });
      await refreshCharacters();
    } catch (err) {
      console.error('Erro ao adicionar item ao inventário:', err);
    }
  }, [activeCharacter, refreshCharacters]);

  // Computed active character stats (PV e CA)
  const activeCharStats = useMemo(() => {
    if (!activeCharacter?.data_json) {
      return { hp: 20, maxHp: 20, ac: 15 };
    }
    try {
      const data = JSON.parse(activeCharacter.data_json);
      const maxHp = data.hpStats?.totalHp || data.derivedStats?.maxHp || 20;
      const currentHp = typeof data.session?.currentHp === 'number' ? Math.min(maxHp, Math.max(0, data.session.currentHp)) : maxHp;
      const ac = data.combatStats?.ac || data.derivedStats?.ac || 15;
      return {
        hp: currentHp,
        maxHp,
        ac
      };
    } catch (e) {
      return { hp: 20, maxHp: 20, ac: 15 };
    }
  }, [activeCharacter]);

  // Filtered saved characters for popover search
  const filteredSavedCharacters = useMemo(() => {
    if (!charSearchQuery.trim()) return savedCharacters;
    const q = charSearchQuery.toLowerCase();
    return savedCharacters.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.ancestry && c.ancestry.toLowerCase().includes(q)) ||
      (c.class && c.class.toLowerCase().includes(q))
    );
  }, [savedCharacters, charSearchQuery]);

  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  // Fetch spells whenever filters change
  const loadSpells = useCallback(async (currentFilters: SpellFilters, isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true);
    else setLoading(true);

    try {
      const favList = Array.from(favoritesRef.current);
      const data = await fetchSpells(currentFilters, favList);
      if (isAppend) {
        setSpells((prev) => {
          const seen = new Set(prev.map(s => s.id));
          return [...prev, ...data.spells.filter(s => !seen.has(s.id))];
        });
      } else {
        setSpells(data.spells);
      }
      setTotal(data.total);
    } catch (err) {
      console.error('Erro ao buscar magias:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadSpells(filters, filters.offset > 0);
    }
  }, [filters, activeTab, loadSpells]);

  useEffect(() => {
    if (activeTab === 'catalog' && filters.onlyFavorites) {
      setFilters((prev) => ({ ...prev, offset: 0 }));
    }
  }, [favorites, activeTab, filters.onlyFavorites]);

  const handleFilterChange = (updates: Partial<SpellFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleSelectTrait = (trait: string) => {
    setFilters((prev) => ({ ...prev, trait, offset: 0 }));
  };

  const handleLoadMore = () => {
    setFilters((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`h-screen bg-canvas text-text-primary flex flex-col md:flex-row font-sans overflow-hidden ${isResizing ? 'select-none cursor-col-resize' : ''}`}>
      {/* Mobile Top Header (Visible only on mobile) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-border-strong z-40 flex-shrink-0 print:hidden">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg bg-elevated text-accent-text hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-accent-text" />
            <span className="font-bold text-sm text-white">PF2e Manager</span>
            <button type="button" onClick={() => setShowSettings(true)} className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-elevated transition-colors" title={t('settings.title')} aria-label={t('settings.open')}>
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeCharacter && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-white truncate max-w-[140px]">{activeCharacter.name}</span>
            <span className="px-1.5 py-0.5 rounded bg-elevated text-accent-text font-bold text-[11px]">
              {t('common.levelShort', { level: activeCharacter.level })}
            </span>
          </div>
        )}
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* LEFT NAVIGATION SIDEBAR (Abas à esquerda com Personagem no Topo, Redimensionável e Recolhível) */}
      <aside
        style={{ width: isSidebarCollapsed ? '64px' : `${sidebarWidth}px` }}
        className={`
          fixed md:relative inset-y-0 left-0 z-50 print:hidden
          bg-surface border-r border-border-strong
          flex flex-col h-full transition-[width] duration-200 ease-in-out flex-shrink-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {isSidebarCollapsed ? (
          /* ================= COLLAPSED ICON-ONLY SIDEBAR ================= */
          <div className="flex flex-col h-full items-center py-3 justify-between">
            {/* Top Expand Button */}
            <div className="space-y-4 flex flex-col items-center">
              <button
                onClick={toggleSidebarCollapse}
                className="p-2 rounded-xl bg-elevated hover:bg-control text-accent-text hover:text-white transition-all shadow"
                title={t('app.expandSidebar')}
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>

              {/* Mini Character Badge */}
              {activeCharacter ? (
                <div 
                  className="w-10 h-10 rounded-xl bg-control border border-accent/50 flex items-center justify-center text-accent-text font-black text-sm shadow cursor-pointer hover:scale-105 transition-transform"
                  title={t('app.activeCharacterBadge', { name: activeCharacter.name, level: activeCharacter.level, className: activeCharacter.class || '' })}
                  onClick={() => setIsSidebarCollapsed(false)}
                >
                  {activeCharacter.level}
                </div>
              ) : (
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="w-10 h-10 rounded-xl bg-elevated border border-border-strong flex items-center justify-center text-text-secondary hover:text-white"
                  title={t('app.expandToSelect')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

              {/* Quick Add Hero Button */}
              <button
                onClick={() => { setActiveTab('creator'); setIsMobileMenuOpen(false); }}
                className="p-2 rounded-xl bg-elevated hover:bg-accent/20 text-accent-text transition-colors"
                title={t('app.newBlankHero')}
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>

            {/* Middle Nav Icons */}
            <div className="space-y-2 flex flex-col items-center">
              <button
                onClick={() => { setActiveTab('levels'); setIsMobileMenuOpen(false); }}
                className={`p-2.5 rounded-xl transition-all ${
                  activeTab === 'levels'
                    ? 'bg-accent text-black shadow-md'
                    : 'text-text-secondary hover:text-white hover:bg-elevated'
                }`}
                title={t('app.viewSheetLevels')}
              >
                <FileText className="w-5 h-5" />
              </button>

              <button
                onClick={() => { setActiveTab('spellbooks'); setIsMobileMenuOpen(false); }}
                className={`p-2.5 rounded-xl transition-all ${
                  activeTab === 'spellbooks'
                    ? 'bg-accent text-black shadow-md'
                    : 'text-text-secondary hover:text-white hover:bg-elevated'
                }`}
                title={t('nav.spellbooks')}
              >
                <Library className="w-5 h-5" />
              </button>

              <div className="w-6 h-[1px] bg-control my-1" />

              <button
                onClick={() => { setActiveTab('catalog'); setIsMobileMenuOpen(false); }}
                className={`p-2.5 rounded-xl transition-all ${
                  activeTab === 'catalog'
                    ? 'bg-accent text-black shadow-md'
                    : 'text-text-secondary hover:text-white hover:bg-elevated'
                }`}
                title={t('nav.spells')}
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={() => { setActiveTab('feats'); setIsMobileMenuOpen(false); }}
                className={`p-2.5 rounded-xl transition-all ${
                  activeTab === 'feats'
                    ? 'bg-accent text-black shadow-md'
                    : 'text-text-secondary hover:text-white hover:bg-elevated'
                }`}
                title={t('nav.feats')}
              >
                <Award className="w-5 h-5" />
              </button>
              <button onClick={() => { setActiveTab('items'); setIsMobileMenuOpen(false); }} className={`p-2.5 rounded-xl transition-all ${activeTab === 'items' ? 'bg-accent text-black shadow-md' : 'text-text-secondary hover:text-white hover:bg-elevated'}`} title={t('nav.items')} aria-label={t('nav.items')}>
                <Package className="w-5 h-5" />
              </button>
            </div>

            {/* Bottom: Settings & Database Dot */}
            <div className="flex flex-col items-center space-y-1">
              <button type="button" onClick={() => setShowSettings(true)} className="p-2 rounded-xl text-text-secondary hover:text-white hover:bg-elevated" title={t('settings.title')} aria-label={t('settings.open')}>
                <Settings className="w-5 h-5" />
              </button>
              <div className="p-2 text-status-success-border" title={t('app.dbConnected')}>
                <Database className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          /* ================= EXPANDED FULL SIDEBAR ================= */
          <div className="flex flex-col h-full min-w-0">
            {/* App Branding Top & Collapse Button */}
            <div className="p-3.5 border-b border-border-strong flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-control border border-accent/40 flex items-center justify-center shadow text-accent-text flex-shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5 truncate">
                    PF2e Manager <span className="text-accent-text font-light">| {t('app.remaster')}</span>
                  </h1>
                  <p className="text-[11px] text-text-muted truncate">{t('app.subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-elevated transition-colors"
                  title={t('settings.title')}
                  aria-label={t('settings.open')}
                >
                  <Settings className="w-4 h-4" />
                </button>
                {/* Collapse Sidebar Button */}
                <button
                  onClick={toggleSidebarCollapse}
                  className="hidden md:flex p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-elevated transition-colors"
                  title={t('app.collapseSidebar')}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="md:hidden p-1.5 text-text-secondary hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CHARACTER SELECTION / CREATION CARD (NO TOPO DAS ABAS) */}
            <div ref={charPopoverRef} className="relative mx-2.5 mt-3">
              <div className="p-3 bg-elevated border border-border-strong rounded-2xl shadow-md space-y-2.5">
                {/* Header: Label and Action Buttons (Visualizar Ficha, Imprimir, Novo) */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-text-secondary tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-accent-text" />
                    <span>{t('app.activeCharacter')}</span>
                  </span>

                  <div className="flex items-center space-x-1">
                    {/* Botão Visualizar Ficha */}
                    <button
                      onClick={() => {
                        setActiveTab('levels');
                        setIsMobileMenuOpen(false);
                        setIsCharPopoverOpen(false);
                      }}
                      className={`p-1.5 rounded-lg border transition-all shadow-sm ${
                        activeTab === 'levels'
                          ? 'bg-accent text-black border-accent'
                          : 'bg-control hover:bg-control text-text-secondary hover:text-white border-border-strong'
                      }`}
                      title={t('app.viewSheet')}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    {/* Botão Novo Herói */}
                    <button
                      onClick={() => {
                        setActiveTab('creator');
                        setIsMobileMenuOpen(false);
                        setIsCharPopoverOpen(false);
                      }}
                      className="p-1.5 rounded-lg bg-control hover:bg-accent/20 text-text-secondary hover:text-accent-text border border-border-strong hover:border-accent/40 transition-all shadow-sm"
                      title={t('app.newBlankHeroWizard')}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Unified Clickable Character Card Trigger */}
                {activeCharacter ? (() => {
                  const activePortrait = resolvePortraitSrc(getCharacterPortrait(activeCharacter));
                  return (
                  <div
                    {...clickableProps(() => setIsCharPopoverOpen(!isCharPopoverOpen))}
                    aria-expanded={isCharPopoverOpen}
                    className="p-2.5 bg-surface hover:bg-elevated border border-border-strong hover:border-accent/60 rounded-xl cursor-pointer transition-all shadow-inner group"
                    title={t('app.switchCharacter')}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      {activePortrait ? (
                        <img
                          src={activePortrait}
                          alt={activeCharacter.name}
                          className="w-10 h-10 rounded-xl object-cover border border-border-strong flex-shrink-0 bg-inset"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-inset border border-border-strong flex items-center justify-center flex-shrink-0 text-text-muted">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {/* Primary Anchor: Character NAME (Hierarquia Máxima) */}
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h2 className="text-sm font-black text-white group-hover:text-accent-text transition-colors truncate tracking-tight">
                            {activeCharacter.name}
                          </h2>
                          <ChevronDown className={`w-4 h-4 text-text-secondary group-hover:text-accent-text transition-transform duration-200 flex-shrink-0 ${isCharPopoverOpen ? 'rotate-180 text-accent-text' : ''}`} />
                        </div>

                        {/* Secondary: Metadata (Level, Ancestry, Class/Multiclass/Archetype) */}
                        <div className="flex items-center space-x-2 text-[11px] text-text-secondary truncate">
                          <span className="px-1.5 py-0.5 rounded font-black bg-elevated text-accent-text border border-border-strong flex-shrink-0">
                            {t('common.levelShort', { level: activeCharacter.level })}
                          </span>
                          <span className="truncate">
                            {activeCharacter.ancestry || t('common.ancestry')} • {activeCharacter.class || t('app.classArchetype')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Combat Mini-Status: PV & CA */}
                    <div className="pt-2 border-t border-border-subtle">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center space-x-1 font-bold text-status-success">
                          <Heart className="w-3 h-3 text-status-danger fill-red-400/20" />
                          <span>{activeCharStats.hp}/{activeCharStats.maxHp} {t('common.hp')}</span>
                        </div>
                        <div className="flex items-center space-x-1 font-bold text-status-info bg-elevated px-1.5 py-0.5 rounded border border-border-strong">
                          <Shield className="w-3 h-3 text-status-info" />
                          <span>{t('common.ac')} {activeCharStats.ac}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })() : (
                  <div
                    onClick={() => setIsCharPopoverOpen(!isCharPopoverOpen)}
                    className="p-3 bg-surface hover:bg-elevated border border-dashed border-border-strong rounded-xl text-center cursor-pointer transition-colors"
                  >
                    <p className="text-xs text-text-secondary">{t('app.noActiveHero')}</p>
                    <span className="text-[11px] text-accent-text font-semibold mt-0.5 block">
                      {t('app.clickToSelect')}
                    </span>
                  </div>
                )}
              </div>

              {/* UNIFIED INTERACTIVE POPOVER SELECTOR */}
              {isCharPopoverOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-surface border border-text-muted rounded-2xl shadow-2xl p-2.5 space-y-2 animate-fadeIn">
                  {/* Search input in popover */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      type="text"
                      value={charSearchQuery}
                      onChange={(e) => setCharSearchQuery(e.target.value)}
                      placeholder={t('app.filterHeroes')}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-inset border border-border-strong rounded-lg text-xs text-white placeholder-text-muted focus:border-accent focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Character list */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {filteredSavedCharacters.length === 0 ? (
                      <p className="text-xs text-text-secondary text-center py-3">
                        {t('app.noHeroFound')}
                      </p>
                    ) : (
                      filteredSavedCharacters.map((c) => {
                        const isCurrent = c.id === activeCharacter?.id;
                        const charPortrait = resolvePortraitSrc(getCharacterPortrait(c));
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              if (c.id === activeCharId) { setIsCharPopoverOpen(false); return; }
                              requestTransition(() => { setActiveCharId(c.id); setIsCharPopoverOpen(false); });
                            }}
                            className={`p-2 rounded-xl cursor-pointer transition-all flex items-center justify-between border group/item ${
                              isCurrent
                                ? 'bg-elevated border-accent text-white shadow-sm'
                                : 'bg-canvas hover:bg-elevated border-border-strong text-text-primary'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2 flex items-center gap-2">
                              {charPortrait ? (
                                <img
                                  src={charPortrait}
                                  alt={c.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-border-strong flex-shrink-0 bg-inset"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-inset border border-border-strong flex items-center justify-center flex-shrink-0 text-text-muted">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                {/* Character Name in Popover (Prominent) */}
                                <div className="flex items-center space-x-2">
                                  <span className="font-black text-xs truncate text-white block">
                                    {c.name}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent text-black font-black uppercase">
                                      {t('app.activeTag')}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-text-muted truncate block mt-0.5">
                                  {t('common.levelShort', { level: c.level })} • {c.ancestry || t('common.ancestry')} • {c.class || t('common.class')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5 flex-shrink-0">
                              {isCurrent && (
                                <Check className="w-4 h-4 text-accent-text" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteChar(c);
                                }}
                                className="p-1 rounded text-text-muted hover:text-status-danger opacity-0 group-hover/item:opacity-100 transition-opacity"
                                title={t('app.deleteCharacter', { name: c.name })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCharPopoverOpen(false);
                        setIsMobileMenuOpen(false);
                        setActiveTab('creator');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-bold shadow"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{t('app.newBlankHero')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* VERTICAL NAVIGATION TABS */}
            <nav className="flex-1 px-2.5 py-3 space-y-3.5 overflow-y-auto min-w-0">
              {/* Section: Ficha e Evolução */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-2.5 block mb-1">
                  {t('app.section.sheet')}
                </span>

                <button
                  onClick={() => {
                    setActiveTab('levels');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'levels'
                      ? 'bg-accent text-black shadow-md'
                      : 'text-text-secondary hover:text-white hover:bg-elevated'
                  }`}
                  title={t('app.viewSheetManage')}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="block truncate">{t('nav.sheet')}</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('spellbooks');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'spellbooks'
                      ? 'bg-accent text-black shadow-md'
                      : 'text-text-secondary hover:text-white hover:bg-elevated'
                  }`}
                >
                  <Library className="w-4 h-4 flex-shrink-0" />
                  <span className="block truncate">{t('nav.spellbooks')}</span>
                </button>
              </div>

              {/* Section: Compêndios Remaster */}
              <div className="space-y-1 pt-2 border-t border-border-subtle">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-2.5 block mb-1">
                  {t('app.section.compendia')}
                </span>

                <button
                  onClick={() => {
                    setActiveTab('catalog');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'catalog'
                      ? 'bg-accent text-black shadow-md'
                      : 'text-text-secondary hover:text-white hover:bg-elevated'
                  }`}
                >
                  <Search className="w-4 h-4 flex-shrink-0" />
                  <span className="block truncate">{t('nav.spells')}</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('feats');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'feats'
                      ? 'bg-accent text-black shadow-md'
                      : 'text-text-secondary hover:text-white hover:bg-elevated'
                  }`}
                >
                  <Award className="w-4 h-4 flex-shrink-0" />
                  <span className="block truncate">{t('nav.feats')}</span>
                </button>
                <button onClick={() => { setActiveTab('items'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'items' ? 'bg-accent text-black shadow-md' : 'text-text-secondary hover:text-white hover:bg-elevated'}`}>
                  <Package className="w-4 h-4 flex-shrink-0" />
                  <span className="block truncate">{t('nav.items')}</span>
                </button>
              </div>
            </nav>

            {/* Database Footer Status */}
            <div className="p-3 border-t border-border-strong bg-canvas space-y-1">
              <div className="flex items-center space-x-2 text-[11px] text-text-secondary">
                <Database className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
                <span className="font-semibold text-white">pf2e.db</span>
              </div>
              {portraitDb === 'portraitdb' && (
                <div className="flex items-center space-x-2 text-[11px] text-text-secondary">
                  <ImageIcon className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
                  <span className="font-semibold text-white">portraitdb</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DRAG-TO-RESIZE HANDLE ON RIGHT EDGE (Desativado quando recolhido) */}
        {!isSidebarCollapsed && (
          <div
            onMouseDown={startResizing}
            className="hidden md:block absolute top-0 right-0 bottom-0 w-1.5 hover:w-2 hover:bg-accent/70 cursor-col-resize transition-all z-20 group"
            title={t('app.resizeSidebar')}
          >
            <div className="w-full h-full group-hover:bg-accent/50" />
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA (Painel da Direita) */}
      <main
        ref={mainRef}
        onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 300)}
        className="flex-1 h-full overflow-y-auto bg-canvas flex flex-col print:h-auto print:overflow-visible print:bg-white print:text-black"
      >
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
          {activeTab === 'creator' ? (
            /* ABC CHARACTER CREATION WIZARD */
            <CharacterCreatorView
              onGuardChange={onGuardChange}
              onNavigateToLevels={() => setActiveTab('levels')}
              onCharacterSaved={(savedId) => {
                setActiveCharId(savedId);
                refreshCharacters();
              }}
            />
          ) : activeTab === 'levels' ? (
            /* LEVEL PROGRESSION & ADVANCEMENT (1-20) */
            <LevelProgressionView
              activeCharId={activeCharId}
              theme={theme}
              onThemeChange={setTheme}
              hpMode={hpMode}
              onGuardChange={onGuardChange}
              onNavigateToCreator={() => setActiveTab('creator')}
              onCharacterSelected={(char) => setActiveCharId(char.id)}
              onCharactersChanged={refreshCharacters}
              onDeleteCharacter={(char) => setConfirmDeleteChar(char)}
            />
          ) : activeTab === 'feats' ? (
            /* FEATS EXPLORER VIEW (7,213 FEATS) */
            <FeatExplorerView />
          ) : activeTab === 'items' ? (
            <EquipmentExplorerView
              activeCharacterName={activeCharacter?.name}
              onAddToInventory={activeCharacter ? handleAddEquipmentToActiveChar : undefined}
            />
          ) : activeTab === 'spellbooks' ? (
            /* SPELLBOOK BUILDER VIEW (66% / 33% SPLIT) */
            <SpellbookBuilderView
              metadata={metadata}
              onSelectSpellForDetail={setSelectedSpell}
              onGuardChange={onGuardChange}
            />
          ) : (
            /* SPELL CATALOG SEARCH VIEW */
            <>
              <SpellFiltersBar
                filters={filters}
                onChange={handleFilterChange}
                onReset={handleResetFilters}
                metadata={metadata}
                totalMatches={total}
                favoritesCount={favorites.size}
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
              />
              {locale === 'pt-BR' && (
                <p className="text-xs text-text-muted px-1">{t('compendium.englishNotice')}</p>
              )}

              {loading && spells.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                  <Loader2 className="w-8 h-8 text-accent-text animate-spin" />
                  <p className="text-sm text-text-secondary">{t('app.queryingDb')}</p>
                </div>
              ) : spells.length === 0 ? (
                <div className="bg-surface border border-border-strong rounded-xl p-12 text-center space-y-3">
                  <Sparkles className="w-10 h-10 text-text-secondary mx-auto opacity-50" />
                  <h3 className="text-lg font-bold text-white">
                    {filters.onlyFavorites ? t('app.noFavoriteSpells') : t('app.noSpellsFound')}
                  </h3>
                  <p className="text-sm text-text-secondary max-w-md mx-auto">
                    {filters.onlyFavorites ? t('app.noFavoriteSpellsHint') : t('app.noSpellsFoundHint')}
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-2 px-4 py-2 bg-control hover:bg-control-hover text-sm text-accent-text font-semibold rounded-lg border border-border-strong transition-colors"
                  >
                    {t('common.resetFilters')}
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {spells.map((spell) => (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      isFavorite={favorites.has(spell.id)}
                      onToggleFavorite={() => toggleFavorite(spell.id)}
                      onClick={() => setSelectedSpell(spell)}
                      onSelectTrait={handleSelectTrait}
                      characterLevel={activeCharacter?.level}
                    />
                  ))}
                </div>
              ) : (
                <SpellTableView
                  spells={spells}
                  favoritesSet={favorites}
                  onToggleFavorite={(id) => toggleFavorite(id)}
                  onSelectSpell={(spell) => setSelectedSpell(spell)}
                  onSelectTrait={handleSelectTrait}
                />
              )}

              {spells.length < total && (
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
                      <span>{t('app.loadMoreSpells', { shown: spells.length, total })}</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-elevated border border-border-strong text-accent-text hover:text-white hover:bg-control shadow-xl transition-all z-20 print:hidden"
          title={t('app.backToTop')}
          aria-label={t('app.backToTop')}
        >
          <ArrowUpCircle className="w-6 h-6" />
        </button>
      )}

      {pendingAction && <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
        <div className="w-full max-w-md bg-surface border border-border-strong rounded-xl p-5 space-y-4 shadow-2xl">
          <h2 id="unsaved-title" className="text-lg font-bold text-white">{t('app.unsavedTitle')}</h2>
          <p className="text-sm text-text-primary">{t('app.unsavedBody')}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={guardSaving} onClick={() => setPendingAction(null)} className="px-3 py-2 rounded-lg bg-control text-sm">{t('common.cancel')}</button>
            <button type="button" disabled={guardSaving} onClick={() => { const action = pendingAction; sheetGuard.current = null; setPendingAction(null); action(); }} className="px-3 py-2 rounded-lg bg-status-danger-bg text-sm text-status-danger">{t('app.dontSave')}</button>
            <button type="button" disabled={guardSaving} onClick={async () => { const guard = sheetGuard.current; if (!guard) return; setGuardSaving(true); const saved = await guard.save(); setGuardSaving(false); if (saved) { const action = pendingAction; sheetGuard.current = null; setPendingAction(null); action(); } }} className="px-3 py-2 rounded-lg bg-accent text-black font-bold text-sm">{guardSaving ? t('common.saving') : t('common.save')}</button>
          </div>
        </div>
      </div>}

      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      {showSettings && <SettingsModal theme={theme} onThemeChange={setTheme} portraitDb={portraitDb} onPortraitDbChange={setPortraitDb} hpMode={hpMode} onHpModeChange={setHpMode} onClose={() => setShowSettings(false)} />}

      {confirmDeleteChar && (
        <ConfirmDialog
          title={t('app.deleteCharacter', { name: confirmDeleteChar.name })}
          message={t('app.confirmDeleteCharacter', { name: confirmDeleteChar.name })}
          confirmLabel={t('common.remove')}
          variant="danger"
          onCancel={() => setConfirmDeleteChar(null)}
          onConfirm={() => {
            const target = confirmDeleteChar;
            setConfirmDeleteChar(null);
            if (target.id === activeCharId) requestTransition(() => { void handleDeleteCharacter(target.id); });
            else void handleDeleteCharacter(target.id);
          }}
        />
      )}

      {/* Spell Detail Modal with Icon Picker */}
      {selectedSpell && (
        <SpellDetailModal
          spell={selectedSpell}
          isFavorite={favorites.has(selectedSpell.id)}
          onToggleFavorite={() => toggleFavorite(selectedSpell.id)}
          onUpdateSpellIcon={handleUpdateSpellIcon}
          onClose={() => setSelectedSpell(null)}
          onSelectTrait={handleSelectTrait}
          characterLevel={activeCharacter?.level}
        />
      )}
    </div>
  );
};
