export const APPEARANCE_FIELDS = ['gender', 'skin', 'hair', 'eyes', 'height', 'weight'] as const;
export type CharacterAppearance = Record<typeof APPEARANCE_FIELDS[number], string>;

export class CharacterDetails {
  static parseXp(value: unknown): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  static parseAppearance(value: unknown): CharacterAppearance {
    const fields = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(APPEARANCE_FIELDS.map(field => [
      field, typeof fields[field] === 'string' ? fields[field] : '',
    ])) as CharacterAppearance;
  }
}
