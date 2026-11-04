import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './ocr/ocr.module';
import { PrismaModule } from './prisma/prisma.module';
import { SongsModule } from './songs/songs.module';

@Module({
  imports: [PrismaModule, SongsModule, OcrModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
