import React, { useState } from 'react';
import { AttributeKey, CharacterStrike, InventoryEntry, ClassItem } from '../types/pf2e';
import { calculateWeaponStrike } from '../utils/strikeCalculation';
import { ProficiencySelector } from './ProficiencySelector';
import { getProficiencyBonus } from '../utils/formatters';
import { Plus, Trash2, Edit3, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { attributeShort } from '../i18n/gameTerms';

interface Props {
  strikes: CharacterStrike[];
  attributes: Record<AttributeKey, number>;
  inventory: InventoryEntry[];
  characterClass: ClassItem | null;
  level: number;
  strAttackPenalty?: number;
  dexAttackPenalty?: number;
  strDamagePenalty?: number;
  onChange: (strikes: CharacterStrike[]) => void;
}
const field = 'w-full min-w-0 rounded-lg border border-border-strong bg-inset px-2 py-1.5 text-sm text-white';
const label = 'text-[11px] font-semibold text-text-secondary uppercase space-y-1';
const signed = (value: number) => value >= 0 ? `+${value}` : String(value);

export const StrikesView: React.FC<Props> = ({
  strikes,
  attributes,
  inventory,
  characterClass,
  level,
  strAttackPenalty = 0,
  dexAttackPenalty = 0,
  strDamagePenalty = 0,
  onChange,
}) => {
  const { t } = useI18n();
  const [editingIds, setEditingIds] = useState<Set<string>>(() => new Set());
  const toggleEdit = (id: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const update = (id: string, patch: Partial<CharacterStrike>) => onChange(strikes.map(strike => strike.id === id ? { ...strike, ...patch } : strike));
  const add = (kind: CharacterStrike['kind']) => {
    const id = crypto.randomUUID();
    setEditingIds(prev => new Set(prev).add(id));
    onChange([...strikes, { id, kind, weapon: '', attribute: kind === 'melee' ? 'str' : 'dex', proficiency: 0, itemBonus: 0, dice: '', strengthDamage: 0, damageType: '', otherDamage: 0, traits: '' }]);
  };
  const weapons = inventory.filter(entry => entry.item.item_type === 'weapon');
  const numberValue = (value: string) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;

  return <section className="space-y-3">
    {(['melee', 'ranged'] as const).map(kind => <div key={kind} className="bg-surface border border-border-strong rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-white">{kind === 'melee' ? t('strikes.melee') : t('strikes.ranged')}</h3><button type="button" onClick={() => add(kind)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-control hover:bg-control-hover text-xs font-semibold text-white"><Plus className="w-4 h-4" /> {t('spellbook.add')}</button></div>
      {strikes.filter(strike => strike.kind === kind).length === 0 && <p className="text-xs text-text-secondary">{t('strikes.none')}</p>}
      {strikes.filter(strike => strike.kind === kind).map(strike => {
        const legacyMatches = !strike.inventoryEntryId && strike.weapon ? weapons.filter(entry => entry.item.name === strike.weapon) : [];
        const selectedId = strike.inventoryEntryId || (legacyMatches.length === 1 ? legacyMatches[0].id : '');
        const missingWeapon = selectedId ? !weapons.some(entry => entry.id === selectedId) : Boolean(strike.weapon);
        const selectedWeapon = weapons.find(entry => entry.id === selectedId);
        const weaponData = selectedWeapon ? calculateWeaponStrike(selectedWeapon.item, kind, attributes.str, characterClass) : null;
        const itemBonus = weaponData?.itemBonus ?? strike.itemBonus;
        const dice = weaponData?.dice ?? strike.dice;
        const strengthDamage = weaponData?.strengthDamage ?? strike.strengthDamage;
        const damageType = weaponData ? (strike.damageTypeOverride && weaponData.damageTypes.includes(strike.damageTypeOverride) ? strike.damageTypeOverride : weaponData.damageType) : strike.damageType;
        const traitsList = weaponData ? weaponData.traits : strike.traits.split(',').map(s => s.trim()).filter(Boolean);
        const isAgile = traitsList.some(tr => tr.toLowerCase() === 'agile');
        const mapStep = isAgile ? 4 : 5;
        const penalty = strike.attribute === 'str' ? strAttackPenalty : dexAttackPenalty;
        const attack = attributes[strike.attribute] + getProficiencyBonus(strike.proficiency, level) + itemBonus + penalty;
        const totalDamageMod = strengthDamage + strike.otherDamage + (kind === 'melee' ? strDamagePenalty : 0);
        const isEditing = editingIds.has(strike.id) || !strike.weapon;

        return <div key={strike.id} className="bg-inset border border-border-strong rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <span className="font-bold text-sm text-text-primary">{strike.weapon || t('strikes.unnamed')}</span>
              <span className="text-sm font-black text-accent-text tabular-nums">{signed(attack)}</span>
              <span className="text-xs font-semibold text-text-secondary bg-elevated px-2 py-0.5 rounded border border-border-subtle tabular-nums">
                {t('strikes.map')}: {signed(attack)} / {signed(attack - mapStep)} / {signed(attack - mapStep * 2)}
              </span>
              <span className="text-xs font-semibold text-text-primary tabular-nums">
                {dice || '—'}{totalDamageMod !== 0 ? signed(totalDamageMod) : ''} {damageType}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleEdit(strike.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated hover:bg-control text-xs font-semibold text-text-secondary border border-border-subtle"
              >
                {isEditing ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditing ? t('strikes.done') : t('strikes.edit')}</span>
              </button>
              <button type="button" onClick={() => onChange(strikes.filter(item => item.id !== strike.id))} aria-label={t('strikes.remove', { name: strike.weapon || t('strikes.unnamed') })} className="text-status-danger p-1.5 rounded-lg hover:bg-status-danger-bg/40"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          {traitsList.length > 0 && !isEditing && (
            <div className="flex flex-wrap gap-1">
              {traitsList.map(tr => (
                <span key={tr} className="text-[11px] uppercase px-2 py-0.5 rounded-full bg-elevated text-text-secondary border border-border-subtle">
                  {tr}
                </span>
              ))}
            </div>
          )}

          {isEditing && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-border-subtle">
              <label className={`${label} sm:col-span-2`}>{t('strikes.weapon')}
                <select className={field} value={missingWeapon ? '__missing__' : selectedId} onChange={event => {
                  const weapon = weapons.find(entry => entry.id === event.target.value);
                  const data = weapon ? calculateWeaponStrike(weapon.item, kind, attributes.str, characterClass) : null;
                  update(strike.id, { inventoryEntryId: weapon?.id, weapon: weapon?.item.name || '', damageTypeOverride: undefined, ...(data?.proficiency !== null && data?.proficiency !== undefined ? { proficiency: data.proficiency } : {}) });
                }}>
                  <option value="">{t('strikes.selectWeapon')}</option>
                  {missingWeapon && <option value="__missing__" disabled>{strike.weapon || t('strikes.weaponFallback')} — {t('strikes.notLinked')}</option>}
                  {weapons.map(entry => <option key={entry.id} value={entry.id}>{entry.item.name}{entry.equipped ? ` (${t('strikes.equipped')})` : ''}</option>)}
                </select>
                {weapons.length === 0 && <span className="block normal-case text-text-secondary">{t('strikes.addWeaponHint')}</span>}
              </label>
              <label className={label}>{attributeShort(t, 'str')} / {attributeShort(t, 'dex')}<select className={field} value={strike.attribute} onChange={e => update(strike.id, { attribute: e.target.value as 'str' | 'dex' })}><option value="str">{attributeShort(t, 'str')} ({signed(attributes.str)})</option><option value="dex">{attributeShort(t, 'dex')} ({signed(attributes.dex)})</option></select></label>
              <ProficiencySelector label={t('strikes.proficiency')} value={strike.proficiency} onChange={proficiency => update(strike.id, { proficiency })} />
              <label className={label}>{t('strikes.itemBonus')}<input type="number" step="1" className={field} value={itemBonus} readOnly={!!weaponData} onChange={e => update(strike.id, { itemBonus: numberValue(e.target.value) })} /></label>
              <label className={label}>{t('strikes.dice')}<input className={field} placeholder="1d8" value={dice} readOnly={!!weaponData} onChange={e => update(strike.id, { dice: e.target.value })} /></label>
              <label className={label}>{t('strikes.strDamage', { str: attributeShort(t, 'str') })}<input type="number" step="1" className={field} value={strengthDamage} readOnly={!!weaponData} onChange={e => update(strike.id, { strengthDamage: numberValue(e.target.value) })} /></label>
              <label className={label}>{t('strikes.damageType')}<select className={field} value={damageType} onChange={e => update(strike.id, weaponData ? { damageTypeOverride: e.target.value } : { damageType: e.target.value })}><option value="">{t('creator.select')}</option>{(weaponData ? weaponData.damageTypes : ['B', 'P', 'S']).map(type => <option key={type} value={type}>{type === 'B' || type === 'P' || type === 'S' ? t(`strikes.damage.${type}`) : type}</option>)}</select></label>
              <label className={label}>{t('strikes.other')}<input type="number" step="1" className={field} value={strike.otherDamage} onChange={e => update(strike.id, { otherDamage: numberValue(e.target.value) })} /></label>
              <label className={`${label} sm:col-span-2`}>{t('common.traits')}<input className={field} value={weaponData ? weaponData.traits.join(', ') : strike.traits} readOnly={!!weaponData} onChange={e => update(strike.id, { traits: e.target.value })} /></label>
            </div>
          )}
          {selectedWeapon && !weaponData && <p className="text-xs text-status-warn">{t('strikes.incomplete')}</p>}
        </div>;
      })}
      <p className="text-xs text-text-muted pt-2 border-t border-border-subtle">{t('strikes.hint')}</p>
    </div>)}
  </section>;
};
