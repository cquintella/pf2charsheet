import React, { useEffect, useState } from 'react';
import { CharacterInventory, EquipmentItem, InventoryEntry } from '../types/pf2e';
import { ITEM_TYPES, itemTypeLabel, weaponDamage } from '../utils/weapon';
import { useI18n } from '../i18n/I18nContext';
import { fetchEquipment } from '../services/api';
import { cleanDescriptionHtml } from '../utils/formatters';

interface Props {
  inventory: CharacterInventory;
  onChange: (inventory: CharacterInventory) => void;
}

const inputClass = 'bg-inset border border-border-strong rounded-lg px-2 py-1.5 text-sm text-white';

export const InventoryView: React.FC<Props> = ({ inventory, onChange }) => {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [initial, setInitial] = useState('');
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<EquipmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<EquipmentItem | null>(null);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detail]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchEquipment(search, type, page * 40, { initial }).then(data => {
        if (active) { setResults(data.items); setTotal(data.total); setError(false); }
      }).catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, type, page, initial]);

  const add = (item: EquipmentItem) => {
    const existing = inventory.items.find(entry => entry.item.id === item.id && item.item_type !== 'custom');
    if (existing) {
      onChange({ ...inventory, items: inventory.items.map(entry => entry.id === existing.id ? { ...entry, quantity: entry.quantity + 1 } : entry) });
    } else {
      onChange({ ...inventory, items: [...inventory.items, { id: crypto.randomUUID(), item, quantity: 1, equipped: false }] });
    }
  };
  const update = (id: string, patch: Partial<InventoryEntry>) => onChange({ ...inventory, items: inventory.items.map(entry => entry.id === id ? { ...entry, ...patch } : entry) });

  return <section className="bg-surface border border-border-strong rounded-2xl p-5 space-y-5">
    <h3 className="text-lg font-bold text-white">{t('inventory.title')}</h3>
    <div className="flex flex-wrap gap-3">
      {(['pp', 'gp', 'sp', 'cp'] as const).map(key => <label key={key} className="text-xs text-text-secondary flex flex-col gap-1">{t(`coin.${key}`)}
        <input aria-label={t('inventory.coinsOf', { coin: t(`coin.${key}`) })} type="number" min="0" step="1" className={`${inputClass} w-24`} value={inventory.coins[key]} onChange={event => onChange({ ...inventory, coins: { ...inventory.coins, [key]: Math.max(0, Math.floor(Number(event.target.value) || 0)) } })} />
      </label>)}
    </div>
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-white">{t('inventory.carried')}</h4>
      {inventory.items.length === 0 && <p className="text-xs text-text-secondary">{t('inventory.empty')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {inventory.items.map(entry => (
          <div key={entry.id} className="bg-inset border border-border-strong rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="text-left text-sm font-semibold text-accent-text hover:underline min-w-0 truncate flex-1" onClick={() => setDetail(entry.item)}>
                {entry.item.name}
              </button>
              <label className="text-xs text-text-secondary flex items-center gap-1.5 flex-shrink-0">
                <span>{t('inventory.qty')}</span>
                <input
                  aria-label={t('inventory.qtyOf', { name: entry.item.name })}
                  type="number"
                  min="1"
                  step="1"
                  className={`${inputClass} w-16 tabular-nums`}
                  value={entry.quantity}
                  onChange={event => update(entry.id, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border-subtle text-xs">
              <span className="text-text-muted truncate">
                {entry.item.item_type === 'custom' ? t('inventory.customItem') : itemTypeLabel(t, entry.item.item_type)}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <label className="text-text-primary flex gap-1.5 items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.equipped}
                    onChange={event => {
                      const equipped = event.target.checked;
                      if (equipped && entry.item.item_type === 'armor') {
                        onChange({ ...inventory, items: inventory.items.map(item => item.item.item_type === 'armor' ? { ...item, equipped: item.id === entry.id } : item) });
                      } else {
                        update(entry.id, { equipped });
                      }
                    }}
                  />
                  <span>{t('inventory.equipped')}</span>
                </label>
                <button
                  type="button"
                  className="text-status-danger hover:underline"
                  onClick={() => onChange({ ...inventory, items: inventory.items.filter(item => item.id !== entry.id) })}
                >
                  {t('common.remove')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-border-strong pt-4 space-y-3 print:hidden">
      <h4 className="font-semibold text-sm text-white">{t('inventory.addFromCompendium')}</h4>
      <div className="flex flex-wrap gap-2"><input className={`${inputClass} flex-1 min-w-[180px]`} placeholder={t('inventory.searchPlaceholder')} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /><select aria-label={t('inventory.typeLabel')} className={inputClass} value={type} onChange={event => { setType(event.target.value); setPage(0); }}><option value="all">{t('spellFilters.allTypes')}</option>{ITEM_TYPES.map(key => <option value={key} key={key}>{itemTypeLabel(t, key)}</option>)}</select></div>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('inventory.byInitial')}>
        {['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(letter => <button key={letter || 'all'} type="button" aria-pressed={initial === letter} onClick={() => { setInitial(letter); setPage(0); }} className={`min-w-[28px] h-7 px-1.5 rounded border text-[11px] font-bold ${initial === letter ? 'bg-accent border-accent text-accent-contrast' : 'bg-inset border-border-strong text-text-secondary hover:text-white'}`}>{letter || t('common.allFem')}</button>)}
      </div>
      {error && <p role="alert" className="text-xs text-status-danger">{t('inventory.loadError')}</p>}
      {loading ? <p className="text-xs text-text-secondary">{t('common.loading')}</p> : <div className="max-h-64 overflow-y-auto space-y-1">{results.map(item => <div key={item.id} className="flex items-center justify-between gap-2 bg-inset rounded-lg px-3 py-2 text-xs"><button type="button" className="text-left text-text-primary min-w-0 truncate" onClick={() => setDetail(item)}>{item.name} <span className="text-text-secondary">· {itemTypeLabel(t, item.item_type)} · {t('common.levelShort', { level: item.level })} · {item.price || t('inventory.noPrice')}</span></button><button type="button" className="text-accent-text font-bold flex-shrink-0" onClick={() => add(item)}>{t('spellbook.add')}</button></div>)}{results.length === 0 && <p className="text-xs text-text-secondary">{t('inventory.noResults')}</p>}</div>}
      <div className="flex items-center gap-3 text-xs text-text-secondary"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">{t('common.previous')}</button><span>{total ? t('common.rangeOf', { from: page * 40 + 1, to: Math.min((page + 1) * 40, total), total }) : t('common.noResults')}</span><button disabled={(page + 1) * 40 >= total || loading} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">{t('common.next')}</button></div>
      <div className="flex gap-2"><input className={`${inputClass} flex-1`} value={customName} placeholder={t('inventory.customPlaceholder')} onChange={event => setCustomName(event.target.value)} /><button type="button" className="px-3 rounded-lg bg-control text-xs text-white" onClick={() => { const name = customName.trim(); if (!name) return; add({ id: crypto.randomUUID(), name, item_type: 'custom', level: 0, price: '', bulk: '', description: '', system_json: '{}' }); setCustomName(''); }}>{t('inventory.addItem')}</button></div>
    </div>
    {detail && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={detail.name}><div className="bg-surface border border-border-strong rounded-xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-3"><div className="flex justify-between gap-3"><h4 className="text-lg font-bold text-white">{detail.name}</h4><button type="button" onClick={() => setDetail(null)} className="text-text-primary">{t('common.close')}</button></div>{weaponDamage(detail, t) && <p className="text-sm font-semibold text-accent-text">{weaponDamage(detail, t)}</p>}<p className="text-xs text-text-secondary">{detail.item_type === 'custom' ? t('inventory.customItem') : itemTypeLabel(t, detail.item_type)} · {t('common.level', { level: detail.level })} · {t('item.price')}: {detail.price || '—'} · {t('item.bulk')}: {detail.bulk || '—'}</p><div className="pf-prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: cleanDescriptionHtml(detail.description || '') }} /></div></div>}
  </section>;
};
