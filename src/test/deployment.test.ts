import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalExperimentalAccess, localAPI } from '@/components/experimental/lab';
afterEach(()=>vi.unstubAllGlobals());
it('blocks experimental measurements before a hosted request can be sent',async()=>{
  vi.stubGlobal('window',{location:{hostname:'metamaterial-absorber-ai-platform.vercel.app'}});
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(localAPI('samples',{private_measurement:'test fixture'})).rejects.toThrow('No experimental measurements were sent');
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(['localhost','127.0.0.1','[::1]'])('preserves local research access on %s',host=>{
  expect(()=>assertLocalExperimentalAccess(host)).not.toThrow();
});
it('reports an unavailable local service instead of a JSON parsing error',async()=>{
  vi.stubGlobal('window',{location:{hostname:'localhost'}});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({json:async()=>{throw new Error('HTML response');}}));
  await expect(localAPI('samples')).rejects.toThrow('Start the local FastAPI backend');
});
it('routes APIs to unavailable JSON before SPA fallback and preserves static assets',()=>{
  const config=JSON.parse(readFileSync(resolve('vercel.json'),'utf8'));
  expect(config.framework).toBe('vite');expect(config.outputDirectory).toBe('dist');
  const [chat,api,filesystem,spa]=config.routes;
  expect(chat.dest).toBe('/api/ai-chat');
  expect(new RegExp('^'+chat.src+'$').test('/api/ai-chat')).toBe(true);
  expect(chat.status).toBeUndefined();
  for(const path of ['/api','/api/experimental/samples','/api/predict/inverse']) expect(new RegExp('^'+api.src+'$').test(path)).toBe(true);
  expect(api.status).toBe(503);expect(filesystem.handle).toBe('filesystem');expect(spa.dest).toBe('/index.html');
  const unavailable=JSON.parse(readFileSync(resolve('public'+api.dest),'utf8'));
  expect(unavailable.detail).toContain('no prediction was made');
  expect(config.installCommand).toContain('--frozen-lockfile --ignore-scripts');
});
