import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateOtpEmailTemplate } from 'src/utils/generateOtpEmailTemplate';
import { sendVerificationEmail } from 'src/utils/sendVerificationEmail';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private generateOtp() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  private getOtpExpiry() {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiresAt() {
    const days = Number(
      this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? '30',
    );
    const ttlDays = Number.isFinite(days) && days > 0 ? days : 30;
    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  }

  private async createRefreshSession(params: {
    userId: string;
    refreshToken: string;
    deviceId?: string;
    userAgent?: string | string[];
    ip?: string;
  }) {
    const refreshTokenHash = this.hashToken(params.refreshToken);

    const session = await this.prisma.refreshSession.create({
      data: {
        userId: params.userId,
        refreshTokenHash,
        deviceId: params.deviceId,
        userAgent:
          typeof params.userAgent === 'string' ? params.userAgent : undefined,
        ip: params.ip,
        expiresAt: this.getRefreshExpiresAt(),
      },
      select: { id: true, expiresAt: true },
    });

    return { sessionId: session.id, expiresAt: session.expiresAt };
  }

  async signup(params: { email: string; password: string; name?: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: params.email },
      select: {
        id: true,
        isVerified: true,
        isBlocked: true,
        isDeleted: true,
      },
    });

    if (existing) {
      if (existing.isBlocked) throw new ConflictException('User is blocked');
      if (existing.isDeleted) throw new ConflictException('User is deleted');
      if (existing.isVerified) {
        throw new ConflictException('Email already registered');
      }

      const otp = this.generateOtp();
      const otpExpiry = this.getOtpExpiry();

      await this.prisma.user.update({
        where: { email: params.email },
        data: {
          registrationOtp: otp,
          registrationOtpExpireIn: otpExpiry,
          registrationOtpAttempts: 0,
        },
      });

      const htmlText = generateOtpEmailTemplate(otp);
      await sendVerificationEmail(
        this.configService,
        params.email,
        'Verify your account',
        htmlText,
      );

      return {
        message:
          'Verification OTP sent. Check your email to verify your account.',
      };
    }

    const passwordHash = await bcrypt.hash(params.password, 12);
    const otp = this.generateOtp();
    const otpExpiry = this.getOtpExpiry();

    const user = await this.prisma.user.create({
      data: {
        email: params.email,
        name: params.name,
        passwordHash,
        isVerified: false,
        registrationOtp: otp,
        registrationOtpExpireIn: otpExpiry,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    const htmlText = generateOtpEmailTemplate(otp);
    await sendVerificationEmail(
      this.configService,
      params.email,
      'Verify your account',
      htmlText,
    );

    return {
      message: 'Signup successful. Check your email for verification OTP.',
      user,
    };
  }

  async resendRegistrationOtp(params: { email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified) {
      throw new ConflictException('User already verified');
    }
    if (user.isBlocked) throw new ConflictException('User is blocked');
    if (user.isDeleted) throw new ConflictException('User is deleted');

    const otp = this.generateOtp();
    const otpExpiry = this.getOtpExpiry();

    await this.prisma.user.update({
      where: { email: params.email },
      data: {
        registrationOtp: otp,
        registrationOtpExpireIn: otpExpiry,
        registrationOtpAttempts: 0,
      },
    });

    const htmlText = generateOtpEmailTemplate(otp);
    await sendVerificationEmail(
      this.configService,
      params.email,
      'Verify your account',
      htmlText,
    );

    return {
      message:
        'Verification OTP resend successfully. Check your email to verify your account. You have 10 minutes to verify.',
    };
  }

  async verifyRegistrationOtp(params: { email: string; otp: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified) throw new ConflictException('User already verified');
    if (user.isBlocked) throw new ConflictException('User is blocked');
    if (user.isDeleted) throw new ConflictException('User is deleted');

    if (user.registrationOtpAttempts >= 5) {
      throw new ForbiddenException('Too many OTP attempts. Please resend OTP.');
    }

    const now = Date.now();
    const expiresAt = user.registrationOtpExpireIn?.getTime() ?? 0;
    if (!user.registrationOtp || expiresAt <= now) {
      throw new ConflictException('OTP expired. Please resend OTP.');
    }

    if (user.registrationOtp !== params.otp) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { registrationOtpAttempts: { increment: 1 } },
      });
      throw new ConflictException('Invalid OTP');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        registrationOtp: null,
        registrationOtpExpireIn: null,
        registrationOtpAttempts: 0,
      },
    });

    return { message: 'Account verified successfully' };
  }

  async login(
    params: { email: string; password: string },
    ctx?: { ip?: string; userAgent?: string | string[] },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.isVerified) {
      throw new ConflictException(
        'User not verified, Please verify your account first.',
      );
    }
    if (user.isBlocked) throw new ConflictException('User is blocked');
    if (user.isDeleted) throw new ConflictException('User is deleted');

    const ok = await bcrypt.compare(params.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid Password');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };

    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const refreshSession = await this.createRefreshSession({
      userId: user.id,
      refreshToken,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return {
      user: safeUser,
      accessToken: await this.signAccessToken(safeUser),
      refreshToken,
      refreshSession,
    };
  }

  async forgotPassword(params: { email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.isVerified) {
      throw new ConflictException(
        'User not verified, Please verify your account first.',
      );
    }
    if (user.isBlocked) throw new ConflictException('User is blocked');
    if (user.isDeleted) throw new ConflictException('User is deleted');

    const otp = this.generateOtp();
    const otpExpiry = this.getOtpExpiry();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpireIn: otpExpiry,
        resetOtpAttempts: 0,
      },
    });

    const htmlText = generateOtpEmailTemplate(otp);
    await sendVerificationEmail(
      this.configService,
      params.email,
      'Reset your password',
      htmlText,
    );

    return {
      message:
        'Password reset OTP sent. Check your email. You have 10 minutes to reset.',
    };
  }

  async resetPassword(params: {
    email: string;
    otp: string;
    newPassword: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isBlocked) throw new ConflictException('User is blocked');
    if (user.isDeleted) throw new ConflictException('User is deleted');

    if (user.resetOtpAttempts >= 5) {
      throw new ForbiddenException('Too many OTP attempts. Please resend OTP.');
    }

    const now = Date.now();
    const expiresAt = user.resetOtpExpireIn?.getTime() ?? 0;
    if (!user.resetOtp || expiresAt <= now) {
      throw new ConflictException('OTP expired. Please resend OTP.');
    }

    if (user.resetOtp !== params.otp) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetOtpAttempts: { increment: 1 } },
      });
      throw new ConflictException('Invalid OTP');
    }

    const passwordHash = await bcrypt.hash(params.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetOtp: null,
          resetOtpExpireIn: null,
          resetOtpAttempts: 0,
        },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    params: { oldPassword: string; newPassword: string },
    user?: User,
  ) {
    if (!user) throw new UnauthorizedException('Unauthorized');

    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!fresh) throw new UnauthorizedException('Unauthorized');
    if (fresh.isBlocked) throw new ConflictException('User is blocked');
    if (fresh.isDeleted) throw new ConflictException('User is deleted');

    const ok = await bcrypt.compare(params.oldPassword, fresh.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid Password');

    const passwordHash = await bcrypt.hash(params.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: fresh.id },
        data: { passwordHash },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: fresh.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password changed successfully' };
  }

  async refreshToken(
    params: { refreshToken: string; deviceId?: string },
    ctx?: { ip?: string; userAgent?: string | string[] },
  ) {
    const refreshTokenHash = this.hashToken(params.refreshToken);

    const session = await this.prisma.refreshSession.findFirst({
      where: { refreshTokenHash },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt)
      throw new UnauthorizedException('Refresh token revoked');
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    if (
      params.deviceId &&
      session.deviceId &&
      params.deviceId !== session.deviceId
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = session.user;
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    if (!user.isVerified) {
      throw new ConflictException(
        'User not verified, Please verify your account first.',
      );
    }
    if (user.isBlocked) throw new ConflictException('User is blocked');
    if (user.isDeleted) throw new ConflictException('User is deleted');

    const nextRefreshToken = crypto.randomBytes(48).toString('base64url');

    const rotated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const next = await tx.refreshSession.create({
          data: {
            userId: user.id,
            refreshTokenHash: this.hashToken(nextRefreshToken),
            deviceId: session.deviceId ?? params.deviceId,
            userAgent:
              typeof ctx?.userAgent === 'string'
                ? ctx.userAgent
                : (session.userAgent ?? undefined),
            ip: ctx?.ip ?? session.ip ?? undefined,
            expiresAt: this.getRefreshExpiresAt(),
          },
          select: { id: true, expiresAt: true },
        });

        await tx.refreshSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date(), replacedById: next.id },
        });

        return next;
      },
    );

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };

    return {
      accessToken: await this.signAccessToken(safeUser),
      refreshToken: nextRefreshToken,
      refreshSession: { sessionId: rotated.id, expiresAt: rotated.expiresAt },
    };
  }

  private async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
  }) {
    return this.jwt.signAsync({
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
