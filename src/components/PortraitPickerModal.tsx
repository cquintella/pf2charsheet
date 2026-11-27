import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Crop, Database, Image as ImageIcon, RotateCcw, Search, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';
import {
  cropPortraitToSquare,
  type CustomPortraitEntry,
  getLocalCustomPortraits,
  getPortraitCropMetrics,
  getSelectedPortraitDb,
  PORTRAIT_SEXES,
  PortraitGallery,
  type PortraitSex,
  readFileAsDataUrl,
  resolvePortraitSrc,
  saveLocalCustomPortrait,
} from '../utils/portrait';
import { addCustomPortrait, fetchPortraitPlugin } from '../services/api';
import { IconButton } from './IconButton';

interface PortraitPickerModalProps {
  currentPortrait?: string;
  characterAncestry?: string;
  onSelect: (portrait: string | undefined) => void;
  onClose: () => void;
}

const PAGE_SIZE = 60;
const CROP_VIEWPORT_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const NEW_OPTION_VALUE = '__new__';

export const PortraitPickerModal: React.FC<PortraitPickerModalProps> = ({
  currentPortrait,
  characterAncestry = '',
  onSelect,
  onClose,
}) => {
  const { t } = useI18n();
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  useModalFocus(modalRef, onClose);

  const portraitDb = getSelectedPortraitDb();
  const [pluginPortraits, setPluginPortraits] = useState<CustomPortraitEntry[]>(() =>
    portraitDb === 'portraitdb' ? getLocalCustomPortraits() : []
  );

  useEffect(() => {
    if (portraitDb !== 'portraitdb') return;
    let active = true;
    fetchPortraitPlugin()
      .then((plugin) => {
        if (!active) return;
        const localItems = getLocalCustomPortraits();
        const mergedMap = new Map<string, CustomPortraitEntry>();
        for (const item of [...plugin.portraits, ...localItems]) {
          mergedMap.set(item.path, item);
        }
        setPluginPortraits(Array.from(mergedMap.values()));
      })
      .catch(() => { /* fallback to local custom portraits */ });
    return () => { active = false; };
  }, [portraitDb]);

  const gallery = useMemo(
    () => new PortraitGallery(portraitDb === 'portraitdb' ? pluginPortraits : []),
    [portraitDb, pluginPortraits]
  );
  const availableSexes = useMemo(() => {
    const set = new Set<string>(PORTRAIT_SEXES);
    for (const item of pluginPortraits) {
      if (item.sex) set.add(item.sex);
    }
    return Array.from(set);
  }, [pluginPortraits]);

  const [species, setSpecies] = useState<string>(() => gallery.defaultSpeciesFor(characterAncestry));
  const [sex, setSex] = useState<string>('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isNewUpload, setIsNewUpload] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);

  const [pendingDbPortrait, setPendingDbPortrait] = useState<string | null>(null);
  const [saveSpecies, setSaveSpecies] = useState<string>('');
  const [customSpeciesInput, setCustomSpeciesInput] = useState('');
  const [saveSex, setSaveSex] = useState<string>(PORTRAIT_SEXES[0]);
  const [customSexInput, setCustomSexInput] = useState('');
  const [savingToDb, setSavingToDb] = useState(false);

  const filtered = useMemo(
    () => gallery.matching({ species, sex: sex as PortraitSex | '', search }),
    [gallery, species, sex, search]
  );
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const openCropper = (src: string, fromUpload = false) => {
    setUploadError(null);
    setPendingDbPortrait(null);
    setIsNewUpload(fromUpload);
    setNaturalSize(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCropSrc(src);
  };

  const cropMetrics = useMemo(() => {
    if (!naturalSize) return null;
    return getPortraitCropMetrics(
      naturalSize.w,
      naturalSize.h,
      CROP_VIEWPORT_SIZE,
      zoom,
      pan.x,
      pan.y
    );
  }, [naturalSize, zoom, pan]);

  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    setZoom(clampedZoom);
    if (naturalSize) {
      const m = getPortraitCropMetrics(
        naturalSize.w,
        naturalSize.h,
        CROP_VIEWPORT_SIZE,
        clampedZoom,
        pan.x,
        pan.y
      );
      setPan({ x: m.panX, y: m.panY });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropMetrics) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: cropMetrics.panX,
      originY: cropMetrics.panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !naturalSize) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const m = getPortraitCropMetrics(
      naturalSize.w,
      naturalSize.h,
      CROP_VIEWPORT_SIZE,
      zoom,
      drag.originX + dx,
      drag.originY + dy
    );
    setPan({ x: m.panX, y: m.panY });
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      openCropper(dataUrl, true);
    } catch {
      setUploadError(t('portrait.uploadError'));
    }
  };

  const handleApplyCrop = async () => {
    if (!cropSrc || applying) return;
    setApplying(true);
    setUploadError(null);
    try {
      const cropped = await cropPortraitToSquare(
        cropSrc,
        CROP_VIEWPORT_SIZE,
        zoom,
        cropMetrics?.panX ?? pan.x,
        cropMetrics?.panY ?? pan.y
      );
      onSelect(cropped);
      if (portraitDb === 'portraitdb' && isNewUpload) {
        const defaultSp = gallery.defaultSpeciesFor(characterAncestry) || gallery.species[0] || NEW_OPTION_VALUE;
        setSaveSpecies(defaultSp);
        setCustomSpeciesInput('');
        setSaveSex(availableSexes[0] || NEW_OPTION_VALUE);
        setCustomSexInput('');
        setCropSrc(null);
        setPendingDbPortrait(cropped);
      } else {
        onClose();
      }
    } catch {
      setUploadError(t('portrait.uploadError'));
    } finally {
      setApplying(false);
    }
  };

  const handleAddToPortraitDb = async () => {
    if (!pendingDbPortrait || savingToDb) return;
    const finalSpecies = (saveSpecies === NEW_OPTION_VALUE ? customSpeciesInput : saveSpecies).trim();
    const finalSex = (saveSex === NEW_OPTION_VALUE ? customSexInput : saveSex).trim();
    if (!finalSpecies || !finalSex) return;

    setSavingToDb(true);
    setUploadError(null);
    try {
      let savedEntry: CustomPortraitEntry;
      try {
        const res = await addCustomPortrait({ dataUrl: pendingDbPortrait, species: finalSpecies, sex: finalSex });
        savedEntry = res.item;
      } catch {
        savedEntry = { path: pendingDbPortrait, species: finalSpecies, sex: finalSex, className: '' };
      }
      saveLocalCustomPortrait(savedEntry);
      setPluginPortraits((prev) => [...prev.filter((item) => item.path !== savedEntry.path), savedEntry]);
      onClose();
    } catch {
      setUploadError(t('portrait.addToDbError'));
    } finally {
      setSavingToDb(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('portrait.title')}
        tabIndex={-1}
        className="bg-surface border border-border-strong rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden outline-none"
      >
        <div className="p-4 border-b border-border-subtle flex items-center justify-between gap-3 bg-inset">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-accent-text" />
            <h2 className="text-base font-bold text-text-primary">{t('portrait.title')}</h2>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('portrait.upload')}</span>
            </button>
            {currentPortrait && !cropSrc && (
              <button
                type="button"
                onClick={() => openCropper(resolvePortraitSrc(currentPortrait) ?? currentPortrait)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated hover:bg-control border border-border-strong text-xs font-semibold text-text-primary transition-colors"
                title={t('portrait.adjust')}
              >
                <Crop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('portrait.adjust')}</span>
              </button>
            )}
            {currentPortrait && (
              <IconButton
                icon={<Trash2 className="w-4 h-4" />}
                label={t('portrait.remove')}
                variant="danger"
                onClick={() => {
                  onSelect(undefined);
                  onClose();
                }}
              />
            )}
            <IconButton icon={<X className="w-4 h-4" />} label={t('common.close')} onClick={onClose} />
          </div>
        </div>

        {!cropSrc && !pendingDbPortrait && (
          <div className="p-3 border-b border-border-subtle bg-elevated flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder={t('portrait.searchPlaceholder')}
              className="w-full bg-inset border border-border-strong rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
            />
          </div>

          <select
            aria-label={t('portrait.allSpecies')}
            value={species}
            onChange={(e) => {
              setSpecies(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            className="bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
          >
            <option value="">{t('portrait.allSpecies')}</option>
            {gallery.species.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>

          <select
            aria-label={t('portrait.allSexes')}
            value={sex}
            onChange={(e) => {
              setSex(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            className="bg-inset border border-border-strong rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
          >
            <option value="">{t('portrait.allSexes')}</option>
            {availableSexes.map((s) => (
              <option key={s} value={s}>
                {PORTRAIT_SEXES.includes(s as PortraitSex)
                  ? t(`portrait.sex.${s}` as 'portrait.sex.Female' | 'portrait.sex.Male' | 'portrait.sex.Other')
                  : s}
              </option>
            ))}
          </select>

          <span className="text-xs text-text-muted font-medium ml-auto">
            {t('portrait.count', { shown: visible.length, total: filtered.length })}
          </span>
        </div>
        )}

        {uploadError && (
          <div className="px-4 py-2 bg-status-danger-bg border-b border-status-danger-border text-xs text-status-danger">
            {uploadError}
          </div>
        )}

        {pendingDbPortrait ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-5 bg-surface">
            <img
              src={pendingDbPortrait}
              alt={t('portrait.addToDbTitle')}
              className="w-32 h-32 rounded-2xl object-cover border-2 border-accent shadow-lg"
            />
            <div className="text-center space-y-1 max-w-md">
              <h3 className="text-base font-bold text-text-primary flex items-center justify-center gap-2">
                <Database className="w-4 h-4 text-accent-text" />
                <span>{t('portrait.addToDbTitle')}</span>
              </h3>
              <p className="text-xs text-text-secondary">{t('portrait.addToDbMessage')}</p>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <div className="space-y-1">
                <label htmlFor="portrait-db-species" className="block text-xs font-bold uppercase text-text-secondary">
                  {t('portrait.speciesLabel')}
                </label>
                <select
                  id="portrait-db-species"
                  value={saveSpecies}
                  onChange={(e) => setSaveSpecies(e.target.value)}
                  className="w-full bg-inset border border-border-strong rounded-lg px-3 py-2 text-xs text-text-primary"
                >
                  {gallery.species.map((sp) => (
                    <option key={sp} value={sp}>{sp}</option>
                  ))}
                  <option value={NEW_OPTION_VALUE}>{t('portrait.addNewOption')}</option>
                </select>
                {saveSpecies === NEW_OPTION_VALUE && (
                  <input
                    type="text"
                    value={customSpeciesInput}
                    onChange={(e) => setCustomSpeciesInput(e.target.value)}
                    placeholder={t('portrait.newSpeciesPlaceholder')}
                    className="w-full mt-1.5 bg-inset border border-border-strong rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted"
                    autoFocus
                  />
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="portrait-db-sex" className="block text-xs font-bold uppercase text-text-secondary">
                  {t('portrait.genderLabel')}
                </label>
                <select
                  id="portrait-db-sex"
                  value={saveSex}
                  onChange={(e) => setSaveSex(e.target.value)}
                  className="w-full bg-inset border border-border-strong rounded-lg px-3 py-2 text-xs text-text-primary"
                >
                  {availableSexes.map((s) => (
                    <option key={s} value={s}>
                      {PORTRAIT_SEXES.includes(s as PortraitSex)
                        ? t(`portrait.sex.${s}` as 'portrait.sex.Female' | 'portrait.sex.Male' | 'portrait.sex.Other')
                        : s}
                    </option>
                  ))}
                  <option value={NEW_OPTION_VALUE}>{t('portrait.addNewOption')}</option>
                </select>
                {saveSex === NEW_OPTION_VALUE && (
                  <input
                    type="text"
                    value={customSexInput}
                    onChange={(e) => setCustomSexInput(e.target.value)}
                    placeholder={t('portrait.newGenderPlaceholder')}
                    className="w-full mt-1.5 bg-inset border border-border-strong rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-elevated hover:bg-control border border-border-strong text-xs font-semibold text-text-primary transition-colors"
              >
                {t('portrait.skipAddToDb')}
              </button>
              <button
                type="button"
                disabled={
                  savingToDb ||
                  !(saveSpecies === NEW_OPTION_VALUE ? customSpeciesInput.trim() : saveSpecies.trim()) ||
                  !(saveSex === NEW_OPTION_VALUE ? customSexInput.trim() : saveSex.trim())
                }
                onClick={handleAddToPortraitDb}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-bold shadow-md disabled:opacity-50 transition-opacity"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('portrait.confirmAddToDb')}</span>
              </button>
            </div>
          </div>
        ) : cropSrc ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-5 bg-surface">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-text-primary">{t('portrait.adjust')}</h3>
              <p className="text-xs text-text-muted">{t('portrait.dragHint')}</p>
            </div>

            <div
              style={{ width: CROP_VIEWPORT_SIZE, height: CROP_VIEWPORT_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                handleZoomChange(zoom + delta);
              }}
              className="relative rounded-2xl overflow-hidden border-2 border-status-info bg-inset shadow-xl cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
            >
              <img
                src={cropSrc}
                alt={t('portrait.adjust')}
                draggable={false}
                crossOrigin="anonymous"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalSize({
                    w: img.naturalWidth || img.width,
                    h: img.naturalHeight || img.height,
                  });
                }}
                style={
                  cropMetrics
                    ? {
                        width: cropMetrics.dispW,
                        height: cropMetrics.dispH,
                        left: cropMetrics.imgLeft,
                        top: cropMetrics.imgTop,
                      }
                    : { width: '100%', height: '100%', objectFit: 'cover' }
                }
                className="absolute max-w-none max-h-none pointer-events-none select-none"
              />
              {/* Subtle circular & rule-of-thirds guide matching sheet portrait framing */}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25 rounded-2xl" />
              <div className="pointer-events-none absolute inset-2 rounded-full border border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]" />
            </div>

            <div className="w-full max-w-xs flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.15)}
                disabled={zoom <= MIN_ZOOM}
                aria-label={`${t('portrait.zoom')} -`}
                className="p-1.5 rounded-lg bg-elevated hover:bg-control border border-border-strong text-text-secondary disabled:opacity-40 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                aria-label={t('portrait.zoom')}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.02}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="flex-1 accent-status-info cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.15)}
                disabled={zoom >= MAX_ZOOM}
                aria-label={`${t('portrait.zoom')} +`}
                className="p-1.5 rounded-lg bg-elevated hover:bg-control border border-border-strong text-text-secondary disabled:opacity-40 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-text-muted w-11 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCropSrc(null);
                  setUploadError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-elevated hover:bg-control border border-border-strong text-xs font-semibold text-text-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('portrait.back')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-elevated hover:bg-control border border-border-strong text-xs font-semibold text-text-primary transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('portrait.reset')}</span>
              </button>
              <button
                type="button"
                disabled={applying || !naturalSize}
                onClick={handleApplyCrop}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-status-info hover:opacity-90 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-opacity"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('portrait.apply')}</span>
              </button>
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <div className="py-16 text-center text-sm text-text-muted">{t('portrait.noResults')}</div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {visible.map((item) => {
                  const selected = currentPortrait === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => openCropper(resolvePortraitSrc(item.path) ?? item.path)}
                      title={`${item.species} · ${item.sex}${item.className ? ` · ${item.className}` : ''}`}
                      className={`group relative aspect-square rounded-xl overflow-hidden border transition-all bg-inset text-left ${
                        selected
                          ? 'border-accent ring-2 ring-accent shadow-lg'
                          : 'border-border-strong hover:border-accent/70'
                      }`}
                    >
                      <img
                        src={resolvePortraitSrc(item.path)}
                        alt={`${item.species} ${item.sex}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 py-1">
                        <span className="text-xs font-semibold text-white block truncate">
                          {item.className ? `${item.species} · ${item.className}` : item.species}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {visible.length < filtered.length && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                    className="px-4 py-2 rounded-lg bg-elevated hover:bg-control border border-border-strong text-xs font-semibold text-text-primary transition-colors"
                  >
                    {t('portrait.loadMore')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
