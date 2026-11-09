import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { MediaFileValidatorService } from './media-file-validator.service.js';

const validator = new MediaFileValidatorService();

describe('MediaFileValidatorService', () => {
  it('büyük görseli 2560 px\'e küçültür ve EXIF/GPS meta verisini siler', async () => {
    const input = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#346872' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'gizli-konum' } })
      .toBuffer();
    const result = await validator.validate(input);
    expect(result).toMatchObject({ mimeType: 'image/jpeg', extension: 'jpg', width: 2560, height: 1920 });
    expect(result.buffer.includes(Buffer.from('gizli-konum'))).toBe(false);
  });

  it('küçük görsel büyütülmez', async () => {
    const input = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#000' } }).png().toBuffer();
    expect(await validator.validate(input)).toMatchObject({ width: 200, height: 100, extension: 'png' });
  });

  it('görsel olmayan dosya (uzantısı .jpg olsa bile) ve SVG reddedilir', async () => {
    await expect(validator.validate(Buffer.from('<?php echo 1; ?>'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(validator.validate(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
