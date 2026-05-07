import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    ArrayMinSize,
    ArrayMaxSize,
} from 'class-validator';
import { Difficulty } from '@prisma/client';

/**
 * Payload for `POST /problem-submissions`. Mirrors the v2 YAML shape used by
 * the existing dev authoring tool, with one addition: `referenceCode` — the
 * contributor's working solution per language. The server runs that against
 * `tests` before persisting; the published `Problem.starterCode` is an
 * auto-generated stub from `signature`, NOT the reference code, so users
 * never see the answer.
 *
 * The signature/tests payloads are accepted as raw `Record<string, unknown>`
 * shapes here and validated server-side via the existing
 * `ProblemYamlV2Schema` (zod) instead of duplicating constraints in
 * class-validator.
 */
export class CreateSubmissionDto {
    @ApiProperty({ example: 'Two Sum' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ description: 'Problem description (markdown supported).' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ enum: Difficulty })
    @IsEnum(Difficulty)
    difficulty: Difficulty;

    @ApiPropertyOptional({ type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @ApiProperty({
        description:
            "Function signature: { name: { javascript, python }, params: [{ name, type }], returns, mutatesArg? }",
    })
    @IsObject()
    signature: Record<string, unknown>;

    @ApiProperty({
        description:
            "Reference solution per language — the working code that must pass all `tests`. Validated server-side; never exposed to users.",
        example: { javascript: 'function twoSum(nums, target) { /* full solution */ }' },
    })
    @IsObject()
    referenceCode: Record<string, string>;

    @ApiProperty({
        description:
            'Test cases: [{ args: [...], expected: any, hidden?: bool }]. At least one required.',
    })
    @IsArray()
    @ArrayMinSize(1)
    tests: Array<{ args: unknown[]; expected: unknown; hidden?: boolean }>;

    @ApiProperty({
        description: 'Hints (1-3) shown progressively to users.',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    @ArrayMaxSize(3)
    hints: string[];

    @ApiProperty({ description: 'Reference solution writeup (markdown).' })
    @IsString()
    @IsNotEmpty()
    solution: string;
}

export class UpdateSubmissionDto extends CreateSubmissionDto {}
