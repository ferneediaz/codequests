/**
 * Integration tests for Piston code execution
 * These tests require a running Piston instance at http://localhost:2000
 * with Python and JavaScript runtimes installed
 * 
 * Run with: RUN_PISTON_TESTS=true npm test -- piston.integration.spec.ts
 * Or locally with Piston running: npm test -- piston.integration.spec.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PistonClient, PISTON_LANGUAGES, ExecutionResult } from './piston.client';

// Mock ConfigService to return local Piston URL
const mockConfigService = {
    get: jest.fn((key: string) => {
        if (key === 'PISTON_URL') return 'http://localhost:2000';
        return undefined;
    }),
} as unknown as ConfigService;

describe('Piston Integration Tests', () => {
    let pistonClient: PistonClient;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PistonClient,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        pistonClient = module.get<PistonClient>(PistonClient);
    });

    // Run these tests only if RUN_PISTON_TESTS is set (opt-in for CI)
    // Locally, we auto-detect if Piston is running
    const conditionalTest = process.env.CI && !process.env.RUN_PISTON_TESTS ? it.skip : it;

    describe('Health Check', () => {
        conditionalTest('should connect to Piston API', async () => {
            const response = await fetch('http://localhost:2000/api/v2/runtimes');
            expect(response.ok).toBe(true);
            const runtimes = await response.json();
            expect(Array.isArray(runtimes)).toBe(true);
        }, 10000);

        conditionalTest('should have runtimes installed', async () => {
            const runtimes = await pistonClient.getRuntimes();
            expect(runtimes.length).toBeGreaterThan(0);
            console.log('Available runtimes:', runtimes.map(r => `${r.language} ${r.version}`));
        }, 10000);
    });

    describe('Simple Hello World Tests', () => {
        conditionalTest('should print "Hello World" in Python', async () => {
            const code = `print("Hello World")`;

            const result = await pistonClient.executeCode(code, 'python');

            console.log('Python Hello World result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3); // Status 3 = Accepted
            expect(result.status.description).toBe('Accepted');
            expect(result.stdout?.trim()).toBe('Hello World');
            expect(result.stderr).toBeFalsy();
        }, 15000);

        conditionalTest('should print "Hello World" in JavaScript', async () => {
            const code = `console.log("Hello World");`;

            const result = await pistonClient.executeCode(code, 'javascript');

            console.log('JavaScript Hello World result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3); // Status 3 = Accepted
            expect(result.status.description).toBe('Accepted');
            expect(result.stdout?.trim()).toBe('Hello World');
            expect(result.stderr).toBeFalsy();
        }, 15000);
    });

    describe('Tests with Input (stdin as answer)', () => {
        conditionalTest('should read input and print it back - Python', async () => {
            const code = `
answer = input()
print("You entered:", answer)
`;
            const inputAnswer = 'Test Answer 123';

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('Python input test result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe(`You entered: ${inputAnswer}`);
        }, 15000);

        conditionalTest('should read input and process it - Python sum', async () => {
            const code = `
numbers = list(map(int, input().split()))
print(sum(numbers))
`;
            const inputAnswer = '1 2 3 4 5';

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('Python sum test result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe('15');
        }, 15000);

        conditionalTest('should handle multiple lines of input - Two Sum problem', async () => {
            const code = `
# Read array of numbers
nums = list(map(int, input().split()))
# Read target
target = int(input())

# Two Sum solution
seen = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in seen:
        print(seen[complement], i)
        break
    seen[num] = i
`;
            const inputAnswer = '2 7 11 15\n9';

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('Two Sum test result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe('0 1'); // Indices of 2 and 7
        }, 15000);

        conditionalTest('should process JSON input as answer', async () => {
            const code = `
import json
data = json.loads(input())
print(f"Name: {data['name']}, Age: {data['age']}")
`;
            const inputAnswer = '{"name": "Alice", "age": 30}';

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('JSON input test result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe('Name: Alice, Age: 30');
        }, 15000);
    });

    describe('Test Case Validation (mimicking problem solving)', () => {
        conditionalTest('should validate Reverse String solution with multiple inputs', async () => {
            const code = `
s = input()
print(s[::-1])
`;
            const testCases = [
                { input: 'hello', expected: 'olleh' },
                { input: 'world', expected: 'dlrow' },
                { input: 'racecar', expected: 'racecar' }, // Palindrome
                { input: 'a', expected: 'a' },
                { input: '', expected: '' },
            ];

            for (const testCase of testCases) {
                const result = await pistonClient.executeCode(code, 'python', testCase.input);

                expect(result.status.id).toBe(3);
                expect(result.stdout?.trim()).toBe(testCase.expected);
            }
        }, 30000);

        conditionalTest('should validate FizzBuzz solution', async () => {
            const code = `
n = int(input())
for i in range(1, n + 1):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
`;
            const inputAnswer = '15';
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

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('FizzBuzz test result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);

            // Normalize outputs
            const actualOutput = result.stdout?.trim().replace(/\r\n/g, '\n');
            const normalizedExpected = expectedOutput.trim().replace(/\r\n/g, '\n');

            expect(actualOutput).toBe(normalizedExpected);
        }, 15000);

        conditionalTest('should validate Palindrome Checker with answer input', async () => {
            const code = `
def is_palindrome(s):
    s = s.lower().replace(' ', '')
    return s == s[::-1]

text = input()
if is_palindrome(text):
    print("true")
else:
    print("false")
`;
            const testCases = [
                { input: 'racecar', expected: 'true' },
                { input: 'hello', expected: 'false' },
                { input: 'A man a plan a canal Panama', expected: 'true' },
                { input: 'not a palindrome', expected: 'false' },
            ];

            for (const testCase of testCases) {
                const result = await pistonClient.executeCode(code, 'python', testCase.input);

                console.log(`Palindrome test for "${testCase.input}":`, result.stdout?.trim());

                expect(result.status.id).toBe(3);
                expect(result.stdout?.trim()).toBe(testCase.expected);
            }
        }, 30000);
    });

    describe('Error Handling', () => {
        conditionalTest('should handle Python syntax error', async () => {
            const code = `print("missing quote)`;

            const result = await pistonClient.executeCode(code, 'python');

            console.log('Syntax error result:', JSON.stringify(result, null, 2));

            // Python is interpreted, so syntax errors show as runtime errors (status 11 = NZEC)
            expect(result.status.id).toBeGreaterThan(3); // Any error status
            expect(result.stderr).toBeTruthy();
        }, 15000);

        conditionalTest('should handle Python runtime error', async () => {
            const code = `
x = 1 / 0  # Division by zero
print(x)
`;

            const result = await pistonClient.executeCode(code, 'python');

            console.log('Runtime error result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBeGreaterThan(3); // Status > 3 = Error
            expect(result.stderr).toBeTruthy();
        }, 15000);

        conditionalTest('should execute code that produces incorrect output without error', async () => {
            const code = `print("This is wrong")`;

            const result = await pistonClient.executeCode(code, 'python');

            // Code executes successfully but produces output that wouldn't match expected
            // Wrong-answer detection happens at the CodeExecutionService level, not Piston
            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe('This is wrong');
            expect(result.stderr).toBeFalsy();
        }, 15000);
    });

    describe('Real-World Problem Examples with Input', () => {
        conditionalTest('should solve Array Sum problem with input', async () => {
            const code = `
n = int(input())  # Array size
arr = list(map(int, input().split()))  # Array elements
print(sum(arr))
`;
            const inputAnswer = '5\n1 2 3 4 5';
            const expectedOutput = '15';

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('Array Sum result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe(expectedOutput);
        }, 15000);

        conditionalTest('should solve Find Maximum problem with input', async () => {
            const code = `
numbers = list(map(int, input().split()))
print(max(numbers))
`;
            const testCases = [
                { input: '1 5 3 9 2', expected: '9' },
                { input: '-5 -2 -10 -1', expected: '-1' },
                { input: '42', expected: '42' },
            ];

            for (const testCase of testCases) {
                const result = await pistonClient.executeCode(code, 'python', testCase.input);

                expect(result.status.id).toBe(3);
                expect(result.stdout?.trim()).toBe(testCase.expected);
            }
        }, 30000);

        conditionalTest('should solve String Concatenation with two inputs', async () => {
            const code = `
first = input()
second = input()
print(first + " " + second)
`;
            const inputAnswer = 'Hello\nWorld';
            const expectedOutput = 'Hello World';

            const result = await pistonClient.executeCode(code, 'python', inputAnswer);

            console.log('String Concat result:', JSON.stringify(result, null, 2));

            expect(result.status.id).toBe(3);
            expect(result.stdout?.trim()).toBe(expectedOutput);
        }, 15000);
    });
});
