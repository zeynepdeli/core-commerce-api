import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { HEX_COLOR_MESSAGE, HEX_COLOR_REGEX, IsImageUrl, IsSafeLink, isImageUrl, SINGLE_LINE_REGEX, SLUG_MESSAGE, SLUG_REGEX } from '../common/validators.js';

import { MAX_HEADER_LABEL, MAX_HEADER_LINKS } from './header-links.js';
import type { SiteImageSlot } from './site-images.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const nullable = (_: unknown, v: unknown) => v != null && v !== '';
const ONE_LINE = { message: 'Tek satır olmalı.' };
// Çok satırlı metin: satır sonu serbest, diğer kontrol karakterleri yok
const MULTI_LINE = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

/** Mağazanın CSS'ine yazılacağı için serbest metin değil, izinli liste (CSS enjeksiyonu yok) */
export const FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Poppins',
  'Montserrat',
  'Nunito',
  'DM Sans',
  'Work Sans',
  'Manrope',
  'Playfair Display',
  'Lora',
  'Merriweather',
  'Cormorant Garamond',
  'Libre Baskerville',
  'Source Serif 4',
] as const;

/** Footer sosyal bağlantı ikonları (mağaza her biri için kendi ikonunu çizer). */
export const FOOTER_ICONS = ['instagram', 'facebook', 'x', 'youtube', 'tiktok', 'pinterest', 'whatsapp', 'telegram', 'web'] as const;
export type FooterIcon = (typeof FOOTER_ICONS)[number];

/**
 * Marka ikonu seçilen bağlantı o markanın alan adına gitmeli (ör. Instagram ikonu altında başka site olmaz).
 * "web" (genel ikon) için alan adı serbest, yalnızca https.
 */
export const FOOTER_ICON_HOSTS: Partial<Record<FooterIcon, readonly string[]>> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  x: ['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  pinterest: ['pinterest.com', 'tr.pinterest.com', 'www.pinterest.com'],
  whatsapp: ['wa.me', 'api.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com'],
  telegram: ['t.me', 'telegram.me'],
};

export const MAX_FOOTER_LINKS = 10;

/** Medya / https görseli veya mağazanın kendi statik dosyası (ör. /logo.png). "//" ve ".." yok */
const STATIC_ASSET = /^\/(?![/\\])(?!.*\.\.)[A-Za-z0-9_\-./]{1,200}\.(png|jpg|jpeg|webp|svg|ico)$/;
const IsBrandImage = () =>
  ValidateBy({
    name: 'isBrandImage',
    validator: {
      validate: (v: unknown) => isImageUrl(v) || (typeof v === 'string' && STATIC_ASSET.test(v)),
      defaultMessage: () => 'Görsel medya kütüphanesinden, https:// adresinden veya mağazanın /dosya.png biçimindeki statik dosyasından olmalıdır.',
    },
  });

class Line {
  static text(max: number) {
    return [Transform(trim), IsString(), MaxLength(max), Matches(SINGLE_LINE_REGEX, ONE_LINE)];
  }
}
const apply = (...decorators: PropertyDecorator[]) => (target: object, key: string | symbol) => decorators.forEach((d) => d(target, key));
const OptionalLine = (max: number) => apply(ValidateIf(nullable), ...Line.text(max));
const RequiredLine = (max: number) => apply(...Line.text(max), MinLength(1, { message: 'Boş bırakılamaz.' }));
const OptionalText = (max: number) => apply(ValidateIf(nullable), Transform(trim), IsString(), MaxLength(max), Matches(MULTI_LINE));

// ───────────── Görünüm ─────────────

export class HeaderLinkDto {
  @RequiredLine(MAX_HEADER_LABEL) label!: string;
  /** "/" ile başlayan site içi adres veya https:// adresi (javascript:, //kotu.site vb. reddedilir) */
  @Transform(trim) @IsSafeLink() href!: string;
}

