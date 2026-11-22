export interface DiceRollSuccess {
  ok: true;
  formula: string;
  total: number;
  breakdown: string;
}

export interface DiceRollFailure {
  ok: false;
  error: 'empty' | 'invalid';
}

export type DiceRollResult = DiceRollSuccess | DiceRollFailure;

interface ParsedTerm {
  sign: 1 | -1;
  count: number;
  sides: number | null;
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function parseFormula(raw: string): ParsedTerm[] | null {
  const compact = raw.replace(/\s+/g, '').toLowerCase();
  if (!compact) return null;

  const normalized = compact.startsWith('+') || compact.startsWith('-') ? compact : `+${compact}`;
  const tokenRegex = /([+-])(\d*d\d+|\d+)/g;
  const terms: ParsedTerm[] = [];
  let matchedLength = 0;

  for (const match of normalized.matchAll(tokenRegex)) {
    if (match.index !== matchedLength) return null;
    matchedLength += match[0].length;
    const sign: 1 | -1 = match[1] === '-' ? -1 : 1;
    const body = match[2];

    if (body.includes('d')) {
      const [countStr, sidesStr] = body.split('d');
      const count = countStr === '' ? 1 : Number(countStr);
      const sides = Number(sidesStr);
      if (!Number.isInteger(count) || !Number.isInteger(sides) || count < 1 || count > 100 || sides < 1 || sides > 10000) {
        return null;
      }
      terms.push({ sign, count, sides });
    } else {
      const value = Number(body);
      if (!Number.isInteger(value) || value < 0 || value > 1000000) return null;
      terms.push({ sign, count: value, sides: null });
    }
  }

  return matchedLength === normalized.length && terms.length > 0 ? terms : null;
}

/** Parse and evaluate a standard RPG dice formula (e.g. `1d20+7`, `2d6 + 1d4 - 2`). */
export function parseAndRollFormula(raw: string): DiceRollResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'empty' };

  const terms = parseFormula(trimmed);
  if (!terms) return { ok: false, error: 'invalid' };

  let total = 0;
  const parts: string[] = [];

  terms.forEach((term, index) => {
    const prefix = index === 0 ? (term.sign === -1 ? '-' : '') : (term.sign === -1 ? ' - ' : ' + ');
    if (term.sides === null) {
      total += term.sign * term.count;
      parts.push(`${prefix}${term.count}`);
      return;
    }

    const rolls: number[] = [];
    let subtotal = 0;
    for (let i = 0; i < term.count; i += 1) {
      const val = rollDie(term.sides);
      rolls.push(val);
      subtotal += val;
    }
    total += term.sign * subtotal;
    parts.push(`${prefix}${term.count}d${term.sides}[${rolls.join(', ')}]`);
  });

  return {
    ok: true,
    formula: trimmed,
    total,
    breakdown: `${parts.join('')} = ${total}`,
  };
}
