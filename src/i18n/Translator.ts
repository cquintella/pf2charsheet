import { ptBR } from './messages/ptBR';
import { en } from './messages/en';

export type Locale = 'pt-BR' | 'en';
export type MessageKey = keyof typeof ptBR;
export type Messages = Record<MessageKey, string>;
export type MessageParams = Record<string, string | number>;

export const SUPPORTED_LOCALES: readonly Locale[] = ['pt-BR', 'en'];
export const DEFAULT_LOCALE: Locale = 'en';

const DICTIONARIES: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Picks the initial locale: stored choice, then the system language, then English. */
export function detectLocale(stored: string | null, systemLanguages: readonly string[]): Locale {
  if (isLocale(stored)) return stored;
  for (const language of systemLanguages) {
    const normalized = language.toLowerCase();
    if (normalized.startsWith('pt')) return 'pt-BR';
    if (normalized.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

export class Translator {
  private readonly messages: Messages;

  constructor(public readonly locale: Locale) {
    this.messages = DICTIONARIES[locale];
  }

  /** Returns the message for `key`, replacing `{name}` placeholders with `params.name`. */
  translate(key: MessageKey, params?: MessageParams): string {
    const template = this.messages[key] ?? ptBR[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale).format(value);
  }

  compare(a: string, b: string): number {
    return a.localeCompare(b, this.locale);
  }
}

export type TranslateFn = (key: MessageKey, params?: MessageParams) => string;
