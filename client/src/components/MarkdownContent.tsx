import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

const components: Partial<Components> = {
    h1: ({ children }) => (
        <h1 className="mb-3 mt-4 text-lg font-bold text-foreground first:mt-0">
            {children}
        </h1>
    ),
    h2: ({ children }) => (
        <h2 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">
            {children}
        </h2>
    ),
    h3: ({ children }) => (
        <h3 className="mb-2 mt-3 text-sm font-semibold text-foreground first:mt-0">
            {children}
        </h3>
    ),
    p: ({ children }) => (
        <p className="mb-3 text-[0.9375rem] leading-relaxed text-foreground/90 last:mb-0">
            {children}
        </p>
    ),
    ul: ({ children }) => (
        <ul className="my-2 list-disc space-y-1 pl-5 text-[0.9375rem] text-foreground/90">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="my-2 list-decimal space-y-1 pl-5 text-[0.9375rem] text-foreground/90">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => (
        <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => (
        <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-4 border-border" />,
    a: ({ href, children }) => (
        <a
            href={href}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    ),
    pre: ({ children }) => (
        <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/70 p-3 first:mt-0 last:mb-0">
            {children}
        </pre>
    ),
    code({ className, children, ...rest }) {
        const isBlock = /language-[\w-]+/.test(className ?? '');
        if (isBlock) {
            return (
                <code
                    className={cn(
                        'block w-full min-w-0 whitespace-pre font-mono text-xs leading-relaxed text-foreground',
                        className,
                    )}
                    {...rest}
                >
                    {children}
                </code>
            );
        }
        return (
            <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground"
                {...rest}
            >
                {children}
            </code>
        );
    },
    table: ({ children }) => (
        <div className="my-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[12rem] border-collapse text-left text-xs">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="border-b border-border bg-muted/40">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
    th: ({ children }) => (
        <th className="px-3 py-2 font-semibold text-foreground">{children}</th>
    ),
    td: ({ children }) => (
        <td className="px-3 py-2 text-foreground/90">{children}</td>
    ),
};

interface MarkdownContentProps {
    markdown: string;
    className?: string;
    /** Tighter typography for inline cards (hints). */
    compact?: boolean;
}

export function MarkdownContent({ markdown, className, compact }: MarkdownContentProps) {
    if (!markdown.trim()) return null;

    return (
        <div
            className={cn(
                compact
                    ? 'text-xs leading-relaxed [&_p]:text-xs [&_li]:text-xs [&_code]:text-[11px]'
                    : 'text-sm',
                'text-foreground/90',
                className,
            )}
        >
            <Markdown remarkPlugins={[remarkGfm]} components={components}>
                {markdown}
            </Markdown>
        </div>
    );
}
