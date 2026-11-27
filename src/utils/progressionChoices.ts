import { FeatItem, FeatSelectionRecord, LevelProgressionData } from '../types/pf2e';
import type { RuleContext } from './featRules';
import { evaluatePrerequisites } from './featRules';

interface CatalogRule {
  key?: string;
  flag?: string;
  choices?: { filter?: unknown[] };
  uuid?: string;
  predicate?: unknown;
}

interface DruidOrder {
  item: FeatItem;
  grant: FeatItem | undefined;
}

export interface OracleMystery {
  item: FeatItem;
  curse?: FeatItem;
}

interface ChoiceDefinition {
  flag: string;
  kind: 'order' | 'feat' | 'membership' | 'mystery' | 'patron' | 'bloodline' | 'consciousMind' | 'muse' | 'swashbucklerStyle' | 'skillFeat' | 'instinct' | 'cause' | 'way' | 'innovation' | 'implement' | 'kineticGate';
  maxLevel?: number;
  trait?: string;
}

export interface ProgressionChoice {
  path: string;
  kind: ChoiceDefinition['kind'];
  options: FeatItem[];
  selection?: FeatItem;
  grant?: FeatItem;
  extraGrants?: FeatItem[];
  unverified?: boolean;
}

interface Acquisition {
  level: number;
  slot: string;
  feat: FeatSelectionRecord;
}

interface ResolveContext {
  orders: Set<string>;
  requireInitialOrder: boolean;
  missingDedicationOrder: boolean;
  reservedOrders: ReadonlySet<string>;
  feats: FeatSelectionRecord[];
  grants: Acquisition[];
  rulesAt: (level: number, excludedSlot: string, grants: Acquisition[]) => Pick<RuleContext, 'attributes' | 'skills'>;
}

export class ProgressionChoiceCatalog {
  static readonly orderExplorerId = '9onf3uGvZRnNLPR6';
  static readonly basicWildingId = 'kUa8PBjKmBk04zmc';
  static readonly druidDedicationId = 'vhw3n86TEs6laopA';
  static readonly oracleDedicationId = 'OUNj8nXTHwGcEdlh';
  static readonly oracularCurseId = 'ibX2EhKkyUtbOHLj';
  static readonly witchDedicationId = 'y0vdu6DGhKKElmE6';
  static readonly sorcererDedicationId = '5UQagWB13Z8xR5Z6';
  static readonly psychicDedicationId = 'OW3W2vMARiojda7e';
  static readonly bardDedicationId = 'dIH771mt4PcVTyAs';
  static readonly wizardDedicationId = 'oQ6EZRFXbHWCx08C';
  static readonly clericDedicationId = 'smCDaPlpRDA47xjK';
  static readonly fighterDedicationId = 'mvNa9KfQooHYEXoA';
  static readonly monkDedicationId = 'renUpSO6MJXPSXow';
  static readonly rogueDedicationId = 'bCWieNDC1CD35tin';
  static readonly swashbucklerDedicationId = 'eAlrvPVb8qt8Lruw';
  static readonly powerfulFistId = 'SB8UJ8rZmvbcBweJ';
  static readonly surpriseAttackId = 'w6rMqmGzhUahdnA7';
  static readonly panacheId = 'LzYi0OuOoypNb6jd';
  static readonly stylishCombatantId = 'TALz3cU06Hb14Key';
  static readonly barbarianDedicationId = 'WVU0c8rgcpGSRqSi';
  static readonly championDedicationId = '0YjetnLVIUz9zQt5';
  static readonly rangerDedicationId = 'R00qiDE5pBctgtyU';
  static readonly inventorDedicationId = 'JIpjpZ8VneQomkZw';
  static readonly inventorSkillFeatId = 'XR95taODq1sq82Du';
  static readonly thaumaturgeDedicationId = 'gQAQRHxpFKEkNQFs';
  static readonly kineticistDedicationId = 'CbfszeYw3cf99kdv';
  static readonly guardianDedicationId = 'zNInvTqZrDdNJAS7';
  static readonly alchemistDedicationId = 'CJMkxlxHiHZQYDCz';
  static readonly aldoriDuelistDedicationId = 'pI97a5xSg4LbBY1g';

