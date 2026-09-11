import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { buildLiteraturePrompt } from '../../../supabase/functions/ai-chat/literaturePrompt';
import ChatTab from './ChatTab';
afterEach(cleanup);
it.each(['', 'Search failed.', 'Tavily search unavailable (no API key).', 'No results found.', 'Source: https://example.org/paper; dimension not reported'])('requires unavailable values for insufficient retrieval: %s', context => {
  const prompt = buildLiteraturePrompt(context);
  for (const label of ['SOURCE-SUPPORTED', 'USER-PROVIDED', 'SIMULATION', 'ANALYTICAL', 'MODEL OUTPUT', 'UNVERIFIED / UNAVAILABLE']) expect(prompt).toContain(label);
  expect(prompt).toContain('Do not fill missing values with plausible guesses');
  expect(prompt).toContain('Never create fake references');
  if (context) expect(prompt).toContain(context);
});
it('keeps the verification disclosure visible in chat', () => {
  Element.prototype.scrollIntoView = vi.fn();
  render(<ChatTab shapes={[]} thrDb={-10} />);
  expect(screen.getByRole('note').textContent).toContain('Verify technical');
  expect(screen.getByRole('note').textContent).toContain('not clinical, experimental, or independently validated evidence');
});
