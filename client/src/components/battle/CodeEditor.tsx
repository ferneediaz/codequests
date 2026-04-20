import { useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';

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

export function CodeEditor({
    language,
    onLanguageChange,
    code,
    onCodeChange,
    starterCode,
    readOnly = false,
}: CodeEditorProps) {
    const starterCodeMap = useMemo(() => {
        try {
            return JSON.parse(starterCode) as Record<string, string>;
        } catch {
            return {};
        }
    }, [starterCode]);

    const handleLanguageChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newLang = e.target.value;
            onLanguageChange(newLang);
            // Load starter code for the new language
            const starter = starterCodeMap[newLang] ?? '';
            onCodeChange(starter);
        },
        [onLanguageChange, onCodeChange, starterCodeMap],
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
}
