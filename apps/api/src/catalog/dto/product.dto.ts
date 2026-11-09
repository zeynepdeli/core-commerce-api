import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  IsImageUrl,
  SINGLE_LINE_REGEX,
  SLUG_MESSAGE,
  SLUG_REGEX,
} from '../../common/validators.js';

const ONE_LINE = { message: 'Bu alan tek satır olmalıdır.' };
const nullable = (_: unknown, value: unknown) => value != null;

export const MAX_PRODUCT_IMAGES = 12;
export const MAX_PRODUCT_TABS = 10;
// Decimal(10,2) üst sınırı 99.999.999,99
export const MAX_PRICE = 10_000_000;

const PRICE = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
const PRICE_MESSAGE = { message: 'Fiyat en fazla 2 ondalık basamaklı bir sayı olmalıdır.' };

export class ProductImageDto {
  @IsImageUrl()
  url!: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(200)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  alt?: string | null;
}

export class ProductTabDto {
  @IsString()
  @MaxLength(80)
  @Matches(/\S/, { message: 'Sekme başlığı boş olamaz.' })
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  title!: string;

  @IsString()
  @MaxLength(10000)
  @Matches(/\S/, { message: 'Sekme içeriği boş olamaz.' })
  body!: string;
}

/**
 * Ürün oluşturma. Güncellemede aynı alanlar isteğe bağlıdır (UpdateProductDto).
 * images/tabs gönderilirse ürünün mevcut görsel/sekme listesinin YERİNE geçer.
 */
export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, { message: 'Ürün adı boş olamaz.' })
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  name!: string;

  @IsString()
  @MaxLength(150)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug!: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'Stok kodu yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.' })
  sku?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @IsNumber(PRICE, PRICE_MESSAGE)
  @Min(0)
  @Max(MAX_PRICE)
  price!: number;

  @ValidateIf(nullable)
  @IsNumber(PRICE, PRICE_MESSAGE)
  @Min(0)
  @Max(MAX_PRICE)
  compareAtPrice?: number | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(40)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsUUID('all', { message: 'Kategori seçin.' })
  categoryId!: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(150)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  metaTitle?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(300)
  metaDescription?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES, { message: `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_TABS, { message: `En fazla ${MAX_PRODUCT_TABS} sekme eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => ProductTabDto)
  tabs?: ProductTabDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, { message: 'Ürün adı boş olamaz.' })
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'Stok kodu yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.' })
  sku?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @IsOptional()
  @IsNumber(PRICE, PRICE_MESSAGE)
  @Min(0)
  @Max(MAX_PRICE)
  price?: number;

  @ValidateIf(nullable)
  @IsNumber(PRICE, PRICE_MESSAGE)
  @Min(0)
  @Max(MAX_PRICE)
  compareAtPrice?: number | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(40)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsUUID('all', { message: 'Kategori seçin.' })
  categoryId?: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(150)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  metaTitle?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(300)
  metaDescription?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES, { message: `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_TABS, { message: `En fazla ${MAX_PRODUCT_TABS} sekme eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => ProductTabDto)
  tabs?: ProductTabDto[];
}
