import { Body, Controller, Get, Param, ParseEnumPipe, Put, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SINGLE_LINE_REGEX } from '../common/validators.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

import { LEGAL_TYPES, LegalService, PLACEHOLDERS, publicSeller, renderTemplate } from './legal.service.js';

class SaveLegalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Matches(SINGLE_LINE_REGEX)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(60_000)
  content!: string;
}

const TYPE = new ParseEnumPipe(Object.fromEntries(LEGAL_TYPES.map((t) => [t, t])));
/** Herkese açık sayfada alıcıya/siparişe özel alanlar ham "{{ALICI_AD}}" olarak görünmesin */
const ORDER_PLACEHOLDERS = Object.fromEntries(
  PLACEHOLDERS.filter((p) => !p.startsWith('SATICI_') && p !== 'CAYMA_SURESI').map((p) => [p, '(sipariş sırasında doldurulur)']),
);
/** Mağaza alt bilgisindeki sıra */
const FOOTER_ORDER = ['KVKK_NOTICE', 'COOKIE_POLICY', 'DISTANCE_SALES', 'PRE_INFORMATION'] as const satisfies readonly (typeof LEGAL_TYPES)[number][];

/** Mağaza: KVKK aydınlatma metni gibi genel metinler (satıcı bilgileri doldurulmuş) */
@Controller('shop/legal')
export class PublicLegalController {
  constructor(
    private readonly legal: LegalService,
    private readonly settings: StoreSettingsService,
  ) {}

  /** Alt bilgi: yasal metin başlıkları + mevzuat gereği sitede gösterilecek satıcı bilgileri */
  @Get()
  async index() {
    const [docs, s] = await Promise.all([this.legal.all(), this.settings.seller()]);
    const titles = new Map(docs.map((d) => [d.type, d.title]));
    return {
      seller: publicSeller(s),
      documents: FOOTER_ORDER.map((type) => ({ type, title: titles.get(type) ?? type })),
    };
  }

  @Get(':type')
  async get(@Param('type', TYPE) type: (typeof LEGAL_TYPES)[number]) {
    const [doc, s] = await Promise.all([this.legal.get(type), this.settings.seller()]);
    return {
      type,
      title: doc.title,
      version: doc.version,
      content: renderTemplate(doc.content, {
        ...ORDER_PLACEHOLDERS,
        SATICI_UNVAN: s.sellerName ?? '',
        SATICI_ADRES: s.sellerAddress ?? '',
        SATICI_TELEFON: s.sellerPhone ?? '',
        SATICI_EPOSTA: s.sellerEmail ?? '',
        SATICI_VERGI_DAIRESI: s.sellerTaxOffice ?? '',
        SATICI_VERGI_NO: s.sellerTaxNumber ?? '',
        SATICI_MERSIS: s.sellerMersisNo ?? '',
        SATICI_KEP: s.sellerKepAddress ?? '',
        CAYMA_SURESI: String(s.returnWindowDays),
      }),
    };
  }
}

@Controller('admin/legal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminLegalController {
  constructor(private readonly legal: LegalService) {}

  @Get()
  async list() {
    return { documents: await this.legal.all(), placeholders: PLACEHOLDERS };
  }

  @Put(':type')
  save(@Param('type', TYPE) type: (typeof LEGAL_TYPES)[number], @Body() dto: SaveLegalDto) {
    return this.legal.save(type, dto.title.trim(), dto.content);
  }
}
