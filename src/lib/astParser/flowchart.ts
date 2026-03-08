// ─── Flowchart Diagram Generator ──────────────────────────────────────────────
// Generates one Mermaid flowchart sub-graph per function found in the AST.
//
// Supported constructs:
//   • if / else / else-if
//   • switch / case
//   • for / while / do-while / for-of / for-in
//   • forEach / map / filter / reduce callbacks (treated as loop body)
//   • return / throw
//   • try / catch
//   • variable declarations
//   • expression statements & calls
//
// Output format: multiple flowcharts joined by "%%SPLIT%%" so the UI can
// render them stacked vertically, one card per function.

import type { Node } from "acorn";
import { walkSimple, toAN, sanitizeId, sanitizeLabel, getNodeName } from "./helpers";
import type { AcornNode } from "./helpers";
import type { MermaidResult, NodeLoc, FlowDirection } from "./types";

// ─── Internal state (reset per call) ─────────────────────────────────────────

let _nodeCounter = 0;

function freshId(prefix: string): string {
  return `${prefix}_${++_nodeCounter}`;
}

let _nodePositions: Record<string, NodeLoc> = {};

// ─── Graph primitives ─────────────────────────────────────────────────────────

interface FlowNode {
  id: string;
  /** Full mermaid shape definition, e.g. `id["label"]` */
  def: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

// Kept for future use (e.g. subgraph rendering)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  exits: string[];
}

// ─── Node emitters ────────────────────────────────────────────────────────────

function emitNode(
  label: string,
  shape: "rect" | "diamond" | "stadium" | "round" | "call",
  loc?: NodeLoc,
): FlowNode {
  const id = freshId(shape);
  let def: string;
  switch (shape) {
    case "diamond":
      def = `${id}{{"${sanitizeLabel(label)}"}}`;
      break;
    case "stadium":
      def = `${id}(["${sanitizeLabel(label)}"])`;
      break;
    case "round":
      def = `${id}(("${sanitizeLabel(label)}"))`;
      break;
    case "call":
      def = `${id}["🔧 ${sanitizeLabel(label)}"]`;
      break;
    default:
      def = `${id}["${sanitizeLabel(label)}"]`;
      break;
  }
  if (loc) _nodePositions[id] = loc;
  return { id, def };
}

/** Ekstrak NodeLoc dari AcornNode jika ada loc info */
function locOf(node: AcornNode): NodeLoc | undefined {
  const l = node.loc as
    | {
        start: { line: number; column: number };
        end: { line: number; column: number };
      }
    | undefined;
  if (!l) return undefined;
  return {
    startLine: l.start.line,
    startCol: l.start.column,
    endLine: l.end.line,
    endCol: l.end.column,
  };
}

// ─── Graph builders ───────────────────────────────────────────────────────────

function addNode(node: FlowNode, lines: string[]) {
  lines.push(`  ${node.def}`);
}

function addEdges(
  fromIds: string[],
  toId: string,
  lines: string[],
  label?: string,
) {
  for (const from of fromIds) {
    if (label) {
      lines.push(`  ${from} -->|"${label}"| ${toId}`);
    } else {
      lines.push(`  ${from} --> ${toId}`);
    }
  }
}

// ─── Statement walker ─────────────────────────────────────────────────────────

/**
 * Walk a list of AST statement nodes and build a FlowGraph.
 * `incomingIds` are the node IDs whose exits feed into the first statement.
 * Returns the exit IDs after all statements.
 */
function walkStatements(
  stmts: unknown[],
  lines: string[],
  incomingIds: string[],
): string[] {
  let currentIds = incomingIds;
  for (const stmt of stmts) {
    if (!stmt || typeof stmt !== "object") continue;
    currentIds = walkStatement(toAN(stmt), lines, currentIds);
  }
  return currentIds;
}

/**
 * Walk a single AST statement node.
 * Returns the exit IDs after this statement (nodes that need a successor edge).
 */
