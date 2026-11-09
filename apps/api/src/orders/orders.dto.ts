import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../common/validators.js';

export const ORDER_STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminOrdersQueryDto {
  // Sipariş no, e-posta veya ad
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX)
  q?: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(SINGLE_LINE_REGEX)
  shippingCarrier?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'Takip numarası yalnızca harf, rakam ve tire içerebilir.' })
  trackingNumber?: string;
}

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}
