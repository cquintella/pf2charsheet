import { FeatItem, FeatSelectionRecord, LevelProgressionData } from '../types/pf2e';
import type { RuleContext } from './featRules';
import { evaluatePrerequisites } from './featRules';

interface CatalogRule {
  key?: string;
  flag?: string;
  choices?: { filter?: unknown[] };
  uuid?: string;
}

interface DruidOrder {
  item: FeatItem;
  grant: FeatItem | undefined;
}

interface ChoiceDefinition {
  flag: string;
  kind: 'order' | 'feat' | 'membership';
  maxLevel?: number;
  trait?: string;
}

export interface ProgressionChoice {
  path: string;
  kind: ChoiceDefinition['kind'];
  options: FeatItem[];
  selection?: FeatItem;
  grant?: FeatItem;
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

  constructor(readonly orders: DruidOrder[], readonly feats: FeatItem[]) {}

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
    const rule = this.rules(item.system_json).find(rule => rule.key === 'GrantItem' && typeof rule.uuid === 'string');
    return rule?.uuid?.match(/^Compendium\.pf2e\.feats-srd\.Item\.([A-Za-z0-9]+)$/)?.[1];
  }

  static definition(feat: FeatSelectionRecord): ChoiceDefinition | undefined {
    const isOrderExplorer = feat.featId === this.orderExplorerId || feat.featName === 'Order Explorer';
    const isBasicWilding = feat.featId === this.basicWildingId || feat.featName === 'Basic Wilding';
    if (feat.featId === this.druidDedicationId || feat.featName === 'Druid Dedication') {
      return { flag: 'druidicOrder', kind: 'membership' };
    }
    if (!isOrderExplorer && !isBasicWilding) return;
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
        : definition.kind === 'order'
        ? this.orders.filter(order => !context.requireInitialOrder && !context.missingDedicationOrder
            && !context.orders.has(order.item.id) && !context.reservedOrders.has(order.item.id) && order.grant)
            .map(order => order.item)
        : this.feats.filter(item => {
            if (item.level > (definition.maxLevel ?? source.level) || item.category !== 'class') return false;
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
        : definition.kind === 'feat' ? selection : undefined;
      const unverified = definition.kind === 'feat' && selection
        ? evaluatePrerequisites(selection.prerequisites, ruleContext).some(requirement => requirement.status === 'unknown')
        : false;
      result.push({ path, kind: definition.kind, options, selection, grant, unverified });
      if (definition.kind !== 'feat' && selection) context.orders.add(selection.id);
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
        if (choice.kind !== 'feat' && choice.selection) {
          this.orderHistory.push({ level: source.level, id: choice.selection.id, slot: source.slot });
        }
        if (choice.grant) {
          this.grants.push({
            level: source.level, slot: `${source.slot}:${choice.path}`,
            feat: ProgressionChoiceCatalog.selection(choice.grant),
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