/** Her alan isteğe bağlı: gönderilmeyen değişmez, null/"" varsayılana döndürür. Bilinmeyen ad reddedilir (forbidNonWhitelisted). */
export class SiteImagesDto implements Partial<Record<SiteImageSlot, string | null>> {
  @ValidateIf(nullable) @IsImageUrl() footerBackground?: string | null;
  @ValidateIf(nullable) @IsImageUrl() productBandBackground?: string | null;
  @ValidateIf(nullable) @IsImageUrl() productPlate?: string | null;
  @ValidateIf(nullable) @IsImageUrl() iconTexture?: string | null;
}

export class UpdateSiteDto {
  @IsOptional() @RequiredLine(80) siteName?: string;

  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: HEX_COLOR_MESSAGE }) primaryColor?: string;
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: HEX_COLOR_MESSAGE }) secondaryColor?: string;
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: HEX_COLOR_MESSAGE }) backgroundColor?: string;
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: HEX_COLOR_MESSAGE }) textColor?: string;

  @IsOptional() @IsIn(FONTS, { message: 'Yazı tipi listeden seçilmelidir.' }) fontHeading?: string;
  @IsOptional() @IsIn(FONTS, { message: 'Yazı tipi listeden seçilmelidir.' }) fontBody?: string;

  @IsOptional() @IsBrandImage() logoUrl?: string;
  @IsOptional() @IsBrandImage() faviconUrl?: string;
  @ValidateIf(nullable) @IsImageUrl() backgroundImageUrl?: string | null;
  @IsOptional() @IsIn(['cover', 'contain', 'repeat']) backgroundImageFit?: string;
  @ValidateIf(nullable) @IsImageUrl() cardTextureUrl?: string | null;
  @ValidateIf(nullable) @IsImageUrl() ogImageUrl?: string | null;

  /** Tasarım görselleri (footer zemini, ürün bandı zemini, ürün tabağı, ikon dokusu) */
  @IsOptional() @IsObject() @ValidateNested() @Type(() => SiteImagesDto) siteImages?: SiteImagesDto;

  @OptionalLine(160) announcementText?: string | null;
  @ValidateIf(nullable) @IsSafeLink() announcementLink?: string | null;

  /** Header menüsü (sıra = menüdeki sıra). Boş liste: mağaza kategorileri gösterir. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HEADER_LINKS, { message: `Menüye en fazla ${MAX_HEADER_LINKS} link eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => HeaderLinkDto)
  headerLinks?: HeaderLinkDto[];

  @OptionalLine(70) metaTitle?: string | null;
  @OptionalLine(160) metaDescription?: string | null;
}

// ───────────── Alt bilgi (footer) ─────────────

export class FooterLinkDto {
  @IsIn(FOOTER_ICONS, { message: 'İkon listeden seçilmelidir.' }) icon!: FooterIcon;
  /** Ekran okuyucunun okuyacağı ad (ör. "Instagram") */
  @RequiredLine(40) label!: string;
  /** Alan adı kuralı ikona göre ContentService'te denetlenir (normalizeFooterLink) */
  @Transform(trim) @IsString() @MaxLength(300) url!: string;
}

