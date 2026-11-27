import React, { useEffect, useState } from 'react';
import { fetchSources } from '../services/api';
import { useI18n } from '../i18n/I18nContext';

interface Props { value: string; onChange: (value: string) => void; className: string }

export const SourceSelector: React.FC<Props> = ({ value, onChange, className }) => {
  const { t } = useI18n();
  const [sources, setSources] = useState<string[] | null>(null);
  const [custom, setCustom] = useState(false);
  useEffect(() => {
    let active = true;
    fetchSources().then(items => { if (active) setSources(items); }).catch(() => { if (active) setSources([]); });
    return () => { active = false; };
  }, []);
  if (custom || !sources?.length) return <div className="space-y-1"><input className={className} value={value} onChange={event => onChange(event.target.value)} />{custom && sources && sources.length > 0 && <button type="button" className="text-accent-text underline" onClick={() => { setCustom(false); onChange(''); }}>{t('source.chooseExisting')}</button>}</div>;
  return <select className={className} value={value} onChange={event => {
    if (event.target.value === '__new_source__') { setCustom(true); onChange(''); }
    else onChange(event.target.value);
  }}>
    <option value="">{t('source.none')}</option>
    {value && !sources.includes(value) && <option value={value}>{value}</option>}
    {sources.map(source => <option key={source} value={source}>{source}</option>)}
    <option value="__new_source__">{t('source.add')}</option>
  </select>;
};
