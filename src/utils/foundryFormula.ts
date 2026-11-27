export interface FormulaContext {
  itemRank?: number;
  itemLevel?: number;
  actorLevel?: number;
}

/**
 * Safely evaluates simple Foundry arithmetic expressions without eval/Function.
 * Supports +, -, *, /, parentheses, ceil(), floor(), round(), min(), max(),
 * and variables @item.rank, @item.level, @actor.level.
 */
export function evaluateFormulaExpression(rawExpr: string, ctx: FormulaContext): number | null {
  let expr = rawExpr.trim();
  if (!expr) return null;

  const vars: Record<string, number | undefined> = {
    '@item.rank': ctx.itemRank,
    '@item.level': ctx.itemLevel,
    '@actor.level': ctx.actorLevel,
  };

  for (const [token, val] of Object.entries(vars)) {
    if (expr.includes(token)) {
      if (val === undefined || !Number.isFinite(val)) return null;
      expr = expr.split(token).join(String(val));
    }
  }

  // Unresolved @ variables remain -> cannot evaluate numerically
  if (expr.includes('@')) return null;

  let pos = 0;
  const skipWs = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };

  const parseExpr = (): number => {
    let left = parseTerm();
    while (true) {
      skipWs();
      const ch = expr[pos];
      if (ch === '+') {
        pos++;
        left += parseTerm();
      } else if (ch === '-') {
        pos++;
        left -= parseTerm();
      } else {
        return left;
      }
    }
  };

  const parseTerm = (): number => {
    let left = parseUnary();
    while (true) {
      skipWs();
      const ch = expr[pos];
      if (ch === '*') {
        pos++;
        left *= parseUnary();
      } else if (ch === '/') {
        pos++;
        const right = parseUnary();
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      } else {
        return left;
      }
    }
  };

  const parseUnary = (): number => {
    skipWs();
    if (expr[pos] === '+') {
      pos++;
      return parseUnary();
    }
    if (expr[pos] === '-') {
      pos++;
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    skipWs();
    if (expr[pos] === '(') {
      pos++;
      const val = parseExpr();
      skipWs();
      if (expr[pos] !== ')') throw new Error('Missing )');
      pos++;
      return val;
    }

    const fnMatch = expr.slice(pos).match(/^(ceil|floor|round|min|max)\s*\(/i);
    if (fnMatch) {
      const fn = fnMatch[1].toLowerCase();
      pos += fnMatch[0].length;
      const args: number[] = [parseExpr()];
      while (true) {
        skipWs();
        if (expr[pos] === ',') {
          pos++;
          args.push(parseExpr());
        } else {
          break;
        }
      }
      skipWs();
      if (expr[pos] !== ')') throw new Error('Missing )');
      pos++;
      if (fn === 'ceil') return Math.ceil(args[0]);
      if (fn === 'floor') return Math.floor(args[0]);
      if (fn === 'round') return Math.round(args[0]);
      if (fn === 'min') return Math.min(...args);
      if (fn === 'max') return Math.max(...args);
    }

    const numMatch = expr.slice(pos).match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      pos += numMatch[0].length;
      return Number(numMatch[0]);
    }

    throw new Error('Unexpected token');
  };

  try {
    const result = parseExpr();
    skipWs();
    if (pos !== expr.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/** Reads balanced [...] content starting right after the opening '['. */
function readBracketContent(text: string, openIdx: number): { content: string; endIdx: number } | null {
  let depth = 1;
  let i = openIdx + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return { content: text.slice(openIdx + 1, i - 1), endIdx: i };
}

function formatDamageBody(body: string, ctx: FormulaContext): string {
  // Split optional trailing [damage,types]
  let exprPart = body.split('|')[0].trim();
  let typesPart = '';
  const trailingTypes = exprPart.match(/\[([^\[\]]+)\]$/);
  if (trailingTypes) {
    typesPart = trailingTypes[1].replace(/,/g, ', ').trim();
    exprPart = exprPart.slice(0, trailingTypes.index).trim();
  }

  // Case 1: Dice expression like "(ceil(@item.rank / 2))d4" or "(2*@item.rank)d6+4"
  const diceMatch = exprPart.match(/^(.+?)(d\d+.*)$/i);
  if (diceMatch) {
    const countRaw = diceMatch[1].trim();
    const rest = diceMatch[2].trim();
    const evaluatedCount = evaluateFormulaExpression(countRaw, ctx);
    const resolvedCount = evaluatedCount !== null ? String(evaluatedCount) : countRaw.replace(/@actor\.level\b/g, 'character level').replace(/@item\.rank\b/g, 'item rank').replace(/@item\.level\b/g, 'item level');
    const resolvedExpr = `${resolvedCount}${rest}`;
    return typesPart ? `${resolvedExpr} ${typesPart}` : resolvedExpr;
  }

  // Case 2: Flat numeric expression like "(2*ceil(@item.rank/2)-1)"
  const evaluatedFlat = evaluateFormulaExpression(exprPart, ctx);
  const resolved = evaluatedFlat !== null ? String(evaluatedFlat) : exprPart;
  return typesPart ? `${resolved} ${typesPart}` : resolved;
}

function formatCheckBody(body: string): string {
  const typeMatch = body.match(/(?:^|\|)type:([a-z-]+)/i);
  const name = typeMatch ? typeMatch[1] : body.split('|')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatTemplateBody(body: string): string {
  const typeMatch = body.match(/type:([a-z-]+)/i);
  const distMatch = body.match(/distance:(\d+)/i);
  if (distMatch && typeMatch) return `${distMatch[1]}-ft. ${typeMatch[1]}`;
  return body.replace(/\|/g, ' ');
}

export function formatFoundryInlineTokens(text: string, ctx: FormulaContext = {}, asHtml = true): string {
  if (!text) return '';

  // First handle tags that have an explicit {label}
  let out = text
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, (_, label) =>
      asHtml ? `<strong class="text-accent-text">${label}</strong>` : label
    )
    .replace(/@Damage\[[^\]]+\]\{([^}]+)\}/g, (_, label) =>
      asHtml ? `<strong class="text-status-danger">${label}</strong>` : label
    )
    .replace(/@Check\[[^\]]+\]\{([^}]+)\}/g, (_, label) =>
      asHtml ? `<strong class="text-status-info">${label}</strong>` : label
    );

  // Then handle @Damage[...], @Check[...], @Template[...] without {label} (supports nested brackets)
  let result = '';
  let i = 0;
  while (i < out.length) {
    const match = out.slice(i).match(/^@(Damage|Check|Template)\[/i);
    if (match) {
      const kind = match[1].toLowerCase();
      const openIdx = i + match[0].length - 1;
      const parsed = readBracketContent(out, openIdx);
      if (parsed) {
        let formatted = parsed.content;
        let cls = 'text-accent-text';
        if (kind === 'damage') {
          formatted = formatDamageBody(parsed.content, ctx);
          cls = 'text-status-danger';
        } else if (kind === 'check') {
          formatted = formatCheckBody(parsed.content);
          cls = 'text-status-info';
        } else if (kind === 'template') {
          formatted = formatTemplateBody(parsed.content);
          cls = 'text-accent-text';
        }
        result += asHtml ? `<strong class="${cls}">${formatted}</strong>` : formatted;
        i = parsed.endIdx;
        continue;
      }
    }
    result += out[i];
    i++;
  }

  return result;
}

export function buildSpellFormulaContext(
  spell: { rank: number; category?: string; traits?: string },
  characterLevel?: number
): FormulaContext {
  const isCantripOrFocus =
    spell.category === 'cantrip' ||
    spell.category === 'focus' ||
    (spell.traits ? /"(cantrip|focus)"/i.test(spell.traits) : false);
  const effectiveRank =
    isCantripOrFocus && characterLevel
      ? Math.max(1, Math.ceil(characterLevel / 2))
      : Math.max(1, spell.rank || 1);

  return {
    itemRank: effectiveRank,
    itemLevel: characterLevel ?? effectiveRank * 2 - 1,
    actorLevel: characterLevel,
  };
}
