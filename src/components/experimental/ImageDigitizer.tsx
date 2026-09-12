import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Calibration, digitize, Pixel, Unit } from './lab';
import { VNAPoint } from '@/utils/vna';
export default function ImageDigitizer({ onExtract, onInvalidate, onLoaded, review }: { onLoaded:()=>void; review:boolean; onInvalidate: ()=>void; onExtract: (points: VNAPoint[], filename: string, image: string, calibration: Calibration, corners: Pixel[], trace: Pixel[])=>void }) {
  const [image,setImage]=useState(''),[filename,setFilename]=useState(''),[size,setSize]=useState({w:1000,h:700});
  const [corners,setCorners]=useState<Pixel[]>([]),[trace,setTrace]=useState<Pixel[]>([]),[error,setError]=useState('');
  const [cal,setCal]=useState<Calibration>({fmin:NaN,fmax:NaN,smin:NaN,smax:NaN,unit:'GHz',confirmed:false});
  const updateCal=(value:Calibration)=>{setCal(value);onInvalidate();};
  const loadImage=async(file?:File)=>{
      if(!file)return;onInvalidate();
      if(!['image/png','image/jpeg'].includes(file.type)||file.size>5000000){setError('PNG/JPEG only; maximum 5 MB.');return;}
      const reader=new FileReader();reader.onload=()=>{const data=String(reader.result),img=new Image();img.onload=()=>{
        // Re-encode pixels to omit EXIF/device metadata before local persistence.
        const canvas=document.createElement('canvas');const ratio=Math.min(1,1600/img.width,1600/img.height);canvas.width=img.width*ratio;canvas.height=img.height*ratio;
        canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);setImage(canvas.toDataURL('image/png'));setSize({w:canvas.width,h:canvas.height});
        onLoaded();setFilename(file.name);setCorners([]);setTrace([]);updateCal({...cal,confirmed:false});setError('');};img.src=data;};reader.readAsDataURL(file);

  };
  return <section className="space-y-4 mt-6">
    <div hidden={review}><div className="lab-section-heading"><div><h3>Import VNA Graph Image</h3><p>IMAGE EXTRACTION — Manual review required</p></div><ImagePlus className="text-violet-400"/></div>
    <label className="lab-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void loadImage(e.dataTransfer.files[0]);}}><ImagePlus size={28}/><p>Drop a PNG/JPEG or choose a graph image · up to 5 MB</p><input aria-label="VNA image" type="file" accept="image/png,image/jpeg" onChange={e=>void loadImage(e.target.files?.[0])}/></label>
    </div>
    {image&&review&&<><p className="lab-caption">Select plot corners in order: top-left, top-right, bottom-right, bottom-left. Then trace at least eight visible curve points. Linear axes only; hidden traces and curved screens are unsupported. Manual extraction is not equivalent to raw VNA accuracy.</p>
    <svg aria-label="Select plot corners and curve trace" viewBox={`0 0 ${size.w} ${size.h}`} className="w-full max-h-[500px] border" onClick={e=>{
      const svg=e.currentTarget,pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM()!.inverse());
      if(corners.length<4)setCorners([...corners,{x:p.x,y:p.y}]);else setTrace([...trace,{x:p.x,y:p.y}]);updateCal({...cal,confirmed:false});
    }}>
      <image href={image} width={size.w} height={size.h}/>
      <polygon points={corners.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="cyan" strokeWidth="2"/>
      <polyline points={trace.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="magenta" strokeWidth="2"/>
      {[...corners,...trace].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill={i<4?'cyan':'magenta'}/>)}
    </svg>
    <p>{corners.length}/4 corners; {trace.length} manually traced points. Extraction confidence: unavailable (not calibrated). Review overlay and XY preview.</p>
    <Button variant="outline" onClick={()=>{setCorners([]);setTrace([]);updateCal({...cal,confirmed:false});}}>Reset plot/trace</Button>{' '}
    <Button variant="outline" onClick={()=>{setTrace(trace.slice(0,-1));updateCal({...cal,confirmed:false});}}>Undo trace point</Button>
    <div className="lab-fields">{(['fmin','fmax','smin','smax'] as const).map(key=><label key={key}>{{fmin:'Frequency minimum',fmax:'Frequency maximum',smin:'S11 minimum',smax:'S11 maximum'}[key]}<input aria-label={key} type="number" step="any" className="border w-24 ml-2" value={Number.isNaN(cal[key])?'':cal[key]} onChange={e=>updateCal({...cal,[key]:e.target.value===''?NaN:Number(e.target.value),confirmed:false})}/></label>)}
      <select aria-label="Image frequency unit" value={cal.unit} onChange={e=>updateCal({...cal,unit:e.target.value as Unit,confirmed:false})}>{['Hz','kHz','MHz','GHz'].map(u=><option key={u}>{u}</option>)}</select>
    </div>
    <label><input type="checkbox" checked={cal.confirmed} onChange={e=>updateCal({...cal,confirmed:e.target.checked})}/> Confirm Calibration — linear axes, bounds, plot corners and traced curve.</label>
    <Button variant="outline" className="block border p-2" onClick={()=>{try{onExtract(digitize(corners,trace,cal),filename,image,cal,corners,trace);setError('');}catch(e){setError(String(e));}}}>Extract Curve</Button>
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
