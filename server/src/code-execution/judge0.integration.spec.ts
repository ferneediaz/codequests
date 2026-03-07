/**
 * Integration tests for Judge0 code execution
 * These tests require a running Judge0 instance at http://localhost:2358
 * 
 * Run with: npm run test:e2e or npx jest --config jest.config.js judge0.integration.spec.ts
 */
import { Judge0Client, LANGUAGE_IDS, Judge0Result } from './judge0.client';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService to return local Judge0 URL
const mockConfigService = {
    get: jest.fn((key: string) => {
        if (key === 'JUDGE0_URL') return 'http://localhost:2358';
        if (key === 'JUDGE0_API_KEY') return ''; // No API key for self-hosted
        return undefined;
    }),
} as unknown as ConfigService;

describe('Judge0 Integration Tests', () => {
    let judge0Client: Judge0Client;

    beforeAll(() => {
        judge0Client = new Judge0Client(mockConfigService);
    });

    // Skip these tests by default since we're using Piston instead
    // To run them, start Judge0 and use: SKIP_JUDGE0_TESTS=false npm test
    const conditionalTest = process.env.SKIP_JUDGE0_TESTS !== 'false' ? it.skip : it;

    describe('Health Check', () => {
        conditionalTest('should connect to Judge0', async () => {
            // Try to get languages - if this works, Judge0 is running
            const response = await fetch('http://localhost:2358/languages');
            expect(response.ok).toBe(true);
            const languages = await response.json();
            expect(Array.isArray(languages)).toBe(true);
            expect(languages.length).toBeGreaterThan(0);
        });

        conditionalTest('should get system info', async () => {
            const response = await fetch('http://localhost:2358/system_info');
            expect(response.ok).toBe(true);
        });
    });

    describe('JavaScript Execution', () => {
        conditionalTest('should execute simple JavaScript code correctly', async () => {
            const code = `console.log("Hello, World!");`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.javascript);

            expect(result.status.id).toBe(3); // Accepted
            expect(result.stdout?.trim()).toBe('Hello, World!');
            expect(result.stderr).toBeFalsy();
        }, 30000);

        conditionalTest('should handle JavaScript with stdin', async () => {
            const code = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
    const nums = line.split(' ').map(Number);
    console.log(nums.reduce((a, b) => a + b, 0));
    rl.close();
});
`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.javascript, '1 2 3 4 5');

            expect(result.status.id).toBe(3); // Accepted
            expect(result.stdout?.trim()).toBe('15');
        }, 30000);

        conditionalTest('should handle JavaScript runtime error', async () => {
            const code = `throw new Error("Test error");`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.javascript);

            // Status 11 = Runtime Error (NZEC)
            expect(result.status.id).toBeGreaterThan(3);
            expect(result.stderr).toBeTruthy();
        }, 30000);
    });

    describe('Python Execution', () => {
        conditionalTest('should execute simple Python code correctly', async () => {
            const code = `print("Hello, Python!")`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            expect(result.status.id).toBe(3); // Accepted
            expect(result.stdout?.trim()).toBe('Hello, Python!');
        }, 30000);

        conditionalTest('should handle Python with stdin - Two Sum problem', async () => {
            // Classic Two Sum solution
            const code = `
nums = list(map(int, input().split()))
target = int(input())
seen = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in seen:
        print(seen[complement], i)
        break
    seen[num] = i
`;
            // Input: array [2, 7, 11, 15] and target 9
            const stdin = '2 7 11 15\n9';

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python, stdin);

            expect(result.status.id).toBe(3); // Accepted
            expect(result.stdout?.trim()).toBe('0 1'); // indices 0 and 1 (2 + 7 = 9)
        }, 30000);

        conditionalTest('should detect wrong answer', async () => {
            const code = `print("wrong answer")`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            expect(result.status.id).toBe(3); // Code ran successfully
            expect(result.stdout?.trim()).not.toBe('correct answer'); // But output is wrong
        }, 30000);

        conditionalTest('should handle Python syntax error', async () => {
            const code = `print("missing closing quote)`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            // Status 6 = Compilation Error
            expect(result.status.id).toBe(6);
            expect(result.compile_output).toBeTruthy();
        }, 30000);
    });

    describe('TypeScript Execution', () => {
        conditionalTest('should execute TypeScript code correctly', async () => {
            const code = `
const greeting: string = "Hello, TypeScript!";
console.log(greeting);
`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.typescript);

            expect(result.status.id).toBe(3); // Accepted
            expect(result.stdout?.trim()).toBe('Hello, TypeScript!');
        }, 30000);
    });

    describe('Test Case Validation', () => {
        /**
         * This test simulates how the CodeExecutionService validates answers
         */
        conditionalTest('should validate correct solution - FizzBuzz', async () => {
            const code = `
for i in range(1, 16):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
`;
            const expectedOutput = `1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            expect(result.status.id).toBe(3); // Accepted

            // Normalize outputs for comparison
            const actualOutput = result.stdout?.trim().replace(/\r\n/g, '\n').replace(/\s+$/gm, '');
            const normalizedExpected = expectedOutput.trim().replace(/\r\n/g, '\n').replace(/\s+$/gm, '');

            expect(actualOutput).toBe(normalizedExpected);
        }, 30000);

        conditionalTest('should validate incorrect solution - FizzBuzz', async () => {
            const code = `
for i in range(1, 16):
    print(i)  # Wrong - just prints numbers
`;
            const expectedOutput = `1
2
Fizz
4
Buzz`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            expect(result.status.id).toBe(3); // Code ran successfully

            // But output should NOT match
            const actualOutput = result.stdout?.trim().replace(/\r\n/g, '\n');
            const normalizedExpected = expectedOutput.trim().replace(/\r\n/g, '\n');

            expect(actualOutput).not.toBe(normalizedExpected);
        }, 30000);

        conditionalTest('should validate Reverse String solution', async () => {
            const code = `
s = input()
print(s[::-1])
`;
            const testCases = [
                { input: 'hello', expected: 'olleh' },
                { input: 'world', expected: 'dlrow' },
                { input: 'racecar', expected: 'racecar' }, // Palindrome
            ];

            for (const testCase of testCases) {
                const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python, testCase.input);

                expect(result.status.id).toBe(3);
                expect(result.stdout?.trim()).toBe(testCase.expected);
            }
        }, 60000);

        conditionalTest('should validate Binary Search solution', async () => {
            const code = `
import json
import sys

data = json.loads(input())
nums = data['nums']
target = data['target']

left, right = 0, len(nums) - 1
while left <= right:
    mid = (left + right) // 2
    if nums[mid] == target:
        print(mid)
        sys.exit()
    elif nums[mid] < target:
        left = mid + 1
    else:
        right = mid - 1
print(-1)
`;
            const testCases = [
                { input: '{"nums": [-1, 0, 3, 5, 9, 12], "target": 9}', expected: '4' },
                { input: '{"nums": [-1, 0, 3, 5, 9, 12], "target": 2}', expected: '-1' },
                { input: '{"nums": [1], "target": 1}', expected: '0' },
            ];

            for (const testCase of testCases) {
                const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python, testCase.input);

                expect(result.status.id).toBe(3);
                expect(result.stdout?.trim()).toBe(testCase.expected);
            }
        }, 60000);
    });

    describe('Performance Limits', () => {
        conditionalTest('should handle time limit exceeded', async () => {
            const code = `
import time
time.sleep(60)  # Sleep for 60 seconds - should timeout
print("done")
`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            // Status 5 = Time Limit Exceeded
            expect(result.status.id).toBe(5);
        }, 30000);

        conditionalTest('should handle memory limit exceeded', async () => {
            const code = `
# Try to allocate huge amount of memory
data = [0] * (10**9)  # 1 billion integers
print(len(data))
`;

            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            // Status 6 = Memory Limit Exceeded or Runtime Error
            expect(result.status.id).toBeGreaterThan(3);
        }, 30000);
    });

    describe('Status Codes', () => {
        /**
         * Judge0 Status Codes:
         * 1 - In Queue
         * 2 - Processing
         * 3 - Accepted
         * 4 - Wrong Answer
         * 5 - Time Limit Exceeded
         * 6 - Compilation Error
         * 7 - Runtime Error (SIGSEGV)
         * 8 - Runtime Error (SIGXFSZ)
         * 9 - Runtime Error (SIGFPE)
         * 10 - Runtime Error (SIGABRT)
         * 11 - Runtime Error (NZEC)
         * 12 - Runtime Error (Other)
         * 13 - Internal Error
         * 14 - Exec Format Error
         */
        conditionalTest('should return status 3 (Accepted) for valid code', async () => {
            const code = `print(42)`;
            const result = await judge0Client.executeCode(code, LANGUAGE_IDS.python);

            expect(result.status.id).toBe(3);
            expect(result.status.description).toBe('Accepted');
        }, 30000);
    });
});

/**
 * Helper function to check if Judge0 is running
 */
export async function isJudge0Running(): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:2358/system_info', {
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch {
        return false;
    }
}
