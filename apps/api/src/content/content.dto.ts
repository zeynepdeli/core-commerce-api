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
  IsNumber,
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

import { HEX_COLOR_MESSAGE, HEX_COLOR_REGEX, IsImageUrl, IsSafeLink, IsVideoUrl, isImageUrl, SINGLE_LINE_REGEX, SLUG_MESSAGE, SLUG_REGEX } from '../common/validators.js';

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
  @ValidateIf(nullable) @IsImageUrl() productPageBackground?: string | null;
  @ValidateIf(nullable) @IsImageUrl() productDecorOne?: string | null;
  @ValidateIf(nullable) @IsImageUrl() productDecorTwo?: string | null;
}

/** İletişim sayfası (Footer'daki adres/telefon/e-posta dışında kalan sayfa ayarları) */
export class ContactPageDto {
  @IsOptional() @RequiredLine(60) title?: string;
  @IsOptional() @RequiredLine(60) infoSmallTitle?: string;
  @IsOptional() @RequiredLine(60) infoTitle?: string;
  @IsOptional() @RequiredLine(40) mapTitle?: string;
  @IsOptional() @RequiredLine(40) mapSubtitle?: string;
  @ValidateIf(nullable) @IsImageUrl() mapImage?: string | null;
  /** "Konumu Gör" bağlantısı (ör. Google Haritalar); boşsa adresten oluşturulur */
  @ValidateIf(nullable) @IsSafeLink() mapLink?: string | null;
}

export class FaqPageDto {
  @IsOptional() @RequiredLine(80) title?: string;
  @IsOptional() @RequiredLine(200) subtitle?: string;
  @IsOptional() @RequiredLine(60) contactTitle?: string;
  @IsOptional() @RequiredLine(30) buttonText?: string;
  @IsOptional() @IsSafeLink() buttonLink?: string;
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

  // Header: teslimat kutusu ve metinler
  @IsOptional() @IsBoolean() showDelivery?: boolean;
  @IsOptional() @RequiredLine(30) deliveryTitle?: string;
  @IsOptional() @RequiredLine(40) deliveryText?: string;
  @IsOptional() @IsSafeLink() deliveryLink?: string;
  @ValidateIf(nullable) @IsImageUrl() deliveryIconUrl?: string | null;
  @IsOptional() @RequiredLine(40) searchPlaceholder?: string;
  @IsOptional() @RequiredLine(16) loginText?: string;
  @IsOptional() @RequiredLine(16) accountText?: string;
  @IsOptional() @RequiredLine(16) cartText?: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => ContactPageDto) contactPage?: ContactPageDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => FaqPageDto) faqPage?: FaqPageDto;

  // Ürün detay sayfası yazıları
  @IsOptional() @RequiredLine(24) productLabelText?: string;
  @IsOptional() @RequiredLine(24) addToCartText?: string;
  @IsOptional() @RequiredLine(24) buyNowText?: string;
  @IsOptional() @RequiredLine(24) quantityText?: string;

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

// ───────────── Hakkımızda ─────────────

