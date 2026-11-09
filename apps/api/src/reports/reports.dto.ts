import { IsIn, IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class SalesReportQueryDto {
  /** Mağaza saat dilimine göre gün (YYYY-AA-GG), dahil */
  @IsOptional()
  @Matches(DATE, { message: 'Başlangıç tarihi YYYY-AA-GG olmalı.' })
  from?: string;

  @IsOptional()
  @Matches(DATE, { message: 'Bitiş tarihi YYYY-AA-GG olmalı.' })
  to?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}
