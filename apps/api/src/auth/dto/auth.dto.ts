import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { EmailField, NameField, NewPasswordField, OpaqueTokenField } from './fields.js';

export class TwoFactorLoginDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Doğrulama süresi doldu. Lütfen yeniden giriş yapın.' })
  challengeToken!: string;

  // 6 haneli kod veya "ABCDE-FGHJK" biçiminde yedek kod
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9A-Za-z -]+$/, { message: 'Doğrulama kodu hatalı.' })
  code!: string;
}

export class RegisterDto {
  @EmailField()
  email!: string;

  @NewPasswordField()
  password!: string;

  @NameField()
  name!: string;
}

export class LoginDto {
  @EmailField()
  email!: string;

  // Giriş sırasında şifre karmaşıklık kuralı YOK — bilinçli: kullanıcı mevcut
  // şifresini giriyor. Yalnızca boş olmadığı ve aşırı uzun olmadığı kontrol edilir.
  @IsString()
  @MinLength(1, { message: 'Şifre boş olamaz.' })
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @OpaqueTokenField()
  refreshToken!: string;
}

export class EmailDto {
  @EmailField()
  email!: string;
}

export class VerifyEmailDto {
  @OpaqueTokenField()
  token!: string;
}

export class ResetPasswordDto {
  @OpaqueTokenField()
  token!: string;

  @NewPasswordField()
  password!: string;
}

export class GoogleLoginDto {
  // Google Identity Services'in verdiği ID token (JWT). Doğrulamayı Google kütüphanesi yapar.
  @IsString()
  @MinLength(100)
  @MaxLength(4096)
  idToken!: string;
}
