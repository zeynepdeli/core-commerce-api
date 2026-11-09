import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../common/validators.js';

export const ROLES = ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'] as const;

export class ListUsersQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE_REGEX)
  q?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @IsOptional()
  @IsIn(['active', 'inactive', 'locked', 'deleted'])
  status?: 'active' | 'inactive' | 'locked' | 'deleted';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class SetRoleDto {
  @IsIn(ROLES)
  role!: (typeof ROLES)[number];
}