export class UpdateFooterDto {
  @OptionalText(300) description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FOOTER_LINKS, { message: `En fazla ${MAX_FOOTER_LINKS} sosyal medya bağlantısı eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => FooterLinkDto)
  socialLinks?: FooterLinkDto[];

  @IsOptional() @RequiredLine(40) pagesTitle?: string;
  @IsOptional() @RequiredLine(40) contactTitle?: string;

  @IsOptional() @IsBoolean() showCampaign?: boolean;
  @IsOptional() @RequiredLine(40) campaignTitle?: string;
  @OptionalText(200) campaignText?: string | null;
  @IsOptional() @RequiredLine(30) campaignButtonLabel?: string;
  @IsOptional() @IsSafeLink() campaignButtonLink?: string;

  @OptionalLine(160) copyrightText?: string | null;

  // İletişim: SiteTheme'de saklanır (İletişim sayfası ve e-postalar da kullanır), burada düzenlenir.
  @ValidateIf(nullable) @IsEmail({}, { message: 'Geçerli bir e-posta girin.' }) @MaxLength(254) contactEmail?: string | null;
  @ValidateIf(nullable) @Matches(/^[0-9 +()-]{7,20}$/, { message: 'Telefon yalnızca rakam ve + ( ) - içerebilir.' }) contactPhone?: string | null;
  @ValidateIf(nullable) @Matches(/^\+?[0-9]{10,15}$/, { message: 'WhatsApp numarası ülke koduyla, yalnızca rakam (ör. 905321234567).' }) contactWhatsapp?: string | null;
  @OptionalText(300) contactAddress?: string | null;
  @OptionalLine(120) workingHours?: string | null;

  /** Footer'da bağlantısı görünecek sayfalar; listede olmayanlar gizlenir */
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', { each: true }) footerPageIds?: string[];
}

// ───────────── Ana sayfa bölümleri ─────────────

export const BLOCK_TYPES = ['HERO', 'PRODUCT_LIST', 'CATEGORY_GRID', 'BANNER', 'TEXT', 'FEATURES'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const FEATURE_ICONS = ['truck', 'shield', 'gift', 'leaf', 'phone', 'refresh', 'star', 'clock', 'award', 'heart', 'credit-card', 'map-pin'] as const;

class BlockBase {
  @IsIn(BLOCK_TYPES) type!: BlockType;
  /** Planlı yayın (kampanya bannerı vb.) */
  @ValidateIf(nullable) @IsDateString() visibleFrom?: string | null;
  @ValidateIf(nullable) @IsDateString() visibleUntil?: string | null;
}

export class HeroSlideDto {
  @IsImageUrl() imageUrl!: string;
  @ValidateIf(nullable) @IsImageUrl() mobileImageUrl?: string | null;
  @OptionalLine(150) alt?: string | null;
  @OptionalLine(80) heading?: string | null;
  @OptionalText(200) text?: string | null;
  @OptionalLine(30) buttonLabel?: string | null;
  @ValidateIf(nullable) @IsSafeLink() buttonLink?: string | null;
}

/** Slayt süresi (saniye). Çok kısa okunamaz, çok uzun "donmuş" görünür. Verilmezse mağaza 5 sn kullanır. */
export const HERO_INTERVAL = { min: 3, max: 15, default: 5 } as const;

export class HeroBlockDto extends BlockBase {
  declare type: 'HERO';
  @IsArray() @ArrayMinSize(1, { message: 'En az bir slayt ekleyin.' }) @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => HeroSlideDto) slides!: HeroSlideDto[];
  @IsOptional() @IsBoolean() autoplay?: boolean;
  @IsOptional()
  @IsInt({ message: 'Slayt süresi tam sayı (saniye) olmalı.' })
  @Min(HERO_INTERVAL.min, { message: `Slayt süresi en az ${HERO_INTERVAL.min} saniye olmalı.` })
  @Max(HERO_INTERVAL.max, { message: `Slayt süresi en fazla ${HERO_INTERVAL.max} saniye olabilir.` })
  intervalSeconds?: number;
}

export class ProductListBlockDto extends BlockBase {
  declare type: 'PRODUCT_LIST';
  @OptionalLine(80) title?: string | null;
  @OptionalLine(200) subtitle?: string | null;
  @IsIn(['featured', 'new', 'bestsellers', 'rating', 'category', 'manual']) source!: 'featured' | 'new' | 'bestsellers' | 'rating' | 'category' | 'manual';
  @ValidateIf((o: ProductListBlockDto) => o.source === 'category') @IsUUID('all', { message: 'Kategori seçin.' }) categoryId?: string;
  @ValidateIf((o: ProductListBlockDto) => o.source === 'manual')
  @IsArray()
  @ArrayMinSize(1, { message: 'En az bir ürün seçin.' })
  @ArrayMaxSize(24)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds?: string[];
  @IsInt() @Min(1) @Max(24) limit!: number;
  @OptionalLine(30) buttonLabel?: string | null;
  @ValidateIf(nullable) @IsSafeLink() buttonLink?: string | null;
}

export class CategoryGridBlockDto extends BlockBase {
  declare type: 'CATEGORY_GRID';
  @OptionalLine(80) title?: string | null;
  /** Boş = tüm aktif kategoriler (sırasıyla, en fazla 12) */
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ArrayUnique() @IsUUID('all', { each: true }) categoryIds?: string[];
}

export class BannerBlockDto extends BlockBase {
  declare type: 'BANNER';
  @IsImageUrl() imageUrl!: string;
  @ValidateIf(nullable) @IsImageUrl() mobileImageUrl?: string | null;
  @OptionalLine(150) alt?: string | null;
  @OptionalLine(80) heading?: string | null;
  @OptionalText(200) text?: string | null;
  @OptionalLine(30) buttonLabel?: string | null;
  @ValidateIf(nullable) @IsSafeLink() link?: string | null;
}

export class TextBlockDto extends BlockBase {
  declare type: 'TEXT';
  @OptionalLine(80) title?: string | null;
  /** Markdown (mağaza HTML'e izin vermeden işler) */
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(10_000) @Matches(MULTI_LINE) body!: string;
}

export class FeatureItemDto {
  @IsIn(FEATURE_ICONS) icon!: (typeof FEATURE_ICONS)[number];
  @RequiredLine(40) title!: string;
  @OptionalLine(120) text?: string | null;
}

export class FeaturesBlockDto extends BlockBase {
  declare type: 'FEATURES';
  @OptionalLine(80) title?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => FeatureItemDto) items!: FeatureItemDto[];
}

export type BlockData = HeroBlockDto | ProductListBlockDto | CategoryGridBlockDto | BannerBlockDto | TextBlockDto | FeaturesBlockDto;

export class SaveBlockDto {
  /** Bölüm anahtarı (kalıcı, ör. "ana-slider"); boşsa üretilir */
  @IsOptional() @Matches(SLUG_REGEX, { message: SLUG_MESSAGE }) @MaxLength(60) key?: string;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @ValidateNested()
  @Type(() => BlockBase, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'type',
      subTypes: [
        { value: HeroBlockDto, name: 'HERO' },
        { value: ProductListBlockDto, name: 'PRODUCT_LIST' },
        { value: CategoryGridBlockDto, name: 'CATEGORY_GRID' },
        { value: BannerBlockDto, name: 'BANNER' },
        { value: TextBlockDto, name: 'TEXT' },
        { value: FeaturesBlockDto, name: 'FEATURES' },
      ],
    },
  })
  data!: BlockData;
}

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

// ───────────── Sayfalar ─────────────

export class SavePageDto {
  @RequiredLine(120) title!: string;
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE }) @MaxLength(80) slug!: string;
  /** Markdown */
  @Transform(trim) @IsString() @MinLength(1, { message: 'İçerik boş olamaz.' }) @MaxLength(50_000) @Matches(MULTI_LINE) body!: string;
  @OptionalLine(70) metaTitle?: string | null;
  @OptionalLine(160) metaDescription?: string | null;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsBoolean() showInFooter?: boolean;
}

// ───────────── S.S.S. ─────────────

export class SaveFaqDto {
  @RequiredLine(300) question!: string;
  @Transform(trim) @IsString() @MinLength(1, { message: 'Cevap boş olamaz.' }) @MaxLength(5000) @Matches(MULTI_LINE) answer!: string;
  @OptionalLine(60) category?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
