import { BadRequestException } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

/** ids dizisindeki sıra = yeni sıra */
export class ReorderIdsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids!: string[];
}

/** Menü gibi hiyerarşik listelerde: hangi üst öğenin altı sıralanıyor */
export class ReorderWithParentDto extends ReorderIdsDto {
  // Boş = en üst seviye
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

/**
 * Gönderilen liste, sıralanan grubun TAMAMI olmalı.
 * Başka gruptan bir id araya sokulamaz (IDOR), eksik liste kabul edilmez.
 */
export function assertSameIds(existingIds: string[], ids: string[]) {
  const existing = new Set(existingIds);

  if (ids.length !== existing.size || !ids.every((id) => existing.has(id))) {
    throw new BadRequestException(
      'Sıralama listesi güncel değil. Sayfayı yenileyip tekrar deneyin.',
    );
  }
}
