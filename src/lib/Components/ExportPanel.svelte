<script lang="ts">
    import { Download, FileImage, FileCode, FileType } from "lucide-svelte";

    interface Props {
        mermaidSvg?: string;
        mermaidCode?: string;
        filename?: string;
        theme?: "light" | "dark";
    }

    let {
        mermaidSvg = "",
        mermaidCode = "",
        filename = "diagram",
        theme = "light",
    }: Props = $props();

    let isExporting = $state(false);
    let exportStatus = $state<string | null>(null);

    function showStatus(msg: string) {
        exportStatus = msg;
        setTimeout(() => {
            exportStatus = null;
        }, 2500);
    }

    // ── SVG Export ──────────────────────────────────────────────────────────────
    function exportSVG() {
        if (!mermaidSvg) return;

        try {
            const blob = new Blob([mermaidSvg], {
                type: "image/svg+xml;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${filename}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showStatus("SVG exported!");
        } catch (err) {
            console.error("SVG export error:", err);
            showStatus("Export failed.");
        }
    }

    // ── PNG Export ──────────────────────────────────────────────────────────────
    async function exportPNG(scale = 2) {
        if (!mermaidSvg) return;

        isExporting = true;
        try {
            // Parse SVG dimensions
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(mermaidSvg, "image/svg+xml");
            const svgEl = svgDoc.querySelector("svg");

            if (!svgEl) throw new Error("No SVG element found");

            // Determine width/height
            let width = parseFloat(svgEl.getAttribute("width") ?? "0");
            let height = parseFloat(svgEl.getAttribute("height") ?? "0");

            if (!width || !height) {
                const viewBox = svgEl.getAttribute("viewBox");
                if (viewBox) {
                    const parts = viewBox.split(/[\s,]+/);
                    width = parseFloat(parts[2]) || 800;
                    height = parseFloat(parts[3]) || 600;
                } else {
                    width = 800;
                    height = 600;
                }
            }

            // Set explicit dimensions on the clone
            svgEl.setAttribute("width", String(width));
            svgEl.setAttribute("height", String(height));

            // Inline all styles for standalone export
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgEl);

            const canvas = document.createElement("canvas");
            canvas.width = width * scale;
            canvas.height = height * scale;

            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Could not get canvas context");

            // Fill background based on theme
            ctx.fillStyle = theme === "dark" ? "#1e1e2e" : "#FDF6E3";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);

            const img = new Image();
            const svgBlob = new Blob([svgString], {
                type: "image/svg+xml;charset=utf-8",
            });
            const url = URL.createObjectURL(svgBlob);

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    resolve();
                };
                img.onerror = () => reject(new Error("Image load failed"));
                img.src = url;
            });

            URL.revokeObjectURL(url);

            // Download
            const pngUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `${filename}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            showStatus("PNG exported!");
        } catch (err) {
            console.error("PNG export error:", err);
            showStatus("PNG export failed.");
        } finally {
            isExporting = false;
        }
    }

    // ── Mermaid Source Export ────────────────────────────────────────────────────
    function exportMermaid() {
        if (!mermaidCode) return;

        try {
            const blob = new Blob([mermaidCode], {
                type: "text/plain;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${filename}.mmd`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showStatus("Mermaid source exported!");
        } catch (err) {
            console.error("Mermaid export error:", err);
            showStatus("Export failed.");
        }
    }

    // ── Copy Mermaid to Clipboard ────────────────────────────────────────────────
    async function copyMermaid() {
        if (!mermaidCode) return;
        try {
            await navigator.clipboard.writeText(mermaidCode);
            showStatus("Copied to clipboard!");
        } catch (err) {
            console.error("Copy error:", err);
            showStatus("Copy failed.");
        }
    }
</script>

<div class="export-panel p-3 space-y-1">
    <!-- Status message -->
    {#if exportStatus}
        <div
            class="px-3 py-1.5 rounded text-xs text-center mb-2 font-medium"
            class:bg-green-50={!exportStatus.includes("failed")}
            class:text-green-700={!exportStatus.includes("failed")}
            class:bg-red-50={exportStatus.includes("failed")}
            class:text-red-600={exportStatus.includes("failed")}
        >
            {exportStatus}
        </div>
    {/if}

    <!-- Section: Image -->
    <div class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1] px-1 pb-1">
        Image
    </div>

    <!-- SVG -->
    <button
        onclick={exportSVG}
        disabled={!mermaidSvg}
        class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
        <div class="flex-shrink-0 w-7 h-7 rounded bg-[#268bd2]/10 flex items-center justify-center">
            <FileImage size={15} class="text-[#268bd2]" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#657b83]">Export as SVG</div>
            <div class="text-xs text-[#93a1a1]">Scalable vector, lossless</div>
        </div>
        <Download size={13} class="text-[#93a1a1] flex-shrink-0" />
    </button>

    <!-- PNG 1x -->
    <button
        onclick={() => exportPNG(1)}
        disabled={!mermaidSvg || isExporting}
        class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
        <div class="flex-shrink-0 w-7 h-7 rounded bg-[#859900]/10 flex items-center justify-center">
            <FileImage size={15} class="text-[#859900]" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#657b83]">Export as PNG</div>
            <div class="text-xs text-[#93a1a1]">Standard resolution (1x)</div>
        </div>
        {#if isExporting}
            <svg class="animate-spin w-3 h-3 text-[#93a1a1] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
        {:else}
            <Download size={13} class="text-[#93a1a1] flex-shrink-0" />
        {/if}
    </button>

    <!-- PNG 2x -->
    <button
        onclick={() => exportPNG(2)}
        disabled={!mermaidSvg || isExporting}
        class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
        <div class="flex-shrink-0 w-7 h-7 rounded bg-[#b58900]/10 flex items-center justify-center">
            <FileImage size={15} class="text-[#b58900]" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#657b83]">Export as PNG @2x</div>
            <div class="text-xs text-[#93a1a1]">High resolution (2x), retina</div>
        </div>
        {#if isExporting}
            <svg class="animate-spin w-3 h-3 text-[#93a1a1] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
        {:else}
            <Download size={13} class="text-[#93a1a1] flex-shrink-0" />
        {/if}
    </button>

    <div class="my-1 border-t border-[#93a1a1]/10"></div>

    <!-- Section: Source -->
    <div class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1] px-1 pb-1">
        Source
    </div>

    <!-- Mermaid .mmd file -->
    <button
        onclick={exportMermaid}
        disabled={!mermaidCode}
        class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
        <div class="flex-shrink-0 w-7 h-7 rounded bg-[#2aa198]/10 flex items-center justify-center">
            <FileCode size={15} class="text-[#2aa198]" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#657b83]">Export as .mmd</div>
            <div class="text-xs text-[#93a1a1]">Mermaid diagram source</div>
        </div>
        <Download size={13} class="text-[#93a1a1] flex-shrink-0" />
    </button>

    <!-- Copy Mermaid source -->
    <button
        onclick={copyMermaid}
        disabled={!mermaidCode}
        class="export-btn w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#EEE8D5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
        <div class="flex-shrink-0 w-7 h-7 rounded bg-[#6c71c4]/10 flex items-center justify-center">
            <FileType size={15} class="text-[#6c71c4]" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#657b83]">Copy Mermaid source</div>
            <div class="text-xs text-[#93a1a1]">Copy diagram code to clipboard</div>
        </div>
    </button>
</div>

<style>
    .export-btn:focus-visible {
        outline: 2px solid #268bd2;
        outline-offset: 1px;
    }
</style>
