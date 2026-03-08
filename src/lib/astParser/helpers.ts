// ─── Shared Helpers ────────────────────────────────────────────────────────────
// Utilities yang dipakai oleh semua diagram generator.
// Import dari sini, bukan define ulang di masing-masing generator.

import { simple as walkSimple } from "acorn-walk";
export { walkSimple };

// Loose record type used for internal traversal – we cast through unknown
// at every walkSimple callback boundary to satisfy TypeScript.
export type AcornNode = Record<string, unknown> & { type: string };

// ─── String sanitizers ────────────────────────────────────────────────────────

/** Buat ID mermaid yang aman: hanya [a-zA-Z0-9_] */
export function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Escape karakter yang bisa merusak label mermaid */
export function sanitizeLabel(name: string): string {
  return name
    .replace(/"/g, "'")
    .replace(/[<>]/g, "")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;");
}

// ─── AST cast helpers ─────────────────────────────────────────────────────────

/** Cast `unknown` ke AcornNode — wajib dipakai di semua walkSimple callback */
export function toAN(node: unknown): AcornNode {
  return node as AcornNode;
}

/** Ambil nama string dari Identifier atau MemberExpression */
export function getNodeName(node: unknown): string {
  if (!node || typeof node !== "object") return "unknown";
  const n = node as AcornNode;
  if (n.type === "Identifier") return (n.name as string) ?? "unknown";
  if (n.type === "MemberExpression") {
    return `${getNodeName(n.object)}.${getNodeName(n.property)}`;
  }
  return "unknown";
}
