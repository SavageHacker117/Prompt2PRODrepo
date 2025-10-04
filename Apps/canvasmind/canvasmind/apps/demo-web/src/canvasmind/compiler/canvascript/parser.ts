// Minimal hand-rolled parser for the grammar above.
// Produces an AST array of { type, ... } nodes.

export type ASTNode =
  | { type: "SceneBlock"; body: ASTNode[] }
  | { type: "Spawn"; kind: string; count?: number; props: Record<string, number | [number, number] | string> }
  | { type: "Sky"; label: string }
  | { type: "Water"; wavesIntensity: number }
  | { type: "LightingSun"; angle: number };

export function parseCanvasScript(src: string): ASTNode[] {
  const s = stripComments(src);
  let i = 0;

  function isWS(c: string) { return /\s/.test(c); }
  function skipWS() { while (i < s.length && isWS(s[i]!)) i++; }
  function peek(n = 0) { return s[i + n]; }
  function match(tok: string) { skipWS(); if (s.slice(i, i + tok.length) === tok) { i += tok.length; return true; } return false; }
  function expect(tok: string) { if (!match(tok)) throw err(`expected '${tok}'`); }
  function err(m: string) { return new Error(`CanvasScript: ${m} at ${i}`); }

  function ident(): string {
    skipWS();
    const m = /^[a-zA-Z_][a-zA-Z0-9_-]*/.exec(s.slice(i));
    if (!m) throw err("identifier");
    i += m[0].length;
    return m[0];
  }

  function number(): number {
    skipWS();
    const m = /^[0-9]+(\.[0-9]+)?/.exec(s.slice(i));
    if (!m) throw err("number");
    i += m[0].length;
    return parseFloat(m[0]);
  }

  function quoted(): string {
    skipWS();
    if (s[i] !== '"') throw err("string");
    i++; const start = i;
    while (i < s.length && s[i] !== '"') i++;
    if (s[i] !== '"') throw err("unterminated string");
    const out = s.slice(start, i);
    i++; return out;
  }

  function kvpair(): [string, number | [number, number] | string] {
    const k = ident();
    skipWS(); expect("=");
    skipWS();
    // range?
    const save = i;
    try {
      const a = number(); skipWS();
      if (match("..")) { const b = number(); return [k, [a, b]]; }
      return [k, a];
    } catch {
      i = save;
      return [k, quoted()];
    }
  }

  function spawnStmt(): ASTNode {
    // spawn <ident> (kvpair)* (count=INT)?
    expect("spawn");
    const kind = ident();
    const props: Record<string, number | [number, number] | string> = {};
    let count: number | undefined;
    // read key=value pairs in any order
    while (true) {
      skipWS();
      const snap = i;
      try {
        const [k, v] = kvpair();
        if (k === "count" && typeof v === "number") { count = v; }
        else props[k] = v;
      } catch {
        i = snap;
        break;
      }
    }
    return { type: "Spawn", kind, count, props };
  }

  function skyStmt(): ASTNode {
    expect("sky");
    const label = quoted();
    return { type: "Sky", label };
  }

  function waterStmt(): ASTNode {
    expect("water"); skipWS();
    expect("waves"); skipWS();
    expect("intensity"); skipWS(); expect("="); const v = number();
    return { type: "Water", wavesIntensity: v };
  }

  function lightingStmt(): ASTNode {
    expect("lighting"); skipWS(); expect("sun"); skipWS(); expect("angle"); skipWS(); expect("="); const ang = number();
    return { type: "LightingSun", angle: ang };
  }

  function stmt(): ASTNode {
    skipWS();
    if (match("scene")) {
      skipWS(); expect("{");
      const body: ASTNode[] = [];
      while (true) {
        skipWS();
        if (match("}")) break;
        body.push(stmt());
      }
      return { type: "SceneBlock", body };
    }
    if (s.slice(i, i + 5) === "spawn") return spawnStmt();
    if (s.slice(i, i + 3) === "sky") return skyStmt();
    if (s.slice(i, i + 5) === "water") return waterStmt();
    if (s.slice(i, i + 8) === "lighting") return lightingStmt();
    throw err("statement");
  }

  const out: ASTNode[] = [];
  while (i < s.length) {
    skipWS();
    if (i >= s.length) break;
    out.push(stmt());
  }
  return out;
}

function stripComments(src: string) {
  return src.replace(/\/\/.*$/gm, "");
}
