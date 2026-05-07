import type { MatchConfig, QuickPlayPreset } from '@/types/api';

const PRESETS_KEY = 'cqb:quickplay:presets:v1';
const ACTIVE_KEY = 'cqb:quickplay:active:v1';

export const BUILTIN_PRESET_ID = 'builtin:quick-1v1';

const BUILTIN_PRESET: QuickPlayPreset = {
    id: BUILTIN_PRESET_ID,
    name: 'Quick 1v1',
    builtin: true,
    config: {
        mode: 'ONE_V_ONE',
        timeLimitMinutes: 5,
        enabledSkills: [],
    },
    createdAt: '1970-01-01T00:00:00.000Z',
};

function safeReadString(key: string): string | null {
    try {
        return typeof window !== 'undefined'
            ? window.localStorage.getItem(key)
            : null;
    } catch {
        return null;
    }
}

function safeWriteString(key: string, value: string): void {
    try {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
        }
    } catch {
        // private mode / quota — silently no-op
    }
}

function readUserPresets(): QuickPlayPreset[] {
    const raw = safeReadString(PRESETS_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (p): p is QuickPlayPreset =>
                typeof p === 'object' &&
                p !== null &&
                typeof (p as QuickPlayPreset).id === 'string' &&
                typeof (p as QuickPlayPreset).name === 'string' &&
                typeof (p as QuickPlayPreset).config === 'object' &&
                (p as QuickPlayPreset).id !== BUILTIN_PRESET_ID,
        );
    } catch {
        return [];
    }
}

function writeUserPresets(presets: QuickPlayPreset[]): void {
    safeWriteString(PRESETS_KEY, JSON.stringify(presets));
}

export function listPresets(): QuickPlayPreset[] {
    return [BUILTIN_PRESET, ...readUserPresets()];
}

export function getActivePresetId(): string {
    const stored = safeReadString(ACTIVE_KEY);
    if (!stored) return BUILTIN_PRESET_ID;
    const presets = listPresets();
    return presets.some((p) => p.id === stored) ? stored : BUILTIN_PRESET_ID;
}

export function setActivePresetId(id: string): void {
    safeWriteString(ACTIVE_KEY, id);
}

function uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function savePreset(input: {
    name: string;
    config: MatchConfig;
}): QuickPlayPreset {
    const preset: QuickPlayPreset = {
        id: uuid(),
        name: input.name.trim() || 'Untitled preset',
        config: input.config,
        createdAt: new Date().toISOString(),
    };
    const next = [...readUserPresets(), preset];
    writeUserPresets(next);
    setActivePresetId(preset.id);
    return preset;
}

export function renamePreset(id: string, name: string): void {
    if (id === BUILTIN_PRESET_ID) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = readUserPresets().map((p) =>
        p.id === id ? { ...p, name: trimmed } : p,
    );
    writeUserPresets(next);
}

export function deletePreset(id: string): void {
    if (id === BUILTIN_PRESET_ID) return;
    const next = readUserPresets().filter((p) => p.id !== id);
    writeUserPresets(next);
    if (getActivePresetId() === id) {
        setActivePresetId(BUILTIN_PRESET_ID);
    }
}

export const PRESETS_STORAGE_KEYS = {
    presets: PRESETS_KEY,
    active: ACTIVE_KEY,
};
