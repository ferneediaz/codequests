import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NewsService } from './news.service';
import { PracticeModule } from '../practice/practice.module';

@Module({
  imports: [PracticeModule],
  controllers: [UsersController],
  providers: [UsersService, NewsService],
  exports: [UsersService, NewsService],
})
export class UsersModule {}
