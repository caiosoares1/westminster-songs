import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientIpThrottlerGuard } from './client-ip.throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { SetlistsModule } from './setlists/setlists.module';
import { SongsModule } from './songs/songs.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Default: 300 requests per minute per IP (auth routes are stricter).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    SongsModule,
    SetlistsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
  ],
})
export class AppModule {}
