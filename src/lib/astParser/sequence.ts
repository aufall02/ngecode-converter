// ─── Sequence Diagram Generator ───────────────────────────────────────────────
// Generates a Mermaid sequenceDiagram from function call interactions in the AST.
//
// Walks all FunctionDeclaration, arrow/function variables, and class methods,
// then extracts every CallExpression inside each body to build caller→callee
// relationships.
//
// Capped at 20 events to keep diagrams readable.

import type { Node } from "acorn";
import { walkSimple, toAN, sanitizeId, sanitizeLabel, getNodeName } from "./helpers";
import type { AcornNode } from "./helpers";
import type { MermaidResult } from "./types";

// ─── Internal types ───────────────────────────────────────────────────────────

interface CallEvent {
  caller: string;
  callee: string;
  method: string;
  isAsync: boolean;
}

// ─── Call extractor ───────────────────────────────────────────────────────────

/**
 * Recursively walk `node` and collect every CallExpression as a CallEvent
 * attributed to `caller`.
 */
function extractCalls(
  node: unknown,
  caller: string,
  events: CallEvent[],
  participants: Set<string>,
): void {
  if (!node || typeof node !== "object") return;
  const n = toAN(node);

  if (n.type === "CallExpression") {
    const callee = toAN(n.callee);
    if (callee.type === "MemberExpression") {
      const obj = getNodeName(callee.object);
      const method = getNodeName(callee.property);
      if (obj !== "unknown" && !obj.startsWith("console")) {
        participants.add(obj);
        events.push({ caller, callee: obj, method, isAsync: false });
      }
    } else {
      const name = getNodeName(callee);
      if (name !== "unknown" && name !== caller) {
        participants.add(name);
        events.push({ caller, callee: name, method: name, isAsync: false });
      }
    }
  }

  if (n.type === "AwaitExpression") {
    const last = events[events.length - 1];
    if (last) last.isAsync = true;
  }

  // Recurse into all child nodes
  for (const key of Object.keys(n)) {
    if (["type", "start", "end", "loc"].includes(key)) continue;
    const child = n[key];
    if (Array.isArray(child)) {
      for (const c of child) extractCalls(c, caller, events, participants);
    } else if (child && typeof child === "object" && (child as AcornNode).type) {
      extractCalls(child, caller, events, participants);
    }
  }
}

// ─── Public: generateSequence ─────────────────────────────────────────────────

/**
 * Generate a Mermaid `sequenceDiagram` from call interactions found in the AST.
 * Returns an error result if no interactions are found.
 */
export function generateSequence(ast: Node): MermaidResult {
  const events: CallEvent[] = [];
  const participants = new Set<string>();

  walkSimple(ast, {
    FunctionDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (!node.id) return;
      const name = getNodeName(node.id);
      participants.add(name);
      extractCalls(node.body, name, events, participants);
    },

    VariableDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (!Array.isArray(node.declarations)) return;
      for (const decl of node.declarations as unknown[]) {
        const d = toAN(decl);
        const init = d.init ? toAN(d.init) : null;
        if (
          init &&
          (init.type === "ArrowFunctionExpression" ||
            init.type === "FunctionExpression")
        ) {
          const name = getNodeName(d.id);
          participants.add(name);
          extractCalls(init.body, name, events, participants);
        }
      }
    },

    ClassDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const className = getNodeName(node.id);
      participants.add(className);
      const body = toAN(node.body);
      if (!body || !Array.isArray(body.body)) return;
      for (const member of body.body as unknown[]) {
        const m = toAN(member);
        if (m.type !== "MethodDefinition") continue;
        const value = m.value ? toAN(m.value) : null;
        if (value?.body) {
          extractCalls(value.body, className, events, participants);
        }
      }
    },
  });

  if (events.length === 0) {
    return {
      success: false,
      diagram: "",
      error:
        "No function call interactions found to generate a sequence diagram.",
    };
  }

  const lines: string[] = ["sequenceDiagram"];

  // Always include a "Main" participant for top-level calls
  const allParticipants = new Set<string>(["Main"]);
  for (const p of participants) allParticipants.add(p);
  for (const p of allParticipants) {
    lines.push(`  participant ${sanitizeId(p)} as ${sanitizeLabel(p)}`);
  }

  const limit = Math.min(events.length, 20);
  for (let i = 0; i < limit; i++) {
    const ev = events[i];
    const from = sanitizeId(ev.caller);
    const to = sanitizeId(ev.callee);
    const label = sanitizeLabel(ev.method) + "()";
    if (ev.isAsync) {
      lines.push(`  ${from}->>${to}: ${label}`);
      lines.push(`  ${to}-->>${from}: response`);
    } else {
      lines.push(`  ${from}->${to}: ${label}`);
    }
  }

  if (events.length > 20) {
    lines.push(`  Note over Main: ... ${events.length - 20} more calls`);
  }

  return { success: true, diagram: lines.join("\n") };
}
