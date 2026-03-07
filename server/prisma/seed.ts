import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Create admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@codequest.dev' },
        update: {},
        create: {
            id: 'admin-seed-user-001',
            email: 'admin@codequest.dev',
            username: 'admin',
            role: 'admin',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        },
    });

    console.log('✅ Created admin user:', admin.email);

    // Create sample regular users
    const users = await Promise.all([
        prisma.user.upsert({
            where: { email: 'alice@example.com' },
            update: {},
            create: {
                id: 'user-seed-001',
                email: 'alice@example.com',
                username: 'alice_coder',
                role: 'user',
                mmr: 1200,
                wins: 15,
                losses: 10,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
            },
        }),
        prisma.user.upsert({
            where: { email: 'bob@example.com' },
            update: {},
            create: {
                id: 'user-seed-002',
                email: 'bob@example.com',
                username: 'bob_dev',
                role: 'user',
                mmr: 1500,
                wins: 25,
                losses: 15,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
            },
        }),
    ]);

    console.log(`✅ Created ${users.length} sample users`);

    // Create sample problems
    const problems = [
        {
            id: 'problem-001-two-sum',
            title: 'Two Sum',
            description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: nums[0] + nums[1] = 2 + 7 = 9
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\``,
            difficulty: 'EASY' as const,
            starterCode: JSON.stringify({
                javascript: `function twoSum(nums, target) {\n  // Your code here\n}`,
                python: `def two_sum(nums, target):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false },
                { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isHidden: false },
                { input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: false },
                { input: '[1,5,3,7,9]\n10', expectedOutput: '[1,3]', isHidden: true },
                { input: '[10,20,30]\n50', expectedOutput: '[1,2]', isHidden: true },
            ],
        },
        {
            id: 'problem-002-reverse-string',
            title: 'Reverse String',
            description: `Write a function that reverses a string. The input string is given as an array of characters.

You must do this by modifying the input array in-place with O(1) extra memory.

**Example 1:**
\`\`\`
Input: s = ["h","e","l","l","o"]
Output: ["o","l","l","e","h"]
\`\`\`

**Example 2:**
\`\`\`
Input: s = ["H","a","n","n","a","h"]
Output: ["h","a","n","n","a","H"]
\`\`\``,
            difficulty: 'EASY' as const,
            starterCode: JSON.stringify({
                javascript: `function reverseString(s) {\n  // Your code here\n}`,
                python: `def reverse_string(s):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: '["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]', isHidden: false },
                { input: '["H","a","n","n","a","h"]', expectedOutput: '["h","a","n","n","a","H"]', isHidden: false },
                { input: '["a"]', expectedOutput: '["a"]', isHidden: true },
            ],
        },
        {
            id: 'problem-003-valid-parentheses',
            title: 'Valid Parentheses',
            description: `Given a string \`s\` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Example 1:**
\`\`\`
Input: s = "()"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "()[]{}"
Output: true
\`\`\`

**Example 3:**
\`\`\`
Input: s = "(]"
Output: false
\`\`\``,
            difficulty: 'MEDIUM' as const,
            starterCode: JSON.stringify({
                javascript: `function isValid(s) {\n  // Your code here\n}`,
                python: `def is_valid(s):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: '()', expectedOutput: 'true', isHidden: false },
                { input: '()[]{}', expectedOutput: 'true', isHidden: false },
                { input: '(]', expectedOutput: 'false', isHidden: false },
                { input: '{[()]}', expectedOutput: 'true', isHidden: true },
                { input: '({[)}]', expectedOutput: 'false', isHidden: true },
            ],
        },
        {
            id: 'problem-004-binary-search',
            title: 'Binary Search',
            description: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return -1.

You must write an algorithm with O(log n) runtime complexity.

**Example 1:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1
\`\`\``,
            difficulty: 'MEDIUM' as const,
            starterCode: JSON.stringify({
                javascript: `function search(nums, target) {\n  // Your code here\n}`,
                python: `def search(nums, target):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: '[-1,0,3,5,9,12]\n9', expectedOutput: '4', isHidden: false },
                { input: '[-1,0,3,5,9,12]\n2', expectedOutput: '-1', isHidden: false },
                { input: '[5]\n5', expectedOutput: '0', isHidden: true },
                { input: '[1,2,3,4,5,6,7,8,9,10]\n7', expectedOutput: '6', isHidden: true },
            ],
        },
        {
            id: 'problem-005-palindrome',
            title: 'Valid Palindrome',
            description: `A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return true if it is a palindrome, or false otherwise.

**Example 1:**
\`\`\`
Input: s = "A man, a plan, a canal: Panama"
Output: true
Explanation: "amanaplanacanalpanama" is a palindrome.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "race a car"
Output: false
Explanation: "raceacar" is not a palindrome.
\`\`\``,
            difficulty: 'MEDIUM' as const,
            starterCode: JSON.stringify({
                javascript: `function isPalindrome(s) {\n  // Your code here\n}`,
                python: `def is_palindrome(s):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true', isHidden: false },
                { input: 'race a car', expectedOutput: 'false', isHidden: false },
                { input: ' ', expectedOutput: 'true', isHidden: true },
            ],
        },
        {
            id: 'problem-006-merge-intervals',
            title: 'Merge Intervals',
            description: `Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

**Example 1:**
\`\`\`
Input: intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
Explanation: Since intervals [1,3] and [2,6] overlap, merge them into [1,6].
\`\`\`

**Example 2:**
\`\`\`
Input: intervals = [[1,4],[4,5]]
Output: [[1,5]]
Explanation: Intervals [1,4] and [4,5] are considered overlapping.
\`\`\``,
            difficulty: 'HARD' as const,
            starterCode: JSON.stringify({
                javascript: `function merge(intervals) {\n  // Your code here\n}`,
                python: `def merge(intervals):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: '[[1,3],[2,6],[8,10],[15,18]]', expectedOutput: '[[1,6],[8,10],[15,18]]', isHidden: false },
                { input: '[[1,4],[4,5]]', expectedOutput: '[[1,5]]', isHidden: false },
                { input: '[[1,4],[0,4]]', expectedOutput: '[[0,4]]', isHidden: true },
            ],
        },
        {
            id: 'problem-007-longest-substring',
            title: 'Longest Substring Without Repeating Characters',
            description: `Given a string \`s\`, find the length of the longest substring without repeating characters.

**Example 1:**
\`\`\`
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.
\`\`\`

**Example 3:**
\`\`\`
Input: s = "pwwkew"
Output: 3
Explanation: The answer is "wke", with the length of 3.
\`\`\``,
            difficulty: 'HARD' as const,
            starterCode: JSON.stringify({
                javascript: `function lengthOfLongestSubstring(s) {\n  // Your code here\n}`,
                python: `def length_of_longest_substring(s):\n    # Your code here\n    pass`,
            }),
            testCases: [
                { input: 'abcabcbb', expectedOutput: '3', isHidden: false },
                { input: 'bbbbb', expectedOutput: '1', isHidden: false },
                { input: 'pwwkew', expectedOutput: '3', isHidden: false },
                { input: 'dvdf', expectedOutput: '3', isHidden: true },
                { input: '', expectedOutput: '0', isHidden: true },
            ],
        },
    ];

    for (const problemData of problems) {
        const { testCases, ...problem } = problemData;

        const createdProblem = await prisma.problem.upsert({
            where: { id: problem.id },
            update: {},
            create: {
                ...problem,
                testCases: {
                    create: testCases,
                },
            },
        });

        console.log(`✅ Created problem: ${createdProblem.title} (${createdProblem.difficulty})`);
    }

    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
