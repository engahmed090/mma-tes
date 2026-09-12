import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import ChatTab from './ChatTab';
vi.mock('./AIWorkingPanel',()=>({default:()=>null,useAIStages:()=>({setStage:()=>{},startTimer:()=>{},stopTimer:()=>{},reset:()=>{}})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('sends to same-origin chat without provider secrets and safely renders streamed Markdown',async()=>{
 HTMLElement.prototype.scrollIntoView=()=>{};
 const bytes=new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{content:'**Provider response** [Source](https://example.org) <script>alert(1)</script>'}}]})+'\n\ndata: [DONE]\n\n');
 const fetcher=vi.fn().mockResolvedValue({ok:true,headers:new Headers({'X-AI-Provider':'groq','X-AI-Model':'configured-model'}),body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})});
 vi.stubGlobal('fetch',fetcher);const {container}=render(<ChatTab shapes={[]} thrDb={-10}/>);
 fireEvent.change(screen.getByPlaceholderText(/Ask about absorbers/),{target:{value:'Hello'}});fireEvent.keyDown(screen.getByPlaceholderText(/Ask about absorbers/),{key:'Enter'});
 await waitFor(()=>expect(screen.getByText('Provider response')).toBeTruthy());
 expect(fetcher.mock.calls[0][0]).toBe('/api/ai-chat');expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
 expect(container.querySelector('script')).toBeNull();expect(screen.getByRole('link',{name:'Source'}).getAttribute('href')).toBe('https://example.org/');
 expect(readFileSync('src/components/absorber/ChatTab.tsx','utf8')).not.toMatch(/VITE_SUPABASE|API_KEY|PUBLISHABLE_KEY/);
});
