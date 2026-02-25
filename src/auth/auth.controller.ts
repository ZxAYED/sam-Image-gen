import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from 'src/common/decorator/rolesDecorator';
import { sendResponse } from 'src/utils/sendResponse';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

const authSuccessResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true, default: true },
    message: { type: 'string', example: 'Signup successful' },
    data: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        accessToken: { type: 'string' },
      },
    },
  },
};

const REFRESH_COOKIE_NAME = 'refreshToken';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
    });
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiCreatedResponse({
    description: 'User registered',
    schema: {
      ...authSuccessResponseSchema,
      properties: {
        ...authSuccessResponseSchema.properties,
        message: { type: 'string', example: 'Signup successful' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.auth.signup(dto);
    if (!data.refreshToken) {
      throw new UnauthorizedException('Failed to issue refresh token');
    }

    this.setRefreshCookie(res, data.refreshToken);
    return sendResponse('Signup successful', data);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      ...authSuccessResponseSchema,
      properties: {
        ...authSuccessResponseSchema.properties,
        message: { type: 'string', example: 'Login successful' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Invalid password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.auth.login(dto);
    if (!data.refreshToken) {
      throw new UnauthorizedException('Failed to issue refresh token');
    }

    this.setRefreshCookie(res, data.refreshToken);
    return sendResponse('Login successful', data);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using refresh token cookie',
  })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Token refreshed successfully' },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Need to login again' })
  async refreshToken(@Req() req: Request) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException(
        'No refresh token provided. Need to login again',
      );
    }

    const data = await this.auth.refreshToken(refreshToken);
    return sendResponse('Token refreshed successfully', data);
  }
}
