import React, { useRef, useState } from 'react';
import { FeatItem } from '../types/pf2e';
import { FeatInput, saveFeat } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceSelector } from './SourceSelector';

interface Props {
  feat: FeatItem | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  category: string;
  level: string;
  rarity: string;
  actionType: string;
  actions: string;
  traits: string;
  prerequisites: string;
  description: string;
  source: string;
}

function parseList(value: string, prerequisite = false): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (typeof item === 'string') return [item];
      if (prerequisite && item && typeof item === 'object' && 'value' in item && typeof item.value === 'string') return [item.value];
      return [];
    });
  } catch { return []; }
}

export const FeatEditorModal: React.FC<Props> = ({ feat, onClose, onSaved }) => {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => ({
    name: feat?.name || '', category: feat?.category || 'class', level: String(feat?.level ?? 1),
    rarity: feat?.rarity || 'common', actionType: feat?.action_type || 'passive', actions: feat?.actions || '1',
    traits: parseList(feat?.traits || '').join(', '), prerequisites: parseList(feat?.prerequisites || '', true).join('\n'),
    description: feat?.description || '', source: feat?.source || '',
  }));
  const initial = useRef(JSON.stringify(form));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const requestClose = () => { if (saving) return; if (JSON.stringify(form) !== initial.current) setConfirmClose(true); else onClose(); };
  useModalFocus(ref, requestClose, !confirmClose);
  const field = 'w-full rounded-lg border border-border-strong bg-inset px-3 py-2 text-text-primary';
  const set = (key: keyof FormState, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(false);
    const data: FeatInput = {
      name: form.name.trim(), category: form.category, level: Number(form.level), rarity: form.rarity,
      action_type: form.actionType, actions: form.actions, traits: form.traits.split(',').map(item => item.trim()).filter(Boolean),
      prerequisites: form.prerequisites.split('\n').map(item => item.trim()).filter(Boolean), description: form.description, source: form.source,
    };
    try { await saveFeat(data, feat?.id); onSaved(); }
    catch { setError(true); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="feat-editor-title" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl">
      <h2 id="feat-editor-title" className="text-xl font-bold text-text-primary">{t(feat ? 'featEditor.edit' : 'featEditor.create')}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <p role="alert" className="text-status-danger">{t('featEditor.saveError')}</p>}
        <label className="block space-y-1"><span>{t('featEditor.name')}</span><input required maxLength={200} className={field} value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1"><span>{t('featEditor.category')}</span><select className={field} value={form.category} onChange={e => set('category', e.target.value)}>{(['class', 'ancestry', 'skill', 'general', 'classfeature', 'ancestryfeature', 'calling', 'bonus'] as const).map(category => <option key={category} value={category}>{t(`featCategory.${category}`)}</option>)}</select></label>
          <label className="space-y-1"><span>{t('featEditor.level')}</span><input type="number" required min={0} max={20} className={field} value={form.level} onChange={e => set('level', e.target.value)} /></label>
          <label className="space-y-1"><span>{t('filters.rarity')}</span><select className={field} value={form.rarity} onChange={e => set('rarity', e.target.value)}>{(['common','uncommon','rare','unique'] as const).map(rarity => <option key={rarity} value={rarity}>{t(`rarity.${rarity}`)}</option>)}</select></label>
          <label className="space-y-1"><span>{t('featEditor.actionType')}</span><select className={field} value={form.actionType} onChange={e => set('actionType', e.target.value)}>{(['passive','action','reaction','free'] as const).map(type => <option key={type} value={type}>{t(`featEditor.action.${type}`)}</option>)}</select></label>
          {form.actionType === 'action' && <label className="space-y-1"><span>{t('featEditor.actionCount')}</span><select className={field} value={form.actions} onChange={e => set('actions', e.target.value)}>{['1','2','3'].map(count => <option key={count} value={count}>{count}</option>)}</select></label>}
          <label className="space-y-1"><span>{t('featEditor.source')}</span><SourceSelector className={field} value={form.source} onChange={value => set('source', value)} /></label>
        </div>
        <label className="block space-y-1"><span>{t('featEditor.traits')}</span><input className={field} value={form.traits} onChange={e => set('traits', e.target.value)} /></label>
        <label className="block space-y-1"><span>{t('featEditor.prerequisites')}</span><textarea rows={3} className={field} value={form.prerequisites} onChange={e => set('prerequisites', e.target.value)} /></label>
        <label className="block space-y-1"><span>{t('featEditor.description')}</span><textarea rows={8} className={field} value={form.description} onChange={e => set('description', e.target.value)} /></label>
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={requestClose} className="rounded-lg bg-control px-4 py-2">{t('common.cancel')}</button><button type="submit" disabled={saving || !form.name.trim()} className="rounded-lg bg-accent px-4 py-2 font-bold text-accent-contrast disabled:opacity-50">{saving ? t('common.saving') : t('common.save')}</button></div>
      </form>
    </div>
    {confirmClose && <ConfirmDialog title={t('app.unsavedTitle')} message={t('featEditor.discardChanges')} confirmLabel={t('app.dontSave')} variant="danger" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />}
  </div>;
};
