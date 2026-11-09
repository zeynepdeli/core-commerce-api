import { IsString, MaxLength, MinLength, ValidateNested, validate } from 'class-validator';
import { Type, plainToInstance } from 'class-transformer';
import type { BadRequestException } from '@nestjs/common';

import { validationExceptionFactory } from './validation-messages.js';

class Inner {
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  name!: string;

  @IsString({ message: 'Özel mesaj.' })
  custom!: string;
}
class Outer {
  @ValidateNested()
  @Type(() => Inner)
  inner!: Inner;
}

it('varsayılan mesajlar Türkçe, özel mesajlar aynen, alan yolu korunur', async () => {
  const errors = await validate(plainToInstance(Outer, { inner: { name: 'çok uzun ad', custom: 1 } }), { whitelist: true, forbidNonWhitelisted: true });
  const res = validationExceptionFactory(errors) as BadRequestException;
  const messages = (res.getResponse() as { message: string[] }).message;
  expect(messages).toContain('inner.name: en fazla 5 karakter olabilir');
  expect(messages).toContain('Özel mesaj.');
});
