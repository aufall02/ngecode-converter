// ─── Core Types — Parser Adapter System ───────────────────────────────────────
// Semua contract/interface yang harus dipenuhi oleh setiap parser adapter.
// Adapter baru (babel, tree-sitter, python, dll) cukup implement IParserAdapter.

import type { FlowDirection } from "../../../lib/astParser/astToMermaid";

// ─── Language ─────────────────────────────────────────────────────────────────

export interface ILanguage {
  /** Unique ID, e.g. "javascript", "typescript", "python" */
  id: string;
  /** Human-readable name, e.g. "JavaScript" */
  name: string;
  /** File extension, e.g. ".js" */
  ext: string;
  /** Monaco editor language ID, e.g. "javascript", "python" */
  monacoId: string;
  /** Icon/emoji for the language (optional) */
  icon?: string;
}

// ─── Parse Result ─────────────────────────────────────────────────────────────

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

export interface ParseResult {
  success: boolean;
  /** The raw AST — type is unknown at this layer; each adapter knows its own shape */
  ast: unknown;
  /** Which language was parsed */
  language: string;
  /** Which adapter produced this result */
  adapterId: string;
  error: ParseError | null;
}

// ─── Diagram Result ───────────────────────────────────────────────────────────

export interface DiagramResult {
  success: boolean;
  /** Mermaid diagram source, possibly containing "%%SPLIT%%" separators */
  diagram: string;
  error?: string;
  /** Map dari mermaid node ID → posisi source code, untuk bidirectional highlight */
  nodePositions?: Record<
    string,
    { startLine: number; startCol: number; endLine: number; endCol: number }
  >;
}

export interface DiagramTypeInfo {
  /** Internal key, e.g. "flowchart", "structure" */
  type: string;
  /** Human-readable label */
  name: string;
  description: string;
}

// ─── Parser Adapter Interface ─────────────────────────────────────────────────

export interface IParserAdapter {
  // ── Metadata ────────────────────────────────────────────────────────────────

  /** Unique adapter ID, e.g. "acorn", "babel", "tree-sitter-python" */
  readonly id: string;

  /** Human-readable adapter name, e.g. "Acorn 8 (JS/TS)" */
  readonly name: string;

  /** Short description shown in the UI */
  readonly description: string;

  /**
   * Name of the underlying parser library, e.g. "acorn", "tree-sitter", "@babel/parser"
   * Displayed in the UI as "Parser: <parserLibrary>-<parserVersion>"
   */
  readonly parserLibrary: string;

  /**
   * Version string of the underlying parser library, e.g. "8.16.0"
   * Shown next to the parser name so users know exactly which version is running.
   */
  readonly parserVersion: string;

  /** Languages this adapter can handle */
  readonly supportedLanguages: ILanguage[];

  /** Diagram types this adapter can generate */
  readonly supportedDiagramTypes: DiagramTypeInfo[];

  // ── Core Methods ─────────────────────────────────────────────────────────────

  /**
   * Parse source code into an AST.
   * @param code    Raw source code string
   * @param languageId  One of the IDs from supportedLanguages
   */
  parse(code: string, languageId: string): ParseResult;

  /**
   * Convert a previously-parsed AST into a Mermaid diagram string.
   * @param ast           The AST returned from parse()
   * @param diagramType   One of the types from supportedDiagramTypes
   * @param direction     Flow direction for flowchart-style diagrams
   */
  toDiagram(
    ast: unknown,
    diagramType: string,
    direction?: FlowDirection,
  ): DiagramResult;

  /**
   * Return a representative sample code string for the given language.
   * Used to pre-populate the editor when the user switches languages.
   */
  getSampleCode(languageId: string): string;
}
