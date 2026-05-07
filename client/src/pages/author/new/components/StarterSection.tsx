import Editor from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import { LANGUAGES, MONACO_LANG } from '../constants';
import type { AuthoringLanguage, BuilderState } from '../types';
import type { AuthorFormMode } from '../useAuthorForm';

interface StarterSectionProps {
    mode?: AuthorFormMode;
    state: BuilderState;
    effectiveActiveLang: AuthoringLanguage;
    availableLangs: AuthoringLanguage[];
    setActiveLang: (lang: AuthoringLanguage) => void;
    toggleLang: (lang: AuthoringLanguage, enabled: boolean) => void;
    updateStarter: (lang: AuthoringLanguage, value: string) => void;
}

const COPY_BY_MODE: Record<AuthorFormMode, { title: string; hint: string }> = {
    'yaml-copy': {
        title: 'Starter code',
        hint: 'The function body players see when they start the problem.',
    },
    submit: {
        title: 'Reference solution',
        hint: "Write a working solution. We'll run it against every test before submitting; users will get a fresh stub when the problem is published.",
    },
    edit: {
        title: 'Reference solution',
        hint: "Write a working solution. We'll run it against every test on resubmit; users will get a fresh stub when the problem is published.",
    },
};

export function StarterSection({
    mode = 'yaml-copy',
    state,
    effectiveActiveLang,
    availableLangs,
    setActiveLang,
    toggleLang,
    updateStarter,
}: StarterSectionProps) {
    const copy = COPY_BY_MODE[mode];
    return (
        <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
                <div>
                    <div className="text-sm font-semibold">{copy.title}</div>
                    <div className="text-[11px] text-muted-foreground">{copy.hint}</div>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                    {LANGUAGES.map((lang) => {
                        const isActive = effectiveActiveLang === lang;
                        const isEnabled = state.enabled[lang];
                        return (
                            <button
                                key={lang}
                                onClick={() => {
                                    if (!isEnabled) toggleLang(lang, true);
                                    setActiveLang(lang);
                                }}
                                className={cn(
                                    'rounded px-2 py-1 text-[11px] transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : isEnabled
                                          ? 'text-foreground hover:bg-muted'
                                          : 'text-muted-foreground line-through opacity-60 hover:opacity-100',
                                )}
                                title={isEnabled ? lang : `enable ${lang}`}
                            >
                                {lang}
                            </button>
                        );
                    })}
                </div>
            </div>
            {availableLangs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
                    Click a language pill above to enable it.
                </div>
            ) : (
                <div className="flex-1">
                    <Editor
                        height="100%"
                        language={MONACO_LANG[effectiveActiveLang]}
                        value={state.starter[effectiveActiveLang]}
                        onChange={(v) => updateStarter(effectiveActiveLang, v ?? '')}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            tabSize: effectiveActiveLang === 'python' ? 4 : 2,
                        }}
                    />
                </div>
            )}
        </div>
    );
}
