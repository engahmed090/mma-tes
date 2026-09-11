import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import SafeChatMarkdown from './SafeChatMarkdown';
afterEach(cleanup);
it.each([
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<iframe src="https://example.org"></iframe><object data="x"></object><embed src="x">',
  '[bad](javascript:alert%281%29)',
  '[bad](data:text/html;base64,PHNjcmlwdD4=)',
  '[bad](vbscript:msgbox)',
  '<a href="https://example.org" onclick="alert(1)">bad</a>',
])('renders untrusted input without executable elements: %s', content => {
  const { container } = render(<SafeChatMarkdown content={content} />);
  expect(container.querySelector('script,img,iframe,object,embed')).toBeNull();
  for (const element of container.querySelectorAll('*')) {
    expect(element.getAttributeNames().some(name => /^on/i.test(name))).toBe(false);
  }
  expect(container.querySelector('a')).toBeNull();
});
it('preserves Markdown structure and safe citations', () => {
  render(<SafeChatMarkdown content={'# Heading\n\nParagraph **bold** and *italic* with `code`.\n\n- First\n- Second\n\n```js\nconst x = 1;\n```\n\n[source](https://example.org/paper) [email](mailto:test@example.org)'} />);
  expect(screen.getByRole('heading', { name: 'Heading' })).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('bold').tagName).toBe('STRONG');
  expect(screen.getByText('italic').tagName).toBe('EM');
  expect(screen.getByText('const x = 1;').closest('pre')).toBeTruthy();
  const link = screen.getByRole('link', { name: 'source' });
  expect(link.getAttribute('href')).toBe('https://example.org/paper');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(screen.getByRole('link', { name: 'email' }).getAttribute('href')).toBe('mailto:test@example.org');
});
