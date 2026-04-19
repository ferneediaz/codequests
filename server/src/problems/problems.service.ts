import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { Difficulty } from '@prisma/client';

@Injectable()
export class ProblemsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Create a new problem with test cases
     */
    async create(createProblemDto: CreateProblemDto) {
        const { testCases, starterCode, tags, ...problemData } = createProblemDto;

        return this.prisma.problem.create({
            data: {
                ...problemData,
                starterCode: starterCode ? JSON.stringify(starterCode) : '{}',
                tags: tags || [],
                testCases: {
                    create: testCases,
                },
            },
            include: {
                testCases: true,
            },
        });
    }

    /**
     * Find all problems with optional filtering
     */
    async findAll(difficulty?: Difficulty, page: number = 1, limit: number = 20, tags?: string[]) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (difficulty) where.difficulty = difficulty;
        if (tags && tags.length > 0) {
            where.tags = { hasSome: tags };
        }

        const [problems, total] = await Promise.all([
            this.prisma.problem.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    testCases: {
                        where: { isHidden: false }, // Only include visible test cases
                    },
                },
            }),
            this.prisma.problem.count({ where }),
        ]);

        return {
            data: problems,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find one problem by ID
     */
    async findOne(id: string, includeHidden: boolean = false) {
        const problem = await this.prisma.problem.findUnique({
            where: { id },
            include: {
                testCases: includeHidden ? true : { where: { isHidden: false } },
            },
        });

        if (!problem) {
            throw new NotFoundException(`Problem with ID ${id} not found`);
        }

        return problem;
    }

    /**
     * Get a random problem optionally filtered by difficulty and tags
     */
    async findRandom(difficulty?: Difficulty, tags?: string[]) {
        const where: any = {};
        if (difficulty) where.difficulty = difficulty;
        if (tags && tags.length > 0) {
            where.tags = { hasSome: tags };
        }

        const count = await this.prisma.problem.count({ where });

        if (count === 0) {
            throw new NotFoundException('No problems found');
        }

        // Get a random index
        const randomIndex = Math.floor(Math.random() * count);

        const problem = await this.prisma.problem.findFirst({
            where,
            skip: randomIndex,
            include: {
                testCases: {
                    where: { isHidden: false }, // Only visible test cases
                },
            },
        });

        return problem;
    }

    /**
     * Update a problem
     */
    async update(id: string, updateProblemDto: UpdateProblemDto) {
        // Verify problem exists
        await this.findOne(id);

        const { starterCode, ...updateData } = updateProblemDto;

        return this.prisma.problem.update({
            where: { id },
            data: {
                ...updateData,
                ...(starterCode && { starterCode: JSON.stringify(starterCode) }),
            },
            include: {
                testCases: true,
            },
        });
    }

    /**
     * Delete a problem (cascade deletes test cases)
     */
    async remove(id: string) {
        // Verify problem exists
        await this.findOne(id);

        await this.prisma.problem.delete({
            where: { id },
        });

        return { message: 'Problem deleted successfully' };
    }

    /**
     * Get all test cases for a problem (admin only)
     */
    async getTestCases(problemId: string) {
        const problem = await this.findOne(problemId, true);
        return problem.testCases;
    }
}
