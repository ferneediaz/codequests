import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ProblemResponseDto } from './dto/problem-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Difficulty } from '@prisma/client';
import { CodeExecutionService } from '../code-execution/code-execution.service';

@ApiTags('problems')
@Controller('problems')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class ProblemsController {
    constructor(
        private readonly problemsService: ProblemsService,
        private readonly codeExecutionService: CodeExecutionService,
    ) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'Create a new problem (Admin only)' })
    @ApiResponse({
        status: 201,
        description: 'Problem created successfully',
        type: ProblemResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
    create(@Body() createProblemDto: CreateProblemDto) {
        return this.problemsService.create(createProblemDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all problems with optional filtering' })
    @ApiQuery({
        name: 'difficulty',
        required: false,
        enum: Difficulty,
        description: 'Filter by difficulty level',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (default: 1)',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (default: 20)',
    })
    @ApiQuery({
        name: 'tags',
        required: false,
        type: String,
        description: 'Comma-separated tags to filter by (e.g. arrays,strings)',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns paginated list of problems',
    })
    findAll(
        @Query('difficulty') difficulty?: Difficulty,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('tags') tags?: string,
    ) {
        const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
        return this.problemsService.findAll(
            difficulty,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 20,
            parsedTags,
        );
    }

    @Get('random')
    @ApiOperation({ summary: 'Get a random problem optionally filtered by difficulty and tags' })
    @ApiQuery({
        name: 'difficulty',
        required: false,
        enum: Difficulty,
        description: 'Filter by difficulty level',
    })
    @ApiQuery({
        name: 'tags',
        required: false,
        type: String,
        description: 'Comma-separated tags to filter by',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns a random problem',
        type: ProblemResponseDto,
    })
    findRandom(
        @Query('difficulty') difficulty?: Difficulty,
        @Query('tags') tags?: string,
    ) {
        const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
        return this.problemsService.findRandom(difficulty, parsedTags);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a problem by ID' })
    @ApiParam({ name: 'id', description: 'Problem ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns the problem',
        type: ProblemResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    findOne(
        @Param('id') id: string,
        @Req() req: Request & { user: { role?: string } },
    ) {
        const includeHidden = req.user.role === 'admin';
        return this.problemsService.findOne(id, includeHidden);
    }

    @Get(':id/testcases')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'Get all test cases for a problem (Admin only)' })
    @ApiParam({ name: 'id', description: 'Problem ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns all test cases including hidden ones',
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
    getTestCases(@Param('id') id: string) {
        return this.problemsService.getTestCases(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'Update a problem (Admin only)' })
    @ApiParam({ name: 'id', description: 'Problem ID' })
    @ApiResponse({
        status: 200,
        description: 'Problem updated successfully',
        type: ProblemResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    update(@Param('id') id: string, @Body() updateProblemDto: UpdateProblemDto) {
        return this.problemsService.update(id, updateProblemDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'Delete a problem (Admin only)' })
    @ApiParam({ name: 'id', description: 'Problem ID' })
    @ApiResponse({ status: 200, description: 'Problem deleted successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    remove(@Param('id') id: string) {
        return this.problemsService.remove(id);
    }

    @Post(':id/execute')
    @ApiOperation({ summary: 'Execute code against problem test cases' })
    @ApiParam({ name: 'id', description: 'Problem ID' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['code', 'language'],
            properties: {
                code: {
                    type: 'string',
                    description: 'Source code to execute',
                    example: 'function twoSum(nums, target) {\n  return [0, 1];\n}',
                },
                language: {
                    type: 'string',
                    description: 'Programming language',
                    enum: ['javascript', 'python', 'typescript', 'java', 'cpp', 'c', 'rust'],
                    example: 'javascript',
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Returns execution results with test case outcomes',
        schema: {
            type: 'object',
            properties: {
                passed: { type: 'number', description: 'Number of test cases passed' },
                total: { type: 'number', description: 'Total number of test cases' },
                allPassed: { type: 'boolean', description: 'Whether all test cases passed' },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            testCaseId: { type: 'string' },
                            passed: { type: 'boolean' },
                            input: { type: 'string' },
                            expectedOutput: { type: 'string' },
                            actualOutput: { type: 'string', nullable: true },
                            error: { type: 'string', nullable: true },
                            executionTime: { type: 'string', nullable: true },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    @ApiResponse({ status: 400, description: 'Invalid language or no test cases' })
    executeCode(
        @Param('id') id: string,
        @Body() body: { code: string; language: string },
    ) {
        return this.codeExecutionService.executeCode(id, body.code, body.language);
    }
}
