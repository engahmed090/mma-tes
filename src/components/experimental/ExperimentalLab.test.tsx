import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('recharts',()=>{const C=({children}:{children?:React.ReactNode})=><div>{children}</div>;return Object.fromEntries(['LineChart','Line','XAxis','YAxis','Tooltip','Legend','ResponsiveContainer','ReferenceDot','ScatterChart','Scatter'].map(k=>[k,C]));});
import ExperimentalLab from './ExperimentalLab';
import ModelDashboard from './ModelDashboard';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const setup=()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[]}));render(<ExperimentalLab/>);};
const step=(name:string)=>fireEvent.click(screen.getByRole('button',{name:new RegExp(name)}));
it('starts with three task cards, compact status and no fabricated metrics',async()=>{
 setup();expect(screen.getByRole('button',{name:'Start Blood Research'})).toBeTruthy();expect(screen.getByRole('button',{name:'Start Glucose Analysis'})).toBeTruthy();expect(screen.getByRole('button',{name:'Start Nitrate Analysis'})).toBeTruthy();
 expect(screen.queryByLabelText('Raw VNA file')).toBeNull();await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 fireEvent.click(screen.getByRole('button',{name:'Start Blood Research'}));expect(screen.queryByLabelText('fmin')).toBeNull();step('Sample Metadata');expect(screen.getByRole('button',{name:/Save approved anonymous/})).toBeDisabled();
 step('Dataset & Training');expect(screen.getByRole('checkbox',{name:/Explicitly allow reviewed IMAGE_EXTRACTED/})).not.toBeChecked();expect(screen.getByRole('status').textContent).toContain('Metrics unavailable');
});
it.each(['Glucose','Nitrate'])('provides %s concentration collection without inventing targets',async task=>{
 setup();fireEvent.click(screen.getByRole('button',{name:'Start '+task+' Analysis'}));step('Sample Metadata');expect(screen.queryByText(/Optional independently established cancer type/)).toBeNull();expect(screen.getByText(/Leave blank for unknown samples/)).toBeTruthy();expect(screen.getByLabelText('Known reference concentration').getAttribute('value')).toBe('');
});
it('invalidates approval when a replacement raw import fails',async()=>{
 setup();fireEvent.click(screen.getByRole('button',{name:'Start Blood Research'}));
 const good=new File(['fixture'],'fixture.csv');Object.defineProperty(good,'text',{value:async()=>'freq_GHz,S11_dB\n'+Array.from({length:8},(_,i)=>`${1+i*.1},-20`).join('\n')});
 fireEvent.change(screen.getByLabelText('Raw VNA file'),{target:{files:[good]}});
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I reviewed the curve/})).not.toBeDisabled());fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the curve/}));
 step('Import Measurement');const bad=new File(['bad'],'bad.txt');Object.defineProperty(bad,'text',{value:async()=>'1 -20\n2 -30'});fireEvent.change(screen.getByLabelText('Raw VNA file'),{target:{files:[bad]}});
 await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());step('Sample Metadata');expect(screen.getByRole('button',{name:/Save approved anonymous/})).toBeDisabled();
});
it('shows unavailable metrics, preserves genuine zero, and separates validation from test',()=>{
 render(<ModelDashboard card={{task:'glucose',model_type:'ridge',metrics:{validation_candidates:{ridge:{mae:0}},held_out_test:{mae:2}},counts:{}}}/>);
 expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(1);expect(screen.getByText('0')).toBeTruthy();expect(screen.getByText('2')).toBeTruthy();expect(screen.getByText(/HELD-OUT TEST/)).toBeTruthy();expect(screen.getByText(/^VALIDATION/)).toBeTruthy();
});
