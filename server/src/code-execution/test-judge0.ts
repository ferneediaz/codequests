#!/usr/bin/env node
/**
 * Quick test script to verify Judge0 is running and working correctly
 * Run with: npx ts-node src/code-execution/test-judge0.ts
 */

const JUDGE0_URL = 'http://localhost:2358';

interface Judge0Status {
    id: number;
    description: string;
}

interface Judge0Result {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    status: Judge0Status;
    time: string | null;
    memory: number | null;
}

async function testJudge0() {
    console.log('🔍 Testing Judge0 connection...\n');

    // 1. Check if Judge0 is up
    try {
        const healthResponse = await fetch(`${JUDGE0_URL}/system_info`);
        if (!healthResponse.ok) {
            console.error('❌ Judge0 is not responding. Make sure containers are running:');
            console.error('   docker-compose up -d');
            process.exit(1);
        }
        console.log('✅ Judge0 is running!\n');
    } catch (error) {
        console.error('❌ Cannot connect to Judge0 at', JUDGE0_URL);
        console.error('   Make sure Judge0 containers are running:');
        console.error('   cd server && docker-compose up -d');
        process.exit(1);
    }

    // 2. Get available languages
    console.log('📋 Available languages:');
    const langResponse = await fetch(`${JUDGE0_URL}/languages`);
    const languages = await langResponse.json();
    const popularLangs = languages
        .filter((l: any) => [63, 71, 74, 62, 54, 50, 73].includes(l.id))
        .map((l: any) => `   - ${l.name} (ID: ${l.id})`)
        .join('\n');
    console.log(popularLangs);
    console.log();

    // 3. Test Python execution
    console.log('🐍 Testing Python execution...');
    const pythonResult = await executeAndWait(
        'print("Hello from Python!")',
        71, // Python 3.8.1
    );
    printResult('Python', pythonResult, 'Hello from Python!');

    // 4. Test JavaScript execution  
    console.log('🟨 Testing JavaScript execution...');
    const jsResult = await executeAndWait(
        'console.log("Hello from JavaScript!");',
        63, // Node.js 12.14.0
    );
    printResult('JavaScript', jsResult, 'Hello from JavaScript!');

    // 5. Test Python with input (Two Sum)
    console.log('🧮 Testing Python Two Sum solution...');
    const twoSumCode = `
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
    const twoSumResult = await executeAndWait(
        twoSumCode,
        71,
        '2 7 11 15\n9',
    );
    printResult('Two Sum', twoSumResult, '0 1');

    // 6. Test error handling
    console.log('⚠️  Testing error handling (syntax error)...');
    const errorResult = await executeAndWait(
        'print("missing quote)',
        71,
    );
    console.log(`   Status: ${errorResult.status.description}`);
    console.log(`   Expected: Compilation Error or similar`);
    console.log(`   Compile output: ${errorResult.compile_output?.substring(0, 100)}...`);
    console.log();

    console.log('✨ All tests completed!\n');
    console.log('You can now run the full test suite with:');
    console.log('   npm test -- --testPathPattern=judge0.integration');
}

async function executeAndWait(
    sourceCode: string,
    languageId: number,
    stdin?: string,
): Promise<Judge0Result> {
    // Submit code
    const submitResponse = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_code: sourceCode,
            language_id: languageId,
            stdin: stdin || '',
        }),
    });

    if (!submitResponse.ok) {
        throw new Error(`Submit failed: ${await submitResponse.text()}`);
    }

    const { token } = await submitResponse.json();

    // Poll for result
    for (let i = 0; i < 20; i++) {
        await sleep(500);

        const resultResponse = await fetch(
            `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`,
        );

        const result: Judge0Result = await resultResponse.json();

        if (result.status.id > 2) {
            return result;
        }
    }

    throw new Error('Timeout waiting for result');
}

function printResult(name: string, result: Judge0Result, expected: string) {
    const actual = result.stdout?.trim() || '';
    const passed = actual === expected && result.status.id === 3;

    console.log(`   Status: ${result.status.description}`);
    console.log(`   Output: "${actual}"`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Time: ${result.time}s, Memory: ${result.memory}KB`);
    console.log(`   ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log();
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
testJudge0().catch(console.error);
