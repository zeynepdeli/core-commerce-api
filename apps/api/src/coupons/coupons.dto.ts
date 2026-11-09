import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

import { COUPON_CODE_REGEX, normalizeCouponCode } from './coupon-code.js';

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
const MSG = { message: 'Tutar en fazla 2 ondalık basamaklı bir sayı olmalıdır.' };
const nullable = (_: unknown, v: unknown) => v != null;
const code = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeCouponCode(value) : value);

export const COUPON_TYPES = ['PERCENT', 'FIXED', 'FREE_SHIPPING'] as const;

class CouponFields {
  @IsOptional()
  @IsNumber(MONEY, MSG)
  @Min(0)
  @Max(1_000_000)
  value?: number;

  @ValidateIf(nullable)
  @IsNumber(MONEY, MSG)
  @Min(0.01)
  @Max(1_000_000)
  maxDiscount?: number | null;

  @ValidateIf(nullable)
  @IsNumber(MONEY, MSG)
  @Min(0)
  @Max(10_000_000)
  minSubtotal?: number | null;

  @ValidateIf(nullable)
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @ValidateIf(nullable)
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;

  @ValidateIf(nullable)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number | null;

  @ValidateIf(nullable)
  @IsInt()
  @Min(1)
  @Max(1000)
  perUserLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCouponDto extends CouponFields {
  @Transform(code)
  @IsString()
  @Matches(COUPON_CODE_REGEX, { message: 'Kupon kodu 3–32 karakter olmalı; yalnızca harf, rakam, - ve _ içerebilir.' })
  code!: string;

  @IsIn(COUPON_TYPES)
  type!: (typeof COUPON_TYPES)[number];
}

export class UpdateCouponDto extends CouponFields {}

export class ApplyCouponDto {
  @Transform(code)
  @IsString()
  @MaxLength(32)
  @Matches(COUPON_CODE_REGEX, { message: 'Kupon kodu geçersiz.' })
  code!: string;
}

export class ListCouponsQueryDto {
  @IsOptional()
  @Transform(code)
  @IsString()
  @MaxLength(32)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}
