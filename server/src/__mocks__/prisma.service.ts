import { PrismaClient } from '@prisma/client';

export const createMockPrismaService = () => {
    return {
        user: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
            upsert: jest.fn(),
            count: jest.fn(),
        },
        problem: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        testCase: {
            create: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        battle: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        battleParticipant: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        problemPool: {
            create: jest.fn(),
            findUnique: jest.fn(),
        },
        clan: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        matchmakingEntry: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            count: jest.fn(),
        },
        subscription: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        battleSkillUse: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        $transaction: jest.fn(),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
    };
};

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;
