import React, { useEffect, useRef, useState } from 'react';
import { CreatureItem } from '../types/pf2e';
import { fetchCreatures } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';
import { cleanDescriptionHtml, cleanSnippetText, resolvePf2eIcon } from '../utils/formatters';
import { useModalFocus, clickableProps } from '../utils/useModalFocus';
import {
  Eye,
  Footprints,
  Heart,
  Loader2,
  PawPrint,
  RotateCcw,
  Search,
  Shield,
  X,
} from 'lucide-react';

const SIZES = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'] as const;
const LEVELS = Array.from({ length: 23 }, (_, i) => i - 1);
const RARITIES = ['common', 'uncommon', 'rare', 'unique'] as const;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const controlClass = 'bg-inset border border-border-strong rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none';

function parseTraits(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Explorer for the PF2e creatures/animals table with filtering and detail view. */
export const CreatureCompendiumView: React.FC = () => {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState('all');
  const [level, setLevel] = useState('all');
  const [size, setSize] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [offset, setOffset] = useState(0);
  const [creatures, setCreatures] = useState<CreatureItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<CreatureItem | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);
  useModalFocus(detailRef, () => setSelected(null), Boolean(selected));

  useEffect(() => {
    let active = true;
    const isAppend = offset > 0;
    if (isAppend) setLoadingMore(true);
    else setLoading(true);

    const timer = window.setTimeout(() => {
      fetchCreatures({ search, letter, level, size, rarity, limit: 48, offset })
        .then((data) => {
          if (!active) return;
          if (isAppend) {
            setCreatures((prev) => {
              const seen = new Set(prev.map((c) => c.id));
              return [...prev, ...data.creatures.filter((c) => !seen.has(c.id))];
            });
          } else {
            setCreatures(data.creatures);
          }
          setTotal(data.total);
          setErrorMsg(null);
        })
        .catch((err) => {
          if (active && !isAppend) {
            setCreatures([]);
            setTotal(0);
            setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar criaturas');
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setLoadingMore(false);
          }
        });
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, letter, level, size, rarity, offset]);

  const handleReset = () => {
    setSearch('');
    setLetter('all');
    setLevel('all');
    setSize('all');
    setRarity('all');
    setOffset(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border-strong rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-elevated border border-accent/40 flex items-center justify-center text-accent-text flex-shrink-0">
            <PawPrint className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">{t('creatures.title')}</h2>
            <p className="text-xs text-text-secondary">{t('creatures.subtitle', { total })}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border-strong rounded-2xl p-4 shadow-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder={t('creatures.searchPlaceholder')}
            className={`${controlClass} w-full pl-9`}
          />
        </div>
        <div className="lg:col-span-2">
          <select value={level} onChange={(e) => { setLevel(e.target.value); setOffset(0); }} className={`${controlClass} w-full`}>
            <option value="all">{t('creatures.allLevels')}</option>
            {LEVELS.map((lvl) => (
              <option key={lvl} value={String(lvl)}>{t('common.level', { level: lvl })}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <select value={size} onChange={(e) => { setSize(e.target.value); setOffset(0); }} className={`${controlClass} w-full`}>
            <option value="all">{t('creatures.allSizes')}</option>
            {SIZES.map((sz) => (
              <option key={sz} value={sz}>{sz.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <select value={rarity} onChange={(e) => { setRarity(e.target.value); setOffset(0); }} className={`${controlClass} w-full`}>
            <option value="all">{t('common.all')}</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>{rarityLabel(t, r)}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-1 flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            title={t('common.resetFilters')}
            aria-label={t('common.resetFilters')}
            className="p-2.5 rounded-lg bg-elevated hover:bg-control border border-border-strong text-text-secondary hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <div className="col-span-full flex flex-wrap items-center gap-1 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => { setLetter('all'); setOffset(0); }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${
              letter === 'all'
                ? 'bg-accent text-black border-accent'
                : 'bg-inset text-text-secondary border-border-subtle hover:text-white hover:border-border-strong'
            }`}
          >
            {t('common.all')}
          </button>
          {LETTERS.map((ltr) => {
            const active = letter === ltr;
            return (
              <button
                key={ltr}
                type="button"
                onClick={() => { setLetter(active ? 'all' : ltr); setOffset(0); }}
                className={`min-w-[28px] px-2 py-1 rounded-md text-xs font-bold border transition-colors ${
                  active
                    ? 'bg-accent text-black border-accent'
                    : 'bg-inset text-text-secondary border-border-subtle hover:text-white hover:border-border-strong'
                }`}
              >
                {ltr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-secondary gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-accent-text" />
          <span>{t('common.loading')}</span>
        </div>
      ) : errorMsg ? (
        <div className="bg-status-danger-bg border border-status-danger-border rounded-2xl p-6 text-center text-sm text-status-danger">
          {errorMsg}
        </div>
      ) : creatures.length === 0 ? (
        <div className="bg-surface border border-border-strong rounded-2xl p-10 text-center text-sm text-text-secondary">
          {t('creatures.empty')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {creatures.map((creature) => (
              <div
                key={creature.id}
                {...clickableProps(() => setSelected(creature))}
                className="h-[430px] bg-surface hover:bg-elevated border border-border-strong hover:border-accent/60 rounded-2xl p-4 cursor-pointer transition-all shadow-md flex flex-col gap-2.5 group overflow-hidden"
              >
                {/* Row 1: Name + Challenge Rate (Level) */}
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <h3 className="font-bold text-white text-base truncate group-hover:text-accent-text transition-colors">
                    {creature.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-elevated border border-border-strong text-accent-text text-xs font-black flex-shrink-0">
                    {t('common.levelShort', { level: creature.level })}
                  </span>
                </div>

                {/* Row 2: Creature image (33% height, 95% width) */}
                <div className="w-[95%] h-[33%] mx-auto shrink-0 rounded-xl bg-inset border border-border-strong p-1.5 flex items-center justify-center overflow-hidden">
                  <img
                    src={resolvePf2eIcon(creature.img, '/assets/icons/default-icons/mystery-man.svg')}
                    alt={creature.name}
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/assets/icons/default-icons/mystery-man.svg'; }}
                  />
                </div>

                {/* Row 3: Stats */}
                <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] shrink-0">
                  <div className="bg-inset rounded-lg py-1.5 px-1 border border-border-subtle">
                    <span className="text-text-muted block">{t('common.hp')}</span>
                    <span className="font-black text-white">{creature.hp}</span>
                  </div>
                  <div className="bg-inset rounded-lg py-1.5 px-1 border border-border-subtle">
                    <span className="text-text-muted block">{t('common.ac')}</span>
                    <span className="font-black text-white">{creature.ac}</span>
                  </div>
                  <div className="bg-inset rounded-lg py-1.5 px-1 border border-border-subtle">
                    <span className="text-text-muted block">{t('sheet.perception')}</span>
                    <span className="font-black text-white">+{creature.perception}</span>
                  </div>
                  <div className="bg-inset rounded-lg py-1.5 px-1 border border-border-subtle">
                    <span className="text-text-muted block">{t('creator.speed')}</span>
                    <span className="font-black text-white">{creature.speed}ft</span>
                  </div>
                </div>

                {/* Row 4: Description */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {creature.description && (
                    <p className="text-xs text-text-secondary line-clamp-5 leading-relaxed">
                      {cleanSnippetText(creature.description)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {creatures.length < total && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => setOffset(creatures.length)}
                className="px-6 py-2.5 rounded-xl bg-surface hover:bg-elevated border border-border-strong hover:border-accent text-sm font-semibold text-white transition-all disabled:opacity-50"
              >
                {loadingMore ? t('common.loading') : t('creatures.loadMore')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            ref={detailRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="creature-detail-title"
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-strong">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={resolvePf2eIcon(selected.img, '/assets/icons/default-icons/mystery-man.svg')}
                  alt={selected.name}
                  className="w-14 h-14 rounded-xl object-contain bg-inset border border-border-strong p-1 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/assets/icons/default-icons/mystery-man.svg'; }}
                />
                <div className="min-w-0">
                  <h3 id="creature-detail-title" className="text-xl font-black text-white truncate">
                    {selected.name}
                  </h3>
                  <p className="text-xs text-accent-text font-bold">
                    {t('common.level', { level: selected.level })} • {(selected.size || 'med').toUpperCase()}{selected.rarity ? ` • ${rarityLabel(t, selected.rarity)}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t('common.close')}
                className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-control"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {parseTraits(selected.traits).map((tr) => (
                <span key={tr} className="pf-trait">{tr}</span>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-inset border border-border-subtle rounded-xl p-2.5 flex items-center gap-2">
                <Heart className="w-4 h-4 text-status-danger flex-shrink-0" />
                <div><span className="text-text-muted block">{t('common.hp')}</span><strong className="text-white">{selected.hp}</strong></div>
              </div>
              <div className="bg-inset border border-border-subtle rounded-xl p-2.5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-status-info flex-shrink-0" />
                <div><span className="text-text-muted block">{t('common.ac')}</span><strong className="text-white">{selected.ac}</strong></div>
              </div>
              <div className="bg-inset border border-border-subtle rounded-xl p-2.5 flex items-center gap-2">
                <Eye className="w-4 h-4 text-status-purple flex-shrink-0" />
                <div><span className="text-text-muted block">{t('sheet.perception')}</span><strong className="text-white">+{selected.perception}</strong></div>
              </div>
              <div className="bg-inset border border-border-subtle rounded-xl p-2.5 flex items-center gap-2">
                <Footprints className="w-4 h-4 text-status-warn flex-shrink-0" />
                <div><span className="text-text-muted block">{t('creator.speed')}</span><strong className="text-white">{selected.speed} ft</strong></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
              <div className="bg-inset border border-border-subtle rounded-xl p-2">
                <span className="text-text-muted block">{t('sheet.fortitude')}</span>
                <strong className="text-white">+{selected.fortitude}</strong>
              </div>
              <div className="bg-inset border border-border-subtle rounded-xl p-2">
                <span className="text-text-muted block">{t('sheet.reflex')}</span>
                <strong className="text-white">+{selected.reflex}</strong>
              </div>
              <div className="bg-inset border border-border-subtle rounded-xl p-2">
                <span className="text-text-muted block">{t('sheet.will')}</span>
                <strong className="text-white">+{selected.will}</strong>
              </div>
            </div>

            {selected.senses && (
              <div className="text-xs text-text-secondary bg-inset border border-border-subtle rounded-xl px-3 py-2">
                <strong className="text-white">{t('sheet.vision')}: </strong>{parseTraits(selected.senses).join(', ') || selected.senses}
              </div>
            )}

            {selected.description && (
              <div
                className="pf-prose text-sm text-text-primary bg-canvas border border-border-strong rounded-xl p-4"
                dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(selected.description) }}
              />
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border-strong">
              <span className="text-[11px] text-text-muted">{selected.source || ''}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
