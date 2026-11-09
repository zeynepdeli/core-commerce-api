import type { LegalDocumentType } from '../generated/prisma/client.js';

/**
 * Varsayılan şablonlar — MAĞAZA SAHİBİ HUKUKÇUSUYLA GÖZDEN GEÇİRMELİDİR.
 * {{YER_TUTUCU}} alanları sipariş anında doldurulur ve doldurulmuş hali
 * siparişe kanıt olarak kaydedilir.
 */
export const LEGAL_DEFAULTS: Record<LegalDocumentType, { title: string; content: string }> = {
  PRE_INFORMATION: {
    title: 'Ön Bilgilendirme Formu',
    content: `ÖN BİLGİLENDİRME FORMU

1. SATICI
Unvan: {{SATICI_UNVAN}}
Adres: {{SATICI_ADRES}}
Telefon: {{SATICI_TELEFON}} · E-posta: {{SATICI_EPOSTA}}
Vergi Dairesi / No: {{SATICI_VERGI_DAIRESI}} / {{SATICI_VERGI_NO}} · MERSİS: {{SATICI_MERSIS}}

2. ALICI
Ad Soyad: {{ALICI_AD}}
E-posta: {{ALICI_EPOSTA}} · Telefon: {{ALICI_TELEFON}}
Teslimat adresi: {{TESLIMAT_ADRESI}}
Fatura bilgileri: {{FATURA_BILGILERI}}

3. SÖZLEŞME KONUSU ÜRÜNLER (fiyatlar KDV dahil)
{{URUNLER}}

Ara toplam: {{ARA_TOPLAM}}
İndirim: {{INDIRIM}}
Kargo: {{KARGO}}
Toplam (KDV dahil): {{TOPLAM}} (içindeki KDV: {{KDV}})

4. TESLİMAT
Ürünler, ödemenin onaylanmasından itibaren en geç 30 gün içinde yukarıdaki adrese teslim edilir.

5. CAYMA HAKKI
Alıcı, ürünü teslim aldığı tarihten itibaren {{CAYMA_SURESI}} gün içinde herhangi bir gerekçe göstermeksizin cayma hakkına sahiptir. Çabuk bozulabilen veya son kullanma tarihi geçebilecek ürünlerde ve ambalajı açılmış hijyen ürünlerinde cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15).

6. ŞİKÂYET
Alıcı, şikâyetlerini satıcıya yukarıdaki iletişim bilgilerinden iletebilir; parasal sınırlar dahilinde Tüketici Hakem Heyeti veya Tüketici Mahkemesi'ne başvurabilir.

Tarih: {{TARIH}}`,
  },
  DISTANCE_SALES: {
    title: 'Mesafeli Satış Sözleşmesi',
    content: `MESAFELİ SATIŞ SÖZLEŞMESİ

Madde 1 – Taraflar
SATICI: {{SATICI_UNVAN}}, {{SATICI_ADRES}}, {{SATICI_TELEFON}}, {{SATICI_EPOSTA}}
ALICI: {{ALICI_AD}}, {{ALICI_EPOSTA}}, {{ALICI_TELEFON}}

Madde 2 – Konu
İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait internet sitesinden elektronik ortamda siparişini verdiği aşağıda nitelikleri ve satış fiyatı belirtilen ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.

Madde 3 – Ürünler
{{URUNLER}}
Toplam (KDV dahil): {{TOPLAM}} · Kargo: {{KARGO}}
Teslimat adresi: {{TESLIMAT_ADRESI}}

Madde 4 – Genel Hükümler
ALICI, ön bilgilendirme formunu okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli onayı verdiğini kabul eder. SATICI, ürünü sağlam, eksiksiz ve siparişte belirtilen niteliklere uygun teslim etmekle yükümlüdür.

Madde 5 – Cayma Hakkı
ALICI, teslimattan itibaren {{CAYMA_SURESI}} gün içinde cayma hakkını kullanabilir. Cayma bildiriminin SATICI'ya ulaşmasından itibaren 14 gün içinde bedel iade edilir.

Madde 6 – Yetkili Mahkeme
Uyuşmazlıklarda Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.

Sipariş tarihi: {{TARIH}}`,
  },
  KVKK_NOTICE: {
    title: 'KVKK Aydınlatma Metni',
    content: `KİŞİSEL VERİLERİN KORUNMASI AYDINLATMA METNİ

Veri sorumlusu {{SATICI_UNVAN}} olarak; ad-soyad, iletişim, adres ve sipariş bilgilerinizi siparişinizin alınması, teslimatı, faturalandırılması ve yasal yükümlülüklerimizin yerine getirilmesi amacıyla, 6698 sayılı Kanun'un 5/2-c ve 5/2-ç maddelerine dayanarak işliyoruz. Verileriniz kargo, ödeme ve muhasebe hizmeti aldığımız iş ortaklarımıza yalnızca bu amaçlarla aktarılır.

Kanun'un 11. maddesi kapsamındaki haklarınız için {{SATICI_EPOSTA}} adresine başvurabilirsiniz.`,
  },
};
