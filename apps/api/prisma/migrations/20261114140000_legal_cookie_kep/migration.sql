-- Çerez Politikası yasal metin türü (mağaza alt bilgisinde yayımlanır; sipariş metni değildir)
ALTER TYPE "LegalDocumentType" ADD VALUE 'COOKIE_POLICY';

-- Satıcının tebligata elverişli KEP adresi (e-ticaret mevzuatı gereği sitede gösterilir)
ALTER TABLE "StoreSettings" ADD COLUMN "sellerKepAddress" TEXT;
