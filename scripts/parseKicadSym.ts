export type SExpr =
  | { type: 'list'; children: SExpr[] }
  | { type: 'atom'; value: string }
  | { type: 'number'; value: number }
  | { type: 'string'; value: string };

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    // Skip whitespace and newlines
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    // Comments
    if (ch === ';') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
      continue;
    }
    // Quoted strings
    if (ch === '"') {
      let s = '"';
      i++;
      while (i < input.length) {
        if (input[i] === '\\') {
          s += input[i];
          i++;
          if (i < input.length) { s += input[i]; i++; }
        } else if (input[i] === '"') {
          s += '"';
          i++;
          break;
        } else {
          s += input[i];
          i++;
        }
      }
      tokens.push(s);
      continue;
    }
    // Unquoted atoms (identifiers, numbers)
    let word = '';
    while (i < input.length && !'()"\n\r\t '.includes(input[i])) {
      word += input[i];
      i++;
    }
    if (word) tokens.push(word);
  }
  return tokens;
}

export function parseSExpr(input: string): SExpr[] {
  const tokens = tokenize(input);
  let pos = 0;

  function parseOne(): SExpr {
    if (pos >= tokens.length) throw new Error('Unexpected end of input');

    const tok = tokens[pos++];
    if (tok === '(') {
      const children: SExpr[] = [];
      while (pos < tokens.length && tokens[pos] !== ')') {
        children.push(parseOne());
      }
      if (pos >= tokens.length) throw new Error('Missing closing paren');
      pos++; // consume ')'
      return { type: 'list', children };
    }

    if (tok === ')') throw new Error('Unexpected closing paren');

    if (tok.startsWith('"') && tok.endsWith('"')) {
      return { type: 'string', value: tok.slice(1, -1) };
    }

    const num = parseFloat(tok);
    if (!isNaN(num) && tok !== '+' && tok !== '-') {
      if (tok.includes('.') || tok.includes('e') || tok.includes('E') || /^-?\d+$/.test(tok)) {
        return { type: 'number', value: num };
      }
    }

    return { type: 'atom', value: tok };
  }

  const results: SExpr[] = [];
  while (pos < tokens.length) {
    results.push(parseOne());
  }
  return results;
}

export function listChildren(node: SExpr): SExpr[] {
  if (node.type !== 'list') return [];
  return node.children;
}

export function findChild(node: SExpr, name: string): SExpr | undefined {
  return listChildren(node).find(
    (c) => c.type === 'list' && c.children.length > 0 && c.children[0].type === 'atom' && c.children[0].value === name
  );
}

export function findChildren(node: SExpr, name: string): SExpr[] {
  return listChildren(node).filter(
    (c) => c.type === 'list' && c.children.length > 0 && c.children[0].type === 'atom' && c.children[0].value === name
  );
}

export function atomValue(node: SExpr): string | undefined {
  if (node.type === 'atom') return node.value;
  if (node.type === 'string') return node.value;
  if (node.type === 'number') return String(node.value);
  return undefined;
}

export function numberValue(node: SExpr): number | undefined {
  if (node.type === 'number') return node.value;
  if (node.type === 'atom') {
    const n = parseFloat(node.value);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

export function stringValue(node: SExpr): string | undefined {
  if (node.type === 'string') return node.value;
  if (node.type === 'atom') return node.value;
  return undefined;
}
