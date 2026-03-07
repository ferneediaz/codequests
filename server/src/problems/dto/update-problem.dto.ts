import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProblemDto } from './create-problem.dto';

export class UpdateProblemDto extends PartialType(
    OmitType(CreateProblemDto, ['testCases'] as const),
) { }
