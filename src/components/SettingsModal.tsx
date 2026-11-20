import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Locale, SUPPORTED_LOCALES, isLocale } from '../i18n/Translator';
import { useModalFocus } from '../utils/useModalFocus';
import { PortraitDbSource } from '../utils/portrait';

export type ThemeName = 'current' | 'light' | 'dark';

const THEMES: readonly ThemeName[] = ['current', 'light', 'dark'];
const selectClass = 'rounded-lg border border-border-strong bg-control px-3 py-1.5 text-sm text-white';

interface GeneralSettingsFieldsProps {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  portraitDb?: PortraitDbSource;
  onPortraitDbChange?: (source: PortraitDbSource) => void;
}

/** Application-wide preferences (theme, language, and portrait database). */
export const GeneralSettingsFields: React.FC<GeneralSettingsFieldsProps> = ({
  theme,
  onThemeChange,
  portraitDb = 'portraitdb',
  onPortraitDbChange,
}) => {
  const { t, locale, setLocale } = useI18n();
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
  </>;
};

interface SettingsModalProps extends GeneralSettingsFieldsProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ theme, onThemeChange, portraitDb, onPortraitDbChange, onClose }) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 print:hidden" onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl space-y-4" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="settings-title" className="text-lg font-bold text-white">{t('settings.title')}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-control"><X className="w-5 h-5" /></button>
      </div>
      <GeneralSettingsFields theme={theme} onThemeChange={onThemeChange} portraitDb={portraitDb} onPortraitDbChange={onPortraitDbChange} />
    </div>
  </div>;
};