  constructor(
    readonly orders: DruidOrder[],
    readonly feats: FeatItem[],
    readonly classTrait = '',
    readonly loadedTraits: readonly string[] = [],
    readonly mysteries: OracleMystery[] = [],
    readonly oracularCurse?: FeatItem,
    readonly tagOptions: Readonly<Partial<Record<'patron' | 'bloodline' | 'consciousMind' | 'muse' | 'swashbucklerStyle' | 'instinct' | 'cause' | 'way' | 'innovation' | 'implement' | 'kineticGate', FeatItem[]>>> = {},
    readonly skillFeats: FeatItem[] = [],
    readonly classFeaturesById: Readonly<Record<string, FeatItem>> = {},
  ) {}

  static rules(systemJson?: string): CatalogRule[] {
    try {
      const rules: unknown = JSON.parse(systemJson || '{}').rules;
      return Array.isArray(rules) ? rules.filter(rule => rule && typeof rule === 'object') : [];
    } catch {
      return [];
    }
  }

  static isOrder(item: FeatItem): boolean {
    try {
      const tags: unknown = JSON.parse(item.system_json).traits?.otherTags;
      return Array.isArray(tags) && tags.includes('druid-order') && !tags.includes('class-archetype');
    } catch {
      return false;
    }
  }

  static orderGrantId(item: FeatItem): string | undefined {
    const rule = ProgressionChoiceCatalog.rules(item.system_json).find(rule => rule.key === 'GrantItem' && typeof rule.uuid === 'string');
    return rule?.uuid?.match(/^Compendium\.pf2e\.feats-srd\.Item\.([A-Za-z0-9]+)$/)?.[1];
  }

  static hasOtherTag(item: FeatItem, tag: string): boolean {
    try {
      const tags: unknown = JSON.parse(item.system_json).traits?.otherTags;
      return Array.isArray(tags) && tags.includes(tag) && !tags.includes('class-archetype');
    } catch {
      return false;
    }
  }

  static isMystery(item: FeatItem): boolean {
    return ProgressionChoiceCatalog.hasOtherTag(item, 'oracle-mystery');
  }

  static mysteryCurseId(item: FeatItem): string | undefined {
    const rule = ProgressionChoiceCatalog.rules(item.system_json).find(rule =>
      rule.key === 'GrantItem' && !rule.predicate && typeof rule.uuid === 'string'
    );
    return rule?.uuid?.match(/^Compendium\.pf2e\.classfeatures\.Item\.([A-Za-z0-9]+)$/)?.[1];
  }

