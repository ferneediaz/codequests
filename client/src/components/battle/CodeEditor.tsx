import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { parseStarterCode } from '@/lib/starterCode';

const LANGUAGE_MAP: Record<string, string> = {
    javascript: 'javascript',
    python: 'python',
    typescript: 'typescript',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    rust: 'rust',
};

const LANGUAGES = Object.keys(LANGUAGE_MAP);

interface CodeEditorProps {
    language: string;
    onLanguageChange: (language: string) => void;
    code: string;
    onCodeChange: (code: string) => void;
    starterCode: string; // JSON string keyed by language
    readOnly?: boolean;
}

export interface CodeEditorHandle {
    scrambleCode: () => void;
}

/**
 * Shuffle non-whitespace tokens within each line while preserving indentation
 * and line structure. Produces a clearly "scrambled" but still code-shaped buffer.
 */
function scrambleSource(src: string): string {
    return src
        .split('\n')
        .map((line) => {
            const leading = line.match(/^\s*/)?.[0] ?? '';
            const rest = line.slice(leading.length);
            if (!rest.trim()) return line;
            const tokens = rest.split(/(\s+)/);
            const words = tokens.filter((t) => t.trim().length > 0);
            for (let i = words.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [words[i], words[j]] = [words[j], words[i]];
            }
            let wi = 0;
            const out = tokens.map((t) => (t.trim().length > 0 ? words[wi++] : t));
            return leading + out.join('');
        })
        .join('\n');
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
    function CodeEditor(
        { language, onLanguageChange, code, onCodeChange, starterCode, readOnly = false },
        ref,
    ) {
        const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

        // Parse into per-language `{prefix, body, suffix}` entries. Only
        // `body` is shown in the editor; the harness lives server-side.
        const starterCodeMap = useMemo(
            () => parseStarterCode(starterCode),
            [starterCode],
        );

        const handleLanguageChange = useCallback(
            (e: React.ChangeEvent<HTMLSelectElement>) => {
                const newLang = e.target.value;
                onLanguageChange(newLang);
                const starter = starterCodeMap[newLang]?.body ?? '';
                onCodeChange(starter);
            },
            [onLanguageChange, onCodeChange, starterCodeMap],
        );

        const handleMount: OnMount = (ed, monaco) => {
            editorRef.current = ed;

            // Disable undo/redo in battle editor so Scramble cannot be reverted.
            const { KeyMod, KeyCode } = monaco;
            const noop = () => {
                /* undo/redo disabled in battle */
            };
            ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, noop);
            ed.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, noop);
            ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyY, noop);
        };

        useImperativeHandle(
            ref,
            () => ({
                scrambleCode: () => {
                    const ed = editorRef.current;
                    if (!ed) return;
                    const model = ed.getModel();
                    if (!model) return;
                    const current = model.getValue();
                    const scrambled = scrambleSource(current);
                    // setValue resets Monaco's undo stack so even a programmatic undo
                    // cannot recover the pre-scramble text.
                    model.setValue(scrambled);
                    onCodeChange(scrambled);
                },
            }),
            [onCodeChange],
        );

        const monacoLanguage = LANGUAGE_MAP[language] ?? 'plaintext';

        return (
            <div className="flex h-full flex-col">
                {!readOnly && (
                    <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
                        <label className="text-xs text-muted-foreground">Language:</label>
                        <select
                            value={language}
                            onChange={handleLanguageChange}
                            className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang} value={lang}>
                                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex-1">
                    <Editor
                        height="100%"
                        language={monacoLanguage}
                        value={code}
                        onChange={(value) => onCodeChange(value ?? '')}
                        onMount={handleMount}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            readOnly,
                            wordWrap: 'on',
                        }}
                    />
                </div>
            </div>
        );
    },
);