/** Hakkımızda sayfası (eski enfesGurme düzeni). Gönderilmeyen alan değişmez; boş görsel = mağaza varsayılanı. */
export class UpdateAboutDto {
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: HEX_COLOR_MESSAGE }) backgroundColor?: string;

  @ValidateIf(nullable) @IsImageUrl() cardImage?: string | null;
  @ValidateIf(nullable) @IsImageUrl() textureImage?: string | null;
  @ValidateIf(nullable) @IsImageUrl() sketchImage1?: string | null;
  @ValidateIf(nullable) @IsImageUrl() sketchImage2?: string | null;
  @ValidateIf(nullable) @IsImageUrl() sketchImage3?: string | null;
  @ValidateIf(nullable) @IsImageUrl() sketchImage4?: string | null;

  @IsOptional() @RequiredLine(60) visionTitle?: string;
  @OptionalText(600) visionText?: string | null;
  @ValidateIf(nullable) @IsImageUrl() visionImage?: string | null;
  @ValidateIf(nullable) @IsImageUrl() visionMiniImage?: string | null;

  @IsOptional() @RequiredLine(60) missionHeading?: string;
  @OptionalText(120) missionTitle?: string | null;
  @OptionalText(600) missionText?: string | null;
  @ValidateIf(nullable) @IsImageUrl() missionImage?: string | null;

  @IsOptional() @RequiredLine(60) storyHeading?: string;
  @OptionalText(120) storyTitle?: string | null;
  @OptionalText(600) storyText?: string | null;
  @ValidateIf(nullable) @IsImageUrl() storyImage?: string | null;
  @ValidateIf(nullable) @IsImageUrl() miniImage1?: string | null;
  @ValidateIf(nullable) @IsImageUrl() miniImage2?: string | null;
  @ValidateIf(nullable) @IsImageUrl() miniImage3?: string | null;

  @IsOptional() @RequiredLine(60) valuesHeading?: string;
  @OptionalText(120) valuesTitle?: string | null;
  @OptionalText(600) valuesText?: string | null;
  @ValidateIf(nullable) @IsImageUrl() valuesImage?: string | null;

  @OptionalLine(70) metaTitle?: string | null;
  @OptionalLine(160) metaDescription?: string | null;
}

// ───────────── Ana sayfa bölümleri ─────────────

export const BLOCK_TYPES = ['HERO', 'PRODUCT_LIST', 'CATEGORY_GRID', 'BANNER', 'TEXT', 'FEATURES', 'REVIEWS'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const FEATURE_ICONS = ['truck', 'shield', 'gift', 'leaf', 'phone', 'refresh', 'star', 'clock', 'award', 'heart', 'credit-card', 'map-pin', 'package'] as const;
/** Avantaj kartı sayısı (eski enfesGurme'de bilgisayarda 4'lü sıra) */
export const MAX_FEATURE_ITEMS = 8;

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
  /** Başlığın üstündeki küçük yazı (eski sitede "Anadolu'nun En Özel Lezzetleri"); boşsa mağaza varsayılanı */
  @OptionalLine(60) eyebrow?: string | null;
  @IsOptional()
  @IsInt({ message: 'Slayt süresi tam sayı (saniye) olmalı.' })
  @Min(HERO_INTERVAL.min, { message: `Slayt süresi en az ${HERO_INTERVAL.min} saniye olmalı.` })
  @Max(HERO_INTERVAL.max, { message: `Slayt süresi en fazla ${HERO_INTERVAL.max} saniye olabilir.` })
  intervalSeconds?: number;
}

export const PRODUCT_LIST_DISPLAYS = ['band', 'hero'] as const;
export const PRODUCT_LIST_SOURCES = ['featured', 'new', 'bestsellers', 'rating', 'category', 'manual', 'custom'] as const;
export type ProductListSource = (typeof PRODUCT_LIST_SOURCES)[number];
export const MAX_CUSTOM_CARDS = 12;

/** "149", "149.9", "149,90" → "149.90" (Türkçe virgül kabul). En fazla 9.999.999,99 */
const PRICE_REGEX = /^\d{1,7}(\.\d{1,2})?$/;
const toPrice = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(',', '.') : value);

/**
 * Elle girilen kart (eski enfesGurme'deki "featured / bestseller cards"): ürünle bağı yok,
 * yazılanı gösterir. Fiyat isteğe bağlı; bağlantı yoksa kart tıklanmaz.
 */
