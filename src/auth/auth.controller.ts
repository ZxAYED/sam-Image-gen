import { Body, Controller, Post } from '@nestjs/common';
import {
    ApiBody,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorator/rolesDecorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

const authResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: { type: 'object' },
  },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiCreatedResponse({
    description: 'User registered',
    schema: authResponseSchema,
  })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful',
    schema: authResponseSchema,
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