function walkStatement(
  s: AcornNode,
  lines: string[],
  incomingIds: string[],
): string[] {
  switch (s.type) {
    // ── Block ──────────────────────────────────────────────────────────────────
    case "BlockStatement": {
      return walkStatements((s.body as unknown[]) ?? [], lines, incomingIds);
    }

    // ── If statement ──────────────────────────────────────────────────────────
    case "IfStatement": {
      const condLabel = exprLabel(toAN(s.test));
      const condNode = emitNode(`if ${condLabel}`, "diamond", locOf(s));
      addNode(condNode, lines);
      addEdges(incomingIds, condNode.id, lines);

      // yes branch
      const yesEntry = emitNode("yes", "rect");
      addNode(yesEntry, lines);
      lines.push(`  ${condNode.id} -->|"yes"| ${yesEntry.id}`);
      const consExits = s.consequent
        ? walkStatement(toAN(s.consequent as object), lines, [yesEntry.id])
        : [yesEntry.id];

      if (s.alternate) {
        // no / else-if branch
        const noEntry = emitNode("no", "rect");
        addNode(noEntry, lines);
        lines.push(`  ${condNode.id} -->|"no"| ${noEntry.id}`);
        const altExits = walkStatement(toAN(s.alternate as object), lines, [
          noEntry.id,
        ]);
        return [...consExits, ...altExits];
      } else {
        // no else — "no" path skips to a merge node
        const skipNode = emitNode("skip", "rect");
        addNode(skipNode, lines);
        lines.push(`  ${condNode.id} -->|"no"| ${skipNode.id}`);
        return [...consExits, skipNode.id];
      }
    }

    // ── Switch statement ──────────────────────────────────────────────────────
    case "SwitchStatement": {
      const discLabel = exprLabel(toAN(s.discriminant));
      const switchNode = emitNode(`switch ${discLabel}`, "diamond");
      addNode(switchNode, lines);
      addEdges(incomingIds, switchNode.id, lines);

      const allExits: string[] = [];
      const cases = (s.cases as unknown[]) ?? [];
      for (const c of cases) {
        const cs = toAN(c);
        const caseLabel = cs.test ? exprLabel(toAN(cs.test)) : "default";
        const caseNode = emitNode(`case ${caseLabel}`, "rect");
        addNode(caseNode, lines);
        lines.push(
          `  ${switchNode.id} -->|"${sanitizeLabel(caseLabel)}"| ${caseNode.id}`,
        );
        const stmts = (cs.consequent as unknown[]) ?? [];
        const exits = walkStatements(stmts, lines, [caseNode.id]);
        allExits.push(...exits);
      }

      return allExits;
    }

    // ── For loop ──────────────────────────────────────────────────────────────
    case "ForStatement": {
      const initLabel = s.init ? exprLabel(toAN(s.init as object)) : "";
      const testLabel = s.test ? exprLabel(toAN(s.test as object)) : "true";
      const updLabel = s.update ? exprLabel(toAN(s.update as object)) : "";
      const loopLabel = [initLabel, testLabel, updLabel]
        .filter(Boolean)
        .join("; ");
      const loopNode = emitNode(`for (${loopLabel})`, "stadium", locOf(s));
      addNode(loopNode, lines);
      addEdges(incomingIds, loopNode.id, lines);

      const bodyExits = s.body
        ? walkStatement(toAN(s.body as object), lines, [loopNode.id])
        : [loopNode.id];
      for (const ex of bodyExits) {
        lines.push(`  ${ex} -.->|"next i"| ${loopNode.id}`);
      }

      const doneNode = emitNode("loop done", "rect");
      addNode(doneNode, lines);
      lines.push(`  ${loopNode.id} -->|"done"| ${doneNode.id}`);
      return [doneNode.id];
    }

    // ── While / DoWhile ───────────────────────────────────────────────────────
    case "WhileStatement":
    case "DoWhileStatement": {
      const testLabel = exprLabel(toAN(s.test as object));
      const loopNode = emitNode(`while (${testLabel})`, "stadium", locOf(s));
      addNode(loopNode, lines);
      addEdges(incomingIds, loopNode.id, lines);

      const bodyExits = s.body
        ? walkStatement(toAN(s.body as object), lines, [loopNode.id])
        : [loopNode.id];
      for (const ex of bodyExits) {
        lines.push(`  ${ex} -.->|"repeat"| ${loopNode.id}`);
      }

      const doneNode = emitNode("loop done", "rect");
      addNode(doneNode, lines);
      lines.push(`  ${loopNode.id} -->|"done"| ${doneNode.id}`);
      return [doneNode.id];
    }

    // ── For-of / For-in ───────────────────────────────────────────────────────
    case "ForOfStatement":
    case "ForInStatement": {
      const left = exprLabel(toAN(s.left as object));
      const right = exprLabel(toAN(s.right as object));
      const op = s.type === "ForOfStatement" ? "of" : "in";
      const loopNode = emitNode(
        `for (${left} ${op} ${right})`,
        "stadium",
        locOf(s),
      );
      addNode(loopNode, lines);
      addEdges(incomingIds, loopNode.id, lines);

      const bodyExits = s.body
        ? walkStatement(toAN(s.body as object), lines, [loopNode.id])
        : [loopNode.id];
      for (const ex of bodyExits) {
        lines.push(`  ${ex} -.->|"next"| ${loopNode.id}`);
      }

      const doneNode = emitNode("loop done", "rect");
      addNode(doneNode, lines);
      lines.push(`  ${loopNode.id} -->|"done"| ${doneNode.id}`);
      return [doneNode.id];
    }

    // ── Return ────────────────────────────────────────────────────────────────
    case "ReturnStatement": {
      const argLabel = s.argument
        ? exprLabel(toAN(s.argument as object))
        : "void";
      const retNode = emitNode(`return ${argLabel}`, "round", locOf(s));
      addNode(retNode, lines);
      addEdges(incomingIds, retNode.id, lines);
      return []; // dead-end — nothing follows a return
    }

    // ── Throw ─────────────────────────────────────────────────────────────────
    case "ThrowStatement": {
      const argLabel = s.argument
        ? exprLabel(toAN(s.argument as object))
        : "";
      const throwNode = emitNode(`throw ${argLabel}`, "round", locOf(s));
      addNode(throwNode, lines);
      addEdges(incomingIds, throwNode.id, lines);
      return [];
    }

    // ── Try / Catch ───────────────────────────────────────────────────────────
    case "TryStatement": {
      const tryNode = emitNode("try", "rect");
      addNode(tryNode, lines);
      addEdges(incomingIds, tryNode.id, lines);

      const tryExits = s.block
        ? walkStatement(toAN(s.block as object), lines, [tryNode.id])
        : [tryNode.id];

      let catchExits: string[] = [];
      if (s.handler) {
        const handler = toAN(s.handler as object);
        const catchLabel = handler.param
          ? `catch (${exprLabel(toAN(handler.param as object))})`
          : "catch";
        const catchNode = emitNode(catchLabel, "rect");
        addNode(catchNode, lines);
        addEdges([tryNode.id], catchNode.id, lines, "error");
        catchExits = handler.body
          ? walkStatement(toAN(handler.body as object), lines, [catchNode.id])
          : [catchNode.id];
      }

      return [...tryExits, ...catchExits];
    }

    // ── Variable declaration ──────────────────────────────────────────────────
    case "VariableDeclaration": {
      const decls = (s.declarations as unknown[]) ?? [];
      let ids = incomingIds;
      for (const d of decls) {
        const decl = toAN(d);
        const name = getNodeName(decl.id);
        const init = decl.init ? toAN(decl.init) : null;
        const label = init
          ? `${name} = ${exprLabel(init)}`
          : `${s.kind as string} ${name}`;
        const n = emitNode(
          label,
          init?.type?.includes("Function") ? "call" : "rect",
          locOf(toAN(d)),
        );
        addNode(n, lines);
        addEdges(ids, n.id, lines);
        ids = [n.id];
      }
      return ids;
    }

    // ── Expression statement (call, assignment, etc.) ─────────────────────────
    case "ExpressionStatement": {
      if (!s.expression) return incomingIds;
      const expr = toAN(s.expression as object);

      // ── Higher-order callback (forEach, map, filter, reduce, …) ──────────
      // Detect: obj.method((args) => { body }) or obj.method(function(args){})
      // Treat the callback body like a loop — stadium node + walk + back-edge.
      if (expr.type === "CallExpression") {
        const callArgs = (expr.arguments as unknown[]) ?? [];
        const callbackIdx = callArgs.findIndex((a) => {
          const arg = toAN(a);
          return (
            arg.type === "ArrowFunctionExpression" ||
            arg.type === "FunctionExpression"
          );
        });

        if (callbackIdx !== -1) {
          const callback = toAN(callArgs[callbackIdx]);
          const callee = toAN(expr.callee as object);
          const calleeLabel = exprLabel(callee);

          // Callback parameter names: (item, i) etc.
          const params = ((callback.params as unknown[]) ?? [])
            .map((p) => getNodeName(toAN(p)))
            .join(", ");

          // Non-callback args (e.g. reduce's initial accumulator)
          const otherArgs = callArgs
            .filter((_, idx) => idx !== callbackIdx)
            .map((a) => exprLabel(toAN(a)))
            .filter(Boolean);

          const loopLabel =
            otherArgs.length > 0
              ? `${calleeLabel}(${params}; init: ${otherArgs.join(", ")})`
              : `${calleeLabel}(${params || "…"})`;

          const loopNode = emitNode(loopLabel, "stadium", locOf(s));
          addNode(loopNode, lines);
          addEdges(incomingIds, loopNode.id, lines);

          const callbackBody = getFuncBody(callback);
          if (callbackBody) {
            let stmts: unknown[];
            if (
              callbackBody.type === "BlockStatement" &&
              Array.isArray(callbackBody.body)
            ) {
              // Block body: (x) => { stmt1; stmt2 }
              stmts = callbackBody.body as unknown[];
            } else {
              // Expression body: (x) => expr  — wrap as fake ExpressionStatement
              stmts = [
                {
                  type: "ExpressionStatement",
                  expression: callbackBody,
                } as unknown,
              ];
            }
            const bodyExits = walkStatements(stmts, lines, [loopNode.id]);
            for (const ex of bodyExits) {
              lines.push(`  ${ex} -.->|"next"| ${loopNode.id}`);
            }
          }

          const doneNode = emitNode("done", "rect");
          addNode(doneNode, lines);
          lines.push(`  ${loopNode.id} -->|"done"| ${doneNode.id}`);
          return [doneNode.id];
        }
      }

      // ── Regular expression statement ──────────────────────────────────────
      const label = exprLabel(expr);
      const shape = expr.type === "CallExpression" ? "call" : "rect";
      const n = emitNode(label, shape, locOf(s));
      addNode(n, lines);
      addEdges(incomingIds, n.id, lines);
      return [n.id];
    }

    // ── Everything else → single rect ─────────────────────────────────────────
    default: {
      const label = s.type.replace(/Statement|Declaration/, "");
      if (!label) return incomingIds;
      const n = emitNode(label, "rect");
      addNode(n, lines);
      addEdges(incomingIds, n.id, lines);
      return [n.id];
    }
  }
}