export class CustomCardDto {
  @RequiredLine(80) name!: string;
  @IsImageUrl() imageUrl!: string;
  @Transform(toPrice) @ValidateIf(nullable) @Matches(PRICE_REGEX, { message: 'Fiyat sayı olmalı (ör. 149,90).' }) price?: string | null;
  @Transform(toPrice) @ValidateIf(nullable) @Matches(PRICE_REGEX, { message: 'Eski fiyat sayı olmalı (ör. 189,90).' }) compareAtPrice?: string | null;
  @ValidateIf(nullable) @IsSafeLink() link?: string | null;
  @IsOptional() @IsBoolean() soldOut?: boolean;
}
export type ProductListDisplay = (typeof PRODUCT_LIST_DISPLAYS)[number];

export class ProductListBlockDto extends BlockBase {
  declare type: 'PRODUCT_LIST';
  @OptionalLine(80) title?: string | null;
  @OptionalLine(200) subtitle?: string | null;
  @IsIn(PRODUCT_LIST_SOURCES) source!: ProductListSource;
  @ValidateIf((o: ProductListBlockDto) => o.source === 'category') @IsUUID('all', { message: 'Kategori seçin.' }) categoryId?: string;
  @ValidateIf((o: ProductListBlockDto) => o.source === 'manual')
  @IsArray()
  @ArrayMinSize(1, { message: 'En az bir ürün seçin.' })
  @ArrayMaxSize(24)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds?: string[];
  /** Elle girilen kartlarda kullanılmaz (kart sayısı = girilen kart sayısı) */
  @ValidateIf((o: ProductListBlockDto) => o.source !== 'custom') @IsInt() @Min(1) @Max(24) limit!: number;
  @ValidateIf((o: ProductListBlockDto) => o.source === 'custom')
  @IsArray()
  @ArrayMinSize(1, { message: 'En az bir kart ekleyin.' })
  @ArrayMaxSize(MAX_CUSTOM_CARDS, { message: `En fazla ${MAX_CUSTOM_CARDS} kart eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => CustomCardDto)
  cards?: CustomCardDto[];
  @OptionalLine(30) buttonLabel?: string | null;
  @ValidateIf(nullable) @IsSafeLink() buttonLink?: string | null;
  /**
   * Görünüm: "band" = ürün bandı (tabaklı kartlar, eski "En Çok Satanlar");
   * "hero" = slider'ın içinde kartlar (eski "Günün Öne Çıkanları"; slider'ın hemen altındaysa).
   * Verilmezse mağaza: slider'ın hemen altındaki "öne çıkanlar" listesi → hero, diğerleri → band.
   */
  @IsOptional() @IsIn(PRODUCT_LIST_DISPLAYS, { message: 'Görünüm listeden seçilmelidir.' }) display?: ProductListDisplay;
  /** Her kartın üzerindeki hap yazısı (eski sitede "Sepete Ekle" / "KEŞFET"); boşsa mağaza varsayılanı */
  @OptionalLine(20) cardButtonLabel?: string | null;
}

/**
 * Kategoriler bölümünde videonun yeri: arka plan görseli bölüme %100 x %100 gerildiği için
 * değerler bölümün yüzdesi. Kemer: üst köşeler yatayda %50, dikeyde "curve" (videonun yüksekliğinin %'si).
 */
export class VideoBoxDto {
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(90) left!: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(90) top!: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(5) @Max(100) width!: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(5) @Max(100) height!: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(50) curve!: number;
}

/**
 * Kategoriler bölümü (eski enfesGurme: solda kemerli kapı içinde video, sağda kategori kartları).
 * Boş bırakılan yazı / görsel / video alanlarında mağaza kendi varsayılanını kullanır.
 */
export class CategoryGridBlockDto extends BlockBase {
  declare type: 'CATEGORY_GRID';
  /** Başlığın üstündeki küçük yazı ("Keşfetmeye Devam Edin") */
  @OptionalLine(60) eyebrow?: string | null;
  @OptionalLine(80) title?: string | null;
  @OptionalText(300) description?: string | null;
  /** Kartlardaki yazı ("İncele") */
  @OptionalLine(20) buttonLabel?: string | null;
  /** Kemer içindeki video: https .mp4/.webm */
  @ValidateIf(nullable) @IsVideoUrl() videoUrl?: string | null;
  @ValidateIf(nullable) @IsImageUrl() desktopBackground?: string | null;
  @ValidateIf(nullable) @IsImageUrl() mobileBackground?: string | null;
  /** Videonun masaüstü arka plandaki kapıya göre yeri (bölümün yüzdesi); yoksa varsayılan kapıya göre */
  @IsOptional() @IsObject() @ValidateNested() @Type(() => VideoBoxDto) videoBox?: VideoBoxDto;
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

/** Avantajlar ("Antep'in Bereketi"): solda başlık + açıklama, sağda numaralı simge kartları */
export class FeaturesBlockDto extends BlockBase {
  declare type: 'FEATURES';
  @OptionalLine(80) title?: string | null;
  @OptionalText(300) description?: string | null;
  /** Bölüm arka planı ve kart dokusu; boşsa mağazanın varsayılanı */
  @ValidateIf(nullable) @IsImageUrl() backgroundImage?: string | null;
  @ValidateIf(nullable) @IsImageUrl() cardTexture?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_FEATURE_ITEMS) @ValidateNested({ each: true }) @Type(() => FeatureItemDto) items!: FeatureItemDto[];
}

export const MAX_REVIEW_CARDS = 12;

/** Elle girilen yorum zorunlu; ama sitedeki onaylı yorumlar gösteriliyorsa elle yorum olmadan da olur */
function CardsUnlessApproved() {
  return ValidateBy({
    name: 'cardsUnlessApproved',
    validator: {
      validate: (value: unknown, args) => (args?.object as { includeApproved?: boolean }).includeApproved === true || (Array.isArray(value) && value.length > 0),
      defaultMessage: () => 'En az bir yorum ekleyin ya da sitedeki onaylı müşteri yorumlarını gösterin.',
    },
  });
}

/** Ana sayfadaki müşteri yorumu kartı (eski enfesGurme "reviews-section" kartları) */
export class ReviewCardDto {
  @RequiredLine(60) name!: string;
  @IsInt({ message: 'Puan 1–5 arası tam sayı olmalı.' }) @Min(1) @Max(5) rating!: number;
  @Transform(trim) @IsString() @MinLength(1, { message: 'Yorum boş bırakılamaz.' }) @MaxLength(300) @Matches(MULTI_LINE) comment!: string;
  /** Kartın arka planındaki ürün fotoğrafı */
  @IsImageUrl() productImage!: string;
  /** Müşterinin fotoğrafı; yoksa baş harfler gösterilir */
  @ValidateIf(nullable) @IsImageUrl() userImage?: string | null;
}

export class ReviewsBlockDto extends BlockBase {
  declare type: 'REVIEWS';
  @OptionalLine(80) title?: string | null;
  @OptionalText(300) description?: string | null;
  @IsArray()
  @CardsUnlessApproved()
  @ArrayMaxSize(MAX_REVIEW_CARDS, { message: `En fazla ${MAX_REVIEW_CARDS} yorum eklenebilir.` })
  @ValidateNested({ each: true })
  @Type(() => ReviewCardDto)
  cards!: ReviewCardDto[];
  /** Sitedeki onaylı ürün yorumlarından 4–5 yıldızlı olanları da göster (elle girilenlerden sonra) */
  @IsOptional() @IsBoolean() includeApproved?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_REVIEW_CARDS) approvedLimit?: number;
  @ValidateIf(nullable) @IsImageUrl() backgroundImage?: string | null;
  /** Kartın altındaki çerçeve görseli (varsayılan: haki çerçeve) */
  @ValidateIf(nullable) @IsImageUrl() frameImage?: string | null;
}

export type BlockData = HeroBlockDto | ProductListBlockDto | CategoryGridBlockDto | BannerBlockDto | TextBlockDto | FeaturesBlockDto | ReviewsBlockDto;

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
        { value: ReviewsBlockDto, name: 'REVIEWS' },
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
