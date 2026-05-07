import { ApiProperty } from '@nestjs/swagger';

export class AchievementResponseDto {
    @ApiProperty({ description: 'Slug identifier (e.g. "first_blood")' })
    id!: string;

    @ApiProperty()
    title!: string;

    @ApiProperty()
    description!: string;

    @ApiProperty({ description: 'lucide-react icon name (e.g. "Trophy")' })
    icon!: string;

    @ApiProperty({
        enum: [
            'wins',
            'streak',
            'speed',
            'quality',
            'language',
            'mode',
            'mmr',
            'special',
            'contribution',
            'season',
        ],
    })
    category!: string;

    @ApiProperty({ enum: ['bronze', 'silver', 'gold'] })
    tier!: string;

    @ApiProperty()
    sortOrder!: number;

    @ApiProperty({ description: 'Whether the requested user has unlocked it' })
    unlocked!: boolean;

    @ApiProperty({
        nullable: true,
        type: String,
        format: 'date-time',
        description: 'Unlock timestamp (null if locked)',
    })
    unlockedAt!: string | null;
}
