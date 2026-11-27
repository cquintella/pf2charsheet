import React, { useEffect, useState } from 'react';
import { changeSource, createSource, deleteSource, fetchSourceRecords, SourceEdition, SourceRecord } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import { ConfirmDialog } from './ConfirmDialog';

export const SourcesView: React.FC = () => {
  const { t } = useI18n();
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [name, setName] = useState('');
  const [edition, setEdition] = useState<SourceEdition>('');
  const [editionFilter, setEditionFilter] = useState<SourceEdition | 'all'>('all');
  const [editing, setEditing] = useState<SourceRecord | null>(null);
  const [deleting, setDeleting] = useState<SourceRecord | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = async () => { setSources(await fetchSourceRecords()); };
  useEffect(() => { load().catch(() => setError(t('sources.loadError'))).finally(() => setLoading(false)); }, []);
  const clearForm = () => { setName(''); setEdition(''); setEditing(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || saving) return;
    if (sources.some(source => source.name !== editing?.name && source.name.localeCompare(value, undefined, { sensitivity: 'base' }) === 0)) { setError(t('sources.duplicate')); return; }
    setSaving(true); setError(''); setSuccess('');
    try { if (editing) await changeSource(editing.name, value, edition); else await createSource(value, edition); await load(); clearForm(); setSuccess(t('sources.saved')); }
    catch { setError(t('sources.saveError')); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleting || saving) return;
    setSaving(true); setError(''); setSuccess('');
    try { await deleteSource(deleting.name); if (editing?.name === deleting.name) clearForm(); setDeleting(null); await load(); setSuccess(t('sources.deleted')); }
    catch { setDeleting(null); setError(t('sources.deleteError')); }
    finally { setSaving(false); }
  };
  const editionOptions: SourceEdition[] = ['', '1e', '2e', '2r'];
  return <div className="space-y-4">
    {deleting && <ConfirmDialog title={t('sources.delete')} message={t('sources.deleteConfirm', { name: deleting.name })} variant="danger" confirmLabel={t('common.remove')} onCancel={() => setDeleting(null)} onConfirm={() => { void remove(); }} />}
    <section className="bg-surface border border-border-strong rounded-2xl p-5 space-y-3">
      <h1 className="text-xl font-bold text-text-primary">{t('sources.title')}</h1>
      <p className="text-text-secondary">{t('sources.hint')}</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[220px] space-y-1"><span className="block font-semibold">{t('sources.name')}</span><input required maxLength={200} value={name} onChange={event => setName(event.target.value)} className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2 text-text-primary" /></label>
        <label className="space-y-1"><span className="block font-semibold">{t('sources.edition')}</span><select value={edition} onChange={event => setEdition(event.target.value as SourceEdition)} className="rounded-lg border border-border-strong bg-inset px-3 py-2 text-text-primary">{editionOptions.map(value => <option key={value} value={value}>{t(`sources.edition.${value || 'unknown'}`)}</option>)}</select></label>
        {editing && <button type="button" onClick={clearForm} className="rounded-lg bg-control px-4 py-2">{t('common.cancel')}</button>}
        <button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-contrast disabled:opacity-50">{saving ? t('common.saving') : editing ? t('common.save') : t('sources.add')}</button>
      </form>
      {error && <p role="alert" className="text-status-danger">{error}</p>}
      {success && <p role="status" className="text-status-success">{success}</p>}
    </section>
    <section className="bg-surface border border-border-strong rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap gap-3"><label className="flex-1 min-w-[220px] block space-y-1"><span className="font-semibold">{t('sources.search')}</span><input value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2 text-text-primary" /></label><label className="space-y-1"><span className="block font-semibold">{t('sources.edition')}</span><select value={editionFilter} onChange={event => setEditionFilter(event.target.value as SourceEdition | 'all')} className="rounded-lg border border-border-strong bg-inset px-3 py-2 text-text-primary"><option value="all">{t('common.all')}</option>{editionOptions.map(value => <option key={value} value={value}>{t(`sources.edition.${value || 'unknown'}`)}</option>)}</select></label></div>
      {loading ? <p>{t('common.loading')}</p> : <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border-subtle">{sources.filter(source => (editionFilter === 'all' || source.edition === editionFilter) && source.name.toLowerCase().includes(search.trim().toLowerCase())).map(source => <li key={source.name} className="py-2 flex flex-wrap items-center justify-between gap-2 text-text-primary"><span>{source.name} <span className="text-text-secondary">· {t(`sources.edition.${source.edition || 'unknown'}`)}</span></span><span className="flex gap-2"><button type="button" onClick={() => { setEditing(source); setName(source.name); setEdition(source.edition); setError(''); setSuccess(''); }} className="rounded-lg bg-control px-3 py-1">{t('sources.edit')}</button><button type="button" onClick={() => setDeleting(source)} className="rounded-lg bg-status-danger-bg px-3 py-1 text-status-danger">{t('sources.delete')}</button></span></li>)}</ul>}
    </section>
  </div>;
};
