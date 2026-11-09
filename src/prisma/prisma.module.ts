import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // bu modülü bir kere import edersin, her yerde otomatik erişilebilir olur
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // başka modüllerin bu servisi enjekte edebilmesi için zorunlu
})
export class PrismaModule {}
