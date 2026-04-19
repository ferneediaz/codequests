import { Test, TestingModule } from '@nestjs/testing';
import { ProblemsService } from './problems.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../__mocks__/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Difficulty } from '@prisma/client';

describe('ProblemsService', () => {
  let service: ProblemsService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    const mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ProblemsService>(ProblemsService);
    prisma = module.get<MockPrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a problem with test cases', async () => {
      const createDto = {
        title: 'Two Sum',
        description: 'Find two numbers that add up to target',
        difficulty: Difficulty.EASY,
        starterCode: { javascript: 'function twoSum() {}' },
        testCases: [
          { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false },
        ],
      };

      const createdProblem = {
        id: 'problem-1',
        ...createDto,
        starterCode: JSON.stringify(createDto.starterCode),
        testCases: [
          { id: 'test-1', ...createDto.testCases[0], problemId: 'problem-1' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.problem.create.mockResolvedValue(createdProblem);

      const result = await service.create(createDto);

      expect(prisma.problem.create).toHaveBeenCalledWith({
        data: {
          title: createDto.title,
          description: createDto.description,
          difficulty: createDto.difficulty,
          starterCode: JSON.stringify(createDto.starterCode),
          tags: [],
          testCases: {
            create: createDto.testCases,
          },
        },
        include: {
          testCases: true,
        },
      });
      expect(result).toEqual(createdProblem);
    });
  });

  describe('findAll', () => {
    it('should return paginated problems with only visible test cases', async () => {
      const problems = [
        {
          id: 'problem-1',
          title: 'Two Sum',
          difficulty: Difficulty.EASY,
          testCases: [{ id: 'test-1', isHidden: false }],
        },
      ];

      prisma.problem.findMany.mockResolvedValue(problems);
      prisma.problem.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(prisma.problem.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          testCases: {
            where: { isHidden: false },
          },
        },
      });
      expect(result.data).toEqual(problems);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter by difficulty', async () => {
      prisma.problem.findMany.mockResolvedValue([]);
      prisma.problem.count.mockResolvedValue(0);

      await service.findAll(Difficulty.HARD);

      expect(prisma.problem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { difficulty: Difficulty.HARD },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return problem with visible test cases by default', async () => {
      const problem = {
        id: 'problem-1',
        title: 'Two Sum',
        testCases: [{ id: 'test-1', isHidden: false }],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      const result = await service.findOne('problem-1');

      expect(prisma.problem.findUnique).toHaveBeenCalledWith({
        where: { id: 'problem-1' },
        include: {
          testCases: { where: { isHidden: false } },
        },
      });
      expect(result).toEqual(problem);
    });

    it('should return all test cases when includeHidden is true', async () => {
      const problem = {
        id: 'problem-1',
        title: 'Two Sum',
        testCases: [
          { id: 'test-1', isHidden: false },
          { id: 'test-2', isHidden: true },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      const result = await service.findOne('problem-1', true);

      expect(prisma.problem.findUnique).toHaveBeenCalledWith({
        where: { id: 'problem-1' },
        include: {
          testCases: true,
        },
      });
      expect(result.testCases).toHaveLength(2);
    });

    it('should throw NotFoundException when problem not found', async () => {
      prisma.problem.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findRandom', () => {
    it('should return a random problem', async () => {
      const problem = {
        id: 'problem-1',
        title: 'Two Sum',
        testCases: [],
      };

      prisma.problem.count.mockResolvedValue(5);
      prisma.problem.findFirst.mockResolvedValue(problem);

      const result = await service.findRandom();

      expect(prisma.problem.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.problem.findFirst).toHaveBeenCalledWith({
        where: {},
        skip: expect.any(Number),
        include: {
          testCases: {
            where: { isHidden: false },
          },
        },
      });
      expect(result).toEqual(problem);
    });

    it('should filter by difficulty', async () => {
      prisma.problem.count.mockResolvedValue(3);
      prisma.problem.findFirst.mockResolvedValue({
        id: 'problem-1',
        title: 'Hard Problem',
        difficulty: Difficulty.HARD,
        testCases: [],
      });

      await service.findRandom(Difficulty.HARD);

      expect(prisma.problem.count).toHaveBeenCalledWith({
        where: { difficulty: Difficulty.HARD },
      });
    });

    it('should throw NotFoundException when no problems found', async () => {
      prisma.problem.count.mockResolvedValue(0);

      await expect(service.findRandom()).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update problem successfully', async () => {
      const existingProblem = {
        id: 'problem-1',
        title: 'Old Title',
        testCases: [],
      };

      const updatedProblem = {
        ...existingProblem,
        title: 'New Title',
      };

      prisma.problem.findUnique.mockResolvedValue(existingProblem);
      prisma.problem.update.mockResolvedValue(updatedProblem);

      const result = await service.update('problem-1', { title: 'New Title' });

      expect(prisma.problem.update).toHaveBeenCalledWith({
        where: { id: 'problem-1' },
        data: {
          title: 'New Title',
        },
        include: {
          testCases: true,
        },
      });
      expect(result.title).toBe('New Title');
    });

    it('should throw NotFoundException when problem not found', async () => {
      prisma.problem.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete problem successfully', async () => {
      const problem = { id: 'problem-1', title: 'Test' };

      prisma.problem.findUnique.mockResolvedValue(problem);
      prisma.problem.delete.mockResolvedValue(problem);

      const result = await service.remove('problem-1');

      expect(prisma.problem.delete).toHaveBeenCalledWith({
        where: { id: 'problem-1' },
      });
      expect(result.message).toBe('Problem deleted successfully');
    });

    it('should throw NotFoundException when problem not found', async () => {
      prisma.problem.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTestCases', () => {
    it('should return all test cases including hidden ones', async () => {
      const problem = {
        id: 'problem-1',
        title: 'Two Sum',
        testCases: [
          { id: 'test-1', isHidden: false },
          { id: 'test-2', isHidden: true },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      const result = await service.getTestCases('problem-1');

      expect(result).toHaveLength(2);
      expect(prisma.problem.findUnique).toHaveBeenCalledWith({
        where: { id: 'problem-1' },
        include: { testCases: true },
      });
    });

    it('should throw NotFoundException when problem not found', async () => {
      prisma.problem.findUnique.mockResolvedValue(null);

      await expect(service.getTestCases('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
