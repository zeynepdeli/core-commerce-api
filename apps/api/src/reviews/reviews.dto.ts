import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../common/validators.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Kontrol karakterleri (satır sonu hariç) yok
const TEXT = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

export class ReviewBodyDto {
  @IsInt({ message: 'Puan 1–5 arası olmalı.' })
  @Min(1, { message: 'Puan 1–5 arası olmalı.' })
  @Max(5, { message: 'Puan 1–5 arası olmalı.' })
  rating!: number;

  @ValidateIf((_, v) => v != null && v !== '')
  @Transform(trim)
  @IsString()
  @MaxLength(120, { message: 'Başlık en fazla 120 karakter olabilir.' })
  @Matches(SINGLE_LINE_REGEX, { message: 'Başlık tek satır olmalı.' })
  title?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Yorum en az 10 karakter olmalı.' })
  @MaxLength(2000, { message: 'Yorum en fazla 2000 karakter olabilir.' })
  @Matches(TEXT, { message: 'Yorum geçersiz karakter içeriyor.' })
  comment!: string;
}

export class CreateReviewDto extends ReviewBodyDto {
  @IsUUID('all', { message: 'Ürün geçersiz.' })
  productId!: string;
}

export class PublicReviewsQueryDto {
  @IsOptional()
  @IsIn(['new', 'rating-high', 'rating-low'])
  sort?: 'new' | 'rating-high' | 'rating-low';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class AdminReviewsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @Transform(trim)
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

export class ModerateReviewDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @Matches(TEXT)
  rejectReason?: string;
}

export class ReplyReviewDto {
  /** Boş: yanıtı kaldır */
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  @Matches(TEXT)
  reply!: string;
}
