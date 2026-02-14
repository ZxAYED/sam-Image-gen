import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/guards/auth/auth.guard';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (env: Record<string, string | undefined>) => {
        const databaseUrl = env.DATABASE_URL;
        const jwtSecret = env.JWT_SECRET;

        if (!databaseUrl) {
          throw new Error('DATABASE_URL is required');
        }

        if (!jwtSecret) {
          throw new Error('JWT_SECRET is required');
        }

        if (env.PORT) {
          const port = Number(env.PORT);
          if (!Number.isInteger(port) || port <= 0) {
            throw new Error('PORT must be a positive integer');
          }
        }

        return env;
      },
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
