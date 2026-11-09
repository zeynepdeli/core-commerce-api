import { IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 50;

export class SetCartItemDto {
  @IsUUID()
  variantId!: string;

  // 0 = satırı kaldır
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class MergeCartDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Geçersiz sepet.' })
  cartToken!: string;
}
