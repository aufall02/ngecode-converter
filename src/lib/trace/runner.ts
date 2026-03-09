// ─── Trace Runner ─────────────────────────────────────────────────────────────
// Creates a sandboxed Web Worker (via Blob URL) that executes instrumented code
// and returns the full trace + console log output.
//
// Usage:
//   const result = await runTrace(instrumentedCode, { timeoutMs: 5000 });
//   // result.traces  → ["diamond_1", "rect_2", "round_3", ...]
//   // result.logs    → [{ level: "log", text: "Hello" }, ...]
//   // result.error   → "Error message" | null

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  level: "log" | "warn" | "error" | "info";
  text: string;
}

export interface TraceResult {
  /** Ordered list of nodeIds visited during execution */
  traces: string[];
  /** Captured console output */
  logs: LogEntry[];
  /** Error message if execution threw, null otherwise */
  error: string | null;
  /** Whether the run timed out */
  timedOut: boolean;
}

export interface RunOptions {
  /** Max ms before the worker is killed. Default: 5000 */
  timeoutMs?: number;
}

// ─── Worker source (runs inside the isolated Web Worker) ─────────────────────
// Written as a plain string so we can create it via Blob URL — no build config
// needed, works in any Vite/SvelteKit setup without extra worker plugin config.

const WORKER_SOURCE = /* javascript */ `
self.onmessage = function (e) {
  var code = e.data.code;

  // __traces and __logs are declared in the PREAMBLE injected by instrumentor.ts
  // We just need to eval() the code and then read them back.

  try {
    // Use indirect eval so the code runs in global (worker) scope, giving it
    // access to Math, Array, Object, JSON, String, Number, Boolean, etc.
    (0, eval)(code);

    self.postMessage({
      type:    "done",
      traces:  typeof __traces !== "undefined" ? __traces : [],
      logs:    typeof __logs   !== "undefined" ? __logs   : [],
      error:   null,
    });
  } catch (err) {
    self.postMessage({
      type:    "error",
      traces:  typeof __traces !== "undefined" ? __traces : [],
      logs:    typeof __logs   !== "undefined" ? __logs   : [],
      error:   err instanceof Error ? err.message : String(err),
    });
  }
};
`;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute `instrumentedCode` inside a sandboxed Web Worker and return the
 * full trace + console output once execution completes (or times out).
 *
 * The worker is created fresh for every call and terminated afterwards,
 * so there is no state leakage between runs.
 */
export function runTrace(
  instrumentedCode: string,
  options: RunOptions = {},
): Promise<TraceResult> {
  const timeoutMs = options.timeoutMs ?? 5_000;

  return new Promise((resolve) => {
    // ── Create worker from Blob URL ──────────────────────────────────────────
    let objectUrl: string | null = null;
    let worker: Worker | null = null;
    let settled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function cleanup() {
      if (timerId !== null) clearTimeout(timerId);
      worker?.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      worker = null;
      objectUrl = null;
    }

    function settle(result: TraceResult) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    try {
      const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
      objectUrl = URL.createObjectURL(blob);
      worker = new Worker(objectUrl);
    } catch (err) {
      // Fallback: worker creation failed (e.g. strict CSP)
      resolve({
        traces: [],
        logs: [],
        error:
          err instanceof Error
            ? `Failed to create worker: ${err.message}`
            : "Failed to create worker",
        timedOut: false,
      });
      return;
    }

    // ── Timeout guard ────────────────────────────────────────────────────────
    timerId = setTimeout(() => {
      settle({
        traces: [],
        logs: [],
        error: `Execution timed out after ${timeoutMs / 1000}s. Check for infinite loops.`,
        timedOut: true,
      });
    }, timeoutMs);

    // ── Handle messages from worker ──────────────────────────────────────────
    worker.onmessage = (e) => {
      const data = e.data as {
        type: "done" | "error";
        traces: string[];
        logs: LogEntry[];
        error: string | null;
      };

      settle({
        traces: Array.isArray(data.traces) ? data.traces : [],
        logs: Array.isArray(data.logs) ? data.logs : [],
        error: data.error ?? null,
        timedOut: false,
      });
    };

    worker.onerror = (e) => {
      settle({
        traces: [],
        logs: [],
        error: e.message ?? "Unknown worker error",
        timedOut: false,
      });
    };

    // ── Send code to worker ──────────────────────────────────────────────────
    worker.postMessage({ code: instrumentedCode });
  });
}
