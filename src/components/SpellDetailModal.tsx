import React, { useEffect, useState, useRef } from 'react';
import { SpellItem } from '../types/pf2e';
import { updateSpellIcon } from '../services/api';
import { resolveSpellIcon } from '../utils/formatters';
import { IconPickerModal } from './IconPickerModal';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';
import { cleanDescriptionHtml } from '../utils/formatters';
import { useModalFocus, clickableProps } from '../utils/useModalFocus';
import { X, Shield, Clock, Crosshair, Hourglass, BookOpen, Layers, Star, Camera, Scroll } from 'lucide-react';

interface SpellDetailModalProps {
  spell: SpellItem | null;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onUpdateSpellIcon?: (spellId: string, newImgPath: string) => void;
  onClose: () => void;
  onSelectTrait?: (trait: string) => void;
  inline?: boolean;
}

export const SpellDetailModal: React.FC<SpellDetailModalProps> = ({ 
  spell, 
  isFavorite = false,
  onToggleFavorite,
  onUpdateSpellIcon,
  onClose, 
  onSelectTrait,
  inline = false
}) => {
  const { t } = useI18n();
  const [showIconPicker, setShowIconPicker] = useState<boolean>(false);
  const [currentImg, setCurrentImg] = useState<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (spell) {
      setCurrentImg(spell.img || '');
    }
  }, [spell]);

  useModalFocus(dialogRef, onClose, Boolean(spell) && !inline && !showIconPicker);

  if (!spell) return null;

  let traits: string[] = [];
  try {
    traits = JSON.parse(spell.traits || '[]');
  } catch (e) {}

  let traditions: string[] = [];
  try {
    traditions = JSON.parse(spell.traditions || '[]');
  } catch (e) {}

  const isCantrip = traits.includes('cantrip') || spell.category === 'cantrip';
  const isFocus = traits.includes('focus') || spell.category === 'focus';
  const isRitual = traits.includes('ritual') || spell.category === 'ritual' || (Boolean(spell.system_json) && spell.system_json.includes('"ritual":{'));

  let ritualData: any = null;
  try {
    const sys = JSON.parse(spell.system_json || '{}');
    if (sys.ritual) ritualData = sys.ritual;
  } catch (e) {}

  // Format action icon
  const renderActionCost = (time: string) => {
    if (time === '1') return <span className="pf-action-icon text-sm px-2">◆ {t('action.1')}</span>;
    if (time === '2') return <span className="pf-action-icon text-sm px-2">◆◆ {t('action.2')}</span>;
    if (time === '3') return <span className="pf-action-icon text-sm px-2">◆◆◆ {t('action.3')}</span>;
    if (time === 'reaction') return <span className="pf-action-icon text-sm px-2 bg-status-danger-bg text-status-danger border-status-danger-border">↺ {t('action.reaction')}</span>;
    if (time === 'free') return <span className="pf-action-icon text-sm px-2 bg-status-success-bg text-status-success border-status-success-border">◇ {t('action.free')}</span>;
    return <span className="pf-action-icon text-sm px-2">{time || t('action.1')}</span>;
  };


  // Determine image path using unified resolver
  const imageSrc = resolveSpellIcon(currentImg);

  const handleSelectNewIcon = async (newPath: string) => {
    setCurrentImg(newPath);
    setShowIconPicker(false);
    try {
      await updateSpellIcon(spell.id, newPath);
      if (onUpdateSpellIcon) {
        onUpdateSpellIcon(spell.id, newPath);
      }
    } catch (err) {
      console.error('Erro ao atualizar ícone:', err);
    }
  };

  return (
    <>
      <div className={inline ? 'w-full animate-fadeIn' : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn'} onClick={inline ? undefined : onClose}>
        <div
          ref={dialogRef}
          role={inline ? undefined : 'dialog'}
          aria-modal={inline ? undefined : true}
          aria-label={spell.name}
          className={`relative w-full ${inline ? '' : 'max-w-3xl max-h-[90vh]'} bg-surface border border-border-strong rounded-xl shadow-2xl flex flex-col overflow-hidden text-text-primary`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border-strong bg-elevated">
            <div className="flex items-center space-x-4">
              {/* Clickable Spell Icon with Overlay */}
              <div 
                onClick={() => setShowIconPicker(true)}
                className="group relative w-16 h-16 rounded-xl bg-control border-2 border-text-muted hover:border-accent p-1 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-lg cursor-pointer transition-all hover:scale-105"
                title={t('spellDetail.clickToChangeIcon')}
              >
                <img 
                  src={imageSrc} 
                  alt={spell.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/icons/default-icons/spell.svg';
                  }}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                  <Camera className="w-5 h-5 text-accent-text" />
                  <span className="text-[11px] font-bold text-center uppercase tracking-tighter mt-0.5">
                    {t('common.change')}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-2xl font-bold tracking-wide text-white">{spell.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent/20 border border-accent/50 text-accent-text">
                    {isCantrip ? t('spell.category.cantrip') : isFocus ? t('spell.category.focus') : isRitual ? t('spell.category.ritual') : t('spell.rankTitle', { rank: spell.rank })}
                  </span>
                </div>
                <div className="flex items-center space-x-2 mt-1 text-xs text-text-secondary">
                  <span>{spell.source || 'Pathfinder Remaster'}</span>
                  {spell.rarity && spell.rarity !== 'common' && (
                    <span className={`capitalize font-semibold ${
                      spell.rarity === 'uncommon' ? 'text-status-warn' :
                      spell.rarity === 'rare' ? 'text-status-info' : 'text-status-purple'
                    }`}>
                      • {rarityLabel(t, spell.rarity)}
                    </span>
                  )}
                  <span className="text-text-muted">• {t('spellDetail.clickImageHint')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`p-2 rounded-lg border transition-all ${
                    isFavorite 
                      ? 'bg-accent/20 border-accent text-accent-text' 
                      : 'bg-control border-border-strong text-text-secondary hover:text-accent-text'
                  }`}
                  title={isFavorite ? t('favorites.remove') : t('favorites.add')}
                >
                  <Star className={`w-5 h-5 ${isFavorite ? 'fill-accent' : ''}`} />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-control transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className={`p-6 space-y-5 ${inline ? '' : 'overflow-y-auto'}`}>
            {/* Traits Bar */}
            <div className="flex flex-wrap gap-1.5">
              {/* Rarity */}
              {spell.rarity && spell.rarity !== 'common' && (
                <span className={`pf-trait pf-trait-rarity-${spell.rarity}`}>
                  {spell.rarity}
                </span>
              )}
              {/* Traditions */}
              {traditions.map((trad) => (
                <span key={trad} className="pf-trait pf-trait-tradition">
                  {trad}
                </span>
              ))}
              {/* Category / Other Traits */}
              {traits.map((trait) => (
                <button
                  key={trait}
                  onClick={() => onSelectTrait && onSelectTrait(trait)}
                  className="pf-trait hover:border-status-danger-border hover:bg-status-danger-bg transition-colors cursor-pointer"
                  title={t('filters.byTrait', { trait })}
                >
                  {trait}
                </button>
              ))}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-elevated rounded-lg border border-border-strong text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-accent-text flex-shrink-0" />
                <div>
                  <span className="text-text-secondary block text-xs">{t('spell.cast')}:</span>
                  <div className="mt-0.5">{renderActionCost(spell.time)}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Crosshair className="w-4 h-4 text-accent-text flex-shrink-0" />
                <div>
                  <span className="text-text-secondary block text-xs">{t('spell.range')}:</span>
                  <span className="font-semibold text-white">{spell.range || t('spell.touchSelf')}</span>
                </div>
              </div>

              {spell.area && (
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-accent-text flex-shrink-0" />
                  <div>
                    <span className="text-text-secondary block text-xs">{t('spell.area')}:</span>
                    <span className="font-semibold text-white">{spell.area}</span>
                  </div>
                </div>
              )}

              {spell.target && (
                <div className="flex items-center space-x-2">
                  <Crosshair className="w-4 h-4 text-accent-text flex-shrink-0" />
                  <div>
                    <span className="text-text-secondary block text-xs">{t('spell.target')}:</span>
                    <span className="font-semibold text-white">{spell.target}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-accent-text flex-shrink-0" />
                <div>
                  <span className="text-text-secondary block text-xs">{t('spell.defense')}:</span>
                  <span className="font-semibold uppercase tracking-wider text-white">
                    {spell.defense || t('common.none')}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Hourglass className="w-4 h-4 text-accent-text flex-shrink-0" />
                <div>
                  <span className="text-text-secondary block text-xs">{t('spell.duration')}:</span>
                  <span className="font-semibold text-white">{spell.duration || t('spell.instant')}</span>
                </div>
              </div>
            </div>

            {/* Ritual Requirements & Checks if applicable */}
            {isRitual && ritualData && (
              <div className="p-4 bg-status-purple-bg rounded-lg border border-status-purple-border text-sm space-y-2">
                <h4 className="text-xs font-bold text-status-purple uppercase tracking-wider flex items-center gap-1.5">
                  <Scroll className="w-4 h-4 text-status-purple" />
                  <span>{t('spellDetail.ritualParams')}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                  {ritualData.primary?.check && (
                    <div>
                      <span className="text-status-purple font-bold block">{t('spellDetail.primaryCheck')}</span>
                      <span className="text-white font-semibold">{ritualData.primary.check}</span>
                    </div>
                  )}
                  {ritualData.secondary && (
                    <div>
                      <span className="text-status-purple font-bold block">{t('spellDetail.secondaryCasters')}</span>
                      <span className="text-white">
                        {ritualData.secondary.casters ? t('spellDetail.casters', { count: ritualData.secondary.casters }) : t('common.none')} 
                        {ritualData.secondary.checks ? ` — (${ritualData.secondary.checks})` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-accent-text flex items-center space-x-1.5 border-b border-border-strong pb-1">
                <BookOpen className="w-4 h-4" />
                <span>{t('spellDetail.description')}</span>
              </h3>
              <div 
                className="pf-prose max-w-none text-base leading-relaxed text-text-primary space-y-3 bg-canvas p-4 rounded-lg border border-border-strong"
                dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(spell.description) }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border-strong bg-elevated flex justify-between items-center">
            <button
              onClick={() => setShowIconPicker(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-control hover:bg-control text-xs font-semibold text-accent-text border border-border-strong transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>{t('spellDetail.changeIcon')}</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 bg-control hover:bg-control-hover text-white font-medium rounded-lg text-sm transition-colors shadow"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Nested Icon Picker Modal */}
      {showIconPicker && (
        <IconPickerModal
          currentIconPath={currentImg}
          spellName={spell.name}
          onSelectIcon={handleSelectNewIcon}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  );
};
