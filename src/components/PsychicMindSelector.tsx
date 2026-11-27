import React, { useEffect, useState } from 'react';
import { fetchFeats } from '../services/api';
import { FeatItem } from '../types/pf2e';
import { cleanDescriptionHtml } from '../utils/formatters';
import { parseConsciousMindCantrips } from '../utils/psychic';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  value: string;
  onChange: (id: string) => void;
  level: number;
  subconscious?: string;
}

export const PsychicMindSelector: React.FC<Props> = ({ value, onChange, level, subconscious }) => {
  const { t } = useI18n();
  const [options, setOptions] = useState<FeatItem[]>([]);
  const [features, setFeatures] = useState<FeatItem[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetchFeats({ search: '', category: 'classfeature', level: '1', max_level: 'all', action_type: 'all', actions: 'all', rarity: 'all', trait: 'psychic', limit: 200, offset: 0 })
      .then(result => {
        if (!active) return;
        if (result.total > result.feats.length) throw new Error('Incomplete psychic class feature catalog');
        const minds = result.feats.filter(feat => {
          try {
            const system = JSON.parse(feat.system_json || '{}') as { traits?: { otherTags?: string[] } };
            return system.traits?.otherTags?.includes('psychic-conscious-mind');
          } catch { return false; }
        }).sort((a, b) => a.name.localeCompare(b.name));
        setFeatures(result.feats);
        setOptions(minds);
        setError(minds.length === 0);
      }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const selected = options.find(mind => mind.id === value);
  const relatedFeatures = features.filter(feat => feat.name === subconscious || feat.name === 'Unleash Psyche' || feat.name === 'Psi Cantrips and Amps');
  const grantedSection = selected?.description.match(/<strong>Granted Spells<\/strong>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/i)?.[1] || '';
  const grantedSpells = Array.from(grantedSection.matchAll(/<li>\s*(\d+)(?:st|nd|rd|th):\s*@UUID\[[^\]]+\]\{([^}]+)\}/gi))
    .map(match => ({ rank: Number(match[1]), name: match[2] }))
    .filter(spell => spell.rank <= Math.ceil(level / 2));
  const { standardCantrips, uniqueCantrips } = selected
    ? parseConsciousMindCantrips(selected.description, level)
    : { standardCantrips: [], uniqueCantrips: [] };
  return <div className="bg-elevated border border-border-strong rounded-xl p-4 space-y-3">
    {subconscious && <p className="text-sm text-text-secondary"><strong>{t('creator.subconsciousMind')}:</strong> {subconscious}</p>}
    <label className="block text-sm font-bold text-text-primary" htmlFor="psychic-conscious-mind">{t('psychic.consciousMind')}</label>
    <select id="psychic-conscious-mind" value={value} onChange={event => onChange(event.target.value)} className="w-full bg-inset border border-border-strong rounded-lg px-3 py-2 text-text-primary">
      <option value="">{error ? t('psychic.loadError') : t('psychic.selectConscious')}</option>
      {value && !selected && <option value={value}>{value}</option>}
      {options.map(mind => <option key={mind.id} value={mind.id}>{mind.name}</option>)}
    </select>
    {!value && <p className="text-sm text-status-warn">{t('psychic.pending')}</p>}
    {grantedSpells.length > 0 && <div className="text-sm text-text-secondary"><strong>{t('psychic.availableSpells')}</strong><ul className="list-disc ml-5">{grantedSpells.map(spell => <li key={`${spell.rank}-${spell.name}`}>{t('sheet.spells.rankLabel', { rank: spell.rank })}: {spell.name}</li>)}</ul></div>}
    {standardCantrips.length + uniqueCantrips.length > 0 && <div className="text-sm text-text-secondary"><strong>{t('psychic.availableCantrips')}</strong><ul className="list-disc ml-5">{[...standardCantrips, ...uniqueCantrips].map(name => <li key={name}>{name}</li>)}</ul></div>}
    {selected && <details>
      <summary className="cursor-pointer text-accent-text font-semibold">{t('psychic.grants')}</summary>
      <p className="text-sm text-text-secondary mt-2">{t('psychic.grantsHint', { level })}</p>
      <div className="pf-prose text-sm text-text-secondary mt-2" dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(selected.description, { actorLevel: level }) }} />
    </details>}
    {relatedFeatures.map(feature => <details key={feature.id}>
      <summary className="cursor-pointer text-accent-text font-semibold">{feature.name}</summary>
      <div className="pf-prose text-sm text-text-secondary mt-2" dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(feature.description, { actorLevel: level }) }} />
    </details>)}
  </div>;
};
