import { IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

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
}
