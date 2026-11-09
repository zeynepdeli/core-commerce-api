import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { TR_PHONE_REGEX } from '../addresses/addresses.dto.js';
import { isValidTckn, isValidVkn } from '../common/tr-ids.js';
import { SINGLE_LINE_REGEX } from '../common/validators.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const phone = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value);
const ONE_LINE = { message: 'Bu alan tek satır olmalıdır.' };

@ValidatorConstraint({ name: 'tckn' })
class TcknRule implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidTckn(value);
  }
  defaultMessage() {
    return 'T.C. kimlik numarası geçersiz.';
  }
}

@ValidatorConstraint({ name: 'vkn' })
class VknRule implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidVkn(value);
  }
  defaultMessage(_args: ValidationArguments) {
    return 'Vergi numarası geçersiz.';
  }
}

export class CheckoutAddressDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Ad soyad en az 2 karakter olmalı.' })
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  fullName!: string;

  @Transform(phone)
  @IsString()
  @Matches(TR_PHONE_REGEX, { message: 'Geçerli bir telefon numarası girin.' })
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
  @Matches(/^\d{5}$/, { message: 'Posta kodu 5 haneli olmalı.' })
  zipCode?: string | null;
}

/**
 * Fatura bilgileri. Bireysel: ad soyad (+ isteğe bağlı TCKN).
 * Kurumsal: firma unvanı, vergi dairesi, VKN zorunlu.
 * sameAsShipping=false ise fatura adresi ayrıca girilir.
 */
export class BillingDto {
  @IsIn(['INDIVIDUAL', 'CORPORATE'])
  type!: 'INDIVIDUAL' | 'CORPORATE';

  @IsBoolean()
  sameAsShipping!: boolean;

  // Bireyselde boş bırakılırsa teslimat adresindeki ad soyad kullanılır
  @ValidateIf((o: BillingDto) => o.fullName != null && o.fullName !== '')
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  fullName?: string;

  @ValidateIf((o: BillingDto) => o.type === 'INDIVIDUAL' && o.identityNumber != null && o.identityNumber !== '')
  @Validate(TcknRule)
  identityNumber?: string;

  @ValidateIf((o: BillingDto) => o.type === 'CORPORATE')
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  companyName?: string;

  @ValidateIf((o: BillingDto) => o.type === 'CORPORATE')
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  taxOffice?: string;

  @ValidateIf((o: BillingDto) => o.type === 'CORPORATE')
  @Validate(VknRule)
  taxNumber?: string;

  @ValidateIf((o: BillingDto) => !o.sameAsShipping)
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  address?: CheckoutAddressDto;
}

export class CheckoutDto {
  /** Aynı form iki kez gönderilirse ikinci sipariş oluşmaz (çift tıklama, ağ tekrarı) */
  @IsUUID()
  idempotencyKey!: string;

  // Misafir için zorunlu; üye için hesap e-postası kullanılır
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  @MaxLength(254)
  email?: string;

  // Üye: adres defterinden seç (ya da shippingAddress gönder)
  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;

  @ValidateIf((o: CheckoutDto) => !o.shippingAddressId)
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;

  @ValidateNested()
  @Type(() => BillingDto)
  billing!: BillingDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // Yasal zorunluluk: iki metin de açıkça onaylanmalı (true)
  @Equals(true, { message: 'Ön Bilgilendirme Formu onaylanmalıdır.' })
  acceptPreInformation!: boolean;

  @Equals(true, { message: 'Mesafeli Satış Sözleşmesi onaylanmalıdır.' })
  acceptDistanceSales!: boolean;

  // Ticari ileti izni (İYS) — isteğe bağlı, varsayılan HAYIR
  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingSms?: boolean;
}

/** Önizleme: sözleşme metinlerini ve tutarı göstermek için (onay gerekmez) */
export class CheckoutPreviewDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingDto)
  billing?: BillingDto;
}

export class GuestOrderLookupDto {
  @Matches(/^\d{4}-[0-9A-Z]{8}$/, { message: 'Sipariş numarası geçersiz.' })
  orderNumber!: string;

  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Sipariş bulunamadı.' })
  accessToken!: string;
}
