// ─── Parser Public API ────────────────────────────────────────────────────────
// Satu-satunya entry point yang dipakai oleh UI dan komponen lain.
// Import dari sini, bukan langsung dari adapter atau core.
//
// Contoh:
//   import { parserRegistry, type ILanguage } from "$lib/parser";
//   const adapter = parserRegistry.getByLanguage("javascript");

// ── Core ──────────────────────────────────────────────────────────────────────
export { parserRegistry } from "./core/registry";
export type {
  IParserAdapter,
  ILanguage,
  ParseResult,
  ParseError,
  DiagramResult,
  DiagramTypeInfo,
} from "./core/types";

// ── Adapters (re-exported for advanced use / testing) ─────────────────────────
export { acornAdapter } from "./adapters/acorn/index";
// export { pythonLezerAdapter } from "./adapters/python-lezer/index";

// ── Auto-registration ─────────────────────────────────────────────────────────
// Cukup import "$lib/parser" dan semua adapter langsung tersedia di registry.
// Adapter baru: tambahkan import + parserRegistry.register() di bawah ini.

import { parserRegistry } from "./core/registry";
import { acornAdapter } from "./adapters/acorn/index";
// import { pythonLezerAdapter } from "./adapters/python-lezer/index";

parserRegistry.register(acornAdapter);
// parserRegistry.register(pythonLezerAdapter); // coming soon
