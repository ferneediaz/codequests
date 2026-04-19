import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'Subscription plan to purchase',
    enum: ['bimonthly', 'yearly'],
    example: 'bimonthly',
  })
  @IsString()
  @IsIn(['bimonthly', 'yearly'])
  plan: 'bimonthly' | 'yearly';
}
