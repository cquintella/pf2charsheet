import React, { useRef, useState } from 'react';
import { EquipmentItem, SpellItem } from '../types/pf2e';
import { CatalogEntryInput, saveCatalogEntry } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';
import { ITEM_TYPES, itemTypeLabel } from '../utils/weapon';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceSelector } from './SourceSelector';

type Kind = 'spell' | 'equipment';
interface Props { kind: Kind; entry: SpellItem | EquipmentItem | null; onClose: () => void; onSaved: () => void }
interface Form { name: string; level: string; rarity: string; traits: string; source: string; description: string; systemJson: string; itemType: string; price: string; bulk: string; category: string; traditions: string[]; time: string; range: string; target: string; area: string; duration: string; defense: string }
function list(value: string | undefined): string[] { try { const result: unknown = JSON.parse(value || '[]'); return Array.isArray(result) ? result.filter((item): item is string => typeof item === 'string') : []; } catch { return []; } }
export const CatalogEditorModal: React.FC<Props> = ({ kind, entry, onClose, onSaved }) => {
  const { t } = useI18n();
  const spell = kind === 'spell' ? entry as SpellItem | null : null;
  const item = kind === 'equipment' ? entry as EquipmentItem | null : null;
  const [form, setForm] = useState<Form>(() => ({ name: entry?.name || '', level: String(spell?.rank ?? item?.level ?? 1), rarity: entry?.rarity || 'common', traits: list(entry?.traits).join(', '), source: entry?.source || '', description: entry?.description || '', systemJson: entry?.system_json || '{}', itemType: item?.item_type || 'equipment', price: item?.price || '', bulk: item?.bulk || '', category: spell?.category || 'spell', traditions: list(spell?.traditions), time: spell?.time || '', range: spell?.range || '', target: spell?.target || '', area: spell?.area || '', duration: spell?.duration || '', defense: spell?.defense || '' }));
  const initial = useRef(JSON.stringify(form));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const requestClose = () => { if (saving) return; if (JSON.stringify(form) !== initial.current) setConfirmClose(true); else onClose(); };
  useModalFocus(modalRef, requestClose, !confirmClose);
  const field = 'w-full rounded-lg border border-border-strong bg-inset px-3 py-2 text-text-primary';
  const set = (key: keyof Form, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(false);
    const data: CatalogEntryInput = { name: form.name.trim(), level: Number(form.level), rarity: form.rarity, traits: form.traits.split(',').map(x => x.trim()).filter(Boolean), description: form.description, source: form.source, systemJson: form.systemJson, itemType: form.itemType, price: form.price, bulk: form.bulk, category: form.category, traditions: form.traditions, time: form.time, range: form.range, target: form.target, area: form.area, duration: form.duration, defense: form.defense };
    try { await saveCatalogEntry(kind, data, entry?.id); onSaved(); } catch { setError(true); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl">
      <h2 id="catalog-editor-title" className="text-xl font-bold text-text-primary">{t(kind === 'spell' ? entry ? 'catalogEditor.editSpell' : 'catalogEditor.newSpell' : entry ? 'catalogEditor.editItem' : 'catalogEditor.newItem')}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <p role="alert" className="text-status-danger">{t('catalogEditor.saveError')}</p>}
        <label className="block space-y-1"><span>{t('featEditor.name')}</span><input required maxLength={200} className={field} value={form.name} onChange={e => set('name',e.target.value)} /></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1"><span>{t(kind === 'spell' ? 'catalogEditor.rank' : 'featEditor.level')}</span><input type="number" required min={0} max={kind === 'spell' ? 10 : 30} className={field} value={form.level} onChange={e => set('level',e.target.value)} /></label>
          <label className="space-y-1"><span>{t('filters.rarity')}</span><select className={field} value={form.rarity} onChange={e => set('rarity',e.target.value)}>{(['common','uncommon','rare','unique'] as const).map(rarity => <option key={rarity} value={rarity}>{t(`rarity.${rarity}`)}</option>)}</select></label>
          <label className="space-y-1"><span>{t('featEditor.source')}</span><SourceSelector className={field} value={form.source} onChange={value => set('source', value)} /></label>
          {kind === 'equipment' ? <>
            <label className="space-y-1"><span>{t('inventory.typeLabel')}</span><select className={field} disabled={Boolean(entry)} value={form.itemType} onChange={e => set('itemType',e.target.value)}>{ITEM_TYPES.map(type => <option key={type} value={type}>{itemTypeLabel(t,type)}</option>)}</select></label>
            <label className="space-y-1"><span>{t('item.price')}</span><input className={field} value={form.price} onChange={e => set('price',e.target.value)} /></label>
            <label className="space-y-1"><span>{t('item.bulk')}</span><input className={field} value={form.bulk} onChange={e => set('bulk',e.target.value)} /></label>
          </> : <>
            <label className="space-y-1"><span>{t('catalogEditor.category')}</span><select className={field} value={form.category} onChange={e => set('category',e.target.value)}>{(['spell','cantrip','focus','ritual'] as const).map(category => <option key={category} value={category}>{t(`spell.category.${category}`)}</option>)}</select></label>
            {(['time','range','target','area','duration','defense'] as const).map(key => <label key={key} className="space-y-1"><span>{t(`catalogEditor.${key}`)}</span><input className={field} value={form[key]} onChange={e => set(key,e.target.value)} /></label>)}
          </>}
        </div>
        {kind === 'spell' && <fieldset><legend className="font-semibold">{t('catalogEditor.traditions')}</legend><div className="flex flex-wrap gap-3 mt-2">{(['arcane','divine','occult','primal'] as const).map(tradition => <label key={tradition} className="flex items-center gap-1"><input type="checkbox" checked={form.traditions.includes(tradition)} onChange={event => setForm(previous => ({ ...previous, traditions: event.target.checked ? [...previous.traditions,tradition] : previous.traditions.filter(value => value !== tradition) }))} />{t(`tradition.${tradition}`)}</label>)}</div></fieldset>}
        <label className="block space-y-1"><span>{t('featEditor.traits')}</span><input className={field} value={form.traits} onChange={e => set('traits',e.target.value)} /></label>
        <label className="block space-y-1"><span>{t('featEditor.description')}</span><textarea rows={6} className={field} value={form.description} onChange={e => set('description',e.target.value)} /></label>
        <details><summary className="cursor-pointer font-semibold text-accent-text">{t('catalogEditor.advanced')}</summary><p className="text-sm text-text-secondary my-2">{t('catalogEditor.advancedHint')}</p><textarea aria-label={t('catalogEditor.advanced')} rows={8} className={`${field} font-mono`} value={form.systemJson} onChange={e => set('systemJson',e.target.value)} /></details>
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={requestClose} className="rounded-lg bg-control px-4 py-2">{t('common.cancel')}</button><button type="submit" disabled={saving || !form.name.trim()} className="rounded-lg bg-accent px-4 py-2 font-bold text-accent-contrast disabled:opacity-50">{saving ? t('common.saving') : t('common.save')}</button></div>
      </form>
    </div>
    {confirmClose && <ConfirmDialog title={t('app.unsavedTitle')} message={t('featEditor.discardChanges')} confirmLabel={t('app.dontSave')} variant="danger" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />}
  </div>;
};
