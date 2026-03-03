import type { Node } from "acorn";
import { simple as walkSimple } from "acorn-walk";

export interface DiagramType {
  type: string;
  name: string;
  description: string;
}

export interface NodeLoc {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface MermaidResult {
  success: boolean;
  diagram: string;
  error?: string;
  /** Map dari mermaid node ID → posisi source code */
  nodePositions?: Record<string, NodeLoc>;
}

export type FlowDirection = "TD" | "LR";

export function getDiagramTypes(): DiagramType[] {
  return [
    {
      type: "flowchart",
      name: "Flowchart",
      description:
        "Shows control flow: conditions, loops, and calls per function",
    },
    {
      type: "structure",
      name: "Class Structure",
      description: "Shows classes, methods, and properties",
    },
    {
      type: "dependencies",
      name: "Dependencies",
      description: "Shows import/export relationships",
    },
    {
      type: "sequence",
      name: "Sequence",
      description: "Shows function call sequence",
    },
  ];
}

export function astToMermaid(
  ast: Node,
  diagramType: string,
  flowDirection: FlowDirection = "TD",
): MermaidResult {
  try {
    switch (diagramType) {
      case "flowchart":
        return generateFlowchart(ast, flowDirection);
      case "structure":
        return generateClassStructure(ast);
      case "dependencies":
        return generateDependencies(ast);
      case "sequence":
        return generateSequence(ast);
      default:
        return generateFlowchart(ast, flowDirection);
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    return {
      success: false,
      diagram: "",
      error: e.message ?? "Failed to convert AST to diagram",
    };
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

// Loose record type used for internal traversal – we cast through unknown
// at every walkSimple callback boundary to satisfy TypeScript.
type AcornNode = Record<string, unknown> & { type: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function sanitizeLabel(name: string): string {
  return name.replace(/"/g, "'").replace(/[<>]/g, "");
}

function toAN(node: unknown): AcornNode {
  return node as AcornNode;
}

function getNodeName(node: unknown): string {
  if (!node || typeof node !== "object") return "unknown";
  const n = node as AcornNode;
  if (n.type === "Identifier") return (n.name as string) ?? "unknown";
  if (n.type === "MemberExpression") {
    return `${getNodeName(n.object)}.${getNodeName(n.property)}`;
  }
  return "unknown";
}

// ─── Class Structure Diagram ──────────────────────────────────────────────────

interface ClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  superClass?: string;
}

function generateClassStructure(ast: Node): MermaidResult {
  const classes: Map<string, ClassInfo> = new Map();
  const functions: string[] = [];
  const variables: string[] = [];

  walkSimple(ast, {
    ClassDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const className = getNodeName(node.id);
      const info: ClassInfo = {
        name: className,
        methods: [],
        properties: [],
        superClass: node.superClass ? getNodeName(node.superClass) : undefined,
      };

      const body = toAN(node.body);
      if (body && Array.isArray(body.body)) {
        for (const member of body.body as unknown[]) {
          const m = toAN(member);
          if (m.type === "MethodDefinition") {
            const methodName = getNodeName(m.key);
            const kind = m.kind as string;
            const isStatic = m.static as boolean;
            const prefix = isStatic ? "+" : "+";
            const suffix =
              kind === "get" ? " (get)" : kind === "set" ? " (set)" : "()";
            if (methodName !== "constructor") {
              info.methods.push(`${prefix}${methodName}${suffix}`);
            }
          } else if (
            m.type === "PropertyDefinition" ||
            m.type === "ClassProperty"
          ) {
            const propName = getNodeName(m.key);
            const isStatic = m.static as boolean;
            info.properties.push(`${isStatic ? "+" : "+"}${propName}`);
          }
        }
      }

      classes.set(className, info);
    },

    FunctionDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (node.id) {
        const name = getNodeName(node.id);
        functions.push(name);
      }
    },

    VariableDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (Array.isArray(node.declarations)) {
        for (const decl of node.declarations as unknown[]) {
          const d = toAN(decl);
          const init = d.init ? toAN(d.init) : null;
          if (
            init &&
            (init.type === "ArrowFunctionExpression" ||
              init.type === "FunctionExpression")
          ) {
            const name = getNodeName(d.id);
            functions.push(name);
          } else if (!init || (init && init.type !== "NewExpression")) {
            const name = getNodeName(d.id);
            if (name !== "unknown") variables.push(name);
          }
        }
      }
    },
  });

  if (classes.size === 0 && functions.length === 0) {
    return {
      success: false,
      diagram: "",
      error:
        "No classes or functions found. Try a different diagram type or add some code.",
    };
  }

  const lines: string[] = ["classDiagram"];

  for (const [, info] of classes) {
    lines.push(`  class ${sanitizeId(info.name)} {`);
    for (const prop of info.properties) {
      lines.push(`    ${sanitizeLabel(prop)}`);
    }
    for (const method of info.methods) {
      lines.push(`    ${sanitizeLabel(method)}`);
    }
    lines.push("  }");
  }

  // Emit inheritance
  for (const [, info] of classes) {
    if (info.superClass && classes.has(info.superClass)) {
      lines.push(
        `  ${sanitizeId(info.superClass)} <|-- ${sanitizeId(info.name)}`,
      );
    }
  }

  // Emit standalone functions as a module box
  if (functions.length > 0) {
    lines.push(`  class Functions {`);
    for (const fn of functions.slice(0, 12)) {
      lines.push(`    +${sanitizeLabel(fn)}()`);
    }
    if (functions.length > 12) {
      lines.push(`    +... ${functions.length - 12} more`);
    }
    lines.push("  }");
  }

  // suppress unused-variable warning
  void variables;

  return { success: true, diagram: lines.join("\n") };
}

// ─── Flowchart Diagram ────────────────────────────────────────────────────────

// ─── Flowchart Generator ──────────────────────────────────────────────────────
// Renders one sub-graph per function with proper control-flow nodes:
//   • rectangle  → statement / call
//   • diamond    → if / switch condition
//   • stadium    → loop header (for / while / do-while)
//   • rounded    → Start / End
// Edges carry "yes/no/true/false" labels where appropriate.

let _nodeCounter = 0;
function freshId(prefix: string): string {
  return `${prefix}_${++_nodeCounter}`;
}

// Map nodeId → source position, di-reset tiap generateFlowchart()
let _nodePositions: Record<string, NodeLoc> = {};

interface FlowNode {
  id: string;
  // mermaid shape definition, e.g. `id["label"]`
  def: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  // The last "exit" ids from this sub-graph so the parent can wire up the next node
  exits: string[];
}

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

// Walk a list of AST statement nodes and build a FlowGraph.
// `incomingIds` are the node IDs whose exits feed into the first statement.
function walkStatements(
  stmts: unknown[],
  lines: string[],
  incomingIds: string[],
): string[] /* exitIds */ {
  let currentIds = incomingIds;

  for (const stmt of stmts) {
    if (!stmt || typeof stmt !== "object") continue;
    const s = toAN(stmt);
    currentIds = walkStatement(s, lines, currentIds);
  }

  return currentIds;
}

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

// Returns the exit IDs after this statement (nodes that need a successor edge)
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

      // yes branch — emit a labelled connector node, then walk into the block
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
        // no else — "no" path skips straight to a merge node
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
      // back-edge from body to loop header
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
      const argLabel = s.argument ? exprLabel(toAN(s.argument as object)) : "";
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

      // ── Higher-order function call with inline callback ────────────────────
      // Deteksi: obj.forEach/map/filter/reduce/find/some/every((args) => { body })
      // Perlakukan callback seperti loop body — stadium node + walk isi + back-edge
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

          // Label param dari callback: (tip, i) atau (item) dll
          const params = ((callback.params as unknown[]) ?? [])
            .map((p) => getNodeName(toAN(p)))
            .join(", ");

          // Non-callback args sebelum/sesudah callback (misal reduce accumulator)
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

          // Walk callback body statements
          // Dua kasus:
          //   1. Block body:      (x) => { stmt1; stmt2 }  → body adalah BlockStatement
          //   2. Expression body: (x) => expr              → body adalah Expression langsung
          const callbackBody = getFuncBody(callback);
          if (callbackBody) {
            let stmts: unknown[];
            if (
              callbackBody.type === "BlockStatement" &&
              Array.isArray(callbackBody.body)
            ) {
              // Kasus 1: block body — ambil array statements
              stmts = callbackBody.body as unknown[];
            } else {
              // Kasus 2: expression body — bungkus sebagai ExpressionStatement palsu
              // supaya walkStatement bisa handle sebagai ExpressionStatement
              stmts = [
                {
                  type: "ExpressionStatement",
                  expression: callbackBody,
                } as unknown,
              ];
            }
            const bodyExits = walkStatements(stmts, lines, [loopNode.id]);
            // back-edge: setelah tiap iterasi kembali ke loop header
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

// Produce a compact human-readable label for an expression node
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

// Extract the body block from a function-like node
function getFuncBody(node: AcornNode): AcornNode | null {
  const body = node.body ? toAN(node.body as object) : null;
  return body;
}

function generateFlowchart(
  ast: Node,
  flowDirection: FlowDirection = "TD",
): MermaidResult {
  _nodeCounter = 0;
  _nodePositions = {};

  // Collect top-level function definitions: FunctionDeclaration, arrow/function
  // assigned to a const, and class methods.
  interface FuncEntry {
    name: string;
    /** Class name jika method, null jika standalone function */
    className: string | null;
    isAsync: boolean;
    bodyNode: AcornNode;
  }

  const funcs: FuncEntry[] = [];

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

  if (funcs.length === 0) {
    return {
      success: false,
      diagram: "",
      error: "No functions found to generate a flowchart.",
    };
  }

  // Render each function as its own independent flowchart block,
  // separated by a "%%SPLIT%%" divider so the UI can split and
  // render them one-by-one stacked vertically.
  const diagrams: string[] = [];

  for (const fn of funcs) {
    const asyncTag = fn.isAsync ? " ⚡" : "";
    // title yang ditampilkan di start node: hanya method name (tanpa class prefix)
    const title = `${sanitizeLabel(fn.name)}${asyncTag}`;
    const block: string[] = [`flowchart ${flowDirection}`];
    // Embed metadata untuk UI — fn: nama method, class: nama class (opsional)
    block.push(`  %% fn: ${title}`);
    if (fn.className) {
      block.push(`  %% class: ${sanitizeLabel(fn.className)}`);
    }

    // Start node — tampilkan "ClassName.method" supaya jelas konteksnya
    const fullLabel = fn.className
      ? `▶ ${sanitizeLabel(fn.className)}.${title}`
      : `▶ ${title}`;
    const startNode = emitNode(fullLabel, "round");
    block.push(`  ${startNode.def}`);

    // Walk the body statements
    const stmts = Array.isArray(fn.bodyNode.body)
      ? (fn.bodyNode.body as unknown[])
      : [fn.bodyNode as unknown];

    const exits = walkStatements(stmts, block, [startNode.id]);

    // End node — only connect if there are live exits (not all paths returned)
    if (exits.length > 0) {
      const endNode = emitNode("End ◀", "round");
      block.push(`  ${endNode.def}`);
      addEdges(exits, endNode.id, block);
    }

    diagrams.push(block.join("\n"));
  }

  // Join with a special separator the renderer can split on
  return {
    success: true,
    diagram: diagrams.join("\n\n%%SPLIT%%\n\n"),
    nodePositions: { ..._nodePositions },
  };
}

// ─── Dependencies Diagram ─────────────────────────────────────────────────────

interface ImportInfo {
  source: string;
  specifiers: string[];
}

interface ExportInfo {
  name: string;
  type: "default" | "named" | "all";
}

function generateDependencies(ast: Node): MermaidResult {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const moduleName = "ThisModule";

  walkSimple(ast, {
    ImportDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const source = toAN(node.source).value as string;
      const specifiers: string[] = [];
      if (Array.isArray(node.specifiers)) {
        for (const spec of node.specifiers as unknown[]) {
          const s = toAN(spec);
          if (s.type === "ImportDefaultSpecifier") {
            specifiers.push(getNodeName(s.local));
          } else if (s.type === "ImportNamespaceSpecifier") {
            specifiers.push(`* as ${getNodeName(s.local)}`);
          } else {
            specifiers.push(getNodeName(s.imported));
          }
        }
      }
      imports.push({ source, specifiers });
    },

    ExportDefaultDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      let name = "default";
      if (node.declaration) {
        const decl = toAN(node.declaration);
        if (decl.id) name = getNodeName(decl.id);
        else if (decl.type === "Identifier") name = getNodeName(decl);
      }
      exports.push({ name, type: "default" });
    },

    ExportNamedDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (node.declaration) {
        const decl = toAN(node.declaration);
        if (decl.id) {
          exports.push({ name: getNodeName(decl.id), type: "named" });
        } else if (Array.isArray(decl.declarations)) {
          for (const d of decl.declarations as unknown[]) {
            exports.push({ name: getNodeName(toAN(d).id), type: "named" });
          }
        }
      }
      if (Array.isArray(node.specifiers)) {
        for (const spec of node.specifiers as unknown[]) {
          exports.push({
            name: getNodeName(toAN(spec).exported),
            type: "named",
          });
        }
      }
    },

    ExportAllDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const source = toAN(node.source).value as string;
      exports.push({ name: `re-export from ${source}`, type: "all" });
    },
  });

  if (imports.length === 0 && exports.length === 0) {
    return {
      success: false,
      diagram: "",
      error:
        "No import/export statements found. Add some imports or exports to see the dependency graph.",
    };
  }

  const lines: string[] = ["flowchart LR"];
  const seenSources = new Set<string>();

  lines.push(`  ${sanitizeId(moduleName)}["📦 ${moduleName}"]`);

  for (const imp of imports) {
    const srcId = sanitizeId(imp.source);
    if (!seenSources.has(srcId)) {
      const label = imp.source.startsWith(".")
        ? `📄 ${imp.source}`
        : `📦 ${imp.source}`;
      lines.push(`  ${srcId}["${sanitizeLabel(label)}"]`);
      seenSources.add(srcId);
    }
    const edgeLabel =
      imp.specifiers.length > 0
        ? imp.specifiers.slice(0, 3).join(", ") +
          (imp.specifiers.length > 3 ? "..." : "")
        : "import";
    lines.push(
      `  ${srcId} -->|"${sanitizeLabel(edgeLabel)}"| ${sanitizeId(moduleName)}`,
    );
  }

  if (exports.length > 0) {
    lines.push(`  Exports["🚀 Exports"]`);
    for (const exp of exports) {
      const label =
        exp.type === "default"
          ? `default: ${exp.name}`
          : exp.type === "all"
            ? exp.name
            : exp.name;
      lines.push(
        `  ${sanitizeId(moduleName)} -->|"${sanitizeLabel(label)}"| Exports`,
      );
    }
  }

  return { success: true, diagram: lines.join("\n") };
}

