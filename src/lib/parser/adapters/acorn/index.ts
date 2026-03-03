// ─── Acorn Adapter ────────────────────────────────────────────────────────────
// Implements IParserAdapter untuk JavaScript dan TypeScript menggunakan
// acorn sebagai parser dan astToMermaid sebagai diagram generator.
//
// Cara daftarkan:
//   import { acornAdapter } from "$lib/parser/adapters/acorn";
//   parserRegistry.register(acornAdapter);

import { parse as acornParse } from "acorn";
import { astToMermaid, getDiagramTypes } from "../../../astParser/astToMermaid";
import type {
  IParserAdapter,
  ILanguage,
  ParseResult,
  DiagramResult,
  DiagramTypeInfo,
} from "../../core/types";
import type { FlowDirection } from "../../../astParser/astToMermaid";
import { acornSampleCode } from "./sampleCode";

// ─── Supported Languages ──────────────────────────────────────────────────────

const LANGUAGES: ILanguage[] = [
  {
    id: "javascript",
    name: "JavaScript",
    ext: ".js",
    monacoId: "javascript",
    icon: "🟨",
  },
  {
    id: "typescript",
    name: "TypeScript",
    ext: ".ts",
    monacoId: "typescript",
    icon: "🔷",
  },
];

// ─── TypeScript Syntax Stripper ───────────────────────────────────────────────
// Acorn hanya mengerti JavaScript murni. Untuk TypeScript kita strip syntax
// TS-only secara line-by-line supaya acorn tetap bisa build AST yang berguna.

function stripTypeScriptSyntax(code: string): string {
  // ── Pass 1: hapus block-level TS constructs ─────────────────────────────────
  let result = code;

  // interface declarations
  result = result.replace(/^[ \t]*interface\s+\w+[^{]*\{[^}]*\}/gm, "");
  // type aliases: type Foo = ...;
  result = result.replace(/^[ \t]*type\s+\w[\w\s]*=\s*[^;]+;/gm, "");
  // declare statements
  result = result.replace(/^[ \t]*declare\s+.+$/gm, "");
  // decorators @Foo / @Foo(...)
  result = result.replace(/^[ \t]*@\w+(\([^)]*\))?[ \t]*\n/gm, "");

  // ── Pass 2: line-by-line inline TS syntax ───────────────────────────────────
  const lines = result.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    let l = line;
    const trimmed = l.trimStart();

    // Jangan sentuh case/default — mereka punya `:` yang harus tetap ada
    const isSwitchCase =
      /^case\s+/.test(trimmed) || /^default\s*:/.test(trimmed);

    if (!isSwitchCase) {
      // Hapus access modifiers
      l = l.replace(
        /\b(public|private|protected|readonly|abstract|override)\s+/g,
        "",
      );

      // Hapus generic type params: <Type>, <T extends X>
      // Hanya yang diawali huruf kapital (TS types, bukan JSX atau comparison)
      l = l.replace(/<[A-Z][^<>()=]*>/g, "");

      // Hapus `as Type` assertion
      l = l.replace(/\bas\s+[\w<>\[\]|&.,\s]+/g, "");

      // 1) Function return type: ): ReturnType { atau ): ReturnType;
      l = l.replace(/\)\s*:\s*[\w<>\[\]|&.,\s?]+(?=\s*[\{;])/g, ")");

      // 2) Variable/param annotation diikuti =, ,, ), ;
      l = l.replace(/(\w)\s*:\s*[\w][\w<>\[\]|&.,\s?|]*(?=\s*[=,);])/g, "$1");

      // 3) Class field / trailing annotation dengan uppercase type
      l = l.replace(/(\w)\s*:\s*[A-Z][\w<>\[\]|&.,\s?]*\s*;/g, "$1;");

      // 4) Non-null assertion !. ![ !(
      l = l.replace(/!(?=[.[(])/g, "");
    }

    out.push(l);
  }

  return out.join("\n");
}

// ─── AcornAdapter ─────────────────────────────────────────────────────────────

class AcornAdapter implements IParserAdapter {
  // ── Metadata ─────────────────────────────────────────────────────────────────

  readonly id = "acorn";
  readonly name = "Acorn 8 (JS / TS)";
  readonly description =
    "Fast, lightweight ECMAScript parser. Supports JavaScript and TypeScript " +
    "(TypeScript annotations are stripped before parsing so acorn can handle them).";

  readonly parserLibrary = "acorn";
  readonly parserVersion = "8.16.0";

  readonly supportedLanguages: ILanguage[] = LANGUAGES;

  readonly supportedDiagramTypes: DiagramTypeInfo[] = getDiagramTypes();

  // ── parse() ──────────────────────────────────────────────────────────────────

  parse(code: string, languageId: string): ParseResult {
    try {
      const isTypeScript = languageId === "typescript" || languageId === "tsx";

      const sourceCode = isTypeScript ? stripTypeScriptSyntax(code) : code;

      const ast = acornParse(sourceCode, {
        ecmaVersion: "latest",
        sourceType: "module",
        locations: true,
        allowHashBang: true,
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowReserved: true,
      });

      return {
        success: true,
        ast: ast as unknown,
        language: languageId,
        adapterId: this.id,
        error: null,
      };
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        loc?: { line: number; column: number };
      };
      return {
        success: false,
        ast: null,
        language: languageId,
        adapterId: this.id,
        error: {
          message: e.message ?? "Unknown parse error",
          line: e.loc?.line,
          column: e.loc?.column,
        },
      };
    }
  }

  // ── toDiagram() ──────────────────────────────────────────────────────────────

  toDiagram(
    ast: unknown,
    diagramType: string,
    direction: FlowDirection = "TD",
  ): DiagramResult {
    try {
      // astToMermaid sudah ada dan teruji — cukup delegate ke sana
      const result = astToMermaid(
        ast as Parameters<typeof astToMermaid>[0],
        diagramType,
        direction,
      );
      return {
        success: result.success,
        diagram: result.diagram,
        error: result.error,
        nodePositions: result.nodePositions,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return {
        success: false,
        diagram: "",
        error: e.message ?? "Failed to generate diagram",
      };
    }
  }

  // ── getSampleCode() ──────────────────────────────────────────────────────────

  getSampleCode(languageId: string): string {
    return acornSampleCode[languageId] ?? acornSampleCode["javascript"] ?? "";
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────
// Satu instance, langsung bisa dipakai tanpa instantiate manual.
export const acornAdapter = new AcornAdapter();
