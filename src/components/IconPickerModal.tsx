import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SpellIconOption, fetchSpellIcons } from '../services/api';
import { X, Search, Sparkles, Check, Image as ImageIcon } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';

interface IconPickerModalProps {
  currentIconPath: string;
  spellName: string;
  onSelectIcon: (iconPath: string) => void;
  onClose: () => void;
}

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  currentIconPath,
  spellName,
  onSelectIcon,
  onClose
}) => {
  const { t } = useI18n();
  const [icons, setIcons] = useState<SpellIconOption[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSpellIcons()
      .then((data) => {
        setIcons(data);
      })
      .catch((err) => console.error('Erro ao carregar lista de ícones:', err))
      .finally(() => setLoading(false));
  }, []);

  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef, onClose);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return icons.slice(0, 200); // show initial batch of 200
    const query = search.toLowerCase();
    return icons.filter(
      (ico) => ico.name.toLowerCase().includes(query) || ico.filename.toLowerCase().includes(query)
    );
  }, [icons, search]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('iconPicker.title')}
        className="relative w-full max-w-4xl max-h-[85vh] bg-surface border border-border-strong rounded-xl shadow-2xl flex flex-col overflow-hidden text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-strong bg-elevated">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-control border border-accent/40 flex items-center justify-center text-accent-text">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {t('iconPicker.title')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('iconPicker.changingFor')} <span className="font-semibold text-accent-text">{spellName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-control transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border-strong bg-surface">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('iconPicker.searchPlaceholder')}
              className="w-full pl-10 pr-9 py-2 bg-elevated border border-border-strong focus:border-accent rounded-lg text-sm text-white placeholder-text-muted outline-none transition-colors"
              autoFocus
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
          <div className="flex items-center justify-between mt-2 text-xs text-text-secondary">
            <span>
              {t('iconPicker.showing', { shown: filteredIcons.length, total: icons.length })}
            </span>
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="text-accent-text hover:underline"
              >
                {t('iconPicker.showAll')}
              </button>
            )}
          </div>
        </div>

        {/* Icons Grid */}
        <div className="flex-1 p-4 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2 text-xs text-text-secondary">
              <Sparkles className="w-6 h-6 text-accent-text animate-spin" />
              <span>{t('iconPicker.loading')}</span>
            </div>
          ) : filteredIcons.length === 0 ? (
            <div className="text-center py-20 text-xs text-text-secondary">
              {t('iconPicker.noResults', { search })}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
              {filteredIcons.map((ico) => {
                const isSelected = currentIconPath.includes(ico.filename);
                return (
                  <button
                    key={ico.filename}
                    onClick={() => onSelectIcon(ico.path)}
                    className={`group relative flex flex-col items-center p-2 rounded-lg border transition-all text-center ${
                      isSelected
                        ? 'bg-status-success-border/20 border-status-success-border shadow-md ring-1 ring-status-success-border'
                        : 'bg-elevated hover:bg-control border-border-strong hover:border-accent'
                    }`}
                    title={ico.name}
                  >
                    <div className="w-12 h-12 rounded bg-inset border border-border-strong p-1 flex items-center justify-center overflow-hidden mb-1.5 group-hover:scale-105 transition-transform">
                      <img
                        src={ico.url}
                        alt={ico.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-xs text-text-primary group-hover:text-accent-text truncate w-full capitalize leading-tight">
                      {ico.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-status-success-border rounded-full p-0.5 text-white">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border-strong bg-elevated flex justify-between items-center text-xs text-text-secondary">
          <span>{t('iconPicker.clickToApply')}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-control hover:bg-control-hover text-white font-medium rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
