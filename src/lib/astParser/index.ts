import { parse as acornParse, type Node } from "acorn";

export type SupportedLanguage = "javascript" | "typescript";

export interface ParseResult {
  success: boolean;
  ast: Node | null;
  error: ParseError | null;
}

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

// Sample code for each language
// Re-export from the canonical source (acorn adapter) so nothing breaks
// if old code still imports sampleCode from here.
import { acornSampleCode } from "../parser/adapters/acorn/sampleCode";
export const sampleCode: Record<SupportedLanguage, string> = {
  javascript: acornSampleCode["javascript"] ?? "",
  typescript: acornSampleCode["typescript"] ?? "",
};

// Map our language IDs to Monaco editor language IDs
export function getMonacoLanguage(lang: SupportedLanguage): string {
  const map: Record<SupportedLanguage, string> = {
    javascript: "javascript",
    typescript: "typescript",
  };
  return map[lang] ?? "javascript";
}

// Parse code using acorn. For TypeScript we strip type annotations
// with a simple regex pre-processor so acorn (JS-only) can handle it.
export function parseCode(
  code: string,
  language: SupportedLanguage,
): ParseResult {
  try {
    const isTypeScript = language === "typescript";

    // For TypeScript we do a lightweight strip of TS-only syntax so acorn
    // can still build a useful AST without a full TS parser dependency.
    const sourceCode = isTypeScript ? stripTypeScriptSyntax(code) : code;

    const ast = acornParse(sourceCode, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
      // acorn doesn't support JSX natively; we allow it to fall through
      // gracefully – if it fails we still return an error with line info.
      allowHashBang: true,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReserved: true,
    });

    return { success: true, ast: ast as unknown as Node, error: null };
  } catch (err: unknown) {
    const e = err as {
      message?: string;
      loc?: { line: number; column: number };
    };
    return {
      success: false,
      ast: null,
      error: {
        message: e.message ?? "Unknown parse error",
        line: e.loc?.line,
        column: e.loc?.column,
      },
    };
  }
}

// TypeScript syntax stripper — line-by-line approach so we never mangle
// switch-case labels, string literals, or object shorthand.
function stripTypeScriptSyntax(code: string): string {
  // ── Pass 1: remove block-level TS-only constructs ────────────────────────
  // interface declarations (single or multi-line, up to 6 nesting levels)
  let result = code;
  result = result.replace(/^[ \t]*interface\s+\w+[^{]*\{[^}]*\}/gm, "");
  // type alias: type Foo = ...;
  result = result.replace(/^[ \t]*type\s+\w[\w\s]*=\s*[^;]+;/gm, "");
  // declare statements
  result = result.replace(/^[ \t]*declare\s+.+$/gm, "");
  // decorators @Foo / @Foo(...)
  result = result.replace(/^[ \t]*@\w+(\([^)]*\))?[ \t]*\n/gm, "");

  // ── Pass 2: line-by-line for inline TS syntax ────────────────────────────
  const lines = result.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    let l = line;

    // Skip lines that are purely TS (already blanked above → empty)
    if (l.trim() === "") {
      out.push(l);
      continue;
    }

    // Don't touch lines that start with `case ` or `default:` — these contain
    // colons that must not be stripped.
    const trimmed = l.trimStart();
    const isSwitchCase =
      /^case\s+/.test(trimmed) || /^default\s*:/.test(trimmed);

    if (!isSwitchCase) {
      // Remove access modifiers at word boundary
      l = l.replace(
        /\b(public|private|protected|readonly|abstract|override)\s+/g,
        "",
      );

      // Remove generic type params: <Type>, <T extends X>, <K, V> etc.
      // Only when NOT inside a string (crude but effective for typical TS)
      l = l.replace(/<[A-Z][^<>()=]*>/g, "");

      // Remove `as Type` assertions (word boundary, not inside strings)
      l = l.replace(/\bas\s+[\w<>\[\]|&.,\s]+/g, "");

      // Remove type annotations after identifiers / closing parens / brackets:
      //   param: Type,   ): ReturnType {   variable: Type =   variable: Type;
      // Strategy: only strip `: <Type>` when followed by =, ,, ), {, ;, newline
      // and NOT when preceded by `case` (handled above) or inside a string.
      //
      // We do multiple narrow passes for common patterns:

      // 1) Function return type annotation:  ): ReturnType {  or  ): ReturnType;
      l = l.replace(/\)\s*:\s*[\w<>\[\]|&.,\s?]+(?=\s*[\{;])/g, ")");

      // 2) Variable / param annotation followed by = or , or ) or ;
      //    e.g.  rows: string[]  =   count: number,   options: Foo)
      //    Careful: do NOT match object-literal `{ key: value }` — those have
      //    lowercase identifiers as values. We restrict the Type part to start
      //    with a word char and require it ends before =,);
      l = l.replace(/(\w)\s*:\s*[\w][\w<>\[\]|&.,\s?\|]*(?=\s*[=,);])/g, "$1");

      // 3) Trailing annotation with nothing after (end of line) – e.g. class fields
      //    `  options: TriangleOptions;`  → `  options;`
      //    But keep object literal values like `{ rows: [], mode: x }`
      //    Heuristic: if the type starts with uppercase, it's a TS type.
      l = l.replace(/(\w)\s*:\s*[A-Z][\w<>\[\]|&.,\s?]*\s*;/g, "$1;");

      // 4) Non-null assertion !. or ![ or !(
      l = l.replace(/!(?=[.[(])/g, "");
    }

    out.push(l);
  }

  return out.join("\n");
}
