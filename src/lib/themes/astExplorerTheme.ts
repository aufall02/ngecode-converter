import type * as Monaco from "monaco-editor";

export const AST_EXPLORER_THEME_NAME = "ast-explorer-light";
export const AST_EXPLORER_DARK_THEME_NAME = "ast-explorer-dark";

export const AST_EXPLORER_THEME: Monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    // Background & default text - Solarized Light palette
    { token: "", foreground: "657b83", background: "FDF6E3" },

    // Comments
    { token: "comment", foreground: "93a1a1", fontStyle: "italic" },
    { token: "comment.line", foreground: "93a1a1", fontStyle: "italic" },
    { token: "comment.block", foreground: "93a1a1", fontStyle: "italic" },

    // Keywords
    { token: "keyword", foreground: "859900", fontStyle: "bold" },
    { token: "keyword.control", foreground: "859900", fontStyle: "bold" },
    { token: "keyword.operator", foreground: "657b83" },
    { token: "keyword.other", foreground: "859900" },

    // Storage (var, let, const, function, class, etc.)
    { token: "storage", foreground: "cb4b16" },
    { token: "storage.type", foreground: "268bd2" },
    { token: "storage.modifier", foreground: "859900" },

    // Strings
    { token: "string", foreground: "2aa198" },
    { token: "string.quoted", foreground: "2aa198" },
    { token: "string.template", foreground: "2aa198" },
    { token: "string.regexp", foreground: "dc322f" },

    // Numbers
    { token: "number", foreground: "d33682" },
    { token: "number.float", foreground: "d33682" },
    { token: "number.hex", foreground: "d33682" },

    // Booleans / null / undefined
    { token: "constant.language", foreground: "cb4b16", fontStyle: "bold" },
    { token: "constant.numeric", foreground: "d33682" },
    { token: "constant.character", foreground: "2aa198" },

    // Variables
    { token: "variable", foreground: "268bd2" },
    { token: "variable.language", foreground: "cb4b16" },
    { token: "variable.other", foreground: "657b83" },
    { token: "variable.parameter", foreground: "6c71c4" },

    // Functions
    { token: "entity.name.function", foreground: "268bd2", fontStyle: "bold" },
    { token: "support.function", foreground: "268bd2" },

    // Types / Classes
    { token: "entity.name.type", foreground: "b58900" },
    { token: "entity.name.class", foreground: "b58900" },
    { token: "entity.other.inherited-class", foreground: "b58900" },
    { token: "support.class", foreground: "b58900" },
    { token: "support.type", foreground: "859900" },

    // Properties / Attributes
    { token: "variable.object.property", foreground: "657b83" },
    { token: "support.variable.property", foreground: "657b83" },
    { token: "entity.other.attribute-name", foreground: "268bd2" },
    { token: "meta.object-literal.key", foreground: "657b83" },

    // Tags (JSX/HTML)
    { token: "entity.name.tag", foreground: "859900" },
    { token: "punctuation.definition.tag", foreground: "93a1a1" },

    // Operators & Punctuation
    { token: "keyword.operator.arithmetic", foreground: "657b83" },
    { token: "keyword.operator.comparison", foreground: "657b83" },
    { token: "keyword.operator.logical", foreground: "657b83" },
    { token: "keyword.operator.assignment", foreground: "657b83" },
    { token: "punctuation", foreground: "93a1a1" },
    { token: "punctuation.separator", foreground: "93a1a1" },
    { token: "punctuation.terminator", foreground: "93a1a1" },
    { token: "punctuation.accessor", foreground: "93a1a1" },
    { token: "delimiter", foreground: "93a1a1" },
    { token: "delimiter.bracket", foreground: "93a1a1" },
    { token: "delimiter.square", foreground: "93a1a1" },
    { token: "delimiter.parenthesis", foreground: "93a1a1" },

    // TypeScript specific
    { token: "type", foreground: "b58900" },
    { token: "type.identifier", foreground: "b58900" },
    { token: "interface", foreground: "b58900" },

    // Decorators
    { token: "meta.decorator", foreground: "6c71c4" },

    // Imports / Modules
    { token: "keyword.control.import", foreground: "859900" },
    { token: "keyword.control.from", foreground: "859900" },
    { token: "keyword.control.export", foreground: "859900" },
    { token: "keyword.control.default", foreground: "cb4b16" },

    // Invalid
    { token: "invalid", foreground: "dc322f", fontStyle: "underline" },
    { token: "invalid.illegal", foreground: "dc322f", background: "fdf6e3" },
  ],
  colors: {
    // Editor background & foreground
    "editor.background": "#FDF6E3",
    "editor.foreground": "#657b83",

    // Line numbers
    "editorLineNumber.foreground": "#93a1a1",
    "editorLineNumber.activeForeground": "#657b83",

    // Cursor
    "editorCursor.foreground": "#657b83",

    // Selection
    "editor.selectionBackground": "#EEE8D5",
    "editor.selectionHighlightBackground": "#EEE8D550",
    "editor.inactiveSelectionBackground": "#EEE8D580",

    // Word highlight
    "editor.wordHighlightBackground": "#EEE8D5",
    "editor.wordHighlightStrongBackground": "#EEE8D5",

    // Find match
    "editor.findMatchBackground": "#b5890044",
    "editor.findMatchHighlightBackground": "#b5890022",

    // Gutter & border
    "editorGutter.background": "#FDF6E3",
    "editorBracketMatch.background": "#EEE8D5",
    "editorBracketMatch.border": "#93a1a1",

    // Line highlight
    "editor.lineHighlightBackground": "#EEE8D540",
    "editor.lineHighlightBorder": "#EEE8D5",

    // Scrollbar
    "scrollbar.shadow": "#0000001a",
    "scrollbarSlider.background": "#93a1a130",
    "scrollbarSlider.hoverBackground": "#93a1a150",
    "scrollbarSlider.activeBackground": "#93a1a170",

    // Indent guides
    "editorIndentGuide.background1": "#EEE8D5",
    "editorIndentGuide.activeBackground1": "#93a1a1",

    // Ruler
    "editorRuler.foreground": "#EEE8D5",

    // Widget (hover/suggest)
    "editorWidget.background": "#FDF6E3",
    "editorWidget.border": "#93a1a130",
    "editorHoverWidget.background": "#FDF6E3",
    "editorHoverWidget.border": "#93a1a130",

    // Suggest widget
    "editorSuggestWidget.background": "#FDF6E3",
    "editorSuggestWidget.border": "#93a1a130",
    "editorSuggestWidget.selectedBackground": "#EEE8D5",
    "editorSuggestWidget.highlightForeground": "#268bd2",

    // Peek view
    "peekView.border": "#268bd2",
    "peekViewEditor.background": "#FDF6E3",
    "peekViewResult.background": "#EEE8D5",

    // Minimap
    "minimap.background": "#FDF6E3",
    "minimapSlider.background": "#93a1a120",
    "minimapSlider.hoverBackground": "#93a1a140",
    "minimapSlider.activeBackground": "#93a1a160",

    // Error / Warning squiggles
    "editorError.foreground": "#dc322f",
    "editorWarning.foreground": "#b58900",
    "editorInfo.foreground": "#268bd2",

    // Whitespace dots
    "editorWhitespace.foreground": "#93a1a130",

    // Matching bracket
    "editorBracketHighlight.foreground1": "#268bd2",
    "editorBracketHighlight.foreground2": "#d33682",
    "editorBracketHighlight.foreground3": "#859900",
    "editorBracketHighlight.foreground4": "#b58900",
    "editorBracketHighlight.foreground5": "#2aa198",
    "editorBracketHighlight.foreground6": "#cb4b16",
  },
};

