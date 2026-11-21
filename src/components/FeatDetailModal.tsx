import React, { useRef } from 'react';
import { FeatItem } from '../types/pf2e';
import { resolvePf2eIcon, cleanDescriptionHtml } from '../utils/formatters';
import { useModalFocus } from '../utils/useModalFocus';
import { 
  X, 
  Star, 
  Award, 
  Clock, 
  CheckCircle, 
  Layers, 
  BookOpen 
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';

interface FeatDetailModalProps {
  feat: FeatItem | null;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onClose: () => void;
  onSelectTrait?: (trait: string) => void;
  inline?: boolean;
}

export const FeatDetailModal: React.FC<FeatDetailModalProps> = ({
  feat,
  isFavorite = false,
  onToggleFavorite,
  onClose,
  onSelectTrait,
  inline = false
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose, Boolean(feat) && !inline);

  if (!feat) return null;

  let traits: string[] = [];
  try {
    traits = JSON.parse(feat.traits || '[]');
  } catch (e) {}

  let prereqs: string[] = [];
  try {
    const parsed = JSON.parse(feat.prerequisites || '[]');
    prereqs = parsed.map((p: any) => (typeof p === 'string' ? p : p.value)).filter(Boolean);
  } catch (e) {}

  const renderActionBadge = () => {
    if (feat.action_type === 'passive') {
      return <span className="pf-action-icon text-sm px-2">⚙ {t('action.passive')}</span>;
    }
    if (feat.action_type === 'reaction') {
      return <span className="pf-action-icon text-sm px-2 bg-status-danger-bg text-status-danger border-status-danger-border">↺ {t('action.reaction')}</span>;
    }
    if (feat.action_type === 'free') {
      return <span className="pf-action-icon text-sm px-2 bg-status-success-bg text-status-success border-status-success-border">◇ {t('action.free')}</span>;
    }
    if (feat.actions === '1') return <span className="pf-action-icon text-sm px-2">◆ {t('action.1')}</span>;
    if (feat.actions === '2') return <span className="pf-action-icon text-sm px-2">◆◆ {t('action.2')}</span>;
    if (feat.actions === '3') return <span className="pf-action-icon text-sm px-2">◆◆◆ {t('action.3')}</span>;
    return <span className="pf-action-icon text-sm px-2">{t('action.generic')}</span>;
  };

  const imageSrc = resolvePf2eIcon(feat.img, '/assets/icons/default-icons/feat.svg');

  return (
    <div className={inline ? 'w-full animate-fadeIn' : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn'} onClick={inline ? undefined : onClose}>
      <div
        ref={dialogRef}
        role={inline ? undefined : 'dialog'}
        aria-modal={inline ? undefined : true}
        aria-label={feat.name}
        className={`relative w-full ${inline ? '' : 'max-w-3xl max-h-[90vh]'} bg-surface border border-border-strong rounded-xl shadow-2xl flex flex-col overflow-hidden text-text-primary`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border-strong bg-elevated">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-xl bg-control border-2 border-text-muted p-1 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-lg">
              <img
                src={imageSrc}
                alt={feat.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/icons/default-icons/feat.svg';
                }}
              />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold tracking-wide text-white">{feat.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent/20 border border-accent/50 text-accent-text">
                  {t('common.level', { level: feat.level })}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1 text-xs text-text-secondary">
                <span className="capitalize">{feat.category}</span>
                {feat.rarity && feat.rarity !== 'common' && (
                  <span className={`capitalize font-semibold ${
                    feat.rarity === 'uncommon' ? 'text-status-warn' :
                    feat.rarity === 'rare' ? 'text-status-info' : 'text-status-purple'
                  }`}>
                    • {feat.rarity}
                  </span>
                )}
                <span>• {feat.source || 'Pathfinder Remaster'}</span>
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
            {feat.rarity && feat.rarity !== 'common' && (
              <span className={`pf-trait pf-trait-rarity-${feat.rarity}`}>
                {rarityLabel(t, feat.rarity)}
              </span>
            )}
            <span className="pf-trait pf-trait-tradition capitalize">
              {feat.category}
            </span>
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
                <span className="text-text-secondary block text-xs">{t('feat.typeAction')}</span>
                <div className="mt-0.5">{renderActionBadge()}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-accent-text flex-shrink-0" />
              <div>
                <span className="text-text-secondary block text-xs">{t('feat.minLevel')}</span>
                <span className="font-semibold text-white">{t('common.level', { level: feat.level })}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-accent-text flex-shrink-0" />
              <div>
                <span className="text-text-secondary block text-xs">{t('feat.category')}:</span>
                <span className="font-semibold text-white capitalize">{feat.category}</span>
              </div>
            </div>
          </div>

          {/* Prerequisites */}
          {prereqs.length > 0 && (
            <div className="p-3.5 bg-status-warn-bg border border-status-warn-border rounded-lg">
              <h4 className="text-xs font-bold text-accent-text uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>{t('feat.prerequisites')}</span>
              </h4>
              <ul className="text-xs text-status-warn space-y-1 pl-4 list-disc">
                {prereqs.map((pr, idx) => (
                  <li key={idx}>{pr}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-accent-text flex items-center space-x-1.5 border-b border-border-strong pb-1">
              <BookOpen className="w-4 h-4" />
              <span>{t('feat.description')}</span>
            </h3>
            <div
              className="pf-prose max-w-none text-base leading-relaxed text-text-primary space-y-3 bg-canvas p-4 rounded-lg border border-border-strong"
              dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(feat.description) }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-strong bg-elevated flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-control hover:bg-control-hover text-white font-medium rounded-lg text-sm transition-colors shadow"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
