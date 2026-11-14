import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateStoreSettingsDto } from '../store-settings/store-settings.dto.js';

import { LEGAL_DEFAULTS } from './legal-defaults.js';
import {
  CHECKOUT_TYPES,
  LEGAL_TYPES,
  publicSeller,
  renderTemplate,
} from './legal.service.js';

const seller = {
  sellerName: 'Enfes Gurme Gıda Ltd. Şti.',
  sellerAddress: 'Kale Cad. No: 12, Şahinbey / Gaziantep',
  sellerPhone: '+90 342 123 45 67',
  sellerEmail: 'bilgi@ornek.com',
  sellerTaxOffice: 'Şahinbey',
  sellerTaxNumber: '12345678901',
  sellerMersisNo: '0123456789012345',
  sellerKepAddress: 'enfes@hs01.kep.tr',
};

describe('yasal metinler', () => {
  it('çerez politikası yayımlanır ama sipariş metni değildir', () => {
    expect(LEGAL_TYPES).toContain('COOKIE_POLICY');
    expect(CHECKOUT_TYPES).not.toContain('COOKIE_POLICY');
    expect(LEGAL_DEFAULTS.COOKIE_POLICY.content).toContain('{{SATICI_KEP}}');
  });

  it('KEP yer tutucusu doldurulur', () => {
    expect(
      renderTemplate('KEP: {{SATICI_KEP}}', {
        SATICI_KEP: 'enfes@hs01.kep.tr',
      }),
    ).toBe('KEP: enfes@hs01.kep.tr');
  });

  it('tacir (MERSİS var): vergi numarası herkese gösterilmez', () => {
    const p = publicSeller(seller);
    expect(p.mersisNo).toBe('0123456789012345');
    expect(p.taxNumber).toBeNull();
    expect(p.taxOffice).toBeNull();
    expect(p.kepAddress).toBe('enfes@hs01.kep.tr');
  });

  it('esnaf (MERSİS yok): vergi kimlik numarası gösterilir (mevzuat gereği)', () => {
    const p = publicSeller({ ...seller, sellerMersisNo: null });
    expect(p.mersisNo).toBeNull();
    expect(p.taxNumber).toBe('12345678901');
    expect(p.taxOffice).toBe('Şahinbey');
  });

  it('KEP adresi e-posta biçiminde olmalı', async () => {
    const errs = async (body: object) =>
      (
        await validate(plainToInstance(UpdateStoreSettingsDto, body), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).map((e) => e.property);
    expect(await errs({ sellerKepAddress: 'enfes@hs01.kep.tr' })).toEqual([]);
    expect(await errs({ sellerKepAddress: null })).toEqual([]);
    expect(await errs({ sellerKepAddress: 'kep adresi' })).toContain(
      'sellerKepAddress',
    );
  });
});
