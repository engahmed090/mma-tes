import { expect, it } from 'vitest';
import { serviceUrl } from '@/lib/serviceConfig';
it('uses same-origin API and disables optional services when unconfigured', () => {
  expect(serviceUrl(undefined)).toBe('');
  expect(serviceUrl('')).toBe('');
});
it('normalizes explicitly configured local and hosted URLs', () => {
  expect(serviceUrl('http://127.0.0.1:8000/')).toBe('http://127.0.0.1:8000');
  expect(serviceUrl('https://example.org/backend/')).toBe('https://example.org/backend');
});
it.each(['javascript:alert(1)', 'https://user:secret@example.org', 'https://example.org?key=secret'])('rejects unsafe service configuration %s', value => {
  expect(() => serviceUrl(value)).toThrow();
});
