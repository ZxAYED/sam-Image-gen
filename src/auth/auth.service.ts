import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { sendResponse } from 'src/utils/sendResponse';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
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

    return sendResponse('Signup successful', {
      user,
      accessToken: await this.signAccessToken({
        id: user.id,
        email: user.email,
      }),
    });
  }

  async login(params: { email: string; password: string }) {
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

    return sendResponse('Login successful', {
      user: safeUser,
      accessToken: await this.signAccessToken({
        id: user.id,
        email: user.email,
      }),
    });
  }

  private async signAccessToken(user: { id: string; email: string }) {
    return this.jwt.signAsync({
      id: user.id,
      email: user.email,
    });
  }
}
