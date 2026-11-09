import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(72)
  @Matches(/[a-z]/, { message: 'Şifre en az bir küçük harf içermeli' })
  @Matches(/[A-Z]/, { message: 'Şifre en az bir büyük harf içermeli' })
  @Matches(/[0-9]/, { message: 'Şifre en az bir rakam içermeli' })
  password: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'İsim en az 2 karakter olmalı' })
  @MaxLength(100)
  name: string;
}
