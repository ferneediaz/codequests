export interface ClanMember {
    id: string;
    username: string;
    avatarUrl?: string;
    mmr: number;
}

export interface Clan {
    id: string;
    name: string;
    tag: string;
    ownerId: string;
    mmr: number;
    members: ClanMember[];
    createdAt: string;
}

export interface CreateClanPayload {
    name: string;
    tag: string;
}