  static definition(feat: FeatSelectionRecord): ChoiceDefinition | undefined {
    if (feat.featName === 'Natural Ambition') return { flag: 'naturalAmbition', kind: 'feat', maxLevel: 1 };
    const isOrderExplorer = feat.featId === this.orderExplorerId || feat.featName === 'Order Explorer';
    const isBasicWilding = feat.featId === this.basicWildingId || feat.featName === 'Basic Wilding';
    if (feat.featId === this.druidDedicationId || feat.featName === 'Druid Dedication') {
      return { flag: 'druidicOrder', kind: 'membership' };
    }
    if (feat.featId === this.oracleDedicationId || feat.featName === 'Oracle Dedication') {
      return { flag: 'mystery', kind: 'mystery' };
    }
    if (feat.featId === this.witchDedicationId || feat.featName === 'Witch Dedication') {
      return { flag: 'patron', kind: 'patron' };
    }
    if (feat.featId === this.sorcererDedicationId || feat.featName === 'Sorcerer Dedication') {
      return { flag: 'bloodline', kind: 'bloodline' };
    }
    if (feat.featId === this.psychicDedicationId || feat.featName === 'Psychic Dedication') {
      return { flag: 'consciousMind', kind: 'consciousMind' };
    }
    if (feat.featId === this.bardDedicationId || feat.featName === 'Bard Dedication') {
      return { flag: 'dedicationMuse', kind: 'muse' };
    }
    if (feat.featId === this.swashbucklerDedicationId || feat.featName === 'Swashbuckler Dedication') {
      return { flag: 'swashbucklersStyle', kind: 'swashbucklerStyle' };
    }
    if (feat.featId === this.rogueDedicationId || feat.featName === 'Rogue Dedication') {
      return { flag: 'skillFeat', kind: 'skillFeat' };
    }
    if (feat.featId === this.barbarianDedicationId || feat.featName === 'Barbarian Dedication') {
      return { flag: 'instinct', kind: 'instinct' };
    }
    if (feat.featId === this.championDedicationId || feat.featName === 'Champion Dedication') {
      return { flag: 'cause', kind: 'cause' };
    }
    if (feat.featName === 'Gunslinger Dedication') {
      return { flag: 'way', kind: 'way' };
    }
    if (feat.featId === this.inventorDedicationId || feat.featName === 'Inventor Dedication') {
      return { flag: 'innovation', kind: 'innovation' };
    }
    if (feat.featId === this.thaumaturgeDedicationId || feat.featName === 'Thaumaturge Dedication') {
      return { flag: 'implement', kind: 'implement' };
    }
    if (feat.featId === this.kineticistDedicationId || feat.featName === 'Kineticist Dedication') {
      return { flag: 'elementOne', kind: 'kineticGate' };
    }
    if (!isOrderExplorer && !isBasicWilding) {
      const rules = this.rules(feat.system_json);
      const choice = rules.find(rule => rule.key === 'ChoiceSet' && rule.flag && Array.isArray(rule.choices?.filter) && rules.some(grant => grant.key === 'GrantItem' && grant.uuid === `{item|flags.system.rulesSelections.${rule.flag}}`));
      const filters = choice?.choices?.filter;
      if (!choice?.flag || !filters || !filters.includes('item:category:class')) return;
      const trait = filters.find((filter): filter is string => typeof filter === 'string' && /^item:trait:[a-z-]+$/.test(filter));
      const level = filters.find(filter => typeof filter === 'string' && /^item:level:\d+$/.test(filter));
      const cap = filters.find(filter => filter && typeof filter === 'object' && 'lte' in filter && Array.isArray(filter.lte) && filter.lte[0] === 'item:level' && typeof filter.lte[1] === 'number');
      if (!trait || filters.some(filter => typeof filter !== 'string' && filter !== cap)) return;
      return { flag: choice.flag, kind: 'feat', trait: trait.slice('item:trait:'.length), maxLevel: typeof level === 'string' ? Number(level.split(':')[2]) : cap && typeof cap === 'object' && 'lte' in cap && Array.isArray(cap.lte) ? cap.lte[1] as number : undefined };
    }
    const rules = this.rules(feat.system_json);
    const flag = isOrderExplorer ? 'order' : 'basicWilding';
    const choice = rules.find(rule => rule.key === 'ChoiceSet' && rule.flag === flag);
    const grant = rules.find(rule => rule.key === 'GrantItem' && rule.uuid === `{item|flags.system.rulesSelections.${flag}}`);
    // Old saves can open the choice before compendium data is hydrated.
    if (!choice || !grant) return isOrderExplorer ? { flag, kind: 'order' } : { flag, kind: 'feat', maxLevel: 2, trait: 'druid' };
    if (isOrderExplorer) return { flag, kind: 'order' };
    const filters = choice.choices?.filter || [];
    const cap = filters.find(filter => filter && typeof filter === 'object' && 'lte' in filter && Array.isArray(filter.lte) && filter.lte[0] === 'item:level');
    const maxLevel = cap && typeof cap === 'object' && 'lte' in cap && Array.isArray(cap.lte) && typeof cap.lte[1] === 'number' ? cap.lte[1] : 2;
    const trait = filters.find((filter): filter is string => typeof filter === 'string' && filter.startsWith('item:trait:'));
    return { flag, kind: 'feat', maxLevel, trait: trait?.slice('item:trait:'.length) || 'druid' };
  }

