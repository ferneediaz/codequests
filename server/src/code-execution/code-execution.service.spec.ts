import { Test, TestingModule } from '@nestjs/testing';
import { CodeExecutionService } from './code-execution.service';
import { PrismaService } from '../prisma/prisma.service';
import { PistonClient } from './piston.client';
import { createMockPrismaService, MockPrismaService } from '../__mocks__/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('CodeExecutionService', () => {
  let service: CodeExecutionService;
  let prisma: MockPrismaService;
  let pistonClient: jest.Mocked<PistonClient>;

  beforeEach(async () => {
    const mockPrisma = createMockPrismaService();

    // Mock PistonClient
    const mockPiston = {
      executeCode: jest.fn(),
      getRuntimes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeExecutionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PistonClient,
          useValue: mockPiston,
        },
      ],
    }).compile();

    service = module.get<CodeExecutionService>(CodeExecutionService);
    prisma = module.get<MockPrismaService>(PrismaService);
    pistonClient = module.get(PistonClient);
  });

  describe('executeCode', () => {
    it('should execute code against all test cases and return results', async () => {
      const problem = {
        id: 'problem-1',
        title: 'Two Sum',
        testCases: [
          {
            id: 'test-1',
            input: '[2,7]\n9',
            expectedOutput: '[0,1]',
            isHidden: false,
          },
          {
            id: 'test-2',
            input: '[3,3]\n6',
            expectedOutput: '[0,1]',
            isHidden: false,
          },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      pistonClient.executeCode
        .mockResolvedValueOnce({
          stdout: '[0,1]',
          stderr: null,
          compile_output: null,
          message: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.01',
          memory: 1024,
        })
        .mockResolvedValueOnce({
          stdout: '[0,1]',
          stderr: null,
          compile_output: null,
          message: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.01',
          memory: 1024,
        });

      const result = await service.executeCode(
        'problem-1',
        'function twoSum() { return [0,1]; }',
        'javascript',
      );

      expect(result.passed).toBe(2);
      expect(result.total).toBe(2);
      expect(result.allPassed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].passed).toBe(true);
    });

    it('should handle compilation errors', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [
          {
            id: 'test-1',
            input: '[2,7]\n9',
            expectedOutput: '[0,1]',
            isHidden: false,
          },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      pistonClient.executeCode.mockResolvedValue({
        stdout: null,
        stderr: null,
        compile_output: 'SyntaxError: Unexpected token',
        message: null,
        status: { id: 6, description: 'Compilation Error' },
        time: null,
        memory: null,
      });

      const result = await service.executeCode(
        'problem-1',
        'function twoSum() { invalid syntax }',
        'javascript',
      );

      expect(result.passed).toBe(0);
      expect(result.total).toBe(1);
      expect(result.allPassed).toBe(false);
      expect(result.results[0].error).toContain('SyntaxError');
    });

    it('should hide details of hidden test cases on failure', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [
          {
            id: 'test-1',
            input: '[2,7]\n9',
            expectedOutput: '[0,1]',
            isHidden: true,
          },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      pistonClient.executeCode.mockResolvedValue({
        stdout: '[1,0]',
        stderr: null,
        compile_output: null,
        message: null,
        status: { id: 3, description: 'Accepted' },
        time: '0.01',
        memory: 1024,
      });

      const result = await service.executeCode('problem-1', 'code', 'javascript');

      expect(result.results[0].input).toBe('[Hidden]');
      expect(result.results[0].expectedOutput).toBe('[Hidden]');
      expect(result.results[0].actualOutput).toBe('[Hidden]');
      expect(result.results[0].passed).toBe(false);
      expect(result.allPassed).toBe(false);
    });

    it('should handle mixed pass/fail results', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [
          { id: 'test-1', input: '[2,7]\n9', expectedOutput: '[0,1]', isHidden: false },
          { id: 'test-2', input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: false },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      pistonClient.executeCode
        .mockResolvedValueOnce({
          stdout: '[0,1]',
          stderr: null,
          compile_output: null,
          message: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.01',
          memory: 1024,
        })
        .mockResolvedValueOnce({
          stdout: '[1,0]',
          stderr: null,
          compile_output: null,
          message: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.01',
          memory: 1024,
        });

      const result = await service.executeCode('problem-1', 'code', 'javascript');

      expect(result.passed).toBe(1);
      expect(result.total).toBe(2);
      expect(result.allPassed).toBe(false);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(false);
    });

    it('should handle runtime errors', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [
          { id: 'test-1', input: '', expectedOutput: 'hello', isHidden: false },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      pistonClient.executeCode.mockResolvedValue({
        stdout: null,
        stderr: 'NameError: name "x" is not defined',
        compile_output: null,
        message: null,
        status: { id: 11, description: 'Runtime Error (NZEC)' },
        time: '0.01',
        memory: 1024,
      });

      const result = await service.executeCode('problem-1', 'code', 'python');

      expect(result.passed).toBe(0);
      expect(result.allPassed).toBe(false);
      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].error).toContain('NameError');
    });

    it('should handle execution exceptions gracefully', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [
          { id: 'test-1', input: '', expectedOutput: 'hello', isHidden: false },
          { id: 'test-2', input: '', expectedOutput: 'world', isHidden: false },
        ],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);
      pistonClient.executeCode.mockRejectedValue(new Error('Connection timeout'));

      const result = await service.executeCode('problem-1', 'code', 'javascript');

      expect(result.passed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.allPassed).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].error).toContain('Connection timeout');
    });

    it('should throw BadRequestException for unsupported language', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [{ id: 'test-1', input: '', expectedOutput: '', isHidden: false }],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      await expect(
        service.executeCode('problem-1', 'code', 'cobol'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when problem not found', async () => {
      prisma.problem.findUnique.mockResolvedValue(null);

      await expect(
        service.executeCode('nonexistent', 'code', 'javascript'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no test cases exist', async () => {
      const problem = {
        id: 'problem-1',
        testCases: [],
      };

      prisma.problem.findUnique.mockResolvedValue(problem);

      await expect(
        service.executeCode('problem-1', 'code', 'javascript'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
