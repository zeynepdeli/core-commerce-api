import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SINGLE_LINE_REGEX, SLUG_REGEX } from '../../common/validators.js';

export const PRODUCT_SORTS = ['new', 'price-asc', 'price-desc', 'name'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Ziyaretçi ürün listesi: /shop/products?category=peynir&q=tulum&sort=price-asc&page=2 */
export class PublicProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(SLUG_REGEX)
  category?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX)
  q?: string;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  @IsOptional()
  @IsIn(['true'])
  featured?: 'true';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  // Kaynak tüketimini sınırla (OWASP API4)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}

/** Admin ürün listesi */
export class AdminProductQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX)
  q?: string;

  @IsOptional()
  @IsUUID()
  category?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'low-stock'])
  status?: 'active' | 'inactive' | 'low-stock';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
