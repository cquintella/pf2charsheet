import { ActionSymbol } from './ActionSymbol';
import React from 'react';
import { SpellItem } from '../types/pf2e';
import { resolveSpellIcon, cleanSnippetText } from '../utils/formatters';
import { buildSpellFormulaContext } from '../utils/foundryFormula';
import { 
  Shield, 
  Clock, 
  Crosshair, 
  Star, 
  Sparkles, 
  Flame, 
  Scroll, 
  BookOpen 
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { rarityLabel } from '../i18n/gameTerms';
import { clickableProps } from '../utils/useModalFocus';

interface SpellCardProps {
  spell: SpellItem;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
  onSelectTrait?: (trait: string) => void;
  characterLevel?: number;
}

export const SpellCard: React.FC<SpellCardProps> = ({ 
  spell, 
  isFavorite,
  onToggleFavorite,
  onClick, 
  onSelectTrait,
  characterLevel
}) => {
  const { t } = useI18n();
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

  // Proposta 1: Categoria de Magia define a cor da borda de 6px (+2px)
  const getCategoryTheme = () => {
    if (isCantrip) {
      return {
        borderClass: 'border-status-info-border hover:border-status-info-border',
        borderColor: '#0e7490',
        badgeBg: 'bg-status-info-bg',
        badgeText: 'text-status-info',
        label: t('spell.badge.cantrip')
      };
    }
    if (isFocus) {
      return {
        borderClass: 'border-status-danger-border hover:border-status-danger-border',
        borderColor: '#7f1d1d',
        badgeBg: 'bg-status-danger-bg',
        badgeText: 'text-status-danger',
        label: t('spell.badge.focus')
      };
    }
    if (isRitual) {
      return {
        borderClass: 'border-status-purple-border hover:border-status-purple-border',
        borderColor: '#581c87',
        badgeBg: 'bg-status-purple-bg',
        badgeText: 'text-status-purple',
        label: t('spell.badge.ritual')
      };
    }
    // Magia Padrão (Slots diários preparados/espontâneos)
    return {
      borderClass: 'border-status-info-border hover:border-status-info-border',
      borderColor: '#1e3a8a',
      badgeBg: 'bg-status-info-bg',
      badgeText: 'text-status-info',
      label: t('spell.badge.slot')
    };
  };

  const categoryTheme = getCategoryTheme();

  // Ícone e identificador para tipos de magias (Foco, Ritual, Truque, Comum)
  const renderSpellTypeBadge = () => {
    if (isCantrip) {
      return (
        <span 
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-status-info-bg text-status-info border border-status-info-border text-xs font-bold"
          title={t('spell.typeTitle.cantrip')}
        >
          <Sparkles className="w-3 h-3 text-status-info" />
          <span>{t('spell.badge.cantrip')}</span>
        </span>
      );
    }
    if (isFocus) {
      return (
        <span 
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-status-danger-bg text-status-danger border border-status-danger-border text-xs font-bold"
          title={t('spell.typeTitle.focus')}
        >
          <Flame className="w-3 h-3 text-status-danger" />
          <span>{t('spell.badge.focus')}</span>
        </span>
      );
    }
    if (isRitual) {
      return (
        <span 
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-status-purple-bg text-status-purple border border-status-purple-border text-xs font-bold"
          title={t('spell.typeTitle.ritual')}
        >
          <Scroll className="w-3 h-3 text-status-purple" />
          <span>{t('spell.badge.ritual')}</span>
        </span>
      );
    }
    return (
      <span 
        className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-status-info-bg text-status-info border border-status-info-border text-xs font-bold"
        title={t('spell.typeTitle.slot')}
      >
        <BookOpen className="w-3 h-3 text-status-info" />
        <span>{t('spell.badge.spell')}</span>
      </span>
    );
  };

  const renderActionBadge = (time: string) => {
    if (time === '1') return <span className="pf-action-icon text-xs px-1.5" title={t('action.timeTitle', { cost: t('action.1') })}><ActionSymbol kind="one" /> 1</span>;
    if (time === '2') return <span className="pf-action-icon text-xs px-1.5" title={t('action.timeTitle', { cost: t('action.2') })}><ActionSymbol kind="two" /> 2</span>;
    if (time === '3') return <span className="pf-action-icon text-xs px-1.5" title={t('action.timeTitle', { cost: t('action.3') })}><ActionSymbol kind="three" /> 3</span>;
    if (time === 'reaction') return <span className="pf-action-icon text-xs px-1.5 bg-status-danger-bg text-status-danger border-status-danger-border" title={t('action.timeTitle', { cost: t('action.reaction') })}><ActionSymbol kind="reaction" /> {t('action.reaction')}</span>;
    if (time === 'free') return <span className="pf-action-icon text-xs px-1.5 bg-status-success-bg text-status-success border-status-success-border" title={t('action.timeTitle', { cost: t('action.free') })}><ActionSymbol kind="free" /> {t('action.freeShort')}</span>;
    return <span className="pf-action-icon text-xs px-1.5">{time || '1'}</span>;
  };

  const cleanSnippet = (html: string) => {
    if (!html) return '';
    const clean = cleanSnippetText(html, buildSpellFormulaContext(spell, characterLevel));
    return clean.slice(0, 320) + (clean.length > 320 ? '...' : '');
  };

  const imageSrc = resolveSpellIcon(spell.img);

  return (
    <div 
      {...clickableProps(onClick)}
      className={`group relative flex flex-col justify-between min-h-[260px] bg-surface hover:bg-elevated border-2 rounded-xl p-3.5 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5 overflow-hidden ${categoryTheme.borderClass} ${
        isFavorite ? 'shadow-[0_0_14px_rgb(var(--accent)/0.25)]' : ''
      }`}
    >
      <div className="flex-1 flex flex-col">
        {/* PRIMEIRA LINHA: Rank, Tipo de Magia (Foco/Ritual/Truque/Magia), Tempo, Favoritada */}
        <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-border-strong">
          {/* Lado Esquerdo: Rank + Tipo de Magia */}
          <div className="flex items-center space-x-1.5">
            {/* Ícone / Badge de Rank */}
            <span 
              className="inline-flex items-center justify-center font-black text-xs px-2 py-0.5 rounded bg-elevated text-accent-text border border-border-strong shadow-sm"
              title={isCantrip ? t('spell.rankTitleCantrip') : t('spell.rankTitle', { rank: spell.rank })}
            >
              {isCantrip ? 'C' : isFocus ? 'F' : isRitual ? 'R' : t('spell.rankOrdinal', { n: spell.rank })}
            </span>

            {/* Ícone / Badge do Tipo de Magia */}
            {renderSpellTypeBadge()}
          </div>

          {/* Lado Direito: Tempo + Botão Favoritada ⭐ */}
          <div className="flex items-center space-x-1.5">
            {/* Ícone de Tempo / Ações */}
            {renderActionBadge(spell.time)}
            
            {/* Botão de Favoritada ⭐ */}
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

        {/* SEGUNDA LINHA (ABAIXO DA PRIMEIRA): Ícone da Magia e Nome */}
        <div className="flex items-center space-x-2.5 mt-2.5">
          <div className="w-10 h-10 rounded-lg bg-elevated border border-border-strong p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
            <img 
              src={imageSrc} 
              alt={spell.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/icons/default-icons/spell.svg';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-white group-hover:text-accent-text transition-colors truncate" title={spell.name}>
              {spell.name}
            </h3>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded border ${categoryTheme.badgeBg} ${categoryTheme.badgeText} border-transparent`}>
                {categoryTheme.label}
              </span>
              {spell.rarity && spell.rarity !== 'common' && (
                <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                  spell.rarity === 'uncommon' ? 'bg-status-warn-bg text-status-warn' :
                  spell.rarity === 'rare' ? 'bg-status-info-bg text-status-info' : 'bg-status-purple-bg text-status-purple'
                }`}>
                  {rarityLabel(t, spell.rarity)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tradições e Traços */}
        <div className="flex flex-wrap gap-1 mt-2.5">
          {traditions.map((trad) => (
            <span key={trad} className="text-xs font-medium uppercase px-1.5 py-0.5 rounded bg-elevated text-status-info border border-border-strong">
              {trad}
            </span>
          ))}
          {traits.slice(0, 3).map((t) => (
            <span 
              key={t}
              onClick={(e) => {
                if (onSelectTrait) {
                  e.stopPropagation();
                  onSelectTrait(t);
                }
              }}
              className="text-xs font-medium uppercase px-1.5 py-0.5 rounded bg-status-danger-bg text-status-danger border border-status-danger-border hover:bg-status-danger-bg"
            >
              {t}
            </span>
          ))}
          {traits.length > 3 && (
            <span className="text-xs text-text-secondary self-center">
              +{traits.length - 3}
            </span>
          )}
        </div>

        {/* Descrição Proporcional ao Formato MTG (63:88) */}
        <div className="flex-1 mt-2.5 p-2.5 rounded-lg bg-inset border border-border-subtle overflow-hidden">
          <p className="text-base text-text-secondary line-clamp-6 leading-relaxed tracking-[0.01em]">
            {cleanSnippet(spell.description)}
          </p>
        </div>
      </div>

      {/* Rodapé: Alcance, Defesa / Salvaguarda, Duração */}
      <div className="mt-2.5 pt-2 border-t border-border-strong flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center space-x-1 truncate max-w-[50%]">
          <Crosshair className="w-3.5 h-3.5 text-accent-text flex-shrink-0" />
          <span className="truncate">{spell.range || t('spell.touch')}</span>
        </div>
        {spell.defense ? (
          <div className="flex items-center space-x-1 text-status-danger font-semibold uppercase">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{spell.defense}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-text-secondary">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{spell.duration || t('spell.instant')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
