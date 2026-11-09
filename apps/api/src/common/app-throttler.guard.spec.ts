import { AppThrottlerGuard } from './app-throttler.guard.js';

describe('AppThrottlerGuard.getTracker', () => {
  const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
  const track = (headers: Record<string, string>, ip = '10.0.0.1') =>
    (guard as unknown as { getTracker: (r: object) => Promise<string> }).getTracker({ headers, ip });
  const SECRET = 's'.repeat(40);

  beforeEach(() => {
    process.env.WEB_API_SECRET = SECRET;
  });
  afterAll(() => {
    delete process.env.WEB_API_SECRET;
  });

  it('doğru anahtarla ziyaretçi IP kullanılır', async () => {
    expect(await track({ 'x-web-secret': SECRET, 'x-client-ip': '203.0.113.7' })).toBe('web:203.0.113.7');
  });

  it('yanlış/eksik anahtarda X-Client-IP yok sayılır (sahte IP ile sınır aşılamaz)', async () => {
    expect(await track({ 'x-web-secret': 'yanlis', 'x-client-ip': '203.0.113.7' })).toBe('10.0.0.1');
    expect(await track({ 'x-client-ip': '203.0.113.7' })).toBe('10.0.0.1');
  });

  it('geçersiz IP yok sayılır', async () => {
    expect(await track({ 'x-web-secret': SECRET, 'x-client-ip': 'evil' })).toBe('10.0.0.1');
  });
});
