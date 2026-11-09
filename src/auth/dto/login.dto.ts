import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1, { message: 'Şifre boş olamaz' })
  @MaxLength(72)
  password: string;
  // Not: burada şifre karmaşıklık kuralları (@Matches) YOK — bilinçli.
  // Kullanıcı zaten var olan bir şifreyi giriyor, format kontrolü login'in
  // işi değil; sadece boş olmadığını ve argon2'nin işleyebileceği bir
  // uzunlukta olduğunu doğruluyoruz.
}
