import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../common/validators.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ONE_LINE = { message: 'Bu alan tek satır olmalıdır.' };
/** Telefonu rakamlara indirger: "0 (532) 123 45 67" → "05321234567" */
const phone = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value);

/** Türkiye telefon numarası: 05xx…, 5xx…, +905xx… veya sabit hat (0212…) */
export const TR_PHONE_REGEX = /^(\+90|0)?[2-5]\d{9}$/;

export class AddressFields {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Ad soyad en az 2 karakter olmalı.' })
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  fullName!: string;

  @Transform(phone)
  @IsString()
  @Matches(TR_PHONE_REGEX, { message: 'Geçerli bir telefon numarası girin (ör. 0532 123 45 67).' })
  phone!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  city!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  district!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Açık adres en az 5 karakter olmalı.' })
  @MaxLength(300)
  addressLine!: string;

  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @Matches(/^\d{5}$/, { message: 'Posta kodu 5 haneli olmalı.' })
  zipCode?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateAddressDto extends AddressFields {}
