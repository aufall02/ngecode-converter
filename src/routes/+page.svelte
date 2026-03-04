<script lang="ts">
    import { onMount, tick } from "svelte";
    import { goto, replaceState } from "$app/navigation";
    import { page } from "$app/stores";
    import MonacoEditor from "$lib/Components/MonacoEditor.svelte";
    import ExportPanel from "$lib/Components/ExportPanel.svelte";
    import ResizablePanel from "$lib/Components/ResizablePanel.svelte";
    import PanZoomDiagram from "$lib/Components/PanZoomDiagram.svelte";
    import {
        AST_EXPLORER_THEME_NAME,
        AST_EXPLORER_DARK_THEME_NAME,
    } from "$lib/themes/astExplorerTheme";
    import {
        parserRegistry,
        type ILanguage,
        type DiagramTypeInfo,
    } from "$lib/parser/index";
    import type { FlowDirection } from "$lib/astParser/astToMermaid";

    // Bootstrap — auto-registers all adapters (acorn, dll)
    import "$lib/parser/index";
    import {
        Code2,
        Download,
        GitBranch,
        ChevronDown,
        AlertTriangle,
        RefreshCw,
        Save,
        GitFork,
        Share2,
        FilePlus,
        Menu,
        X,
        Copy,
        Check,
        ExternalLink,
        Github,
        ZoomIn,
        ZoomOut,
        Sun,
        Moon,
    } from "lucide-svelte";

    // ── Derive languages & diagram types from registry ────────────────────────
    // Semua adapter yang sudah register otomatis muncul di sini.
    const allLanguages: ILanguage[] = parserRegistry.listAllLanguages();
    const defaultLanguage = allLanguages[0]?.id ?? "javascript";

    // ── State ─────────────────────────────────────────────────────────────────
    let code = $state(
        parserRegistry
            .getByLanguage(defaultLanguage)
            ?.getSampleCode(defaultLanguage) ?? "",
    );
    let language = $state(defaultLanguage);
    let diagramType = $state("flowchart");
    let flowDirection = $state<FlowDirection>("TD");
    let snippetTitle = $state("Untitled Snippet");
    let saveError = $state<string | null>(null);
    // ── Editor appearance ─────────────────────────────────────────────────────
    let editorTheme = $state(AST_EXPLORER_THEME_NAME);
    let editorFontSize = $state(13);
    const FONT_SIZE_MIN = 10;
    const FONT_SIZE_MAX = 24;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mermaid: any = null;
    let ast = $state<unknown>(null);
    let parseError = $state<{
        message: string;
        line?: number;
        column?: number;
    } | null>(null);
    let mermaidCode = $state("");
    let mermaidSvg = $state("");
    // mermaidSvgsExport: render ulang dengan htmlLabels:false — teks jadi SVG <text> murni
    // sehingga file SVG/PNG yang diexport punya teks yang readable tanpa butuh external font
    let mermaidSvgsExport = $state<
        {
            title: string;
            svg: string;
            group: string | null;
            collapsed: boolean;
        }[]
    >([]);
    let mermaidSvgs = $state<
        {
            title: string;
            svg: string;
            group: string | null;
            collapsed: boolean;
            nodePositions?: Record<
                string,
                {
                    startLine: number;
                    startCol: number;
                    endLine: number;
                    endCol: number;
                }
            >;
        }[]
    >([]);
    let mermaidError = $state<string | null>(null);
    let isRendering = $state(false);

    // ── Highlight state ───────────────────────────────────────────────────────
    /** Ref function yang selalu baca allNodePositions terbaru — hindari stale closure */
    function handleCursorChange(line: number, col: number) {
        const entries = Object.entries(allNodePositions);

        if (entries.length === 0) {
            if (highlightedNodeId !== null) highlightedNodeId = null;
            return;
        }

        let found: string | null = null;
        let foundSize = Infinity;

        for (const [nodeId, loc] of entries) {
            const afterStart =
                line > loc.startLine ||
                (line === loc.startLine && col >= loc.startCol);
            const beforeEnd =
                line < loc.endLine ||
                (line === loc.endLine && col <= loc.endCol);

            if (afterStart && beforeEnd) {
                const size =
                    (loc.endLine - loc.startLine) * 1000 +
                    (loc.endCol - loc.startCol);
                if (size < foundSize) {
                    found = nodeId;
                    foundSize = size;
                }
            }
        }

        if (found !== highlightedNodeId) {
            highlightedNodeId = found;
        }
    }

    /** API dari MonacoEditor, diterima via onReady callback */
    let monacoEditorApi: {
        highlightRange: (
            sl: number,
            sc: number,
            el: number,
            ec: number,
        ) => void;
        clearHighlight: () => void;
    } | null = $state(null);
    /** Node ID yang sedang di-highlight di diagram (dari hover editor) */
    let highlightedNodeId = $state<string | null>(null);
    /** Semua positions dari semua diagram yang ter-render saat ini */
    let allNodePositions = $state<
        Record<
            string,
            {
                startLine: number;
                startCol: number;
                endLine: number;
                endCol: number;
            }
        >
    >({});
    let showSnippetMenu = $state(false);
    let showExportMenu = $state(false);
    let showShareModal = $state(false);
    let isSaving = $state(false);
    let saveSuccess = $state(false);
    let shareUrl = $state("");
    let copiedShare = $state(false);

    // Diagram types from registry (semua adapter, dedupe)
    // UI hanya tampilkan flowchart untuk sekarang — selector disembunyikan
    const allDiagramTypes: DiagramTypeInfo[] =
        parserRegistry.listAllDiagramTypes();
    const activeDiagramType =
        allDiagramTypes.find((d) => d.type === "flowchart") ??
        allDiagramTypes[0];

    // Active adapter — reaktif terhadap perubahan language
    const activeAdapter = $derived(parserRegistry.getByLanguage(language));
    const parserInfo = $derived(
        activeAdapter
            ? `${activeAdapter.parserLibrary}-${activeAdapter.parserVersion}`
            : "—",
    );

    // Debounce timer
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // ── URL state helpers ─────────────────────────────────────────────────────

    /** Encode state ke URL search params */
    function encodeToUrl(
        c: string,
        lang: string,
        title: string,
        dt: string,
    ): string {
        const params = new URLSearchParams();
        params.set("c", btoa(unescape(encodeURIComponent(c))));
        params.set("l", lang);
        params.set("t", title);
        params.set("dt", dt);
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    }

    /** Decode state dari URL search params, return null jika tidak ada */
    function decodeFromUrl(): {
        code: string;
        language: string;
        title: string;
        diagramType: string;
    } | null {
        const params = new URLSearchParams(window.location.search);
        const c = params.get("c");
        const l = params.get("l");
        const t = params.get("t");
        const dt = params.get("dt");
        if (!c) return null;
        try {
            return {
                code: decodeURIComponent(escape(atob(c))),
                language: l ?? "javascript",
                title: t ?? "Shared Snippet",
                diagramType: dt ?? "flowchart",
            };
        } catch {
            return null;
        }
    }

    // ── localStorage multi-snippet helpers ────────────────────────────────────

    interface SavedSnippet {
        id: string;
        title: string;
        code: string;
        language: string;
        diagramType: string;
        savedAt: string;
    }

    function loadAllSnippets(): SavedSnippet[] {
        try {
            return JSON.parse(localStorage.getItem("ngecode_snippets") ?? "[]");
        } catch {
            return [];
        }
    }

    function persistSnippets(snippets: SavedSnippet[]) {
        localStorage.setItem("ngecode_snippets", JSON.stringify(snippets));
    }

    // Initialize Mermaid with light theme (dynamic import — browser only)
    onMount(async () => {
        const { default: mermaidLib } = await import("mermaid");
        mermaid = mermaidLib;

        mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: "basis",
                padding: 15,
            },
            securityLevel: "loose",
        });

        // Pre-configure instance export (htmlLabels: false) — dipakai hanya untuk export
        // Kita simpan config ini dan re-init sebentar saat export

        // ── Load dari URL jika ada params ─────────────────────────────────────
        const fromUrl = decodeFromUrl();
        if (fromUrl) {
            code = fromUrl.code;
            language = fromUrl.language;
            snippetTitle = fromUrl.title;
            diagramType = fromUrl.diagramType;
        }

        // Initial parse
        handleCodeChange(code);
    });

    // Handle code changes with debounce
    function handleCodeChange(newCode: string) {
        code = newCode;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            parseAndRender();
        }, 300);
    }

    // Parse code and render diagram
    async function parseAndRender() {
        const adapter = parserRegistry.getByLanguage(language);
        if (!adapter) {
            parseError = {
                message: `No parser adapter found for "${language}"`,
            };
            return;
        }

        const result = adapter.parse(code, language);

        if (result.success) {
            ast = result.ast;
            parseError = null;
            await generateDiagram();
        } else {
            ast = null;
            parseError = result.error;
            mermaidCode = "";
            mermaidSvg = "";
        }
    }

    // Generate Mermaid diagram from AST
    async function generateDiagram() {
        if (!ast || !mermaid) return;

        // Reset immediately so UI clears old diagram right away
        isRendering = true;
        mermaidError = null;
        mermaidSvg = "";
        mermaidSvgs = [];

        try {
            const adapter = parserRegistry.getByLanguage(language);
            if (!adapter)
                throw new Error(`No adapter for language "${language}"`);

            const result = adapter.toDiagram(ast, diagramType, flowDirection);

            if (result.success && result.diagram) {
                mermaidCode = result.diagram;

                // Split on %%SPLIT%% — flowchart emits one block per function
                const parts = result.diagram
                    .split("%%SPLIT%%")
                    .map((p) => p.trim())
                    .filter(Boolean);

                const rendered: typeof mermaidSvgs = [];
                const renderedExport: typeof mermaidSvgsExport = [];
                // Gabungkan semua nodePositions dari result
                const mergedPositions: typeof allNodePositions = {
                    ...(result.nodePositions ?? {}),
                };

                // Re-init mermaid dengan htmlLabels:false khusus render export
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "default",
                    flowchart: {
                        useMaxWidth: false,
                        htmlLabels: false,
                        curve: "basis",
                        padding: 15,
                    },
                    securityLevel: "loose",
                });

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    const titleMatch = part.match(/%%\s*fn:\s*(.+)/);
                    const classMatch = part.match(/%%\s*class:\s*(.+)/);
                    const title = titleMatch
                        ? titleMatch[1].trim()
                        : parts.length === 1
                          ? activeDiagramType.name
                          : `Function ${i + 1}`;
                    const group = classMatch ? classMatch[1].trim() : null;
                    try {
                        // Render untuk export dulu (htmlLabels:false)
                        const exportUid = `mermaid-export-${Date.now()}-${i}`;
                        const { svg: exportSvg } = await mermaid.render(
                            exportUid,
                            part,
                        );
                        renderedExport.push({
                            title,
                            svg: exportSvg,
                            group,
                            collapsed: false,
                        });
                    } catch (e) {
                        console.warn(`Skipping export diagram ${i}:`, e);
                    }
                }

                // Restore htmlLabels:true untuk render tampilan di UI
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "default",
                    flowchart: {
                        useMaxWidth: true,
                        htmlLabels: true,
                        curve: "basis",
                        padding: 15,
                    },
                    securityLevel: "loose",
                });

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    const titleMatch = part.match(/%%\s*fn:\s*(.+)/);
                    const classMatch = part.match(/%%\s*class:\s*(.+)/);
                    const title = titleMatch
                        ? titleMatch[1].trim()
                        : parts.length === 1
                          ? activeDiagramType.name
                          : `Function ${i + 1}`;
                    const group = classMatch ? classMatch[1].trim() : null;
                    try {
                        const uid = `mermaid-${Date.now()}-${i}`;
                        const { svg } = await mermaid.render(uid, part);
                        rendered.push({
                            title,
                            svg,
                            group,
                            collapsed: false,
                            nodePositions: result.nodePositions,
                        });
                    } catch (e) {
                        console.warn(`Skipping diagram ${i}:`, e);
                    }
                }

                // Always use mermaidSvgs — unifies single and multi rendering
                allNodePositions = mergedPositions;
                highlightedNodeId = null;
                mermaidSvgs = rendered;
                mermaidSvgsExport = renderedExport;
                // mermaidSvg = SVG pertama saja (untuk backward compat).
                // Export multi-diagram ditangani ExportPanel via mermaidSvgs.
                mermaidSvg = rendered[0]?.svg ?? "";
            } else {
                mermaidCode = "";
                mermaidSvg = "";
                mermaidSvgs = [];
                mermaidError = result.error ?? "Failed to generate diagram";
            }
        } catch (err: unknown) {
            console.error("Mermaid render error:", err);
            mermaidError =
                err instanceof Error ? err.message : "Failed to render diagram";
            mermaidSvg = "";
            mermaidSvgs = [];
        } finally {
            isRendering = false;
        }
    }

    // Handle language change
    function changeLanguage(newLangId: string) {
        language = newLangId;
        const adapter = parserRegistry.getByLanguage(newLangId);
        code = adapter?.getSampleCode(newLangId) ?? "";
        parseAndRender();
    }

    // Handle diagram type change
    function changeDiagramType(newType: string) {
        diagramType = newType;
        generateDiagram();
    }

    // Toggle flow direction TD ↔ LR
    function toggleDirection() {
        flowDirection = flowDirection === "TD" ? "LR" : "TD";
        generateDiagram();
    }

    // New snippet — reset ke sample code & bersihkan URL params
    function newSnippet() {
        const adapter = parserRegistry.getByLanguage(language);
        code = adapter?.getSampleCode(language) ?? "";
        snippetTitle = "Untitled Snippet";
        showSnippetMenu = false;
        // Bersihkan URL params
        if (window.location.search) {
            replaceState(window.location.pathname, {});
        }
        parseAndRender();
    }

    // Save snippet ke localStorage (multi-snippet, per ID unik)
    async function saveSnippet() {
        isSaving = true;
        saveError = null;
        try {
            const snippets = loadAllSnippets();
            // Cek apakah sudah ada snippet dengan title yang sama → update
            const existing = snippets.find((s) => s.title === snippetTitle);
            const now = new Date().toISOString();
            if (existing) {
                existing.code = code;
                existing.language = language;
                existing.diagramType = diagramType;
                existing.savedAt = now;
            } else {
                snippets.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    title: snippetTitle,
                    code,
                    language,
                    diagramType,
                    savedAt: now,
                });
            }
            persistSnippets(snippets);

            // Update URL juga supaya link saat ini mencerminkan state tersimpan
            const url = encodeToUrl(code, language, snippetTitle, diagramType);
            replaceState(url, {});

            saveSuccess = true;
            setTimeout(() => (saveSuccess = false), 2500);
        } catch (err) {
            console.error("Save error:", err);
            saveError = "Gagal menyimpan snippet";
        } finally {
            isSaving = false;
            showSnippetMenu = false;
        }
    }

    // Fork — buat salinan dengan title baru dari snippet yang sedang aktif
    // (bukan dari localStorage, tapi dari state yang sedang ditampilkan)
    function forkSnippet() {
        snippetTitle = `Fork of ${snippetTitle}`;
        showSnippetMenu = false;
        // Bersihkan URL supaya tidak dianggap snippet yang sama
        if (window.location.search) {
            replaceState(window.location.pathname, {});
        }
    }

    // Share — encode state ke URL dan tampilkan modal
    function openShareModal() {
        shareUrl = encodeToUrl(code, language, snippetTitle, diagramType);
        showShareModal = true;
        showSnippetMenu = false;
    }

    // Copy share URL ke clipboard
    async function copyShareUrl() {
        try {
            await navigator.clipboard.writeText(shareUrl);
            copiedShare = true;
            // Update URL bar juga supaya user bisa langsung copy dari address bar
            replaceState(shareUrl, {});
            setTimeout(() => (copiedShare = false), 2500);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    }

    // Get filename for export
    const exportFilename = $derived(
        `${snippetTitle.replace(/\s+/g, "-").toLowerCase()}-${diagramType}`,
    );
    // ── Diagram node click → highlight in editor ──────────────────────────────
    function onDiagramNodeClick(nodeId: string) {
        const loc = allNodePositions[nodeId];
        if (!loc || !monacoEditorApi) return;
        monacoEditorApi.highlightRange(
            loc.startLine,
            loc.startCol,
            loc.endLine,
            loc.endCol,
        );
    }

    // ── Editor cursor → highlight SVG node ───────────────────────────────────
    $effect(() => {
        const nodeId = highlightedNodeId;

        // Hapus semua highlight lama
        document
            .querySelectorAll(".nc-svg-node-highlight")
            .forEach((el) => el.classList.remove("nc-svg-node-highlight"));

        if (!nodeId) return;

        // Mermaid v11 renders nodes sebagai:
        //   <g class="node ..." id="flowchart-{nodeId}-{globalCounter}">
        // Kita match dengan startsWith supaya counter tidak masalah.
        // Tapi ada edge case: nodeId "rect_1" bisa match "rect_10", "rect_11" dsb.
        // Solusi: cari elemen yang id-nya persis "flowchart-{nodeId}-{digits}"
        const pattern = new RegExp(
            `^flowchart-${nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+$`,
        );
        document.querySelectorAll("svg g[id]").forEach((el) => {
            if (pattern.test(el.id)) {
                el.classList.add("nc-svg-node-highlight");
            }
        });
    });
</script>

<svelte:head>
    <title>{snippetTitle} - NgeCode Explorer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin="anonymous"
    />
    <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<div class="h-screen flex flex-col bg-[#FDF6E3] text-[#657b83]">
    <!-- Header - AST Explorer Classic Style -->
    <header
        class="flex items-center justify-between px-4 py-2 bg-[#EEE8D5] border-b border-[#93a1a1]/30"
    >
        <div class="flex items-center gap-3">
            <!-- Logo -->
            <a
                href="/"
                class="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
                <span class="font-bold text-lg text-[#268bd2]">NgeCode</span>
                <span class="text-[#93a1a1]">Explorer</span>
            </a>

            <div class="h-5 w-px bg-[#93a1a1]/30"></div>

            <!-- Snippet Menu — hidden until DB backend ready -->
            <div class="relative hidden">
                <button
                    onclick={() => (showSnippetMenu = !showSnippetMenu)}
                    class="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#93a1a1]/30 rounded hover:bg-[#FDF6E3] transition-colors"
                >
                    <Menu size={14} />
                    <span class="text-sm">Snippet</span>
                    <ChevronDown size={12} />
                </button>

                {#if showSnippetMenu}
                    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                    <div
                        class="fixed inset-0 z-40"
                        onclick={() => (showSnippetMenu = false)}
                    ></div>
                    <div
                        class="absolute top-full left-0 mt-1 w-64 bg-white border border-[#93a1a1]/30 rounded shadow-lg z-50 overflow-hidden"
                    >
                        <!-- Actions -->
                        <div class="p-1">
                            <button
                                onclick={newSnippet}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#EEE8D5] rounded transition-colors"
                            >
                                <FilePlus size={14} class="text-[#268bd2]" />
                                <span>New Snippet</span>
                            </button>
                            <button
                                onclick={saveSnippet}
                                disabled={isSaving}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#EEE8D5] rounded transition-colors disabled:opacity-50"
                            >
                                <Save size={14} class="text-[#859900]" />
                                <span>{isSaving ? "Saving..." : "Save"}</span>
                                {#if window.location.search}
                                    <span
                                        class="ml-auto text-[10px] text-[#268bd2] bg-[#268bd2]/10 px-1.5 rounded"
                                        >shared</span
                                    >
                                {/if}
                            </button>
                            <button
                                onclick={forkSnippet}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#EEE8D5] rounded transition-colors"
                            >
                                <GitFork size={14} class="text-[#6c71c4]" />
                                <span>Fork Current</span>
                            </button>
                            <button
                                onclick={openShareModal}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#EEE8D5] rounded transition-colors"
                            >
                                <Share2 size={14} class="text-[#2aa198]" />
                                <span>Share...</span>
                            </button>
                        </div>

                        {#if saveError}
                            <div
                                class="px-3 py-1.5 text-xs text-[#dc322f] bg-[#dc322f]/5 border-t border-[#93a1a1]/15"
                            >
                                ⚠ {saveError}
                            </div>
                        {/if}

                        <!-- Saved snippets list -->
                        {#if loadAllSnippets().length > 0}
                            {@const saved = loadAllSnippets()}
                            <div class="border-t border-[#93a1a1]/15">
                                <p
                                    class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1]"
                                >
                                    Saved ({saved.length})
                                </p>
                                <div class="max-h-48 overflow-y-auto">
                                    {#each saved.slice().reverse() as s (s.id)}
                                        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                                        <div
                                            onclick={() => {
                                                code = s.code;
                                                language = s.language;
                                                snippetTitle = s.title;
                                                diagramType = s.diagramType;
                                                showSnippetMenu = false;
                                                if (window.location.search)
                                                    replaceState(
                                                        window.location
                                                            .pathname,
                                                        {},
                                                    );
                                                parseAndRender();
                                            }}
                                            class="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[#EEE8D5] transition-colors cursor-pointer group"
                                        >
                                            <div class="flex-1 min-w-0">
                                                <p
                                                    class="text-xs font-medium text-[#657b83] truncate"
                                                >
                                                    {s.title}
                                                </p>
                                                <p
                                                    class="text-[10px] text-[#93a1a1]"
                                                >
                                                    {s.language} · {new Date(
                                                        s.savedAt,
                                                    ).toLocaleDateString(
                                                        "id-ID",
                                                        {
                                                            day: "numeric",
                                                            month: "short",
                                                        },
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onclick={(e) => {
                                                    e.stopPropagation();
                                                    const all =
                                                        loadAllSnippets().filter(
                                                            (x) =>
                                                                x.id !== s.id,
                                                        );
                                                    persistSnippets(all);
                                                    showSnippetMenu = false;
                                                    setTimeout(
                                                        () =>
                                                            (showSnippetMenu = true),
                                                        10,
                                                    );
                                                }}
                                                class="opacity-0 group-hover:opacity-100 text-[#dc322f]/60 hover:text-[#dc322f] transition-all p-0.5 rounded"
                                                title="Hapus"
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Language Selector — auto-populated from registry -->
            <div class="relative">
                <select
                    bind:value={language}
                    onchange={(e) =>
                        changeLanguage((e.target as HTMLSelectElement).value)}
                    class="appearance-none bg-white border border-[#93a1a1]/30 rounded px-3 py-1.5 pr-8 text-sm cursor-pointer hover:border-[#268bd2] focus:outline-none focus:border-[#268bd2]"
                >
                    {#each allLanguages as lang}
                        <option value={lang.id}
                            >{lang.icon
                                ? lang.icon + " "
                                : ""}{lang.name}</option
                        >
                    {/each}
                </select>
                <ChevronDown
                    size={12}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-[#93a1a1] pointer-events-none"
                />
            </div>

            <!-- Diagram Type — locked to Flowchart for now, selector hidden -->
            <div
                class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#93a1a1]/30 rounded text-sm text-[#657b83] select-none"
                title="More diagram types coming soon"
            >
                <GitBranch size={13} class="text-[#859900]" />
                <span>{activeDiagramType.name}</span>
            </div>
        </div>

        <!-- Right side - Parser info + Save Status -->
        <div class="flex items-center gap-3">
            {#if saveSuccess}
                <span class="flex items-center gap-1 text-sm text-[#859900]">
                    <Check size={14} />
                    Saved!
                </span>
            {/if}

            <!-- Parser badge — mirip AST Explorer "Parser: acorn-8.x" -->
            {#if activeAdapter}
                <div
                    class="flex items-center gap-1.5 text-xs text-[#93a1a1] border border-[#93a1a1]/25 rounded px-2 py-1 bg-white"
                    title={activeAdapter.description}
                >
                    <span class="text-[#93a1a1]/60 font-medium">Parser:</span>
                    <a
                        href="https://www.npmjs.com/package/{activeAdapter.parserLibrary}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-mono font-semibold text-[#268bd2] hover:underline"
                    >
                        {parserInfo}
                    </a>
                </div>
            {/if}

            <a
                href="https://github.com/aufall02/ngecode-converter"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm hover:text-[#268bd2] transition-colors"
                title="View on GitHub"
            >
                <Github size={14} />
                <span>NgeCode</span>
            </a>
        </div>
    </header>

    <!-- Snippet Title Bar — hidden until DB backend ready -->
    <div
        class="hidden items-center justify-between gap-4 px-4 py-1.5 bg-[#EEE8D5]/50 border-b border-[#93a1a1]/20 z-20 relative"
    >
        <div class="flex items-center gap-2 flex-1">
            <input
                type="text"
                bind:value={snippetTitle}
                class="flex-1 max-w-lg bg-transparent text-sm font-medium focus:outline-none focus:bg-white px-2 py-1 rounded transition-colors"
                placeholder="Snippet title..."
            />
        </div>
    </div>

    <!-- Main Content - 2 Panel Layout -->
    <main class="flex-1 overflow-hidden">
        <ResizablePanel
            direction="horizontal"
            defaultSplit={50}
            minSize={30}
            maxSize={70}
        >
            {#snippet first()}
                <!-- Left Panel: Code Editor -->
                <div
                    class="h-full flex flex-col {editorTheme ===
                    AST_EXPLORER_DARK_THEME_NAME
                        ? 'bg-[#1e1e2e]'
                        : 'bg-[#FDF6E3]'}"
                >
                    <div
                        class="flex items-center gap-2 px-3 py-1.5 border-b {editorTheme ===
                        AST_EXPLORER_DARK_THEME_NAME
                            ? 'bg-[#252540]/80 border-[#ffffff]/10'
                            : 'bg-[#EEE8D5]/50 border-[#93a1a1]/20'}"
                    >
                        <Code2 size={14} class="text-[#268bd2]" />
                        <span
                            class="text-xs font-medium {editorTheme ===
                            AST_EXPLORER_DARK_THEME_NAME
                                ? 'text-[#d4d4d4]'
                                : ''}">Source Code</span
                        >
                        <span class="text-xs text-[#93a1a1]"
                            >({allLanguages.find((l) => l.id === language)
                                ?.ext})</span
                        >

                        <!-- Spacer -->
                        <div class="flex-1"></div>

                        <!-- Font size / Zoom controls -->
                        <div class="flex items-center gap-0.5">
                            <button
                                onclick={() =>
                                    (editorFontSize = Math.max(
                                        FONT_SIZE_MIN,
                                        editorFontSize - 1,
                                    ))}
                                disabled={editorFontSize <= FONT_SIZE_MIN}
                                class="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-30
                                    {editorTheme ===
                                AST_EXPLORER_DARK_THEME_NAME
                                    ? 'text-[#9cdcfe] hover:bg-white/10'
                                    : 'text-[#657b83] hover:bg-[#93a1a1]/20'}"
                                title="Zoom out (kurangi font)"
                            >
                                <ZoomOut size={13} />
                            </button>
                            <span
                                class="text-[10px] w-7 text-center tabular-nums {editorTheme ===
                                AST_EXPLORER_DARK_THEME_NAME
                                    ? 'text-[#6a737d]'
                                    : 'text-[#93a1a1]'}"
                                >{editorFontSize}px</span
                            >
                            <button
                                onclick={() =>
                                    (editorFontSize = Math.min(
                                        FONT_SIZE_MAX,
                                        editorFontSize + 1,
                                    ))}
                                disabled={editorFontSize >= FONT_SIZE_MAX}
                                class="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-30
                                    {editorTheme ===
                                AST_EXPLORER_DARK_THEME_NAME
                                    ? 'text-[#9cdcfe] hover:bg-white/10'
                                    : 'text-[#657b83] hover:bg-[#93a1a1]/20'}"
                                title="Zoom in (perbesar font)"
                            >
                                <ZoomIn size={13} />
                            </button>
                        </div>
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <MonacoEditor
                            onReady={(api) => (monacoEditorApi = api)}
                            value={code}
                            language={allLanguages.find(
                                (l) => l.id === language,
                            )?.monacoId ?? language}
                            theme={editorTheme}
                            fontSize={editorFontSize}
                            onChange={handleCodeChange}
                            onCursorChange={handleCursorChange}
                            height="100%"
                        />
                    </div>
                </div>
            {/snippet}

            {#snippet second()}
                <!-- Right Panel: Mermaid Diagram -->
                <div class="h-full flex flex-col bg-[#FDF6E3]">
                    <div
                        class="flex items-center gap-2 px-3 py-1.5 bg-[#EEE8D5]/50 border-b border-[#93a1a1]/20"
                    >
                        <GitBranch size={14} class="text-[#859900]" />
                        <span class="text-xs font-medium">Diagram</span>
                        <span class="text-xs text-[#93a1a1]"
                            >({activeDiagramType.name})</span
                        >

                        <div class="ml-auto flex items-center gap-2">
                            {#if isRendering}
                                <RefreshCw
                                    size={12}
                                    class="animate-spin text-[#93a1a1]"
                                />
                            {/if}

                            <!-- Export Dropdown — dipindah dari title bar ke sini -->
                            {#if mermaidSvg || mermaidCode}
                                <div class="relative">
                                    <button
                                        onclick={() =>
                                            (showExportMenu = !showExportMenu)}
                                        class="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#93a1a1]/30 text-[#657b83] rounded hover:bg-[#FDF6E3] hover:text-[#268bd2] transition-colors text-[11px] font-medium shadow-sm"
                                        aria-label="Export Diagram"
                                        title="Export Diagram"
                                    >
                                        <Download size={12} />
                                        <span>Export</span>
                                    </button>

                                    {#if showExportMenu}
                                        <div
                                            class="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-[#93a1a1]/20 overflow-hidden z-50"
                                        >
                                            <div
                                                class="flex justify-between items-center p-3 border-b border-[#93a1a1]/10 bg-[#EEE8D5]/30"
                                            >
                                                <span
                                                    class="text-xs font-semibold uppercase tracking-wider text-[#93a1a1]"
                                                    >Export Options</span
                                                >
                                                <button
                                                    onclick={() =>
                                                        (showExportMenu = false)}
                                                    class="text-[#93a1a1] hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <ExportPanel
                                                {mermaidSvg}
                                                mermaidSvgs={mermaidSvgsExport}
                                                {mermaidCode}
                                                filename={exportFilename}
                                                theme="light"
                                            />
                                        </div>

                                        <!-- Backdrop -->
                                        <button
                                            class="fixed inset-0 w-full h-full z-40 cursor-default"
                                            onclick={() =>
                                                (showExportMenu = false)}
                                            aria-label="Close export menu"
                                            title="Close export menu"
                                        ></button>
                                    {/if}
                                </div>
                            {/if}

                            <!-- Divider -->
                            <div class="w-px h-3.5 bg-[#93a1a1]/30"></div>

                            <!-- Direction toggle -->
                            <div
                                class="flex items-center rounded border border-[#93a1a1]/30 overflow-hidden text-[10px] font-semibold"
                            >
                                <button
                                    onclick={() => {
                                        if (flowDirection !== "TD")
                                            toggleDirection();
                                    }}
                                    class="px-2 py-1 flex items-center gap-1 transition-colors {flowDirection ===
                                    'TD'
                                        ? 'bg-[#268bd2] text-white'
                                        : 'bg-white text-[#93a1a1] hover:bg-[#EEE8D5]'}"
                                    title="Top → Down"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="currentColor"
                                    >
                                        <rect
                                            x="4"
                                            y="0"
                                            width="4"
                                            height="3"
                                            rx="1"
                                        />
                                        <rect
                                            x="4"
                                            y="9"
                                            width="4"
                                            height="3"
                                            rx="1"
                                        />
                                        <rect
                                            x="5.5"
                                            y="3"
                                            width="1"
                                            height="6"
                                        />
                                        <polygon
                                            points="6,12 3.5,8.5 8.5,8.5"
                                        />
                                    </svg>
                                    TD
                                </button>
                                <button
                                    onclick={() => {
                                        if (flowDirection !== "LR")
                                            toggleDirection();
                                    }}
                                    class="px-2 py-1 flex items-center gap-1 transition-colors {flowDirection ===
                                    'LR'
                                        ? 'bg-[#268bd2] text-white'
                                        : 'bg-white text-[#93a1a1] hover:bg-[#EEE8D5]'}"
                                    title="Left → Right"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="currentColor"
                                    >
                                        <rect
                                            x="0"
                                            y="4"
                                            width="3"
                                            height="4"
                                            rx="1"
                                        />
                                        <rect
                                            x="9"
                                            y="4"
                                            width="3"
                                            height="4"
                                            rx="1"
                                        />
                                        <rect
                                            x="3"
                                            y="5.5"
                                            width="6"
                                            height="1"
                                        />
                                        <polygon
                                            points="12,6 8.5,3.5 8.5,8.5"
                                        />
                                    </svg>
                                    LR
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="flex-1 overflow-auto p-4 min-h-0 flex flex-col">
                        {#if parseError}
                            <div
                                class="flex flex-col items-center justify-center h-full text-center"
                            >
                                <div
                                    class="w-12 h-12 rounded-full bg-[#dc322f]/10 flex items-center justify-center mb-4"
                                >
                                    <AlertTriangle
                                        size={24}
                                        class="text-[#dc322f]"
                                    />
                                </div>
                                <p class="text-sm font-medium text-[#dc322f]">
                                    Parse Error
                                </p>
                                <p class="text-xs text-[#93a1a1] mt-2 max-w-xs">
                                    {parseError.message}
                                </p>
                                {#if parseError.line}
                                    <p class="text-xs text-[#93a1a1]/60 mt-1">
                                        Line {parseError.line}, Column {parseError.column}
                                    </p>
                                {/if}
                            </div>
                        {:else if mermaidError}
                            <div
                                class="flex flex-col items-center justify-center h-full text-center"
                            >
                                <div
                                    class="w-12 h-12 rounded-full bg-[#b58900]/10 flex items-center justify-center mb-4"
                                >
                                    <AlertTriangle
                                        size={24}
                                        class="text-[#b58900]"
                                    />
                                </div>
                                <p class="text-sm font-medium text-[#b58900]">
                                    Diagram Error
                                </p>
                                <p class="text-xs text-[#93a1a1] mt-2 max-w-xs">
                                    {mermaidError}
                                </p>
                            </div>
                        {:else if mermaidSvgs.length > 0}
                            {#if mermaidSvgs.length === 1}
                                <!-- Single diagram — full height, no chrome -->
                                <div
                                    class="h-full flex flex-col rounded-lg border border-[#93a1a1]/20 bg-white shadow-sm overflow-hidden min-h-0"
                                >
                                    <div
                                        class="flex items-center gap-2 px-3 py-2 bg-[#EEE8D5]/60 border-b border-[#93a1a1]/15 shrink-0"
                                    >
                                        <span
                                            class="text-sm font-medium text-[#268bd2] font-mono"
                                        >
                                            {mermaidSvgs[0].group
                                                ? mermaidSvgs[0].group +
                                                  "." +
                                                  mermaidSvgs[0].title
                                                : mermaidSvgs[0].title}
                                        </span>
                                    </div>
                                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                                    <div
                                        class="flex-1 min-h-0"
                                        onclick={(e) => {
                                            // Klik pada node SVG → highlight di editor
                                            const g = (
                                                e.target as Element
                                            )?.closest("g.node");
                                            if (!g) return;
                                            const rawId = g.id ?? "";
                                            // Format Mermaid: "flowchart-{nodeId}-{n}"
                                            const m =
                                                rawId.match(
                                                    /^flowchart-(.+)-\d+$/,
                                                );
                                            if (m) onDiagramNodeClick(m[1]);
                                        }}
                                    >
                                        <PanZoomDiagram
                                            svg={mermaidSvgs[0].svg}
                                            height="100%"
                                        />
                                    </div>
                                </div>
                            {:else}
                                <!-- Multi diagram — grouped, collapsible cards -->
                                {@const groups = [
                                    ...new Set(mermaidSvgs.map((d) => d.group)),
                                ]}
                                {@const standalone = mermaidSvgs.filter(
                                    (d) => !d.group,
                                )}
                                {@const allCollapsed = mermaidSvgs.every(
                                    (d) => d.collapsed,
                                )}

                                <!-- Toolbar: collapse all / expand all -->
                                <div
                                    class="flex items-center justify-between mb-3 shrink-0"
                                >
                                    <span class="text-xs text-[#93a1a1]">
                                        {mermaidSvgs.length} diagram
                                    </span>
                                    <button
                                        onclick={() => {
                                            const next = !allCollapsed;
                                            mermaidSvgs = mermaidSvgs.map(
                                                (d) => ({
                                                    ...d,
                                                    collapsed: next,
                                                }),
                                            );
                                        }}
                                        class="text-[11px] px-2 py-1 rounded border border-[#93a1a1]/30 bg-white hover:bg-[#EEE8D5] text-[#657b83] transition-colors"
                                    >
                                        {allCollapsed
                                            ? "▶ Expand All"
                                            : "▼ Collapse All"}
                                    </button>
                                </div>

                                <div class="flex flex-col gap-4 pb-6">
                                    <!-- Class groups -->
                                    {#each groups.filter((g) => g !== null) as className}
                                        {@const methods = mermaidSvgs.filter(
                                            (d) => d.group === className,
                                        )}
                                        {@const allMethodsCollapsed =
                                            methods.every((d) => d.collapsed)}
                                        <div
                                            class="rounded-lg border border-[#268bd2]/25 bg-white shadow-sm overflow-hidden"
                                        >
                                            <!-- Class header -->
                                            <div
                                                class="flex items-center justify-between px-3 py-2 bg-[#268bd2]/8 border-b border-[#268bd2]/15"
                                            >
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <span
                                                        class="text-[10px] font-semibold uppercase tracking-wider text-[#268bd2]/70"
                                                        >class</span
                                                    >
                                                    <span
                                                        class="text-sm font-bold text-[#268bd2] font-mono"
                                                        >{className}</span
                                                    >
                                                    <span
                                                        class="text-[10px] text-[#93a1a1] bg-[#EEE8D5] px-1.5 py-0.5 rounded-full"
                                                        >{methods.length} method</span
                                                    >
                                                </div>
                                                <button
                                                    onclick={() => {
                                                        const next =
                                                            !allMethodsCollapsed;
                                                        mermaidSvgs =
                                                            mermaidSvgs.map(
                                                                (d) =>
                                                                    d.group ===
                                                                    className
                                                                        ? {
                                                                              ...d,
                                                                              collapsed:
                                                                                  next,
                                                                          }
                                                                        : d,
                                                            );
                                                    }}
                                                    class="text-[10px] px-2 py-0.5 rounded border border-[#268bd2]/20 bg-white hover:bg-[#EEE8D5] text-[#268bd2] transition-colors"
                                                >
                                                    {allMethodsCollapsed
                                                        ? "▶ Expand"
                                                        : "▼ Collapse"}
                                                </button>
                                            </div>

                                            <!-- Method cards inside class -->
                                            <div
                                                class="flex flex-col divide-y divide-[#93a1a1]/10"
                                            >
                                                {#each methods as item (item.group + "." + item.title)}
                                                    {@const idx =
                                                        mermaidSvgs.indexOf(
                                                            item,
                                                        )}
                                                    <div>
                                                        <!-- Method title bar -->
                                                        <button
                                                            onclick={() => {
                                                                mermaidSvgs[
                                                                    idx
                                                                ] = {
                                                                    ...mermaidSvgs[
                                                                        idx
                                                                    ],
                                                                    collapsed:
                                                                        !item.collapsed,
                                                                };
                                                            }}
                                                            class="w-full flex items-center gap-2 px-4 py-2 bg-[#EEE8D5]/40 hover:bg-[#EEE8D5]/70 transition-colors text-left"
                                                        >
                                                            <span
                                                                class="text-[#93a1a1] text-xs w-3"
                                                            >
                                                                {item.collapsed
                                                                    ? "▶"
                                                                    : "▼"}
                                                            </span>
                                                            <span
                                                                class="text-xs text-[#93a1a1] font-medium"
                                                                >method</span
                                                            >
                                                            <span
                                                                class="text-sm font-medium text-[#657b83] font-mono"
                                                                >{item.title}</span
                                                            >
                                                            {#if item.title.includes("⚡")}
                                                                <span
                                                                    class="text-[10px] text-[#b58900] bg-[#b58900]/10 px-1.5 rounded"
                                                                    >async</span
                                                                >
                                                            {/if}
                                                        </button>
                                                        <!-- Diagram body -->
                                                        {#if !item.collapsed}
                                                            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                                                            <div
                                                                style="height: 380px"
                                                                onclick={(
                                                                    e,
                                                                ) => {
                                                                    const g = (
                                                                        e.target as Element
                                                                    )?.closest(
                                                                        "g.node",
                                                                    );
                                                                    if (!g)
                                                                        return;
                                                                    const m = (
                                                                        g.id ??
                                                                        ""
                                                                    ).match(
                                                                        /^flowchart-(.+)-\d+$/,
                                                                    );
                                                                    if (m)
                                                                        onDiagramNodeClick(
                                                                            m[1],
                                                                        );
                                                                }}
                                                            >
                                                                <PanZoomDiagram
                                                                    svg={item.svg}
                                                                    height="100%"
                                                                />
                                                            </div>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}

                                    <!-- Standalone functions (no class) -->
                                    {#each standalone as item (item.title)}
                                        {@const idx = mermaidSvgs.indexOf(item)}
                                        <div
                                            class="rounded-lg border border-[#93a1a1]/20 bg-white shadow-sm overflow-hidden"
                                        >
                                            <!-- Function title bar -->
                                            <button
                                                onclick={() => {
                                                    mermaidSvgs[idx] = {
                                                        ...mermaidSvgs[idx],
                                                        collapsed:
                                                            !item.collapsed,
                                                    };
                                                }}
                                                class="w-full flex items-center gap-2 px-3 py-2 bg-[#EEE8D5]/60 hover:bg-[#EEE8D5] transition-colors text-left border-b border-[#93a1a1]/15"
                                            >
                                                <span
                                                    class="text-[#93a1a1] text-xs w-3"
                                                >
                                                    {item.collapsed ? "▶" : "▼"}
                                                </span>
                                                <span
                                                    class="text-[10px] font-semibold uppercase tracking-wider text-[#93a1a1]"
                                                    >fn</span
                                                >
                                                <span
                                                    class="text-sm font-medium text-[#268bd2] font-mono"
                                                    >{item.title}</span
                                                >
                                                {#if item.title.includes("⚡")}
                                                    <span
                                                        class="text-[10px] text-[#b58900] bg-[#b58900]/10 px-1.5 rounded"
                                                        >async</span
                                                    >
                                                {/if}
                                            </button>
                                            <!-- Diagram body -->
                                            {#if !item.collapsed}
                                                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                                                <div
                                                    style="height: 380px"
                                                    onclick={(e) => {
                                                        const g = (
                                                            e.target as Element
                                                        )?.closest("g.node");
                                                        if (!g) return;
                                                        const m = (
                                                            g.id ?? ""
                                                        ).match(
                                                            /^flowchart-(.+)-\d+$/,
                                                        );
                                                        if (m)
                                                            onDiagramNodeClick(
                                                                m[1],
                                                            );
                                                    }}
                                                >
                                                    <PanZoomDiagram
                                                        svg={item.svg}
                                                        height="100%"
                                                    />
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        {:else if isRendering}
                            <div
                                class="flex items-center justify-center h-full"
                            >
                                <RefreshCw
                                    size={24}
                                    class="animate-spin text-[#93a1a1]"
                                />
                            </div>
                        {:else}
                            <div
                                class="flex items-center justify-center h-full text-[#93a1a1] text-sm"
                            >
                                Write some code to see the diagram
                            </div>
                        {/if}
                    </div>
                </div>
            {/snippet}
        </ResizablePanel>
    </main>

    <!-- Footer -->
    <footer
        class="px-4 py-2 bg-[#EEE8D5] border-t border-[#93a1a1]/30 text-xs text-[#93a1a1]"
    >
        <div class="flex items-center justify-between">
            <span>Built with ❤️ by NgeCode</span>
            <span>Code. Teach. Share. Repeat.</span>
        </div>
    </footer>
</div>

<!-- Share Modal -->
{#if showShareModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div
            class="absolute inset-0 bg-black/30"
            onclick={() => (showShareModal = false)}
        ></div>

        <!-- Modal -->
        <div
            class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        >
            <button
                onclick={() => (showShareModal = false)}
                class="absolute top-4 right-4 p-1 hover:bg-[#EEE8D5] rounded"
            >
                <X size={18} />
            </button>

            <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
                <Share2 size={20} class="text-[#268bd2]" />
                Share Snippet
            </h3>

            <div class="space-y-4">
                <!-- Info: title + language -->
                <div
                    class="flex items-center gap-2 text-xs text-[#93a1a1] bg-[#EEE8D5]/60 rounded px-3 py-2"
                >
                    <span
                        class="font-medium text-[#657b83] truncate max-w-[180px]"
                        >{snippetTitle}</span
                    >
                    <span class="text-[#93a1a1]/50">·</span>
                    <span>{language}</span>
                    <span class="text-[#93a1a1]/50">·</span>
                    <span>{code.split("\n").length} baris</span>
                    <span
                        class="ml-auto font-mono text-[10px] {shareUrl.length >
                        8000
                            ? 'text-[#dc322f]'
                            : 'text-[#859900]'}"
                    >
                        {shareUrl.length} chars
                    </span>
                </div>

                {#if shareUrl.length > 8000}
                    <div
                        class="flex items-start gap-2 text-xs text-[#b58900] bg-[#b58900]/8 border border-[#b58900]/20 rounded px-3 py-2"
                    >
                        <span class="mt-0.5">⚠</span>
                        <span
                            >URL cukup panjang karena kode besar. Beberapa
                            browser/platform mungkin memotongnya. Pertimbangkan
                            untuk menyimpan dan share sebagai file.</span
                        >
                    </div>
                {/if}

                <div>
                    <label
                        class="block text-xs font-medium text-[#93a1a1] mb-1.5 uppercase tracking-wider"
                    >
                        Share URL
                    </label>
                    <div class="flex gap-2">
                        <input
                            type="text"
                            readonly
                            value={shareUrl}
                            onclick={(e) =>
                                (e.target as HTMLInputElement).select()}
                            class="flex-1 px-3 py-2 bg-[#EEE8D5] rounded text-xs font-mono text-[#657b83] focus:outline-none cursor-text"
                        />
                        <button
                            onclick={copyShareUrl}
                            class="px-3 py-2 bg-[#268bd2] text-white rounded hover:bg-[#268bd2]/80 transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap"
                        >
                            {#if copiedShare}
                                <Check size={14} />
                                <span class="text-xs">Copied!</span>
                            {:else}
                                <Copy size={14} />
                                <span class="text-xs">Copy</span>
                            {/if}
                        </button>
                    </div>
                </div>

                <div class="flex gap-2">
                    <a
                        href="https://twitter.com/intent/tweet?url={encodeURIComponent(
                            shareUrl,
                        )}&text={encodeURIComponent(
                            `Lihat snippet kode saya: ${snippetTitle} — dibuat di NgeCode Explorer`,
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex-1 py-2 bg-[#1DA1F2] text-white rounded text-center text-sm hover:bg-[#1DA1F2]/80 transition-colors"
                    >
                        Share on Twitter
                    </a>
                    <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="px-3 py-2 bg-[#EEE8D5] rounded hover:bg-[#93a1a1]/20 transition-colors flex items-center gap-1 text-sm"
                        title="Buka di tab baru"
                    >
                        <ExternalLink size={14} />
                        Open
                    </a>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* SVG node highlight — editor cursor → diagram */
    :global(.nc-svg-node-highlight > rect),
    :global(.nc-svg-node-highlight > polygon),
    :global(.nc-svg-node-highlight > circle),
    :global(.nc-svg-node-highlight > ellipse),
    :global(.nc-svg-node-highlight > path) {
        stroke: #268bd2 !important;
        stroke-width: 2.5px !important;
        filter: drop-shadow(0 0 6px rgba(38, 139, 210, 0.5));
    }

    /* Diagram node click cursor */
    :global(.pan-zoom-container svg .node) {
        cursor: pointer;
    }

    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
    }
</style>
