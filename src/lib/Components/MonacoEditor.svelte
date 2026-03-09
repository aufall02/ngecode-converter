<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import loader from "@monaco-editor/loader";
    import type * as Monaco from "monaco-editor";
    import * as prettier from "prettier";
    import prettierPluginBabel from "prettier/plugins/babel";
    import prettierPluginEstree from "prettier/plugins/estree";
    import prettierPluginTypescript from "prettier/plugins/typescript";
    import {
        AST_EXPLORER_THEME_NAME,
        AST_EXPLORER_THEME,
        AST_EXPLORER_DARK_THEME_NAME,
        AST_EXPLORER_DARK_THEME,
    } from "../themes/astExplorerTheme";

    interface EditorAPI {
        highlightRange: (
            startLine: number,
            startCol: number,
            endLine: number,
            endCol: number,
        ) => void;
        clearHighlight: () => void;
        formatCode: () => Promise<void>;
    }

    interface Props {
        value: string;
        language?: string;
        theme?: string;
        height?: string;
        fontSize?: number;
        onChange?: (value: string) => void;
        onCursorChange?: (line: number, col: number) => void;
        onReady?: (api: EditorAPI) => void;
        onFormat?: (formatted: string) => void;
        readOnly?: boolean;
    }

    const props: Props = $props();
    // Akses individual prop via props.xxx agar reaktif di $effect

    // Shorthand helper — dipakai di template
    const value = $derived(props.value ?? "");
    const language = $derived(props.language ?? "javascript");
    const theme = $derived(props.theme ?? AST_EXPLORER_THEME_NAME);
    const height = $derived(props.height ?? "100%");
    const fontSize = $derived(props.fontSize ?? 13);
    const readOnly = $derived(props.readOnly ?? false);

    let container: HTMLDivElement;
    let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
    let monacoRef: typeof Monaco | null = null;
    let isThemeRegistered = false;
    let decorationCollection: ReturnType<
        ReturnType<typeof import("monaco-editor")["editor"]["create"]>["createDecorationsCollection"]
    > | null = null;
    let isFormatting = $state(false);

    async function runPrettier(code: string, lang: string): Promise<string> {
        const parser =
            lang === "typescript" || lang === "tsx"
                ? "typescript"
                : "babel";
        const plugins =
            parser === "typescript"
                ? [prettierPluginTypescript, prettierPluginEstree]
                : [prettierPluginBabel, prettierPluginEstree];
        return await prettier.format(code, {
            parser,
            plugins,
            semi: true,
            singleQuote: false,
            tabWidth: 2,
            trailingComma: "es5",
            printWidth: 80,
        });
    }

    onMount(() => {
        let disposed = false;

        loader.init().then((monacoInstance) => {
            if (disposed) return;

            monacoRef = monacoInstance;

            // Register custom themes once
            if (!isThemeRegistered) {
                monacoInstance.editor.defineTheme(
                    AST_EXPLORER_THEME_NAME,
                    AST_EXPLORER_THEME,
                );
                monacoInstance.editor.defineTheme(
                    AST_EXPLORER_DARK_THEME_NAME,
                    AST_EXPLORER_DARK_THEME,
                );
                isThemeRegistered = true;
            }

            editor = monacoInstance.editor.create(container, {
                value: props.value ?? "",
                language: props.language ?? "javascript",
                theme: props.theme ?? AST_EXPLORER_THEME_NAME,
                readOnly: props.readOnly ?? false,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: props.fontSize ?? 13,
                fontFamily:
                    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true,
                lineNumbers: "on",
                lineNumbersMinChars: 3,
                glyphMargin: false,
                folding: true,
                foldingHighlight: false,
                showFoldingControls: "mouseover",
                renderLineHighlight: "line",
                scrollBeyondLastLine: false,
                wordWrap: "off",
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: false,
                bracketPairColorization: { enabled: true },
                guides: {
                    bracketPairs: false,
                    indentation: true,
                },
                suggest: {
                    showKeywords: true,
                    showSnippets: true,
                },
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: false,
                },
                padding: { top: 12, bottom: 12 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                scrollbar: {
                    vertical: "auto",
                    horizontal: "auto",
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                    useShadows: false,
                },
                contextmenu: true,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                roundedSelection: true,
                renderWhitespace: "none",
            });

            // Emit changes — editor is definitely non-null here
            const createdEditor = editor!;
            createdEditor.onDidChangeModelContent(() => {
                const newValue = createdEditor.getValue();
                props.onChange?.(newValue);
            });

            // Emit cursor position changes
            createdEditor.onDidChangeCursorPosition((e) => {
                props.onCursorChange?.(
                    e.position.lineNumber,
                    e.position.column - 1, // convert to 0-based column
                );
            });

            // Format shortcut: Shift+Alt+F
            createdEditor.addCommand(
                monacoInstance.KeyMod.Shift |
                    monacoInstance.KeyMod.Alt |
                    monacoInstance.KeyCode.KeyF,
                async () => {
                    const code = createdEditor.getValue();
                    try {
                        isFormatting = true;
                        const formatted = await runPrettier(
                            code,
                            props.language ?? "javascript",
                        );
                        const position = createdEditor.getPosition();
                        createdEditor.setValue(formatted);
                        if (position) createdEditor.setPosition(position);
                        props.onFormat?.(formatted);
                    } catch (e) {
                        console.warn("Prettier format error:", e);
                    } finally {
                        isFormatting = false;
                    }
                },
            );

            // Expose public API via onReady callback (Svelte 5 compatible)
            props.onReady?.({
                highlightRange(
                    startLine: number,
                    startCol: number,
                    endLine: number,
                    endCol: number,
                ) {
                    if (!createdEditor || !monacoInstance) return;
                    // dispose previous collection before creating a new one
                    decorationCollection?.clear();
                    decorationCollection = createdEditor.createDecorationsCollection(
                        [
                            {
                                range: new monacoInstance.Range(
                                    startLine,
                                    startCol + 1,
                                    endLine,
                                    endCol + 1,
                                ),
                                options: {
                                    // Full-line background so trace highlight is clearly visible
                                    isWholeLine: true,
                                    className: "nc-highlight-range",
                                    marginClassName: "nc-highlight-margin",
                                    overviewRuler: {
                                        color: "#268bd2",
                                        position:
                                            monacoInstance.editor
                                                .OverviewRulerLane.Full,
                                    },
                                },
                            },
                        ],
                    );
                    createdEditor.revealLineInCenterIfOutsideViewport(
                        startLine,
                    );
                },
                clearHighlight() {
                    decorationCollection?.clear();
                    decorationCollection = null;
                },
                async formatCode() {
                    const code = createdEditor.getValue();
                    try {
                        isFormatting = true;
                        const formatted = await runPrettier(
                            code,
                            props.language ?? "javascript",
                        );
                        const position = createdEditor.getPosition();
                        createdEditor.setValue(formatted);
                        if (position) createdEditor.setPosition(position);
                        props.onFormat?.(formatted);
                    } catch (e) {
                        console.warn("Prettier format error:", e);
                    } finally {
                        isFormatting = false;
                    }
                },
            });
        });

        return () => {
            disposed = true;
            editor?.dispose();
            editor = null;
        };
    });

    onDestroy(() => {
        editor?.dispose();
        editor = null;
    });

    // Reactively update language when prop changes
    $effect(() => {
        // Read reactive values BEFORE the `if (editor)` guard so Svelte 5
        // tracks them as dependencies even while editor is still null (async init).
        const lang = language;
        const monaco = monacoRef;
        if (editor && monaco && lang) {
            const model = editor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, lang);
            }
        }
    });

    // Reactively update theme when prop changes
    $effect(() => {
        const t = theme;
        const monaco = monacoRef;
        if (editor && monaco && t) {
            monaco.editor.setTheme(t);
        }
    });

    // Reactively update value only when it differs (avoid cursor-jump loops)
    $effect(() => {
        // Always read `value` here so the effect is re-run whenever value
        // changes — even if editor was null on the first run.
        const v = value;
        if (editor) {
            const current = editor.getValue();
            if (current !== v) {
                const position = editor.getPosition();
                editor.setValue(v);
                if (position) editor.setPosition(position);
            }
        }
    });

    // Reactively update readOnly
    $effect(() => {
        const ro = readOnly;
        if (editor) {
            editor.updateOptions({ readOnly: ro });
        }
    });

    // Reactively update fontSize
    $effect(() => {
        const size = fontSize; // baca derived agar effect ter-track
        if (editor) {
            editor.updateOptions({ fontSize: size });
        }
    });
</script>

<div
    bind:this={container}
    style="width: 100%; height: {height};"
    class="monaco-editor-container"
></div>

<style>
    .monaco-editor-container {
        overflow: hidden;
    }

    /* Remove Monaco's default focus outline in favour of our own */
    .monaco-editor-container :global(.monaco-editor .overflow-guard) {
        border-radius: 0;
    }

    /* Bidirectional highlight — diagram node → editor range */
    .monaco-editor-container :global(.nc-highlight-range) {
        background-color: rgba(38, 139, 210, 0.15);
        border-left: 3px solid #268bd2;
        border-radius: 0 2px 2px 0;
    }

    /* Margin gutter indicator — arrow/dot di sebelah kiri nomor baris */
    .monaco-editor-container :global(.nc-highlight-margin) {
        background-color: #268bd2;
        width: 3px !important;
    }
</style>
