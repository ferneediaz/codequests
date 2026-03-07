import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Piston API Client
 * Alternative to Judge0 with better cgroups v2 support
 * https://github.com/engineer-man/piston
 */

export interface PistonExecuteRequest {
    language: string;
    version: string;
    files: { name: string; content: string }[];
    stdin?: string;
    args?: string[];
    compile_timeout?: number;
    run_timeout?: number;
    compile_memory_limit?: number;
    run_memory_limit?: number;
}

export interface PistonExecuteResponse {
    language: string;
    version: string;
    run: {
        stdout: string;
        stderr: string;
        code: number;
        signal: string | null;
        output: string;
    };
    compile?: {
        stdout: string;
        stderr: string;
        code: number;
        signal: string | null;
        output: string;
    };
}

export interface PistonRuntime {
    language: string;
    version: string;
    aliases: string[];
}

/**
 * Language mapping from our IDs to Piston language names
 */
export const PISTON_LANGUAGES: Record<string, { language: string; version: string; extension: string }> = {
    javascript: { language: 'javascript', version: '*', extension: 'js' },
    python: { language: 'python', version: '3', extension: 'py' },
    typescript: { language: 'typescript', version: '*', extension: 'ts' },
    java: { language: 'java', version: '*', extension: 'java' },
    cpp: { language: 'c++', version: '*', extension: 'cpp' },
    c: { language: 'c', version: '*', extension: 'c' },
    rust: { language: 'rust', version: '*', extension: 'rs' },
};

/**
 * Result interface compatible with Judge0
 */
export interface ExecutionResult {
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

@Injectable()
export class PistonClient {
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        // Use JUDGE0_URL for backwards compatibility, defaults to local Piston (port 2000 with host networking)
        this.baseUrl = this.configService.get<string>('JUDGE0_URL') || 'http://localhost:2000';
    }

    /**
     * Get available runtimes
     */
    async getRuntimes(): Promise<PistonRuntime[]> {
        const response = await fetch(`${this.baseUrl}/api/v2/runtimes`);
        if (!response.ok) {
            throw new Error(`Failed to get runtimes: ${await response.text()}`);
        }
        return response.json();
    }

    /**
     * Execute code and return Judge0-compatible result
     */
    async executeCode(
        sourceCode: string,
        languageKey: string,
        stdin?: string,
    ): Promise<ExecutionResult> {
        const langConfig = PISTON_LANGUAGES[languageKey.toLowerCase()];
        if (!langConfig) {
            throw new Error(`Unsupported language: ${languageKey}`);
        }

        // Get available runtimes to find the right version
        const runtimes = await this.getRuntimes();
        const runtime = runtimes.find(r =>
            r.language === langConfig.language ||
            r.aliases?.includes(langConfig.language)
        );

        if (!runtime) {
            throw new Error(`Runtime not found for language: ${languageKey}`);
        }

        const request: PistonExecuteRequest = {
            language: runtime.language,
            version: runtime.version,
            files: [{
                name: `main.${langConfig.extension}`,
                content: sourceCode,
            }],
            stdin: stdin || '',
            run_timeout: 3000, // 3 seconds (max allowed by Piston config)
            run_memory_limit: 512 * 1024 * 1024, // 512MB
        };

        const startTime = Date.now();
        const response = await fetch(`${this.baseUrl}/api/v2/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
        const executionTime = ((Date.now() - startTime) / 1000).toFixed(3);

        if (!response.ok) {
            const error = await response.text();
            return {
                stdout: null,
                stderr: null,
                compile_output: null,
                message: `Execution failed: ${error}`,
                status: { id: 13, description: 'Internal Error' },
                time: null,
                memory: null,
            };
        }

        const result: PistonExecuteResponse = await response.json();

        // Convert Piston response to Judge0-compatible format
        return this.convertToJudge0Format(result, executionTime);
    }

    /**
     * Convert Piston response to Judge0-compatible format
     */
    private convertToJudge0Format(result: PistonExecuteResponse, time: string): ExecutionResult {
        // Determine status based on execution result
        let status: { id: number; description: string };

        // Check for compilation errors
        if (result.compile && result.compile.code !== 0) {
            status = { id: 6, description: 'Compilation Error' };
            return {
                stdout: null,
                stderr: result.compile.stderr || null,
                compile_output: result.compile.output || result.compile.stderr || null,
                message: null,
                status,
                time,
                memory: null,
            };
        }

        // Check for runtime errors
        if (result.run.code !== 0 || result.run.signal) {
            if (result.run.signal === 'SIGKILL') {
                status = { id: 5, description: 'Time Limit Exceeded' };
            } else if (result.run.signal === 'SIGSEGV') {
                status = { id: 7, description: 'Runtime Error (SIGSEGV)' };
            } else if (result.run.signal) {
                status = { id: 11, description: `Runtime Error (${result.run.signal})` };
            } else {
                status = { id: 11, description: 'Runtime Error (NZEC)' };
            }
        } else {
            status = { id: 3, description: 'Accepted' };
        }

        return {
            stdout: result.run.stdout || null,
            stderr: result.run.stderr || null,
            compile_output: result.compile?.output || null,
            message: result.run.signal || null,
            status,
            time,
            memory: null, // Piston doesn't report memory usage
        };
    }
}
