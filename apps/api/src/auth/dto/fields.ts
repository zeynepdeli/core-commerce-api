import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { SINGLE_LINE_REGEX } from '../../common/validators.js';

/** E-posta her zaman küçük harfe çevrilip boşlukları kırpılarak işlenir */
export const EmailField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz.' }),
    MaxLength(254),
  );

/**
 * Yeni şifre kuralları. Üst sınır 128: argon2'de bcrypt'teki gibi 72 bayt
 * sınırı yok; uzun parola cümleleri desteklenir, aşırı uzunsa (DoS) reddedilir.
 */
export const NewPasswordField = () =>
  applyDecorators(
    IsString(),
    MinLength(8, { message: 'Şifre en az 8 karakter olmalı.' }),
    MaxLength(128, { message: 'Şifre en fazla 128 karakter olabilir.' }),
    Matches(/[a-zçğıöşü]/, { message: 'Şifre en az bir küçük harf içermeli.' }),
    Matches(/[A-ZÇĞİÖŞÜ]/, { message: 'Şifre en az bir büyük harf içermeli.' }),
    Matches(/[0-9]/, { message: 'Şifre en az bir rakam içermeli.' }),
  );

export const NameField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    MinLength(2, { message: 'İsim en az 2 karakter olmalı.' }),
    MaxLength(100),
    Matches(SINGLE_LINE_REGEX, { message: 'İsim tek satır olmalı.' }),
  );

/** Kullanıcıya e-postayla/yanıtla giden rastgele değerler (base64url, 43 karakter) */
export const OpaqueTokenField = () =>
  applyDecorators(IsString(), Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Geçersiz veya süresi dolmuş bağlantı.' }));