  static hasTrait(item: FeatItem, trait: string): boolean {
    try {
      const traits: unknown = JSON.parse(item.traits || '[]');
      return Array.isArray(traits) && traits.includes(trait);
    } catch {
      return false;
    }
  }

  static selection(item: FeatItem): FeatSelectionRecord {
    return {
      featId: item.id, featName: item.name, featImg: item.img, level: item.level,
      category: item.category, action_type: item.action_type, actions: item.actions,
      traits: item.traits, prerequisites: item.prerequisites, description: item.description,
      system_json: item.system_json,
    };
  }

  initialOrder(subclass: string, initialFeat?: FeatSelectionRecord): DruidOrder | undefined {
    return this.orders.find(order => order.item.name.toLowerCase() === subclass.toLowerCase())
      || this.inferOrder(initialFeat);
  }

  inferOrder(feat?: FeatSelectionRecord): DruidOrder | undefined {
    if (!feat) return;
    const matches = this.orders.filter(order => order.grant?.id === feat.featId);
    return matches.length === 1 ? matches[0] : undefined;
  }

  orderNames(ids: ReadonlySet<string>): string[] {
    return this.orders.filter(order => ids.has(order.item.id)).map(order => order.item.name);
  }

  resolve(source: Acquisition, context: ResolveContext, legacyFeat?: FeatSelectionRecord): ProgressionChoice[] {
    const result: ProgressionChoice[] = [];
    let feat = source.feat;
    let prefix = '';
    const visited = new Set<string>();
    while (!visited.has(feat.featId)) {
      visited.add(feat.featId);
      const definition = ProgressionChoiceCatalog.definition(feat);
      if (!definition) break;
      const path = prefix + definition.flag;
      const ruleContext: RuleContext = {
        ...context.rulesAt(source.level, source.slot, context.grants), feats: context.feats,
        orderNames: this.orderNames(context.orders),
        incompleteOrders: context.requireInitialOrder || context.missingDedicationOrder || this.orders.length === 0,
      };
      const missingSourcePrerequisite = result.length === 0 &&
        evaluatePrerequisites(feat.prerequisites || '[]', ruleContext).some(requirement => requirement.status === 'unmet');
      const options = missingSourcePrerequisite ? [] : definition.kind === 'membership'
        ? this.orders.map(order => order.item)
        : definition.kind === 'mystery'
        ? this.mysteries.map(mystery => mystery.item)
        : definition.kind === 'patron' || definition.kind === 'bloodline' || definition.kind === 'consciousMind' || definition.kind === 'muse' || definition.kind === 'swashbucklerStyle' || definition.kind === 'instinct' || definition.kind === 'cause' || definition.kind === 'way' || definition.kind === 'innovation' || definition.kind === 'implement' || definition.kind === 'kineticGate'
        ? (this.tagOptions[definition.kind] || [])
        : definition.kind === 'skillFeat'
        ? this.skillFeats.filter(item =>
            item.level <= source.level
            && !context.feats.some(entry => entry.featId === item.id)
            && !evaluatePrerequisites(item.prerequisites, ruleContext).some(requirement => requirement.status === 'unmet')
          )
        : definition.kind === 'order'
        ? this.orders.filter(order => !context.requireInitialOrder && !context.missingDedicationOrder
            && !context.orders.has(order.item.id) && !context.reservedOrders.has(order.item.id) && order.grant)
            .map(order => order.item)
        : this.feats.filter(item => {
            if (item.level > (definition.maxLevel ?? source.level) || item.category !== 'class') return false;
            if (definition.flag === 'naturalAmbition') {
              if (!this.classTrait || !ProgressionChoiceCatalog.hasTrait(item, this.classTrait)) return false;
              const excluded = ['animal-companion', 'animal-companion-druid', 'bardic-lore', 'fire-lung', 'lingering-composition', 'leshy-familiar', 'martial-performance', 'shore-step', 'steadying-stone', 'storm-born', 'versatile-performance', 'untamed-form'];
              const slug = (() => { try { return JSON.parse(item.system_json).slug as string; } catch { return ''; } })();
              if (excluded.includes(slug) || (slug === 'draconic-arrogance' && !context.feats.some(entry => /dragon instinct/i.test(entry.featName)))) return false;
            }
            if (definition.trait && !ProgressionChoiceCatalog.hasTrait(item, definition.trait)) return false;
            const repeatable = ProgressionChoiceCatalog.definition(ProgressionChoiceCatalog.selection(item))?.kind === 'order';
            return (repeatable || !context.feats.some(entry => entry.featId === item.id))
              && !evaluatePrerequisites(item.prerequisites, ruleContext).some(requirement => requirement.status === 'unmet');
          });
      const savedId = source.feat.choices?.[path];
      const legacyId = result.length === 0 && definition.kind === 'order' ? this.inferOrder(legacyFeat)?.item.id : undefined;
      const selection = options.find(option => option.id === (savedId ?? legacyId));
      const grant = definition.kind === 'order'
        ? this.orders.find(order => order.item.id === selection?.id)?.grant
        : definition.kind === 'mystery' || definition.kind === 'patron' || definition.kind === 'bloodline' || definition.kind === 'consciousMind' || definition.kind === 'way' || definition.kind === 'skillFeat'
        ? selection
        : definition.kind === 'feat' ? selection : undefined;
      const extraGrants = definition.kind === 'mystery' && selection
        ? [this.oracularCurse, this.mysteries.find(mystery => mystery.item.id === selection.id)?.curse]
            .filter((item): item is FeatItem => !!item)
        : definition.kind === 'swashbucklerStyle' && selection
        ? [this.classFeaturesById[ProgressionChoiceCatalog.panacheId], this.classFeaturesById[ProgressionChoiceCatalog.stylishCombatantId]]
            .filter((item): item is FeatItem => !!item)
        : definition.kind === 'innovation' && selection
        ? [this.classFeaturesById[ProgressionChoiceCatalog.inventorSkillFeatId]].filter((item): item is FeatItem => !!item)
        : definition.kind === 'skillFeat' && (source.feat.featId === ProgressionChoiceCatalog.rogueDedicationId || source.feat.featName === 'Rogue Dedication')
        ? [this.classFeaturesById[ProgressionChoiceCatalog.surpriseAttackId]].filter((item): item is FeatItem => !!item)
        : undefined;
      const unverified = (definition.kind === 'feat' || definition.kind === 'skillFeat') && selection
        ? evaluatePrerequisites(selection.prerequisites, ruleContext).some(requirement => requirement.status === 'unknown')
        : false;
      result.push({ path, kind: definition.kind, options, selection, grant, extraGrants, unverified });
      if ((definition.kind === 'membership' || definition.kind === 'order') && selection) context.orders.add(selection.id);
      if (!grant) break;
      feat = ProgressionChoiceCatalog.selection(grant);
      context.feats.push(feat);
      prefix = path + '/';
    }
    return result;
  }
}

