import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  IsImageUrl,
  SINGLE_LINE_REGEX,
  SLUG_MESSAGE,
  SLUG_REGEX,
} from '../../common/validators.js';

const ONE_LINE = { message: 'Bu alan tek satır olmalıdır.' };
const nullable = (_: unknown, value: unknown) => value != null;

export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  @Matches(/\S/, { message: 'Kategori adı boş olamaz.' })
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  name!: string;

  @IsString()
  @MaxLength(150)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug!: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf(nullable)
  @IsImageUrl()
  image?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(150)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  metaTitle?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(300)
  metaDescription?: string | null;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/\S/, { message: 'Kategori adı boş olamaz.' })
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf(nullable)
  @IsImageUrl()
  image?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(150)
  @Matches(SINGLE_LINE_REGEX, ONE_LINE)
  metaTitle?: string | null;

  @ValidateIf(nullable)
  @IsString()
  @MaxLength(300)
  metaDescription?: string | null;
}
