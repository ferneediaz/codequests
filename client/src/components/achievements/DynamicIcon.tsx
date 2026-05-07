import { createElement } from 'react';
import { getAchievementIcon } from './iconMap';

/**
 * Look up a lucide icon by string name at render time. Uses
 * `createElement` rather than `<Icon … />` so the lookup doesn't bind a
 * PascalCase local — the `react-hooks/static-components` lint rule treats
 * any locally-assigned component as "freshly created" and false-positives
 * on stable lookups like this one.
 */
export function DynamicIcon({
    name,
    className,
}: {
    name: string;
    className?: string;
}) {
    return createElement(getAchievementIcon(name), { className });
}