export class ProgressionChoiceResolution {
  readonly choices = new Map<string, ProgressionChoice[]>();
  readonly grants: Acquisition[] = [];
  readonly acquisitions: Acquisition[] = [];
  readonly orderHistory: { level: number; id: string; slot: string }[] = [];
  private readonly pendingDedications: Acquisition[] = [];

  constructor(
    catalog: ProgressionChoiceCatalog,
    levels: Record<number, LevelProgressionData>,
    initialOrderId: string | undefined,
    rulesAt: ResolveContext['rulesAt'],
    isDruid: boolean,
  ) {
    const sortedLevels = Object.entries(levels).sort(([left], [right]) => Number(left) - Number(right));
    for (const [key, data] of sortedLevels) {
      for (const [slot, feat] of Object.entries(data.feats || {})) {
        if (slot === `order_explorer_${key}`) continue;
        this.acquisitions.push({ level: Number(key), slot, feat });
      }
    }
    const orders = new Set<string>();
    if (initialOrderId) {
      orders.add(initialOrderId);
      this.orderHistory.push({ level: 1, id: initialOrderId, slot: 'initial' });
    }
    const reserved = new Map<string, string>();
    for (const source of this.acquisitions) {
      for (const [path, id] of Object.entries(source.feat.choices || {})) {
        if (path.split('/').at(-1) === 'order' && !reserved.has(id)) reserved.set(id, this.key(source.level, source.slot));
      }
    }
    const directOrdersByLevel = new Map<number, number>();
    for (const source of this.acquisitions) {
      if (ProgressionChoiceCatalog.definition(source.feat)?.kind === 'order') {
        directOrdersByLevel.set(source.level, (directOrdersByLevel.get(source.level) || 0) + 1);
      }
    }
    const choiceSources = [...this.acquisitions].sort((left, right) => left.level - right.level ||
      Number(ProgressionChoiceCatalog.definition(right.feat)?.kind === 'membership') -
      Number(ProgressionChoiceCatalog.definition(left.feat)?.kind === 'membership'));
    for (const source of choiceSources) {
      const definition = ProgressionChoiceCatalog.definition(source.feat);
      if (!definition) continue;
      const key = this.key(source.level, source.slot);
      const feats = this.featsAt(source.level, source.slot).map(entry => entry.feat);
      const legacyFeat = directOrdersByLevel.get(source.level) === 1
        ? levels[source.level]?.feats?.[`order_explorer_${source.level}`] : undefined;
      const choices = catalog.resolve(source, {
        orders, feats, rulesAt, grants: this.grants, requireInitialOrder: isDruid && !initialOrderId,
        missingDedicationOrder: this.hasPendingDedication(source.level, source.slot),
        reservedOrders: new Set([...reserved].filter(([, owner]) => owner !== key).map(([id]) => id)),
      }, legacyFeat);
      this.choices.set(key, choices);
      if (definition.kind === 'membership' && !choices[0]?.selection) this.pendingDedications.push(source);
      for (const choice of choices) {
        if ((choice.kind === 'membership' || choice.kind === 'order') && choice.selection) {
          this.orderHistory.push({ level: source.level, id: choice.selection.id, slot: source.slot });
        }
        if (choice.grant) {
          this.grants.push({
            level: source.level, slot: `${source.slot}:${choice.path}`,
            feat: ProgressionChoiceCatalog.selection(choice.grant),
          });
        }
        for (const extra of choice.extraGrants || []) {
          this.grants.push({
            level: source.level, slot: `${source.slot}:${choice.path}:${extra.id}`,
            feat: ProgressionChoiceCatalog.selection(extra),
          });
        }
      }
    }
  }

  key(level: number, slot: string): string {
    return `${level}:${slot}`;
  }

  featsAt(level: number, excludedSlot?: string): Acquisition[] {
    return [...this.acquisitions, ...this.grants].filter(entry => entry.level <= level && !(
      entry.level === level && excludedSlot && (entry.slot === excludedSlot || entry.slot.startsWith(`${excludedSlot}:`))
    ));
  }

  hasPendingDedication(level: number, excludedSlot?: string): boolean {
    return this.pendingDedications.some(source => source.level <= level && !(source.level === level && source.slot === excludedSlot));
  }

  ordersAt(level: number, excludedSlot?: string): Set<string> {
    return new Set(this.orderHistory.filter(entry => entry.level <= level &&
      !(entry.level === level && entry.slot === excludedSlot)).map(entry => entry.id));
  }
}
