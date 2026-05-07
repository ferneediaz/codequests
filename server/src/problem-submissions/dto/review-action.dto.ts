import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSubmissionDto } from './create-submission.dto';

export class ReviewNotesDto {
    @ApiPropertyOptional({
        description: 'Optional reviewer notes shown to the contributor.',
        maxLength: 2000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class ApproveSubmissionDto extends ReviewNotesDto {
    /**
     * Optional inline edits applied before publishing — backs the
     * "Edit & Approve" admin action. When present, the supplied fields
     * replace the contributor's payload before the new Problem row is
     * created. Only the fields admins are likely to touch (title,
     * description, tags, difficulty, hints, solution) are exposed here;
     * structural fields (signature, tests) require a Request Changes
     * round-trip so the contributor can re-validate their solution.
     */
    @ApiPropertyOptional({ type: () => CreateSubmissionDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => CreateSubmissionDto)
    edits?: CreateSubmissionDto;
}

export class RejectSubmissionDto {
    @ApiPropertyOptional({
        description: 'Required reason shown to the contributor.',
        maxLength: 2000,
    })
    @IsString()
    @MaxLength(2000)
    notes: string;
}

export class RequestChangesDto extends RejectSubmissionDto {}
