import { cn } from '@/lib/utils';
import { useAuthorForm } from './new/useAuthorForm';
import { AuthorHeader } from './new/components/AuthorHeader';
import { DescriptionSection } from './new/components/DescriptionSection';
import { HintsSection } from './new/components/HintsSection';
import { MetaSection } from './new/components/MetaSection';
import { SignatureSection } from './new/components/SignatureSection';
import { SolutionSection } from './new/components/SolutionSection';
import { StarterSection } from './new/components/StarterSection';
import { TestsSection } from './new/components/TestsSection';
import { YamlPreview } from './new/components/YamlPreview';

/**
 * Dev-only blank-slate problem authoring page. Two-column workbench with a
 * pinned live YAML preview: left column is the structured form, center
 * column is the starter-code editor + ad-hoc tests, right column renders
 * the current YAML on every keystroke.
 */
export default function AuthorNew() {
    const form = useAuthorForm();

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <AuthorHeader
                state={form.state}
                isRunning={form.isRunning}
                copied={form.copied}
                yamlOpen={form.yamlOpen}
                errors={form.liveYaml.errors}
                availableLangs={form.availableLangs}
                effectiveActiveLang={form.effectiveActiveLang}
                onRun={form.handleRun}
                onCopy={form.handleCopy}
                onToggleYaml={() => form.setYamlOpen((v) => !v)}
            />

            <div
                className={cn(
                    'grid flex-1 overflow-hidden',
                    form.yamlOpen
                        ? 'grid-cols-[minmax(320px,24rem)_minmax(480px,1fr)_minmax(0,26rem)]'
                        : 'grid-cols-[minmax(320px,24rem)_minmax(480px,1fr)]',
                )}
            >
                <div className="overflow-y-auto border-r border-border bg-background p-4">
                    <MetaSection
                        state={form.state}
                        knownTags={form.knownTags}
                        manualId={form.manualId}
                        nextProblemNumber={form.nextProblemNumber}
                        setTitle={form.setTitle}
                        setIdManual={form.setIdManual}
                        patch={form.patch}
                        toggleTag={form.toggleTag}
                        addCustomTag={form.addCustomTag}
                    />
                    <DescriptionSection
                        description={form.state.description}
                        patch={form.patch}
                    />
                    <SignatureSection
                        state={form.state}
                        manualPyName={form.manualPyName}
                        patch={form.patch}
                        setFnName={form.setFnName}
                        toggleLang={form.toggleLang}
                        addParam={form.addParam}
                        removeParam={form.removeParam}
                        updateParam={form.updateParam}
                    />
                    <HintsSection
                        hints={form.state.hints}
                        updateHint={form.updateHint}
                        addHint={form.addHint}
                        removeHint={form.removeHint}
                    />
                    <SolutionSection
                        solution={form.state.solution}
                        patch={form.patch}
                    />
                </div>

                <div className="grid grid-rows-[1.8fr_1fr] overflow-hidden border-r border-border">
                    <StarterSection
                        state={form.state}
                        effectiveActiveLang={form.effectiveActiveLang}
                        availableLangs={form.availableLangs}
                        setActiveLang={form.setActiveLang}
                        toggleLang={form.toggleLang}
                        updateStarter={form.updateStarter}
                    />
                    <TestsSection
                        tests={form.state.tests}
                        result={form.result}
                        addTest={form.addTest}
                        removeTest={form.removeTest}
                        updateTest={form.updateTest}
                    />
                </div>

                {form.yamlOpen && (
                    <YamlPreview
                        yaml={form.liveYaml.yaml}
                        errors={form.liveYaml.errors}
                        copied={form.copied}
                        onCopy={form.handleCopy}
                    />
                )}
            </div>
        </div>
    );
}
