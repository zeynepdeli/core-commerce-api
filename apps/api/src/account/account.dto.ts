import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { NameField, NewPasswordField } from '../auth/dto/fields.js';

export class UpdateProfileDto {
  @NameField()
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Mevcut şifre boş olamaz.' })
  @MaxLength(128)
  currentPassword!: string;

  @NewPasswordField()
  newPassword!: string;
}

export class DeleteAccountDto {
  // Google ile kayıtlı (şifresi olmayan) kullanıcılar için boş bırakılabilir
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(128)
  password?: string;
}
