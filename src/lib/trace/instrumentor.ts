// ─── Code Instrumentor ────────────────────────────────────────────────────────
// Takes original (executable) source code + the nodePositions map produced by
// generateFlowchart(), and injects `__trace("nodeId")` calls before every
// statement that has a known source position.
//
// Injection is done bottom-to-top (highest line first) so that earlier
// insertions never shift the line numbers of later ones.
//
// Also injects a `__loopGuard()` call inside every loop body (stadium nodes)
// to prevent infinite loops from hanging the browser.
//
// Output is plain JavaScript — TypeScript should be stripped before passing
// here (use ParseResult.executableCode, not the raw TS source).

import type { NodeLoc } from "../astParser/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface InstrumentResult {
  /** The instrumented JS code, ready to be eval()'d inside the sandbox. */
  code: string;
  /**
   * Ordered list of nodeIds that COULD be traced (i.e. had a position).
   * The actual execution trace will be a subset/repetition of these.
   */
  traceableNodes: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ITER = 10_000;

// ─── Preamble injected at the top of every instrumented script ────────────────

const PREAMBLE = `
var __traces = [];
var __logs   = [];
var __iterCount = 0;
var __MAX_ITER  = ${MAX_ITER};

function __trace(nodeId) {
  __traces.push(nodeId);
}

function __loopGuard() {
  if (++__iterCount > __MAX_ITER) {
    throw new Error("Loop iteration limit (${MAX_ITER.toLocaleString()}) exceeded. Check for infinite loops.");
  }
}

// Capture console output
var console = (function() {
  function _push(level, args) {
    __logs.push({ level: level, text: args.map(function(a) {
      if (a === null) return "null";
      if (a === undefined) return "undefined";
      if (typeof a === "object") { try { return JSON.stringify(a); } catch(_) { return String(a); } }
      return String(a);
    }).join(" ") });
  }
  return {
    log:   function() { _push("log",   Array.prototype.slice.call(arguments)); },
    warn:  function() { _push("warn",  Array.prototype.slice.call(arguments)); },
    error: function() { _push("error", Array.prototype.slice.call(arguments)); },
    info:  function() { _push("info",  Array.prototype.slice.call(arguments)); },
  };
})();
`.trimStart();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return the leading whitespace of a source line (for indent-matching). */
function indentOf(line: string): string {
  return line.match(/^(\s*)/)?.[1] ?? "";
}

/**
 * Detect if a node is a loop node (stadium shape) by its ID prefix.
 * Stadium nodes use prefix "stadium" in freshId().
 */
function isLoopNode(nodeId: string): boolean {
  return nodeId.startsWith("stadium_");
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Instrument `code` by injecting `__trace("nodeId")` calls at every position
 * recorded in `nodePositions`.
 *
 * @param code           Executable JS source (TS already stripped).
 * @param nodePositions  Map of nodeId → NodeLoc from generateFlowchart().
 */
export function instrumentCode(
  code: string,
  nodePositions: Record<string, NodeLoc>,
): InstrumentResult {
  const lines = code.split("\n");

  // ── Build injection list ───────────────────────────────────────────────────
  // Each entry: { nodeId, lineIdx (0-based), isLoop }
  // Multiple nodes can share the same line — we deduplicate by (line, col) and
  // keep the one with the smallest column so we inject once per statement start.

  interface Injection {
    nodeId: string;
    lineIdx: number; // 0-based
    col: number;
    isLoop: boolean;
  }

  // Deduplicate: if two nodeIds map to the exact same start position keep both
  // (they'll emit separate __trace calls on the same line), but avoid injecting
  // the same nodeId twice.
  const seen = new Set<string>();
  const injections: Injection[] = [];

  for (const [nodeId, loc] of Object.entries(nodePositions)) {
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);

    const lineIdx = loc.startLine - 1; // convert 1-based → 0-based
    if (lineIdx < 0 || lineIdx >= lines.length) continue;

    injections.push({
      nodeId,
      lineIdx,
      col: loc.startCol,
      isLoop: isLoopNode(nodeId),
    });
  }

  // Sort descending by line then col so bottom-to-top insertion preserves positions.
  injections.sort((a, b) => b.lineIdx - a.lineIdx || b.col - a.col);

  // ── Inject ────────────────────────────────────────────────────────────────
  for (const inj of injections) {
    const indent = indentOf(lines[inj.lineIdx] ?? "");

    // For loop nodes we also inject __loopGuard() to cap iterations.
    const traceLine = inj.isLoop
      ? `${indent}__trace("${inj.nodeId}"); __loopGuard();`
      : `${indent}__trace("${inj.nodeId}");`;

    lines.splice(inj.lineIdx, 0, traceLine);
  }

  const traceableNodes = injections
    .slice()
    .sort((a, b) => a.lineIdx - b.lineIdx || a.col - b.col)
    .map((i) => i.nodeId);

  return {
    code: PREAMBLE + lines.join("\n"),
    traceableNodes,
  };
}
