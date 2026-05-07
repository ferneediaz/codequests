import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { QuickPlayPreset } from '@/types/api';
import { describeDifficulty, describeMode, describeTime } from '../utils';

interface PresetListProps {
    presets: QuickPlayPreset[];
    activeId: string;
    onActivate: (id: string) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
}

export function PresetList({
    presets,
    activeId,
    onActivate,
    onRename,
    onDelete,
}: PresetListProps) {
    return (
        <Card>
            <CardContent className="space-y-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your presets
                </p>
                <ul className="divide-y divide-border/60">
                    {presets.map((preset) => (
                        <PresetRow
                            key={preset.id}
                            preset={preset}
                            isActive={preset.id === activeId}
                            onActivate={() => onActivate(preset.id)}
                            onRename={(name) => onRename(preset.id, name)}
                            onDelete={() => onDelete(preset.id)}
                        />
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function PresetRow({
    preset,
    isActive,
    onActivate,
    onRename,
    onDelete,
}: {
    preset: QuickPlayPreset;
    isActive: boolean;
    onActivate: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(preset.name);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const subtitle = `${describeMode(preset.config)} · ${describeDifficulty(preset.config)} · ${describeTime(preset.config)}`;

    if (editing) {
        return (
            <li className="flex items-center gap-2 py-2.5">
                <input
                    autoFocus
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onRename(draftName);
                            setEditing(false);
                        } else if (e.key === 'Escape') {
                            setDraftName(preset.name);
                            setEditing(false);
                        }
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={48}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Save name"
                    onClick={() => {
                        onRename(draftName);
                        setEditing(false);
                    }}
                >
                    <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Cancel rename"
                    onClick={() => {
                        setDraftName(preset.name);
                        setEditing(false);
                    }}
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </Button>
            </li>
        );
    }

    return (
        <li
            className={`group flex items-center gap-3 py-2.5 ${
                isActive ? '' : 'cursor-pointer'
            }`}
        >
            <button
                type="button"
                onClick={onActivate}
                disabled={isActive}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
                <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${
                        isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                            {preset.name}
                        </span>
                        {preset.builtin && (
                            <Badge
                                variant="outline"
                                className="h-4 border-border/60 px-1 text-[9px] uppercase"
                            >
                                Default
                            </Badge>
                        )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {subtitle}
                    </span>
                </span>
            </button>
            {!preset.builtin && (
                <div className="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Rename preset"
                        onClick={() => {
                            setDraftName(preset.name);
                            setEditing(true);
                        }}
                    >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    {confirmDelete ? (
                        <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                                onDelete();
                                setConfirmDelete(false);
                            }}
                            onBlur={() => setConfirmDelete(false)}
                        >
                            Confirm
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete preset"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                    )}
                </div>
            )}
        </li>
    );
}
