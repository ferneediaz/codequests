import { supabase } from './supabase';
import api from './api';
import type { User } from '@/types/api';

const BUCKET = 'avatars';

/** Max upload size; larger files are rejected client-side. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

export const ALLOWED_AVATAR_MIME = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
] as const;

export class AvatarUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AvatarUploadError';
    }
}

/**
 * Upload a user avatar to the Supabase Storage `avatars` bucket and
 * persist the resulting public URL on the backend via `PATCH /auth/avatar`.
 *
 * The bucket must exist and be public; see `server/readme.md` for the
 * one-time setup instructions.
 */
export async function uploadAvatar(userId: string, file: File): Promise<User> {
    if (!ALLOWED_AVATAR_MIME.includes(file.type as (typeof ALLOWED_AVATAR_MIME)[number])) {
        throw new AvatarUploadError('Only PNG, JPEG, WEBP, or GIF images are allowed');
    }
    if (file.size > MAX_AVATAR_BYTES) {
        throw new AvatarUploadError('Image must be 5MB or smaller');
    }

    // Path: `<userId>/<timestamp>.<ext>` - prefixing with the user id lets
    // RLS policies restrict writes/overwrites to the owner.
    const ext = file.name.includes('.')
        ? file.name.split('.').pop()!.toLowerCase()
        : file.type.split('/')[1] ?? 'png';
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
        });
    if (uploadError) {
        throw new AvatarUploadError(uploadError.message);
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = publicData.publicUrl;
    if (!avatarUrl) {
        throw new AvatarUploadError('Could not resolve uploaded file URL');
    }

    const { data } = await api.patch<User>('/auth/avatar', {
        avatarUrl,
        avatarSource: 'URL',
    });
    return data;
}
