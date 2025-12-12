import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';

@Module({
  imports: [PrismaModule],
  providers: [UsersService, NetworkService],
  controllers: [UsersController, NetworkController],
  exports: [UsersService, NetworkService],
})
export class UsersModule {}