// ─── Sequence Diagram ─────────────────────────────────────────────────────────

interface CallEvent {
  caller: string;
  callee: string;
  method: string;
  isAsync: boolean;
}

function generateSequence(ast: Node): MermaidResult {
  const events: CallEvent[] = [];
  const participants = new Set<string>();

  function extractCalls(node: unknown, caller: string) {
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

    for (const key of Object.keys(n)) {
      if (["type", "start", "end", "loc"].includes(key)) continue;
      const child = n[key];
      if (Array.isArray(child)) {
        child.forEach((c) => extractCalls(c, caller));
      } else if (
        child &&
        typeof child === "object" &&
        (child as AcornNode).type
      ) {
        extractCalls(child, caller);
      }
    }
  }

  walkSimple(ast, {
    FunctionDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (node.id) {
        const name = getNodeName(node.id);
        participants.add(name);
        extractCalls(node.body, name);
      }
    },
    VariableDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (Array.isArray(node.declarations)) {
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
            extractCalls(init.body, name);
          }
        }
      }
    },
    ClassDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const className = getNodeName(node.id);
      participants.add(className);
      const body = toAN(node.body);
      if (body && Array.isArray(body.body)) {
        for (const member of body.body as unknown[]) {
          const m = toAN(member);
          if (m.type === "MethodDefinition") {
            const value = m.value ? toAN(m.value) : null;
            if (value?.body) extractCalls(value.body, className);
          }
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
