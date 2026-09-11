import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('recharts',()=>{
 const C=({children}:{children?:React.ReactNode})=><div>{children}</div>;
 return Object.fromEntries(['LineChart','Line','XAxis','YAxis','Tooltip','Legend','ResponsiveContainer','ReferenceDot','ScatterChart','Scatter'].map(k=>[k,C]));
});
import ExperimentalLab from './ExperimentalLab';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('starts with no fabricated results, no image training opt-in and explicit approval required',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>[]});vi.stubGlobal('fetch',fetcher);
 render(<ExperimentalLab/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 expect(screen.getByRole('note').textContent).toContain('must not be used to diagnose or rule out cancer');
 expect(screen.getByRole('status').textContent).toContain('No result');
 expect(screen.getByRole('button',{name:/Save approved anonymous/})).toBeDisabled();
 expect(screen.getByRole('checkbox',{name:/Explicitly allow reviewed IMAGE_EXTRACTED/})).not.toBeChecked();
 expect(screen.getByText(/Cancer-type model output: Unavailable/)).toBeTruthy();
 expect(fetcher.mock.calls.every(([url])=>String(url).startsWith('/api/experimental/'))).toBe(true);
});
it('provides separate concentration collection without inventing a target',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[]}));
 render(<ExperimentalLab/>);
 fireEvent.change(screen.getByLabelText('Experiment'),{target:{value:'glucose'}});
 expect(screen.queryByText(/Optional independently established cancer type/)).toBeNull();
 expect(screen.getByText(/Leave blank for unknown samples/)).toBeTruthy();
 expect(screen.getByRole('status').textContent).toContain('unavailable');
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
});

it('invalidates previous approval when a new raw import fails',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[]}));
 render(<ExperimentalLab/>);
 const good=new File(['fixture'],'fixture.csv');
 Object.defineProperty(good,'text',{value:async()=>'freq_GHz,S11_dB\n'+Array.from({length:8},(_,i)=>`${1+i*.1},-20`).join('\n')});
 fireEvent.change(screen.getByLabelText('Raw VNA file'),{target:{files:[good]}});
 const approval=screen.getByRole('checkbox',{name:/I reviewed the curve/});
 await waitFor(()=>expect(approval).not.toBeDisabled());
 fireEvent.click(approval);
 expect(screen.getByRole('button',{name:/Save approved anonymous/})).not.toBeDisabled();
 const bad=new File(['bad'],'ambiguous.txt');Object.defineProperty(bad,'text',{value:async()=>'1 -20\n2 -30'});
 fireEvent.change(screen.getByLabelText('Raw VNA file'),{target:{files:[bad]}});
 await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.getByRole('button',{name:/Save approved anonymous/})).toBeDisabled();
 expect(approval).not.toBeChecked();
});
