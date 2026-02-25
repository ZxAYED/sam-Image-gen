import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

type AuthResult = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken?: string;
};

type TokenPayload = {
  id?: string;
  email?: string;
  tokenType?: 'refresh' | 'access';
  [key: string]: unknown;
};

type AccessTokenResult = {
  accessToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(params: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(params.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: params.email,
        password: passwordHash,
        firstName: params.firstName,
        lastName: params.lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    return this.buildAuthResult(user);
  }

  async login(params: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(params.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid password');

    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };

    return this.buildAuthResult(safeUser);
  }

  async refreshToken(refreshToken: string): Promise<AccessTokenResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const userId = payload.id;
    const email = payload.email;

    if (!userId || !email) {
      throw new UnauthorizedException('Need to login again');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId, email },
      select: { id: true },
    });

    if (!existingUser) {
      throw new UnauthorizedException('Need to login again');
    }

    return {
      accessToken: await this.signAccessToken({ id: userId, email }),
    };
  }

  private async buildAuthResult(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
  }): Promise<AuthResult> {
    return {
      user,
      accessToken: await this.signAccessToken({
        id: user.id,
        email: user.email,
      }),
      refreshToken: await this.signRefreshToken({
        id: user.id,
        email: user.email,
      }),
    };
  }

  private async signAccessToken(user: { id: string; email: string }) {
    return this.jwt.signAsync({
      id: user.id,
      email: user.email,
    });
  }

  private async signRefreshToken(user: { id: string; email: string }) {
    const secret =
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      this.config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    return this.jwt.signAsync(
      {
        id: user.id,
        email: user.email,
        tokenType: 'refresh',
      },
      {
        secret,
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as StringValue,
      },
    );
  }

  private async verifyRefreshToken(token: string): Promise<TokenPayload> {
    const secret =
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      this.config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Need to login again');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Need to login again');
    }

    return payload;
  }
}
