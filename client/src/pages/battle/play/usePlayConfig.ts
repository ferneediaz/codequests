import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { listClans } from '@/services/clans';
import type {
    BattleMode,
    BattleRoyaleFormat,
    ClanWarsFormat,
    ClanWarsPreset,
    Difficulty,
    MatchConfig,
    RoundConfig,
    RoyalePreset,
    SkillType,
} from '@/types/api';
import { BR_MAX_PLAYERS, BR_MIN_PLAYERS, BR_MIN_ROUNDS, SKILLS } from './constants';
import {
    buildDefaultClanWarRounds,
    buildDefaultRounds,
    computeRoyaleProgression,
    validateClanWarsConfig,
    validateRoyaleConfig,
} from './utils';

/**
 * Owns the entire Play-page configuration state — modes, rules, skills,
 * Battle Royale + Clan Wars sub-configs, server presets, and derived
 * validations. Page components read from the returned shape and call setters
 * on it.
 */
export function usePlayConfig(userId: string | undefined) {
    // Generic config
    const [mode, setMode] = useState<BattleMode>('ONE_V_ONE');
    const [difficulty, setDifficulty] = useState<Difficulty | 'ANY'>('ANY');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
    const [topic, setTopic] = useState<string | null>(null);
    const [enabledSkills, setEnabledSkills] = useState<SkillType[]>([]);

    // Battle Royale
    const [royaleFormat, setRoyaleFormat] = useState<BattleRoyaleFormat>('SAME_PROBLEM');
    const [royaleMaxPlayers, setRoyaleMaxPlayers] = useState(8);
    const [royaleRounds, setRoyaleRounds] = useState<RoundConfig[]>(() =>
        buildDefaultRounds(8),
    );
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    // Clan Wars
    const [cwFormat, setCwFormat] = useState<ClanWarsFormat>('SAME_PROBLEM');
    const [cwTeamSize, setCwTeamSize] = useState(3);
    const [cwRounds, setCwRounds] = useState<{ timeLimitSeconds: number }[]>(() =>
        buildDefaultClanWarRounds(),
    );
    const [cwPresetId, setCwPresetId] = useState<string | null>(null);
    const [myClanId, setMyClanId] = useState<string | null>(null);

    // Server presets, lazily fetched by TanStack Query when the relevant
    // mode is selected. Using `useQuery` instead of useEffect+useState keeps
    // the synchronous part of effects free of setState calls.
    const presetsQuery = useQuery<RoyalePreset[]>({
        queryKey: ['battles', 'royale', 'presets'],
        queryFn: async () => {
            const { data } = await api.get<RoyalePreset[]>(
                '/battles/royale/presets',
            );
            return data;
        },
        enabled: mode === 'BATTLE_ROYALE',
        staleTime: Infinity,
    });
    const presets = useMemo(
        () => presetsQuery.data ?? [],
        [presetsQuery.data],
    );
    const presetsLoading = presetsQuery.isLoading;
    const presetsError = presetsQuery.isError
        ? 'Failed to load presets. You can still build a custom config.'
        : null;

    const cwPresetsQuery = useQuery<ClanWarsPreset[]>({
        queryKey: ['battles', 'clan-wars', 'presets'],
        queryFn: async () => {
            const { data } = await api.get<ClanWarsPreset[]>(
                '/battles/clan-wars/presets',
            );
            return data;
        },
        enabled: mode === 'GROUP',
        staleTime: Infinity,
    });
    const cwPresets = useMemo(
        () => cwPresetsQuery.data ?? [],
        [cwPresetsQuery.data],
    );
    const cwPresetsLoading = cwPresetsQuery.isLoading;
    const cwPresetsError = cwPresetsQuery.isError
        ? 'Failed to load clan war presets. You can still use custom settings.'
        : null;

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            try {
                const all = await listClans(200);
                if (cancelled) return;
                const mine = all.find((c) => c.members.some((m) => m.id === userId));
                setMyClanId(mine?.id ?? null);
            } catch {
                if (cancelled) return;
                setMyClanId(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    // Live BR validation
    const royaleErrors = useMemo(
        () =>
            mode === 'BATTLE_ROYALE'
                ? validateRoyaleConfig({
                      maxPlayers: royaleMaxPlayers,
                      rounds: royaleRounds,
                  })
                : [],
        [mode, royaleMaxPlayers, royaleRounds],
    );
    const royaleValid = royaleErrors.length === 0;
    const royaleProgression = useMemo(
        () => computeRoyaleProgression(royaleRounds, royaleMaxPlayers),
        [royaleRounds, royaleMaxPlayers],
    );
    const royaleTotalSeconds = useMemo(
        () => royaleRounds.reduce((acc, r) => acc + (r.timeLimitSeconds || 0), 0),
        [royaleRounds],
    );
    const royaleTotalElim = useMemo(
        () => royaleRounds.reduce((acc, r) => acc + (r.eliminateCount || 0), 0),
        [royaleRounds],
    );

    // Live CW validation
    const cwErrors = useMemo(
        () =>
            mode === 'GROUP'
                ? validateClanWarsConfig({
                      teamSize: cwTeamSize,
                      rounds: cwRounds,
                  })
                : [],
        [mode, cwTeamSize, cwRounds],
    );
    const cwValid = cwErrors.length === 0;
    const cwTotalSeconds = useMemo(
        () => cwRounds.reduce((acc, r) => acc + (r.timeLimitSeconds || 0), 0),
        [cwRounds],
    );

    // Detect when the user has diverged from the active preset.
    const selectedPreset = useMemo(
        () => presets.find((p) => p.id === selectedPresetId) ?? null,
        [presets, selectedPresetId],
    );
    const presetModified = useMemo(() => {
        if (!selectedPreset) return false;
        if (selectedPreset.battleRoyaleFormat !== royaleFormat) return true;
        if (selectedPreset.maxPlayers !== royaleMaxPlayers) return true;
        if (selectedPreset.rounds.length !== royaleRounds.length) return true;
        return selectedPreset.rounds.some(
            (r, i) =>
                r.eliminateCount !== royaleRounds[i]?.eliminateCount ||
                r.timeLimitSeconds !== royaleRounds[i]?.timeLimitSeconds,
        );
    }, [selectedPreset, royaleFormat, royaleMaxPlayers, royaleRounds]);

    // ---- BR mutations ----

    const applyPreset = (preset: RoyalePreset) => {
        setSelectedPresetId(preset.id);
        setRoyaleFormat(preset.battleRoyaleFormat);
        setRoyaleMaxPlayers(preset.maxPlayers);
        setRoyaleRounds(preset.rounds.map((r) => ({ ...r })));
    };

    const onChangeMaxPlayers = (next: number) => {
        const clamped = Math.max(
            BR_MIN_PLAYERS,
            Math.min(BR_MAX_PLAYERS, Math.round(next)),
        );
        setRoyaleMaxPlayers(clamped);
        setRoyaleRounds(buildDefaultRounds(clamped));
        setSelectedPresetId(null);
    };

    const updateRound = (index: number, patch: Partial<RoundConfig>) => {
        setRoyaleRounds((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        );
        setSelectedPresetId((id) => (id ? id : null));
    };

    const addRound = () => {
        // Insert a new round before the last (1v1) round so the finale rule stays intact.
        setRoyaleRounds((prev) => {
            if (prev.length === 0) {
                return [
                    { timeLimitSeconds: 300, eliminateCount: 0 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ];
            }
            const finale = prev[prev.length - 1];
            const head = prev.slice(0, -1);
            return [...head, { timeLimitSeconds: 300, eliminateCount: 0 }, finale];
        });
        setSelectedPresetId(null);
    };

    const removeRound = (index: number) => {
        if (royaleRounds.length <= BR_MIN_ROUNDS) return;
        if (index === royaleRounds.length - 1) return;
        setRoyaleRounds((prev) => prev.filter((_, i) => i !== index));
        setSelectedPresetId(null);
    };

    const onChangeRoyaleFormat = (next: BattleRoyaleFormat) => {
        setRoyaleFormat(next);
        setSelectedPresetId(null);
    };

    // ---- CW mutations ----

    const applyCwPreset = (preset: ClanWarsPreset) => {
        setCwPresetId(preset.id);
        setCwFormat(preset.clanWarsFormat);
        setCwTeamSize(preset.teamSize);
        setCwRounds(
            preset.rounds.map((r) => ({ timeLimitSeconds: r.timeLimitSeconds })),
        );
    };

    const updateCwRound = (
        index: number,
        patch: { timeLimitSeconds?: number },
    ) => {
        setCwRounds((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        );
        setCwPresetId(null);
    };

    const addCwRound = () => {
        setCwRounds((prev) => [...prev, { timeLimitSeconds: 300 }]);
        setCwPresetId(null);
    };

    const removeCwRound = (index: number) => {
        setCwRounds((prev) =>
            prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
        );
        setCwPresetId(null);
    };

    const onChangeCwFormat = (next: ClanWarsFormat) => {
        setCwFormat(next);
        setCwPresetId(null);
    };

    const onChangeCwTeamSize = (next: number) => {
        setCwTeamSize(next);
        setCwPresetId(null);
    };

    // ---- Skills ----

    const toggleSkill = (skill: SkillType) => {
        setEnabledSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
        );
    };

    const toggleAllSkills = () => {
        if (enabledSkills.length === SKILLS.length) setEnabledSkills([]);
        else setEnabledSkills(SKILLS.map((s) => s.type));
    };

    const getMatchConfig = (): MatchConfig => ({
        mode,
        preferredDifficulty: difficulty === 'ANY' ? undefined : difficulty,
        preferredTopic: topic ?? undefined,
        timeLimitMinutes,
        enabledSkills,
    });

    return {
        // raw state
        mode,
        setMode,
        difficulty,
        setDifficulty,
        timeLimitMinutes,
        setTimeLimitMinutes,
        topic,
        setTopic,
        enabledSkills,
        toggleSkill,
        toggleAllSkills,

        // BR
        royaleFormat,
        royaleMaxPlayers,
        royaleRounds,
        royaleErrors,
        royaleValid,
        royaleProgression,
        royaleTotalSeconds,
        royaleTotalElim,
        selectedPresetId,
        selectedPreset,
        presetModified,
        presets,
        presetsLoading,
        presetsError,
        applyPreset,
        onChangeMaxPlayers,
        updateRound,
        addRound,
        removeRound,
        onChangeRoyaleFormat,

        // CW
        cwFormat,
        cwTeamSize,
        cwRounds,
        cwErrors,
        cwValid,
        cwTotalSeconds,
        cwPresets,
        cwPresetId,
        cwPresetsLoading,
        cwPresetsError,
        myClanId,
        applyCwPreset,
        updateCwRound,
        addCwRound,
        removeCwRound,
        onChangeCwFormat,
        onChangeCwTeamSize,

        // helpers
        getMatchConfig,
    };
}

export type PlayConfig = ReturnType<typeof usePlayConfig>;
