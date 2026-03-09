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
  // ── Pass 1: hapus block-level TS constructs (multiline safe) ────────────────
  let result = code;

  // interface declarations (possibly multiline)
  result = result.replace(
    /^[ \t]*(?:export\s+)?interface\s+\w[\w\s,<>]*\{[^}]*\}/gm,
    "",
  );
  // type aliases: type Foo = ...;  (possibly multiline with |)
  result = result.replace(
    /^[ \t]*(?:export\s+)?type\s+\w+[\w\s,<>]*=[\s\S]*?;/gm,
    "",
  );
  // declare statements
  result = result.replace(/^[ \t]*declare\s+.+$/gm, "");
  // decorators @Foo / @Foo(...)
  result = result.replace(/^[ \t]*@\w+(\([^)]*\))?[ \t]*\n/gm, "");
  // abstract method declarations (no body): `abstract foo(): void;`
  result = result.replace(/^[ \t]*abstract\s+\w+[^{}\n]*;\s*$/gm, "");
  // `implements Foo, Bar` clause on class declaration
  result = result.replace(/\bimplements\s+[\w\s,.<>]+(?=\s*\{)/g, "");

  // ── Pass 2: line-by-line inline TS syntax ───────────────────────────────────
  const lines = result.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    let l = line;
    const trimmed = l.trimStart();

    // Skip blank lines produced by pass 1
    // (keep them so line numbers stay meaningful)

    // Jangan sentuh case/default — mereka punya `:` yang harus tetap ada
    const isSwitchCase =
      /^case\s+/.test(trimmed) || /^default\s*:/.test(trimmed);

    if (!isSwitchCase) {
      // Hapus `abstract` keyword on class declaration: `abstract class Foo`
      l = l.replace(/\babstract\s+(?=class\b)/g, "");

      // Hapus access + modifier keywords
      l = l.replace(/\b(public|private|protected|readonly|override)\s+/g, "");

      // Hapus generic type params: <Type>, <T extends X>, <K, V>
      // Hanya yang diawali huruf kapital atau sudah pasti generik
      l = l.replace(/<[A-Z][^<>()=\n]*>/g, "");

      // Hapus `as Type` assertion (tidak boleh hapus `as` di import/export)
      l = l.replace(/\bas\s+[\w<>\[\]|&.,\s?]+/g, "");

      // 1) Function/method return type: ): ReturnType { atau ): ReturnType;
      l = l.replace(/\)\s*:\s*[\w<>\[\]|&.,\s?]+(?=\s*[\{;])/g, ")");

      // 2) Parameter type annotation: `name: string,`  `age: number)`  `x: T =`
      l = l.replace(
        /(\w)\s*\?\s*:\s*[\w][\w<>\[\]|&.,\s?]*(?=\s*[=,);])/g,
        "$1",
      );
      l = l.replace(/(\w)\s*:\s*[\w][\w<>\[\]|&.,\s?|]*(?=\s*[=,);])/g, "$1");

      // 3) Class field declaration with type only (no `=`), e.g. `name: string;`
      //    These lines have nothing useful for JS — blank them out
      if (
        /^[ \t]*\w+\s*[?!]?\s*:\s*[\w<>\[\]|&.,\s?]+\s*;?\s*$/.test(l) &&
        !/^\s*(case|default|return|throw|const|let|var|if|for|while)\b/.test(
          l,
        ) &&
        !/[=({]/.test(l)
      ) {
        out.push("");
        continue;
      }

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
        executableCode: sourceCode,
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
