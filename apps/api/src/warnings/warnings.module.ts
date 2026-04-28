import { Module } from '@nestjs/common';
import { WarningsController } from './warnings.controller';
import { WarningsService } from './warnings.service';

@Module({
  controllers: [WarningsController],
  providers: [WarningsService],
})
export class WarningsModule {}
