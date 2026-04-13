import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Sina' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Laut' })
  @IsString()
  lastName!: string;
}
