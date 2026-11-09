import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { LegalDocumentType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { LEGAL_DEFAULTS } from './legal-defaults.js';

export const LEGAL_TYPES = ['PRE_INFORMATION', 'DISTANCE_SALES', 'KVKK_NOTICE'] as const satisfies readonly LegalDocumentType[];
export const PLACEHOLDERS = [
  'SATICI_UNVAN',
  'SATICI_ADRES',
  'SATICI_TELEFON',
  'SATICI_EPOSTA',
  'SATICI_VERGI_DAIRESI',
  'SATICI_VERGI_NO',
  'SATICI_MERSIS',
  'ALICI_AD',
  'ALICI_EPOSTA',
  'ALICI_TELEFON',
  'TESLIMAT_ADRESI',
  'FATURA_BILGILERI',
  'URUNLER',
  'ARA_TOPLAM',
  'INDIRIM',
  'KARGO',
  'TOPLAM',
  'KDV',
  'TARIH',
  'CAYMA_SURESI',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

/**
 * Şablonu doldurur. Çıktı DÜZ METİNDİR (HTML değil): mağaza metni
 * `white-space: pre-line` ile göstermeli, innerHTML ile değil.
 * Bilinmeyen yer tutucular olduğu gibi kalır.
 */
export function renderTemplate(template: string, values: Partial<Record<Placeholder, string>>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    key in values ? (values[key as Placeholder] ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') || '-' : match,
  );
}

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kayıtlı şablon; yoksa varsayılan (sürüm 0 = hiç düzenlenmemiş) */
  async get(type: LegalDocumentType) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { type } });
    return doc ?? { type, ...LEGAL_DEFAULTS[type], version: 0, updatedAt: null };
  }

  async all() {
    return Promise.all(LEGAL_TYPES.map((type) => this.get(type)));
  }

  /** Her kaydedişte sürüm artar (onay kayıtları sürümü tutar) */
  async save(type: LegalDocumentType, title: string, content: string) {
    return this.prisma.legalDocument.upsert({
      where: { type },
      create: { type, title, content, version: 1 },
      update: { title, content, version: { increment: 1 } },
    });
  }
}
