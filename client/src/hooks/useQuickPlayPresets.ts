import { useCallback, useSyncExternalStore } from 'react';
import {
    BUILTIN_PRESET_ID,
    PRESETS_STORAGE_KEYS,
    deletePreset,
    getActivePresetId,
    listPresets,
    renamePreset,
    savePreset,
    setActivePresetId,
} from '@/services/presets';
import type { MatchConfig, QuickPlayPreset } from '@/types/api';

type Snapshot = {
    presets: QuickPlayPreset[];
    activeId: string;
};

const subscribers = new Set<() => void>();

function notifyAll() {
    subscribers.forEach((cb) => cb());
}

let cachedSnapshot: Snapshot | null = null;

function readSnapshot(): Snapshot {
    return { presets: listPresets(), activeId: getActivePresetId() };
}

function getSnapshot(): Snapshot {
    if (cachedSnapshot) return cachedSnapshot;
    cachedSnapshot = readSnapshot();
    return cachedSnapshot;
}

function refreshSnapshot() {
    cachedSnapshot = readSnapshot();
    notifyAll();
}

function onStorage(event: StorageEvent) {
    if (
        event.key === PRESETS_STORAGE_KEYS.presets ||
        event.key === PRESETS_STORAGE_KEYS.active ||
        event.key === null // localStorage.clear()
    ) {
        refreshSnapshot();
    }
}

function subscribe(callback: () => void): () => void {
    if (subscribers.size === 0 && typeof window !== 'undefined') {
        window.addEventListener('storage', onStorage);
    }
    subscribers.add(callback);
    return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && typeof window !== 'undefined') {
            window.removeEventListener('storage', onStorage);
        }
    };
}

function getServerSnapshot(): Snapshot {
    return { presets: [], activeId: BUILTIN_PRESET_ID };
}

export function useQuickPlayPresets() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setActiveId = useCallback((id: string) => {
        setActivePresetId(id);
        refreshSnapshot();
    }, []);

    const save = useCallback(
        (input: { name: string; config: MatchConfig }): QuickPlayPreset => {
            const preset = savePreset(input);
            refreshSnapshot();
            return preset;
        },
        [],
    );

    const rename = useCallback((id: string, name: string) => {
        renamePreset(id, name);
        refreshSnapshot();
    }, []);

    const remove = useCallback((id: string) => {
        deletePreset(id);
        refreshSnapshot();
    }, []);

    const activePreset =
        snapshot.presets.find((p) => p.id === snapshot.activeId) ??
        snapshot.presets[0];

    return {
        presets: snapshot.presets,
        activeId: snapshot.activeId,
        activePreset,
        setActiveId,
        save,
        rename,
        remove,
    };
}
