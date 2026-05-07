import type { MatchConfig } from './battle';

/**
 * A user's saved Quick Play preset, persisted to localStorage. The shape
 * deliberately wraps a `MatchConfig` (the same shape `/matchmaking` consumes
 * via route state) so loading a preset is a one-click navigate.
 */
export interface QuickPlayPreset {
    id: string;
    name: string;
    /** True for the immutable built-in default; rename/delete are no-ops. */
    builtin?: boolean;
    config: MatchConfig;
    createdAt: string;
}
