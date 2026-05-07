import { useParams } from 'react-router-dom';
import AuthorNew from '@/pages/author/AuthorNew';

/**
 * Remount AuthorNew when the submission id in the URL changes so prefill
 * state always reflects the row being edited. Without this, switching from
 * `/contribute/A/edit` to `/contribute/B/edit` would reuse A's BuilderState.
 */
export default function EditSubmission() {
    const { id } = useParams<{ id: string }>();
    return <AuthorNew key={id ?? 'new'} mode="edit" />;
}
