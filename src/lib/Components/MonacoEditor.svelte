<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import loader from "@monaco-editor/loader";
    import type * as Monaco from "monaco-editor";
    import {
        AST_EXPLORER_THEME_NAME,
        AST_EXPLORER_THEME,
    } from "../themes/astExplorerTheme";

    interface EditorAPI {
        highlightRange: (
            startLine: number,
            startCol: number,
            endLine: number,
            endCol: number,
        ) => void;
        clearHighlight: () => void;
    }

    interface Props {
        value: string;
        language?: string;
        theme?: string;
        height?: string;
        onChange?: (value: string) => void;
        onCursorChange?: (line: number, col: number) => void;
        onReady?: (api: EditorAPI) => void;
        readOnly?: boolean;
    }

    let {
        value = "",
        language = "javascript",
        theme = AST_EXPLORER_THEME_NAME,
        height = "100%",
        onChange,
        onCursorChange,
        onReady,
        readOnly = false,
    }: Props = $props();

    let container: HTMLDivElement;
    let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
    let monacoRef: typeof Monaco | null = null;
    let isThemeRegistered = false;
    let activeDecorations: string[] = [];

    onMount(() => {
        let disposed = false;

        loader.init().then((monacoInstance) => {
            if (disposed) return;

            monacoRef = monacoInstance;

            // Register custom theme once
            if (!isThemeRegistered) {
                monacoInstance.editor.defineTheme(
                    AST_EXPLORER_THEME_NAME,
                    AST_EXPLORER_THEME,
                );
                isThemeRegistered = true;
            }

            editor = monacoInstance.editor.create(container, {
                value,
                language,
                theme,
                readOnly,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
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
                onChange?.(newValue);
            });

            // Emit cursor position changes
            createdEditor.onDidChangeCursorPosition((e) => {
                onCursorChange?.(
                    e.position.lineNumber,
                    e.position.column - 1, // convert to 0-based column
                );
            });

            // Expose public API via onReady callback (Svelte 5 compatible)
            onReady?.({
                highlightRange(
                    startLine: number,
                    startCol: number,
                    endLine: number,
                    endCol: number,
                ) {
                    if (!createdEditor || !monacoInstance) return;
                    const newDecos = createdEditor.deltaDecorations(
                        activeDecorations,
                        [
                            {
                                range: new monacoInstance.Range(
                                    startLine,
                                    startCol + 1,
                                    endLine,
                                    endCol + 1,
                                ),
                                options: {
                                    className: "nc-highlight-range",
                                    isWholeLine: false,
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
                    activeDecorations = newDecos;
                    createdEditor.revealLineInCenterIfOutsideViewport(
                        startLine,
                    );
                },
                clearHighlight() {
                    if (!createdEditor) return;
                    activeDecorations = createdEditor.deltaDecorations(
                        activeDecorations,
                        [],
                    );
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
        if (editor && monacoRef && language) {
            const model = editor.getModel();
            if (model) {
                monacoRef.editor.setModelLanguage(model, language);
            }
        }
    });

    // Reactively update theme when prop changes
    $effect(() => {
        if (editor && monacoRef && theme) {
            monacoRef.editor.setTheme(theme);
        }
    });

    // Reactively update value only when it differs (avoid cursor-jump loops)
    $effect(() => {
        if (editor) {
            const current = editor.getValue();
            if (current !== value) {
                const position = editor.getPosition();
                editor.setValue(value);
                if (position) editor.setPosition(position);
            }
        }
    });

    // Reactively update readOnly
    $effect(() => {
        if (editor) {
            editor.updateOptions({ readOnly });
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
        background-color: rgba(38, 139, 210, 0.18);
        border-bottom: 2px solid #268bd2;
        border-radius: 2px;
    }
</style>
