import { ActionSymbol } from './ActionSymbol';
import React from 'react';
import { FeatItem } from '../types/pf2e';
import { resolvePf2eIcon, cleanSnippetText } from '../utils/formatters';
import { Star } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';
import { clickableProps } from '../utils/useModalFocus';

interface FeatCardProps {
  feat: FeatItem;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
  onSelectTrait?: (trait: string) => void;
  characterLevel?: number;
}

export const FeatCard: React.FC<FeatCardProps> = ({
  feat,
  isFavorite,
  onToggleFavorite,
  onClick,
  onSelectTrait,
  characterLevel
}) => {
  const { t } = useI18n();
  let traits: string[] = [];
  try {
    traits = JSON.parse(feat.traits || '[]');
  } catch (e) {}

  let prereqs: string[] = [];
  try {
    const parsed = JSON.parse(feat.prerequisites || '[]');
    prereqs = parsed.map((p: any) => (typeof p === 'string' ? p : p.value)).filter(Boolean);
  } catch (e) {}

  // Category theme styling
  const getCategoryTheme = () => {
    switch (feat.category) {
      case 'class':
        return {
          borderClass: 'border-status-info-border hover:border-status-info-border',
          badgeBg: 'bg-status-info-bg',
          badgeText: 'text-status-info',
          label: t('featCategory.class')
        };
      case 'ancestry':
        return {
          borderClass: 'border-status-success-border hover:border-status-success-border',
          badgeBg: 'bg-status-success-bg',
          badgeText: 'text-status-success',
          label: t('featCategory.ancestry')
        };
      case 'skill':
        return {
          borderClass: 'border-status-warn-border hover:border-status-warn-border',
          badgeBg: 'bg-status-warn-bg',
          badgeText: 'text-status-warn',
          label: t('featCategory.skill')
        };
      case 'general':
        return {
          borderClass: 'border-status-purple-border hover:border-status-purple-border',
          badgeBg: 'bg-status-purple-bg',
          badgeText: 'text-status-purple',
          label: t('featCategory.general')
        };
      case 'classfeature':
        return {
          borderClass: 'border-border-strong hover:border-text-muted',
          badgeBg: 'bg-elevated',
          badgeText: 'text-text-primary',
          label: t('featCategory.classfeature')
        };
      case 'ancestryfeature':
        return {
          borderClass: 'border-border-strong hover:border-text-muted',
          badgeBg: 'bg-elevated',
          badgeText: 'text-text-primary',
          label: t('featCategory.ancestryfeature')
        };
      default:
        return {
          borderClass: 'border-border-strong hover:border-border-strong',
          badgeBg: 'bg-elevated',
          badgeText: 'text-text-primary',
          label: feat.category || t('featCategory.feat')
        };
    }
  };

  const theme = getCategoryTheme();

  // Action badge rendering
  const renderActionBadge = () => {
    if (feat.action_type === 'passive') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-elevated text-text-secondary border border-border-strong" title={t('action.passive')}>
          ⚙ {t('action.passive')}
        </span>
      );
    }
    if (feat.action_type === 'reaction') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-status-danger-bg text-status-danger border border-status-danger-border" title={t('action.reaction')}>
          <ActionSymbol kind="reaction" /> {t('action.reaction')}
        </span>
      );
    }
    if (feat.action_type === 'free') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-status-success-bg text-status-success border border-status-success-border" title={t('action.free')}>
          <ActionSymbol kind="free" /> {t('action.freeShort')}
        </span>
      );
    }
    if (feat.actions === '1') {
      return <span className="pf-action-icon text-xs px-1.5" title={t('action.1')}><ActionSymbol kind="one" /> 1</span>;
    }
    if (feat.actions === '2') {
      return <span className="pf-action-icon text-xs px-1.5" title={t('action.2')}><ActionSymbol kind="two" /> 2</span>;
    }
    if (feat.actions === '3') {
      return <span className="pf-action-icon text-xs px-1.5" title={t('action.3')}><ActionSymbol kind="three" /> 3</span>;
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-elevated text-text-primary border border-border-strong">
        {t('action.generic')}
      </span>
    );
  };

  const imageSrc = resolvePf2eIcon(feat.img, '/assets/icons/default-icons/feat.svg');

  return (
    <div
      {...clickableProps(onClick)}
      className={`feat-compendium-card group relative flex flex-col justify-between min-h-[250px] bg-surface hover:bg-elevated border-2 rounded-xl p-3.5 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5 overflow-hidden ${theme.borderClass} ${
        isFavorite ? 'shadow-[0_0_14px_rgb(var(--accent)/0.25)]' : ''
      }`}
    >
      <div className="flex-1 flex flex-col">
        {/* FIRST ROW: Level Badge, Category, Action Type, Favorite Star */}
        <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-border-strong">
          <div className="flex items-center space-x-1.5">
            {/* Level Badge */}
            <span 
              className="inline-flex items-center justify-center font-black text-xs px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong shadow-sm"
              title={t('feat.levelTitle', { level: feat.level })}
            >
              {t('common.levelShort', { level: feat.level })}
            </span>

            {/* Category Badge */}
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border border-transparent ${theme.badgeBg} ${theme.badgeText}`}>
              {theme.label}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Action Cost */}
            {renderActionBadge()}

            {/* Favorite Star Button ⭐ */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e);
              }}
              className="p-1 rounded-md hover:bg-control transition-colors"
              title={isFavorite ? t('favorites.remove') : t('favorites.add')}
            >
              <Star 
                className={`w-4 h-4 transition-all ${
                  isFavorite 
                    ? 'text-accent-text fill-accent drop-shadow-[0_0_6px_rgb(var(--accent)/0.6)]'
                    : 'text-text-muted hover:text-accent-text'
                }`} 
              />
            </button>
          </div>
        </div>

        {/* SECOND ROW: Icon & Name */}
        <div className="flex items-center space-x-2.5 mt-2.5">
          <div className="w-10 h-10 rounded-lg bg-elevated border border-border-strong p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
            <img
              src={imageSrc}
              alt={feat.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/icons/default-icons/feat.svg';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-white group-hover:text-accent-text transition-colors truncate" title={feat.name}>
              {feat.name}
            </h3>
            {feat.rarity && feat.rarity !== 'common' && (
              <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                feat.rarity === 'uncommon' ? 'bg-status-warn-bg text-status-warn' :
                feat.rarity === 'rare' ? 'bg-status-info-bg text-status-info' : 'bg-status-purple-bg text-status-purple'
              }`}>
                {rarityLabel(t, feat.rarity)}
              </span>
            )}
          </div>
        </div>

        {/* Prerequisites Badge if any */}
        {prereqs.length > 0 && (
          <div className="mt-2 text-xs text-accent-text bg-status-warn-bg px-2 py-1 rounded border border-status-warn-border truncate" title={prereqs.join('; ')}>
            <span className="font-bold">{t('feat.prereqShort')}</span> {prereqs.join('; ')}
          </div>
        )}

        {/* Traits Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {traits.slice(0, 4).map((t) => (
            <span
              key={t}
              onClick={(e) => {
                if (onSelectTrait) {
                  e.stopPropagation();
                  onSelectTrait(t);
                }
              }}
              className="text-xs font-medium uppercase px-1.5 py-0.5 rounded bg-elevated text-status-info border border-border-strong hover:bg-control"
            >
              {t}
            </span>
          ))}
          {traits.length > 4 && (
            <span className="text-xs text-text-secondary self-center">
              +{traits.length - 4}
            </span>
          )}
        </div>

        {/* Description Snippet Proporcional ao Formato MTG (63:88) */}
        <div className="flex-1 mt-2.5 p-2.5 rounded-lg bg-inset border border-border-subtle overflow-hidden">
          <p className="text-base text-text-secondary line-clamp-6 leading-relaxed tracking-[0.01em]">
            {cleanSnippetText(feat.description, { actorLevel: characterLevel })}
          </p>
        </div>
      </div>
    </div>
  );
};
