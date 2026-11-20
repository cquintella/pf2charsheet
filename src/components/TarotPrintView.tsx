import React, { useRef, useState } from 'react';
import { SpellItem } from '../types/pf2e';
import { resolveSpellIcon } from '../utils/formatters';
import './tarot-print.css';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';

interface TarotPrintViewProps {
  spells: SpellItem[];
  onClose: () => void;
}

function textDescription(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return (parsed.body.textContent || '')
    .replace(/@(?:UUID|Damage|Check)\[[^\]]+\]\{([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

function traitsOf(spell: SpellItem): string[] {
  try {
    const traits: unknown = JSON.parse(spell.traits || '[]');
    return Array.isArray(traits) ? traits.filter((trait): trait is string => typeof trait === 'string') : [];
  } catch {
    return [];
  }
}

export const TarotPrintView: React.FC<TarotPrintViewProps> = ({ spells, onClose }) => {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<'tarot' | 'poker'>('tarot');
  const [fullText, setFullText] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(spells.map(s => s.id)));
  useModalFocus(overlayRef, onClose);

  const perPage = cardSize === 'poker' ? 9 : 4;
  const activeSpells = spells.filter(s => selectedIds.has(s.id));

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div ref={overlayRef} className="tarot-overlay" role="dialog" aria-modal="true" aria-label={t('tarot.ariaLabel')}>
      <div className="tarot-toolbar">
        <div>
          <strong>{t('tarot.title')}</strong>
          <p>{t('tarot.subtitle', { count: activeSpells.length })}</p>
        </div>
        <div className="tarot-actions flex-wrap">
          <button type="button" onClick={() => setCardSize(s => s === 'tarot' ? 'poker' : 'tarot')}>
            {cardSize === 'tarot' ? t('tarot.sizeTarot') : t('tarot.sizePoker')}
          </button>
          <button type="button" onClick={() => setFullText(v => !v)}>
            {t('tarot.fullText')}: {fullText ? t('common.on') : t('common.off')}
          </button>
          <button type="button" onClick={() => setSelectedIds(new Set(spells.map(s => s.id)))}>{t('tarot.selectAll')}</button>
          <button type="button" onClick={() => setSelectedIds(new Set())}>{t('tarot.selectNone')}</button>
          <button type="button" onClick={() => window.print()} disabled={activeSpells.length === 0}>{t('tarot.print')}</button>
          <button type="button" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-6 py-3 bg-[#1b2028] border-b border-[#344256] print:hidden">
        {spells.map(sp => {
          const checked = selectedIds.has(sp.id);
          return (
            <button
              key={sp.id}
              type="button"
              onClick={() => toggleId(sp.id)}
              className={`px-2 py-1 rounded text-xs border ${
                checked ? 'bg-[#e0a845] text-black border-[#e0a845] font-bold' : 'bg-[#141922] text-[#8e9aa8] border-[#2e3846]'
              }`}
            >
              {sp.name}
            </button>
          );
        })}
      </div>

      <div className="tarot-sheets">
        {Array.from({ length: Math.ceil(activeSpells.length / perPage) }, (_, page) => (
          <div className={`tarot-sheet ${cardSize === 'poker' ? 'is-poker' : ''}`} key={page}>
            {activeSpells.slice(page * perPage, page * perPage + perPage).map((spell) => {
              const traits = traitsOf(spell);
              const description = textDescription(spell.description);
              const limit = cardSize === 'poker' ? 210 : 300;
              const excerpt = !fullText && description.length > limit ? `${description.slice(0, limit - 3).trimEnd()}…` : description;
              const details = [
                [t('spell.cast'), spell.time], [t('spell.range'), spell.range], [t('spell.target'), spell.target],
                [t('spell.area'), spell.area], [t('tarot.defense'), spell.defense], [t('spell.duration'), spell.duration]
              ].filter(([, value]) => value);
              return (
                <article className="tarot-card" key={spell.id}>
                  <div className="tarot-card-inner">
                    <div className="tarot-kicker">✦ &nbsp; PF2E · {traits.includes('cantrip') ? t('tarot.cantrip') : t('tarot.rank', { rank: spell.rank })} &nbsp; ✦</div>
                    <div className="tarot-art"><img src={resolveSpellIcon(spell.img)} alt="" /></div>
                    <h2>{spell.name}</h2>
                    <div className="tarot-traits">{traits.join(' · ') || t('tarot.spell')}</div>
                    <div className="tarot-rule">✧</div>
                    <div className="tarot-details">{details.map(([label, value]) => <div key={label}><b>{label}:</b> {value}</div>)}</div>
                    <p className="tarot-description">{excerpt}</p>
                    <div className="tarot-footer">✦ &nbsp; {excerpt.length < description.length ? t('tarot.summaryFooter') : t('tarot.compendiumFooter')} &nbsp; ✦</div>
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
