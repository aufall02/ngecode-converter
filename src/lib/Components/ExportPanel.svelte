<script lang="ts">
    import {
        Download,
        FileImage,
        FileCode,
        FileType,
        Package,
    } from "lucide-svelte";

    interface DiagramItem {
        title: string;
        svg: string;
        group: string | null;
        collapsed: boolean;
    }

    interface Props {
        mermaidSvg?: string;
        mermaidSvgs?: DiagramItem[];
        mermaidCode?: string;
        filename?: string;
        theme?: "light" | "dark";
    }

    let {
        mermaidSvg = "",
        mermaidSvgs = [],
        mermaidCode = "",
        filename = "diagram",
        theme = "light",
    }: Props = $props();

    let isExporting = $state(false);
    let exportStatus = $state<string | null>(null);

    // Checklist state — index dari mermaidSvgs yang dipilih
    let selected = $state<Set<number>>(new Set());

    // Saat mermaidSvgs berubah, select semua secara default
    $effect(() => {
        if (mermaidSvgs.length > 0) {
            selected = new Set(mermaidSvgs.map((_, i) => i));
        }
    });

    const isMulti = $derived(mermaidSvgs.length > 1);
    const selectedCount = $derived(selected.size);
    const allChecked = $derived(
        mermaidSvgs.length > 0 && selected.size === mermaidSvgs.length,
    );

    function toggleSelect(i: number) {
        const next = new Set(selected);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        selected = next;
    }

    function toggleAll() {
        if (allChecked) {
            selected = new Set();
        } else {
            selected = new Set(mermaidSvgs.map((_, i) => i));
        }
    }

    // ── Status helper ────────────────────────────────────────────────────────
    function showStatus(msg: string, isError = false) {
        exportStatus = isError ? `❌ ${msg}` : `✅ ${msg}`;
        setTimeout(() => (exportStatus = null), 2800);
    }

    // ── Helper: download blob ─────────────────────────────────────────────────
    function downloadBlob(blob: Blob, name: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Helper: slugify ───────────────────────────────────────────────────────
    function slug(title: string) {
        return (
            title
                .replace(/[^a-zA-Z0-9]+/g, "-")
                .toLowerCase()
                .replace(/^-|-$/g, "") || "diagram"
        );
    }

    // ── Helper: siapkan SVG string (set dimensi eksplisit + background rect) ──
    async function prepareSvg(svgStr: string): Promise<string> {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgStr, "image/svg+xml");
        const svgEl = svgDoc.querySelector("svg");
        if (!svgEl) throw new Error("No SVG element");

        let w = parseFloat(svgEl.getAttribute("width") ?? "0");
        let h = parseFloat(svgEl.getAttribute("height") ?? "0");
        if (!w || !h) {
            const vb = svgEl.getAttribute("viewBox");
            if (vb) {
                const parts = vb.split(/[\s,]+/);
                w = parseFloat(parts[2]) || 800;
                h = parseFloat(parts[3]) || 600;
            } else {
                w = 800;
                h = 600;
            }
        }
        svgEl.setAttribute("width", String(w));
        svgEl.setAttribute("height", String(h));

        // Background rect
        const bg = svgDoc.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", "0");
        bg.setAttribute("width", String(w));
        bg.setAttribute("height", String(h));
        bg.setAttribute("fill", theme === "dark" ? "#1e1e2e" : "#ffffff");
        svgEl.insertBefore(bg, svgEl.firstChild);

        return new XMLSerializer().serializeToString(svgEl);
    }

    // ── Helper: SVG string → PNG Blob ─────────────────────────────────────────
    // Pakai data: URI bukan blob: URL agar canvas tidak kena taint cross-origin
    async function svgToPng(svgStr: string, scale = 2): Promise<Blob> {
        const prepared = await prepareSvg(svgStr);

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(prepared, "image/svg+xml");
        const svgEl = svgDoc.querySelector("svg")!;

        const w = parseFloat(svgEl.getAttribute("width") ?? "800");
        const h = parseFloat(svgEl.getAttribute("height") ?? "600");

        // Encode ke data URI — menghindari masalah canvas taint
        const svgString = new XMLSerializer().serializeToString(svgEl);
        const dataUri =
            "data:image/svg+xml;base64," +
            btoa(unescape(encodeURIComponent(svgString)));

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);

        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = theme === "dark" ? "#1e1e2e" : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                resolve();
            };
            img.onerror = (e) => {
                console.error("img load error", e);
                reject(new Error("SVG image load failed"));
            };
            img.src = dataUri;
        });

        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
                "image/png",
            );
        });
    }

    // ── Export SVG ────────────────────────────────────────────────────────────
    async function doExportSvg(svgStr: string, name: string) {
        const prepared = await prepareSvg(svgStr);
        downloadBlob(
            new Blob([prepared], { type: "image/svg+xml;charset=utf-8" }),
            `${name}.svg`,
        );
    }

    // ── Export PNG ────────────────────────────────────────────────────────────
    async function doExportPng(svgStr: string, name: string, scale = 2) {
        const blob = await svgToPng(svgStr, scale);
        downloadBlob(blob, `${name}.png`);
    }

    // ── Export selected diagrams ──────────────────────────────────────────────
    async function exportSelected(format: "svg" | "png", scale = 2) {
        if (selected.size === 0) {
            showStatus("Pilih minimal 1 diagram dulu.", true);
            return;
        }
        isExporting = true;
        try {
            const items = mermaidSvgs.filter((_, i) => selected.has(i));

            if (items.length === 1) {
                // Langsung download satu file
                const item = items[0];
                const name = slug(item.title);
                if (format === "svg") {
                    await doExportSvg(item.svg, name);
                } else {
                    await doExportPng(item.svg, name, scale);
                }
                showStatus(`${format.toUpperCase()} exported!`);
            } else {
                // Banyak file → ZIP
                const { default: JSZip } = await import("jszip");
                const zip = new JSZip();

                for (let i = 0; i < mermaidSvgs.length; i++) {
                    if (!selected.has(i)) continue;
                    const item = mermaidSvgs[i];
                    const name = slug(item.title);
                    if (format === "svg") {
                        const prepared = await prepareSvg(item.svg);
                        zip.file(`${name}.svg`, prepared);
                    } else {
                        const blob = await svgToPng(item.svg, scale);
                        zip.file(`${name}.png`, blob);
                    }
                }

                const zipBlob = await zip.generateAsync({ type: "blob" });
                downloadBlob(
                    zipBlob,
                    `${filename}-${items.length}diagrams.zip`,
                );
                showStatus(
                    `ZIP (${items.length} file ${format.toUpperCase()}) exported!`,
                );
            }
        } catch (e) {
            console.error("Export error:", e);
            showStatus("Export failed. Cek console.", true);
        } finally {
            isExporting = false;
        }
    }

    // ── Export single (mode 1 diagram) ───────────────────────────────────────
    async function exportSingle(format: "svg" | "png", scale = 2) {
        const svg = mermaidSvgs.length === 1 ? mermaidSvgs[0].svg : mermaidSvg;
        if (!svg) return;
        isExporting = true;
        try {
            if (format === "svg") {
                await doExportSvg(svg, filename);
            } else {
                await doExportPng(svg, filename, scale);
            }
            showStatus(
                `${format.toUpperCase()}${scale > 1 ? ` @${scale}x` : ""} exported!`,
            );
        } catch (e) {
            console.error("Export error:", e);
            showStatus("Export failed. Cek console.", true);
        } finally {
            isExporting = false;
        }
    }

    // ── Mermaid source ────────────────────────────────────────────────────────
    function exportMermaid() {
        if (!mermaidCode) return;
        try {
            downloadBlob(
                new Blob([mermaidCode], { type: "text/plain;charset=utf-8" }),
                `${filename}.mmd`,
            );
            showStatus("Mermaid source exported!");
        } catch {
            showStatus("Export failed.", true);
        }
    }

    async function copyMermaid() {
        if (!mermaidCode) return;
        try {
            await navigator.clipboard.writeText(mermaidCode);
            showStatus("Copied to clipboard!");
        } catch {
            showStatus("Copy failed.", true);
        }
    }

    const hasAnySvg = $derived(mermaidSvgs.length > 0 || !!mermaidSvg);
