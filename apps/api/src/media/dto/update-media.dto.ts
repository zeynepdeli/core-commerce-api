import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateMediaDto {
  // null/boş = açıklamayı kaldır
  @ValidateIf((_, value: unknown) => value != null)
  @IsString()
  @MaxLength(200)
  alt!: string | null;
}
