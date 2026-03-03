// ─── Parser Registry ──────────────────────────────────────────────────────────
// Global singleton. Setiap adapter register dirinya satu kali saat init.
// UI dan diagram engine hanya berinteraksi lewat registry ini — tidak pernah
// import adapter secara langsung.
//
// Contoh penggunaan:
//   import { parserRegistry } from "$lib/parser/core/registry";
//
//   // register (dilakukan di adapter/index.ts masing-masing)
//   parserRegistry.register(new AcornAdapter());
//
//   // lookup di UI
//   const adapter = parserRegistry.getByLanguage("typescript");
//   const result  = adapter.parse(code, "typescript");

import type { IParserAdapter, ILanguage, DiagramTypeInfo } from "./types";

class ParserRegistry {
  private readonly _adapters = new Map<string, IParserAdapter>();

  // ── Registration ─────────────────────────────────────────────────────────────

  /**
   * Register an adapter.
   * Throws if an adapter with the same id is already registered,
   * so duplicate registrations (e.g. HMR) are safe — just warn and skip.
   */
  register(adapter: IParserAdapter): void {
    if (this._adapters.has(adapter.id)) {
      console.warn(
        `[ParserRegistry] Adapter "${adapter.id}" is already registered. Skipping.`,
      );
      return;
    }
    this._adapters.set(adapter.id, adapter);
  }

  /**
   * Replace an existing adapter (useful for hot-reload / testing).
   */
  replace(adapter: IParserAdapter): void {
    this._adapters.set(adapter.id, adapter);
  }

  /**
   * Unregister an adapter by id.
   */
  unregister(adapterId: string): void {
    this._adapters.delete(adapterId);
  }

  // ── Lookup ───────────────────────────────────────────────────────────────────

  /**
   * Get an adapter by its unique id.
   * Returns undefined if not found.
   */
  getById(adapterId: string): IParserAdapter | undefined {
    return this._adapters.get(adapterId);
  }

  /**
   * Find the first adapter that supports the given language id.
   * Returns undefined if no adapter supports it.
   */
  getByLanguage(languageId: string): IParserAdapter | undefined {
    for (const adapter of this._adapters.values()) {
      if (adapter.supportedLanguages.some((l) => l.id === languageId)) {
        return adapter;
      }
    }
    return undefined;
  }

  /**
   * Find the adapter that supports a language AND has the requested diagram type.
   * Falls back to any adapter that supports the language if none has the diagram type.
   */
  getForDiagram(
    languageId: string,
    diagramType: string,
  ): IParserAdapter | undefined {
    // Prefer adapter that supports both language + diagram type
    for (const adapter of this._adapters.values()) {
      const hasLang = adapter.supportedLanguages.some(
        (l) => l.id === languageId,
      );
      const hasDiagram = adapter.supportedDiagramTypes.some(
        (d) => d.type === diagramType,
      );
      if (hasLang && hasDiagram) return adapter;
    }
    // Fallback: any adapter that supports the language
    return this.getByLanguage(languageId);
  }

  // ── Aggregated views ─────────────────────────────────────────────────────────

  /**
   * List every registered adapter.
   */
  listAdapters(): IParserAdapter[] {
    return [...this._adapters.values()];
  }

  /**
   * Flat list of all languages across all adapters (deduped by language id).
   * Sorted alphabetically by name.
   */
  listAllLanguages(): ILanguage[] {
    const seen = new Map<string, ILanguage>();
    for (const adapter of this._adapters.values()) {
      for (const lang of adapter.supportedLanguages) {
        if (!seen.has(lang.id)) seen.set(lang.id, lang);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Flat list of all diagram types across all adapters (deduped by type key).
   * Useful for building a global diagram-type selector.
   */
  listAllDiagramTypes(): DiagramTypeInfo[] {
    const seen = new Map<string, DiagramTypeInfo>();
    for (const adapter of this._adapters.values()) {
      for (const dt of adapter.supportedDiagramTypes) {
        if (!seen.has(dt.type)) seen.set(dt.type, dt);
      }
    }
    return [...seen.values()];
  }

  /**
   * List diagram types available for a specific language
   * (union across all adapters that support the language).
   */
  getDiagramTypesForLanguage(languageId: string): DiagramTypeInfo[] {
    const seen = new Map<string, DiagramTypeInfo>();
    for (const adapter of this._adapters.values()) {
      const hasLang = adapter.supportedLanguages.some(
        (l) => l.id === languageId,
      );
      if (!hasLang) continue;
      for (const dt of adapter.supportedDiagramTypes) {
        if (!seen.has(dt.type)) seen.set(dt.type, dt);
      }
    }
    return [...seen.values()];
  }

  /**
   * Returns true if at least one adapter has been registered.
   */
  get isEmpty(): boolean {
    return this._adapters.size === 0;
  }

  /**
   * Number of registered adapters.
   */
  get size(): number {
    return this._adapters.size;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// One instance shared across the entire app.
export const parserRegistry = new ParserRegistry();
