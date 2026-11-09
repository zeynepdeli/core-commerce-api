import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../common/validators.js';
import { ReturnReason, ReturnStatus } from '../generated/prisma/enums.js';

export const RETURN_REASONS = Object.values(ReturnReason);

export class ReturnItemDto {
  @IsUUID('all', { message: 'Ürün seçimi geçersiz.' })
  orderItemId!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'İade edilecek en az bir ürün seçin.' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @IsIn(RETURN_REASONS, { message: 'İade nedeni seçin.' })
  reason!: ReturnReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** Misafir: sipariş no + erişim anahtarı ile */
export class GuestCreateReturnDto extends CreateReturnDto {
  @Matches(/^\d{4}-[0-9A-Z]{8}$/, { message: 'Sipariş numarası geçersiz.' })
  orderNumber!: string;

  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Sipariş bulunamadı.' })
  accessToken!: string;
}

export class GuestReturnAuthDto {
  @Matches(/^\d{4}-[0-9A-Z]{8}$/, { message: 'Sipariş numarası geçersiz.' })
  orderNumber!: string;

  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Sipariş bulunamadı.' })
  accessToken!: string;
}

export class AdminReturnsQueryDto {
  @IsOptional()
  @IsIn(Object.values(ReturnStatus))
  status?: ReturnStatus;

  // İade no, sipariş no veya e-posta
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

export class ReturnDecisionDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  /** Onayda: iade adresi/kargo kodu talimatı; retde: gerekçe (zorunlu) */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReturnReceiveDto {
  /** Ürün satılabilir durumdaysa stoğa geri eklenir */
  @IsBoolean()
  restock!: boolean;
}

export class ReturnRefundDto {
  /** true: ödeme havale vb. ile alındı, iade elle yapıldı (iyzico'ya istek atılmaz) */
  @IsOptional()
  @IsBoolean()
  manual?: boolean;
}
