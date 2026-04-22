import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SubscriptionDetailsDto {
  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: '2026-06-19T00:00:00.000Z' })
  currentPeriodEnd!: string;

  @ApiProperty({ example: false })
  cancelAtPeriodEnd!: boolean;
}

export class SubscriptionStatusResponseDto {
  @ApiProperty({ enum: ['free', 'pro', 'trial'], example: 'free' })
  tier!: 'free' | 'pro' | 'trial';

  @ApiProperty({ description: 'Games remaining today. -1 means unlimited (pro/trial).', example: 1 })
  gamesRemaining!: number;

  @ApiProperty({ example: 0 })
  gamesPlayedToday!: number;

  @ApiProperty({ description: 'Daily game limit. -1 means unlimited (pro/trial).', example: 1 })
  dailyLimit!: number;

  @ApiProperty({ example: '2026-04-20T00:00:00.000Z' })
  resetsAt!: string;

  @ApiPropertyOptional({ example: '2026-04-26T00:00:00.000Z' })
  trialEndsAt?: string;

  @ApiPropertyOptional({ type: SubscriptionDetailsDto })
  subscription?: SubscriptionDetailsDto;

  /**
   * Where the Pro entitlement comes from. Useful for the client to render
   * a small "Dev PRO" badge instead of "PRO" when access is granted by the
   * developer allowlist (DEV_PRO_USER_IDS / DEV_PRO_EMAILS).
   */
  @ApiPropertyOptional({
    enum: ['stripe', 'trial', 'dev'],
    description:
      'Source of pro entitlement. Omitted for free users.',
  })
  source?: 'stripe' | 'trial' | 'dev';
}
