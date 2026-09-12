import { render,screen,cleanup } from '@testing-library/react';
import { expect,it,afterEach } from 'vitest';
import DimTable from './DimTable';
import { SHAPES } from '@/data/shapes';
afterEach(cleanup);
it('does not describe the fixed triangle indexing sentinel as zero patch width',()=>{
 const shape=SHAPES.find(s=>s.name==='triangle1')!;render(<DimTable spec={shape} pBest={0}/>);
 expect(screen.queryByText('wm — patch width (mm)')).toBeNull();expect(screen.getByText('Not applicable — fixed source geometry')).toBeTruthy();expect(screen.getByText('11.000 / 12.000 mm')).toBeTruthy();
});
