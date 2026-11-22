import React, { useRef } from 'react';
import { Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Locale, SUPPORTED_LOCALES, isLocale } from '../i18n/Translator';
import { useModalFocus } from '../utils/useModalFocus';
import { PortraitDbSource } from '../utils/portrait';
import { HpProgressionMode } from '../types/pf2e';

export type ThemeName = 'current' | 'light' | 'dark';
export type WallpaperMode = 'scaled' | 'tiled';

const THEMES: readonly ThemeName[] = ['current', 'light', 'dark'];
const HP_MODES: readonly HpProgressionMode[] = ['full', 'average', 'roll'];
const WALLPAPER_MODES: readonly WallpaperMode[] = ['scaled', 'tiled'];
const selectClass = 'rounded-lg border border-border-strong bg-control px-3 py-1.5 text-sm text-white';

interface GeneralSettingsFieldsProps {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  portraitDb?: PortraitDbSource;
  onPortraitDbChange?: (source: PortraitDbSource) => void;
  hpMode?: HpProgressionMode;
  onHpModeChange?: (mode: HpProgressionMode) => void;
  wallpaperImage?: string | null;
  onWallpaperImageChange?: (dataUrl: string | null) => void;
  wallpaperMode?: WallpaperMode;
  onWallpaperModeChange?: (mode: WallpaperMode) => void;
}

/** Application-wide preferences (theme, language, portrait database, and game options). */
export const GeneralSettingsFields: React.FC<GeneralSettingsFieldsProps> = ({
  theme,
  onThemeChange,
  portraitDb = 'portraitdb',
  onPortraitDbChange,
  hpMode = 'full',
  onHpModeChange,
  wallpaperImage = null,
  onWallpaperImageChange,
  wallpaperMode = 'scaled',
  onWallpaperModeChange,
}) => {
  const { t, locale, setLocale } = useI18n();
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onWallpaperImageChange) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      if (!raw) return;
      // Keep small images/textures untouched; downscale large PNGs so they fit in localStorage.
      if (raw.length <= 900_000) {
        onWallpaperImageChange(raw);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onWallpaperImageChange(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onWallpaperImageChange(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => onWallpaperImageChange(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  };
  return <>
    <div className="flex items-center justify-between gap-4 border-t border-border-strong pt-4">
      <label htmlFor="display-theme" className="text-sm font-semibold text-white">{t('settings.theme')}</label>
      <select id="display-theme" value={theme} onChange={event => onThemeChange(event.target.value as ThemeName)} className={selectClass}>
        {THEMES.map(name => <option key={name} value={name}>{t(`settings.theme.${name}`)}</option>)}
      </select>
    </div>
    <div className="flex items-start justify-between gap-4 border-t border-border-strong pt-4">
      <div>
        <label htmlFor="interface-language" className="text-sm font-semibold text-white">{t('settings.language')}</label>
        <p className="text-xs text-text-secondary">{t('settings.languageHint')}</p>
      </div>
      <select id="interface-language" value={locale} onChange={event => { const value: string = event.target.value; if (isLocale(value)) setLocale(value); }} className={selectClass}>
        {SUPPORTED_LOCALES.map((code: Locale) => <option key={code} value={code}>{t(`settings.language.${code}`)}</option>)}
      </select>
    </div>
    <div className="flex items-start justify-between gap-4 border-t border-border-strong pt-4">
      <div>
        <label htmlFor="database-language" className="text-sm font-semibold text-white">{t('settings.databaseLanguage')}</label>
        <p className="text-xs text-text-secondary">{t('settings.databaseLanguageHint')}</p>
      </div>
      <select id="database-language" disabled value="original" className={`${selectClass} disabled:opacity-70`}>
        <option value="original">{t('settings.databaseLanguage.original')}</option>
      </select>
    </div>
    {onPortraitDbChange && (
      <div className="flex items-start justify-between gap-4 border-t border-border-strong pt-4">
        <div>
          <label htmlFor="portrait-database" className="text-sm font-semibold text-white">{t('settings.portraitDb')}</label>
          <p className="text-xs text-text-secondary">{t('settings.portraitDbHint')}</p>
        </div>
        <select
          id="portrait-database"
          value={portraitDb}
          onChange={event => onPortraitDbChange(event.target.value as PortraitDbSource)}
          className={selectClass}
        >
          <option value="portraitdb">portraitdb</option>
          <option value="none">{t('settings.portraitDb.none')}</option>
        </select>
      </div>
    )}
    {onHpModeChange && (
      <div className="border-t border-border-strong pt-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t('settings.gameOptions')}</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor="hp-progression-mode" className="text-sm font-semibold text-white">{t('settings.hpMode')}</label>
            <p className="text-xs text-text-secondary">{t('settings.hpModeHint')}</p>
          </div>
          <select
            id="hp-progression-mode"
            value={hpMode}
            onChange={event => onHpModeChange(event.target.value as HpProgressionMode)}
            className={selectClass}
          >
            {HP_MODES.map(mode => <option key={mode} value={mode}>{t(`settings.hpMode.${mode}`)}</option>)}
          </select>
        </div>
      </div>
    )}
    {onWallpaperImageChange && (
      <div className="border-t border-border-strong pt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-accent-text" />
              <span>{t('settings.wallpaper')}</span>
            </span>
            <p className="text-xs text-text-secondary">{t('settings.wallpaperHint')}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              onChange={handleWallpaperUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => wallpaperInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-control hover:bg-control-hover px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-accent-text" />
              <span>{t('settings.wallpaper.upload')}</span>
            </button>
            {wallpaperImage && (
              <button
                type="button"
                onClick={() => onWallpaperImageChange(null)}
                title={t('settings.wallpaper.remove')}
                aria-label={t('settings.wallpaper.remove')}
                className="rounded-lg border border-status-danger-border bg-status-danger-bg p-1.5 text-status-danger hover:opacity-90 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {wallpaperImage && onWallpaperModeChange && (
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="wallpaper-display-mode" className="text-xs font-semibold text-text-secondary">
              {t('settings.wallpaper.mode')}
            </label>
            <select
              id="wallpaper-display-mode"
              value={wallpaperMode}
              onChange={event => onWallpaperModeChange(event.target.value as WallpaperMode)}
              className={selectClass}
            >
              {WALLPAPER_MODES.map(mode => (
                <option key={mode} value={mode}>{t(`settings.wallpaper.${mode}`)}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    )}
  </>;
};

interface SettingsModalProps extends GeneralSettingsFieldsProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  theme,
  onThemeChange,
  portraitDb,
  onPortraitDbChange,
  hpMode,
  onHpModeChange,
  wallpaperImage,
  onWallpaperImageChange,
  wallpaperMode,
  onWallpaperModeChange,
  onClose,
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 print:hidden" onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl space-y-4" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="settings-title" className="text-lg font-bold text-white">{t('settings.title')}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-control"><X className="w-5 h-5" /></button>
      </div>
      <GeneralSettingsFields
        theme={theme}
        onThemeChange={onThemeChange}
        portraitDb={portraitDb}
        onPortraitDbChange={onPortraitDbChange}
        hpMode={hpMode}
        onHpModeChange={onHpModeChange}
        wallpaperImage={wallpaperImage}
        onWallpaperImageChange={onWallpaperImageChange}
        wallpaperMode={wallpaperMode}
        onWallpaperModeChange={onWallpaperModeChange}
      />
    </div>
  </div>;
};
