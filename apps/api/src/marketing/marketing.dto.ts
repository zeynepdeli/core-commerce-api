import { IsBoolean, IsEmail, IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';

export class StockAlertDto {
  @IsUUID('all', { message: 'Ürün seçimi geçersiz.' })
  variantId!: string;

  /** Üye girişliyse hesabın e-postası kullanılır */
  @IsOptional()
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  @MaxLength(254)
  email?: string;
}

export class UnsubscribeDto {
  @Matches(/^[A-Za-z0-9_-]{4,400}\.[A-Za-z0-9_-]{43}$/, { message: 'Bağlantı geçersiz.' })
  token!: string;
}

export class ConsentUpdateDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}
