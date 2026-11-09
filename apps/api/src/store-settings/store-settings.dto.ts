import { IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../common/validators.js';

const nullable = (_: unknown, v: unknown) => v != null;

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
const MSG = { message: 'Tutar en fazla 2 ondalık basamaklı bir sayı olmalıdır.' };

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsNumber(MONEY, MSG)
  @Min(0)
  @Max(100_000)
  shippingFee?: number;

  @ValidateIf((_, v) => v != null)
  @IsNumber(MONEY, MSG)
  @Min(0)
  @Max(10_000_000)
  freeShippingThreshold?: number | null;

  @ValidateIf((_, v) => v != null)
  @IsNumber(MONEY, MSG)
  @Min(0)
  @Max(10_000_000)
  minOrderAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1440)
  paymentTimeoutMinutes?: number;

  // Yasal alt sınır 14 gün; mağaza daha uzun süre tanıyabilir
  @IsOptional()
  @IsInt()
  @Min(14, { message: 'Cayma süresi yasal olarak en az 14 gündür.' })
  @Max(365)
  returnWindowDays?: number;

  // ───── Satıcı bilgileri (yasal metinlerde kullanılır) ─────
  @ValidateIf(nullable)
  @IsString()
  @MaxLength(200)
  @Matches(SINGLE_LINE_REGEX)
  sellerName?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(500)
  sellerAddress?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9 +()-]*$/, { message: 'Telefon yalnızca rakam ve + ( ) - içerebilir.' })
  sellerPhone?: string | null;

  @ValidateIf(nullable)
  @IsEmail()
  @MaxLength(254)
  sellerEmail?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX)
  sellerTaxOffice?: string | null;

  @ValidateIf(nullable)
  @Matches(/^\d{10,11}$/, { message: 'Vergi no 10 (VKN) veya 11 (TCKN) haneli olmalı.' })
  sellerTaxNumber?: string | null;

  @ValidateIf(nullable)
  @Matches(/^\d{16}$/, { message: 'MERSİS no 16 haneli olmalı.' })
  sellerMersisNo?: string | null;
}