// ─── Expression label ─────────────────────────────────────────────────────────

/** Produce a compact human-readable label for an expression node. */
function exprLabel(n: AcornNode): string {
  if (!n) return "";
  switch (n.type) {
    case "Identifier":
      return (n.name as string) ?? "?";
    case "Literal":
      return String(n.raw ?? n.value ?? "");
    case "BinaryExpression":
    case "LogicalExpression":
      return `${exprLabel(toAN(n.left as object))} ${n.operator as string} ${exprLabel(toAN(n.right as object))}`;
    case "UnaryExpression":
      return `${n.operator as string}${exprLabel(toAN(n.argument as object))}`;
    case "AssignmentExpression":
      return `${exprLabel(toAN(n.left as object))} ${n.operator as string} ${exprLabel(toAN(n.right as object))}`;
    case "UpdateExpression":
      return n.prefix
        ? `${n.operator as string}${exprLabel(toAN(n.argument as object))}`
        : `${exprLabel(toAN(n.argument as object))}${n.operator as string}`;
    case "MemberExpression":
      return `${exprLabel(toAN(n.object as object))}.${exprLabel(toAN(n.property as object))}`;
    case "CallExpression": {
      const callee = exprLabel(toAN(n.callee as object));
      const args = ((n.arguments as unknown[]) ?? [])
        .slice(0, 2)
        .map((a) => exprLabel(toAN(a)))
        .join(", ");
      return `${callee}(${args})`;
    }
    case "VariableDeclaration": {
      const d = toAN((n.declarations as unknown[])?.[0] ?? {});
      return `${n.kind as string} ${getNodeName(d.id)} = ...`;
    }
    case "TemplateLiteral":
      return "`...`";
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "fn(...)";
    case "ObjectExpression":
      return "{...}";
    case "ArrayExpression":
      return "[...]";
    case "ConditionalExpression":
      return `${exprLabel(toAN(n.test as object))} ? ... : ...`;
    case "NewExpression":
      return `new ${exprLabel(toAN(n.callee as object))}(...)`;
    default:
      return n.type.replace(/Expression|Statement/, "") || "expr";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the body block from a function-like node. */
function getFuncBody(node: AcornNode): AcornNode | null {
  return node.body ? toAN(node.body as object) : null;
}

// ─── Public: generateFlowchart ────────────────────────────────────────────────

/**
 * Generate one Mermaid flowchart per function/method found in the AST.
 * Top-level script statements (outside any function) get their own "(script)" block.
 *
 * Multiple diagrams are joined by "%%SPLIT%%" so the UI can render them
 * as separate stacked cards.
 */
export function generateFlowchart(
  ast: Node,
  flowDirection: FlowDirection = "TD",
): MermaidResult {
  // Reset global counters for this run
  _nodeCounter = 0;
  _nodePositions = {};

  interface FuncEntry {
    name: string;
    /** Class name if this is a method, null for standalone functions */
    className: string | null;
    isAsync: boolean;
    bodyNode: AcornNode;
  }

  const funcs: FuncEntry[] = [];

  // ── Collect function declarations ──────────────────────────────────────────
  walkSimple(ast, {
    FunctionDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (!node.id) return;
      const body = getFuncBody(node);
      if (body) {
        funcs.push({
          name: getNodeName(node.id),
          className: null,
          isAsync: !!node.async,
          bodyNode: body,
        });
      }
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
          const body = getFuncBody(init);
          if (body) {
            funcs.push({
              name: getNodeName(d.id),
              className: null,
              isAsync: !!init.async,
              bodyNode: body,
            });
          }
        }
      }
    },

    ClassDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const cName = getNodeName(node.id);
      const body = toAN(node.body);
      if (!body || !Array.isArray(body.body)) return;
      for (const member of body.body as unknown[]) {
        const m = toAN(member);
        if (m.type !== "MethodDefinition") continue;
        const mName = getNodeName(m.key);
        const mValue = m.value ? toAN(m.value) : null;
        const mBody = mValue ? getFuncBody(mValue) : null;
        if (mBody) {
          funcs.push({
            name: mName,
            className: cName,
            isAsync: !!mValue?.async,
            bodyNode: mBody,
          });
        }
      }
    },
  });

  // ── Collect top-level non-function statements ──────────────────────────────
  // Statements outside any function/class (e.g. top-level calls, assignments)
  // are shown as a separate "(script)" block.
  const programNode = toAN(ast);
  const allTopLevel = Array.isArray(programNode.body)
    ? (programNode.body as unknown[])
    : [];

  const topLevelScriptStmts = allTopLevel.filter((raw) => {
    const s = toAN(raw);
    if (s.type === "FunctionDeclaration") return false;
    if (s.type === "ClassDeclaration") return false;
    if (s.type === "VariableDeclaration") {
      // Exclude variable declarations where every declarator is a function
      const decls = (s.declarations as unknown[]) ?? [];
      const allAreFuncs = decls.every((d) => {
        const node = toAN(d as unknown);
        const init = node.init ? toAN(node.init as unknown) : null;
        return (
          init?.type === "ArrowFunctionExpression" ||
          init?.type === "FunctionExpression"
        );
      });
      return !allAreFuncs;
    }
    return true;
  });

  // ── Edge case: no functions and no script statements ───────────────────────
  if (funcs.length === 0 && topLevelScriptStmts.length === 0) {
    return {
      success: false,
      diagram: "",
      error: "No statements found to generate a flowchart.",
    };
  }

  // ── Helper: build a single flowchart block ─────────────────────────────────
  function buildBlock(
    stmts: unknown[],
    startLabel: string,
    metaLines: string[],
  ): string {
    const block: string[] = [`flowchart ${flowDirection}`, ...metaLines];
    const startNode = emitNode(startLabel, "round");
    block.push(`  ${startNode.def}`);
    const exits = walkStatements(stmts, block, [startNode.id]);
    if (exits.length > 0) {
      const endNode = emitNode("End ◀", "round");
      block.push(`  ${endNode.def}`);
      addEdges(exits, endNode.id, block);
    }
    return block.join("\n");
  }

  // ── No named functions: render everything as a single (script) block ───────
  if (funcs.length === 0) {
    return {
      success: true,
      diagram: buildBlock(
        topLevelScriptStmts,
        "▶ (script)",
        ["  %% fn: (script)"],
      ),
      nodePositions: { ..._nodePositions },
    };
  }

  // ── Render each function + optional (script) block ────────────────────────
  const diagrams: string[] = [];

  // (script) block first, if there are top-level statements
  if (topLevelScriptStmts.length > 0) {
    diagrams.push(
      buildBlock(topLevelScriptStmts, "▶ (script)", ["  %% fn: (script)"]),
    );
  }

  for (const fn of funcs) {
    const asyncTag = fn.isAsync ? " ⚡" : "";
    const title = `${sanitizeLabel(fn.name)}${asyncTag}`;

    const metaLines = [`  %% fn: ${title}`];
    if (fn.className) {
      metaLines.push(`  %% class: ${sanitizeLabel(fn.className)}`);
    }

    const fullLabel = fn.className
      ? `▶ ${sanitizeLabel(fn.className)}.${title}`
      : `▶ ${title}`;

    const stmts = Array.isArray(fn.bodyNode.body)
      ? (fn.bodyNode.body as unknown[])
      : [fn.bodyNode as unknown];

    const block: string[] = [`flowchart ${flowDirection}`, ...metaLines];
    const startNode = emitNode(fullLabel, "round");
    block.push(`  ${startNode.def}`);
    const exits = walkStatements(stmts, block, [startNode.id]);
    if (exits.length > 0) {
      const endNode = emitNode("End ◀", "round");
      block.push(`  ${endNode.def}`);
      addEdges(exits, endNode.id, block);
    }

    diagrams.push(block.join("\n"));
  }

  return {
    success: true,
    diagram: diagrams.join("\n\n%%SPLIT%%\n\n"),
    nodePositions: { ..._nodePositions },
  };
}