// ─── AST Explorer Dark Theme ──────────────────────────────────────────────────
// Mirip tampilan astexplorer.net — dark background, syntax colorful
export const AST_EXPLORER_DARK_THEME: Monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    // Default text
    { token: "", foreground: "d4d4d4", background: "1e1e2e" },

    // Comments — abu-abu muted
    { token: "comment", foreground: "6a737d", fontStyle: "italic" },
    { token: "comment.line", foreground: "6a737d", fontStyle: "italic" },
    { token: "comment.block", foreground: "6a737d", fontStyle: "italic" },

    // Keywords — biru muda seperti AST Explorer
    { token: "keyword", foreground: "569cd6", fontStyle: "bold" },
    { token: "keyword.control", foreground: "c586c0" },
    { token: "keyword.operator", foreground: "d4d4d4" },
    { token: "keyword.other", foreground: "569cd6" },

    // Storage (var, let, const, function, class)
    { token: "storage", foreground: "569cd6" },
    { token: "storage.type", foreground: "569cd6" },
    { token: "storage.modifier", foreground: "569cd6" },

    // Strings — oranye/kuning seperti AST Explorer
    { token: "string", foreground: "ce9178" },
    { token: "string.quoted", foreground: "ce9178" },
    { token: "string.template", foreground: "ce9178" },
    { token: "string.regexp", foreground: "d16969" },

    // Numbers — hijau muda
    { token: "number", foreground: "b5cea8" },
    { token: "number.float", foreground: "b5cea8" },
    { token: "number.hex", foreground: "b5cea8" },

    // Booleans / null
    { token: "constant.language", foreground: "569cd6", fontStyle: "bold" },
    { token: "constant.numeric", foreground: "b5cea8" },

    // Variables
    { token: "variable", foreground: "9cdcfe" },
    { token: "variable.language", foreground: "569cd6" },
    { token: "variable.other", foreground: "9cdcfe" },
    { token: "variable.parameter", foreground: "9cdcfe" },

    // Functions — kuning
    { token: "entity.name.function", foreground: "dcdcaa", fontStyle: "bold" },
    { token: "support.function", foreground: "dcdcaa" },

    // Types / Classes — hijau
    { token: "entity.name.type", foreground: "4ec9b0" },
    { token: "entity.name.class", foreground: "4ec9b0" },
    { token: "entity.other.inherited-class", foreground: "4ec9b0" },
    { token: "support.class", foreground: "4ec9b0" },
    { token: "support.type", foreground: "4ec9b0" },

    // Properties
    { token: "variable.object.property", foreground: "9cdcfe" },
    { token: "meta.object-literal.key", foreground: "9cdcfe" },

    // Operators & Punctuation
    { token: "keyword.operator.arithmetic", foreground: "d4d4d4" },
    { token: "keyword.operator.comparison", foreground: "d4d4d4" },
    { token: "keyword.operator.logical", foreground: "d4d4d4" },
    { token: "punctuation", foreground: "d4d4d4" },
    { token: "delimiter", foreground: "d4d4d4" },
    { token: "delimiter.bracket", foreground: "ffd700" },
    { token: "delimiter.parenthesis", foreground: "da70d6" },

    // TypeScript
    { token: "type", foreground: "4ec9b0" },
    { token: "type.identifier", foreground: "4ec9b0" },

    // Decorators
    { token: "meta.decorator", foreground: "c586c0" },

    // Imports
    { token: "keyword.control.import", foreground: "c586c0" },
    { token: "keyword.control.from", foreground: "c586c0" },
    { token: "keyword.control.export", foreground: "c586c0" },
  ],
  colors: {
    // Background — dark seperti AST Explorer
    "editor.background": "#1e1e2e",
    "editor.foreground": "#d4d4d4",

    // Line numbers
    "editorLineNumber.foreground": "#4a4a6a",
    "editorLineNumber.activeForeground": "#9cdcfe",

    // Cursor
    "editorCursor.foreground": "#aeafad",

    // Selection
    "editor.selectionBackground": "#264f78",
    "editor.selectionHighlightBackground": "#264f7840",
    "editor.inactiveSelectionBackground": "#264f7860",

    // Word highlight
    "editor.wordHighlightBackground": "#575757b8",
    "editor.wordHighlightStrongBackground": "#004972b8",

    // Find match
    "editor.findMatchBackground": "#515c6a",
    "editor.findMatchHighlightBackground": "#ea5c0044",

    // Gutter
    "editorGutter.background": "#1e1e2e",
    "editorBracketMatch.background": "#0064001a",
    "editorBracketMatch.border": "#888888",

    // Line highlight
    "editor.lineHighlightBackground": "#ffffff0d",
    "editor.lineHighlightBorder": "#ffffff0d",

    // Scrollbar
    "scrollbar.shadow": "#000000",
    "scrollbarSlider.background": "#79797966",
    "scrollbarSlider.hoverBackground": "#646464b3",
    "scrollbarSlider.activeBackground": "#bfbfbf66",

    // Indent guides
    "editorIndentGuide.background1": "#404040",
    "editorIndentGuide.activeBackground1": "#707070",

    // Widget
    "editorWidget.background": "#252526",
    "editorWidget.border": "#454545",
    "editorHoverWidget.background": "#252526",
    "editorHoverWidget.border": "#454545",

    // Suggest widget
    "editorSuggestWidget.background": "#252526",
    "editorSuggestWidget.border": "#454545",
    "editorSuggestWidget.selectedBackground": "#094771",
    "editorSuggestWidget.highlightForeground": "#0097fb",

    // Minimap
    "minimap.background": "#1e1e2e",

    // Error / Warning
    "editorError.foreground": "#f48771",
    "editorWarning.foreground": "#cca700",
    "editorInfo.foreground": "#75beff",

    // Bracket highlight
    "editorBracketHighlight.foreground1": "#ffd700",
    "editorBracketHighlight.foreground2": "#da70d6",
    "editorBracketHighlight.foreground3": "#179fff",
    "editorBracketHighlight.foreground4": "#ffd700",
    "editorBracketHighlight.foreground5": "#da70d6",
    "editorBracketHighlight.foreground6": "#179fff",
  },
};