</script>

<div
    class="export-panel p-3 space-y-1 text-[#657b83] max-h-[70vh] overflow-y-auto"
>
    <!-- Status -->
    {#if exportStatus}
        <div
            class="px-3 py-1.5 rounded text-xs text-center mb-1 font-medium
            {exportStatus.startsWith('❌')
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-700'}"
        >
            {exportStatus}
        </div>
    {/if}

    <!-- ── MULTI MODE ─────────────────────────────────────────────────────── -->
    {#if isMulti}
        <!-- Checklist header -->
        <div class="flex items-center gap-2 px-1 pb-1">
            <input
                type="checkbox"
                id="select-all"
                checked={allChecked}
                onchange={toggleAll}
                class="w-3.5 h-3.5 accent-[#268bd2] cursor-pointer"
            />
            <label
                for="select-all"
                class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1] cursor-pointer select-none"
            >
                Pilih diagram ({selectedCount}/{mermaidSvgs.length})
            </label>
        </div>

        <!-- List diagram dengan checkbox -->
        <div class="space-y-0.5 mb-2">
            {#each mermaidSvgs as item, i}
                <label
                    class="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-[#EEE8D5] transition-colors group"
                >
                    <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onchange={() => toggleSelect(i)}
                        class="w-3.5 h-3.5 accent-[#268bd2] cursor-pointer flex-shrink-0"
                    />
                    <span
                        class="text-xs font-medium truncate flex-1"
                        title={item.title}
                    >
                        {item.title}
                    </span>
                    {#if item.group}
                        <span
                            class="text-[10px] text-[#93a1a1] bg-[#93a1a1]/10 px-1.5 rounded shrink-0"
                        >
                            {item.group}
                        </span>
                    {/if}
                </label>
            {/each}
        </div>

        <div class="border-t border-[#93a1a1]/10 pt-2 space-y-1">
            <div
                class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1] px-1 pb-1"
            >
                Export {selectedCount > 1
                    ? `(${selectedCount} file → ZIP)`
                    : "(1 file)"}
            </div>

            <!-- SVG -->
            <button
                onclick={() => exportSelected("svg")}
                disabled={isExporting || selectedCount === 0}
                class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
                <div
                    class="shrink-0 w-7 h-7 rounded bg-[#268bd2]/10 flex items-center justify-center"
                >
                    {#if selectedCount > 1}
                        <Package size={15} class="text-[#268bd2]" />
                    {:else}
                        <FileImage size={15} class="text-[#268bd2]" />
                    {/if}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium">Export as SVG</div>
                    <div class="text-xs text-[#93a1a1]">
                        {selectedCount > 1
                            ? "Download ZIP berisi file .svg"
                            : "Scalable vector, lossless"}
                    </div>
                </div>
                {#if isExporting}
                    <svg
                        class="animate-spin w-3 h-3 text-[#93a1a1] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        ></circle>
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                        ></path>
                    </svg>
                {:else}
                    <Download size={13} class="text-[#93a1a1] shrink-0" />
                {/if}
            </button>

            <!-- PNG 1x -->
            <button
                onclick={() => exportSelected("png", 1)}
                disabled={isExporting || selectedCount === 0}
                class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
                <div
                    class="shrink-0 w-7 h-7 rounded bg-[#859900]/10 flex items-center justify-center"
                >
                    {#if selectedCount > 1}
                        <Package size={15} class="text-[#859900]" />
                    {:else}
                        <FileImage size={15} class="text-[#859900]" />
                    {/if}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium">Export as PNG</div>
                    <div class="text-xs text-[#93a1a1]">
                        Standard resolution (1x)
                    </div>
                </div>
                {#if isExporting}
                    <svg
                        class="animate-spin w-3 h-3 text-[#93a1a1] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        ></circle>
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                        ></path>
                    </svg>
                {:else}
                    <Download size={13} class="text-[#93a1a1] shrink-0" />
                {/if}
            </button>

            <!-- PNG 2x -->
            <button
                onclick={() => exportSelected("png", 2)}
                disabled={isExporting || selectedCount === 0}
                class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
                <div
                    class="shrink-0 w-7 h-7 rounded bg-[#b58900]/10 flex items-center justify-center"
                >
                    {#if selectedCount > 1}
                        <Package size={15} class="text-[#b58900]" />
                    {:else}
                        <FileImage size={15} class="text-[#b58900]" />
                    {/if}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium">Export as PNG @2x</div>
                    <div class="text-xs text-[#93a1a1]">
                        High resolution (2x), retina
                    </div>
                </div>
                {#if isExporting}
                    <svg
                        class="animate-spin w-3 h-3 text-[#93a1a1] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        ></circle>
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                        ></path>
                    </svg>
                {:else}
                    <Download size={13} class="text-[#93a1a1] shrink-0" />
                {/if}
            </button>
        </div>

        <!-- ── SINGLE MODE ────────────────────────────────────────────────────── -->
    {:else}
        <div
            class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1] px-1 pb-1"
        >
            Image
        </div>

        <!-- SVG -->
        <button
            onclick={() => exportSingle("svg")}
            disabled={!hasAnySvg || isExporting}
            class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
            <div
                class="shrink-0 w-7 h-7 rounded bg-[#268bd2]/10 flex items-center justify-center"
            >
                <FileImage size={15} class="text-[#268bd2]" />
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">Export as SVG</div>
                <div class="text-xs text-[#93a1a1]">
                    Scalable vector, lossless
                </div>
            </div>
            <Download size={13} class="text-[#93a1a1] shrink-0" />
        </button>

        <!-- PNG 1x -->
        <button
            onclick={() => exportSingle("png", 1)}
            disabled={!hasAnySvg || isExporting}
            class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
            <div
                class="shrink-0 w-7 h-7 rounded bg-[#859900]/10 flex items-center justify-center"
            >
                <FileImage size={15} class="text-[#859900]" />
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">Export as PNG</div>
                <div class="text-xs text-[#93a1a1]">
                    Standard resolution (1x)
                </div>
            </div>
            {#if isExporting}
                <svg
                    class="animate-spin w-3 h-3 text-[#93a1a1] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    ></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                    ></path>
                </svg>
            {:else}
                <Download size={13} class="text-[#93a1a1] shrink-0" />
            {/if}
        </button>

        <!-- PNG 2x -->
        <button
            onclick={() => exportSingle("png", 2)}
            disabled={!hasAnySvg || isExporting}
            class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
            <div
                class="shrink-0 w-7 h-7 rounded bg-[#b58900]/10 flex items-center justify-center"
            >
                <FileImage size={15} class="text-[#b58900]" />
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">Export as PNG @2x</div>
                <div class="text-xs text-[#93a1a1]">
                    High resolution (2x), retina
                </div>
            </div>
            {#if isExporting}
                <svg
                    class="animate-spin w-3 h-3 text-[#93a1a1] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    ></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                    ></path>
                </svg>
            {:else}
                <Download size={13} class="text-[#93a1a1] shrink-0" />
            {/if}
        </button>
    {/if}

    <!-- ── SOURCE (selalu tampil) ─────────────────────────────────────────── -->
    <div class="mt-1 border-t border-[#93a1a1]/10 pt-2">
        <div
            class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1] px-1 pb-1"
        >
            Source
        </div>

        <!-- .mmd file -->
        <button
            onclick={exportMermaid}
            disabled={!mermaidCode}
            class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
            <div
                class="shrink-0 w-7 h-7 rounded bg-[#2aa198]/10 flex items-center justify-center"
            >
                <FileCode size={15} class="text-[#2aa198]" />
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">Export as .mmd</div>
                <div class="text-xs text-[#93a1a1]">Mermaid diagram source</div>
            </div>
            <Download size={13} class="text-[#93a1a1] shrink-0" />
        </button>

        <!-- Copy -->
        <button
            onclick={copyMermaid}
            disabled={!mermaidCode}
            class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
            <div
                class="shrink-0 w-7 h-7 rounded bg-[#6c71c4]/10 flex items-center justify-center"
            >
                <FileType size={15} class="text-[#6c71c4]" />
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">Copy Mermaid source</div>
                <div class="text-xs text-[#93a1a1]">
                    Copy diagram code to clipboard
                </div>
            </div>
        </button>
    </div>
</div>

<style>
    .export-btn:focus-visible {
        outline: 2px solid #268bd2;
        outline-offset: 1px;
    }
</style>
