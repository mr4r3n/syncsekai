import { Module, Global } from '@nestjs/common';
import { CoversService } from './covers.service';
import { CoversController } from './covers.controller';

@Global()
@Module({
  controllers: [CoversController],
  providers: [CoversService],
  exports: [CoversService],
})
export class CoversModule {}
