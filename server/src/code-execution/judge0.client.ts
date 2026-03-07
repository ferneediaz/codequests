import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Judge0SubmissionRequest {
    source_code: string;
    language_id: number;
    stdin?: string;
    expected_output?: string;
}

export interface Judge0SubmissionResponse {
    token: string;
}

export interface Judge0Result {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    message: string | null;
    status: {
        id: number;
        description: string;
    };
    time: string | null;
    memory: number | null;
}

/**
 * Judge0 Language IDs
 * Reference: https://ce.judge0.com/languages
 */
export const LANGUAGE_IDS = {
    javascript: 63, // JavaScript (Node.js 12.14.0)
    python: 71, // Python (3.8.1)
    typescript: 74, // TypeScript (3.7.4)
    java: 62, // Java (OpenJDK 13.0.1)
    cpp: 54, // C++ (GCC 9.2.0)
    c: 50, // C (GCC 9.2.0)
    rust: 73, // Rust (1.40.0)
} as const;

@Injectable()
export class Judge0Client {
    private readonly baseUrl: string;
    private readonly apiKey?: string;

    constructor(private configService: ConfigService) {
        this.baseUrl =
            this.configService.get<string>('JUDGE0_URL') ||
            'https://judge0-ce.p.rapidapi.com';
        this.apiKey = this.configService.get<string>('JUDGE0_API_KEY');
    }

    /**
     * Submit code to Judge0 for execution
     */
    async submitCode(
        sourceCode: string,
        languageId: number,
        stdin?: string,
    ): Promise<string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.apiKey) {
            headers['X-RapidAPI-Key'] = this.apiKey;
            headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
        }

        const response = await fetch(`${this.baseUrl}/submissions?base64_encoded=false&wait=false`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                source_code: sourceCode,
                language_id: languageId,
                stdin: stdin || '',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Judge0 submission failed: ${error}`);
        }

        const data = (await response.json()) as Judge0SubmissionResponse;
        return data.token;
    }

    /**
     * Get the result of a submission by token
     * Polls until the execution is complete
     */
    async getResult(token: string, maxAttempts: number = 10): Promise<Judge0Result> {
        const headers: Record<string, string> = {};

        if (this.apiKey) {
            headers['X-RapidAPI-Key'] = this.apiKey;
            headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
        }

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(
                `${this.baseUrl}/submissions/${token}?base64_encoded=false`,
                { headers },
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to get Judge0 result: ${error}`);
            }

            const result = (await response.json()) as Judge0Result;

            // Status IDs: 1 = In Queue, 2 = Processing
            if (result.status.id > 2) {
                return result;
            }

            // Wait before polling again (exponential backoff)
            await new Promise((resolve) =>
                setTimeout(resolve, Math.min(1000 * Math.pow(1.5, attempt), 5000)),
            );
        }

        throw new Error('Judge0 execution timeout');
    }

    /**
     * Submit code and wait for result
     */
    async executeCode(
        sourceCode: string,
        languageId: number,
        stdin?: string,
    ): Promise<Judge0Result> {
        const token = await this.submitCode(sourceCode, languageId, stdin);
        return this.getResult(token);
    }
}
