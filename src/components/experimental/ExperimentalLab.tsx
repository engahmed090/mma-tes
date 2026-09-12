import { Activity, ArrowLeft, ArrowRight, Check, Droplet, FlaskConical, Upload, ShieldCheck, Database, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ModelDashboard, { Metric, PredictionResult } from './ModelDashboard';
import './experimental.css';
import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceDot, ScatterChart, Scatter } from 'recharts';
import { VNAPoint } from '@/utils/vna';
import { Experiment, importVNA, localAPI, Sample, summarize, Unit } from './lab';
import ImageDigitizer from './ImageDigitizer';
const anonymous=()=>crypto.randomUUID();
export default function ExperimentalLab() {
  const [started,setStarted]=useState(false),[step,setStep]=useState(1),[connected,setConnected]=useState(false),[sampleId,setSampleId]=useState(anonymous);
  const [trainingStage,setTrainingStage]=useState(''),[trainingEvents,setTrainingEvents]=useState<string[]>([]);
  const [task,setTask]=useState<Experiment>('blood'),[records,setRecords]=useState<Sample[]>([]),[models,setModels]=useState<any[]>([]);
  const [points,setPoints]=useState<VNAPoint[]>([]),[source,setSource]=useState<'RAW_VNA'|'IMAGE_EXTRACTED'>('RAW_VNA');
  const [unit,setUnit]=useState<Unit>('GHz'),[artifact,setArtifact]=useState<Partial<Sample>>({}),[approved,setApproved]=useState(false);
  const [group,setGroup]=useState<string>(anonymous),[sensor,setSensor]=useState(''),[session,setSession]=useState(''),[replicate,setReplicate]=useState('1');
  const [date,setDate]=useState(''),[notes,setNotes]=useState(''),[label,setLabel]=useState(''),[cancerType,setCancerType]=useState('');
  const [concentration,setConcentration]=useState(''),[concentrationUnit,setConcentrationUnit]=useState('mg/L'),[independent,setIndependent]=useState(false);
  const [reference,setReference]=useState(''),[selected,setSelected]=useState<string[]>([]),[allowImages,setAllowImages]=useState(false);
  const [representation,setRepresentation]=useState('physical'),[bandwidth,setBandwidth]=useState(false),[useReference,setUseReference]=useState(false);
  const [seed,setSeed]=useState(42),[margin,setMargin]=useState(1),[modelId,setModelId]=useState(''),[result,setResult]=useState<any>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const refresh=async()=>{const [r,m]=await Promise.all([localAPI('samples'),localAPI('models')]);setRecords(r);setModels(m);setConnected(true);};
  useEffect(()=>{refresh().catch(()=>setConnected(false));},[]);
  useEffect(()=>{setReference('');setApproved(false);},[sensor]);
  const rows=records.filter(r=>r.experiment_type===task);
  const ref=rows.find(r=>r.sample_id===reference);
  const asPoints=(r:Sample)=>r.points.map(([freq,s11])=>({freq,s11}));
  const summary=summarize(points,ref?asPoints(ref):undefined);
  const compare=useMemo(()=>{
    const chosen=task==='blood'?['NORMAL_REFERENCE','CANCER_REFERENCE'].map(l=>rows.find(r=>r.reference_label===l&&r.sensor_id===sensor)).filter(Boolean) as Sample[]:[];
    if(ref&&!chosen.includes(ref))chosen.push(ref);
    return [{name:'Imported unknown / sample',points},...chosen.map(r=>({name:`${r.reference_label||'Selected reference'} Â· ${r.sample_id.slice(0,8)} Â· ${r.source_type}`,points:asPoints(r)}))];
  },[points,records,task,reference,sensor]);
  const graph=useMemo(()=>{
    const fs=[...new Set(compare.flatMap(c=>c.points.map(p=>p.freq)))].sort((a,b)=>a-b);
    const step=Math.max(1,Math.ceil(fs.length/600));
    return fs.filter((_,i)=>i%step===0||i===fs.length-1).map(freq=>{
      const row:Record<string,number|null>={freq};
      compare.forEach((c,i)=>{const right=c.points.findIndex(p=>p.freq>=freq);if(right<0||!c.points.length||freq<c.points[0].freq){row['s'+i]=null;return;}
        if(right===0||c.points[right].freq===freq)row['s'+i]=c.points[right].s11;
        else {const a=c.points[right-1],b=c.points[right];row['s'+i]=a.s11+(freq-a.freq)/(b.freq-a.freq)*(b.s11-a.s11);}});return row;
    });
  },[compare]);
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}};
  const makeSample=():Sample=>{
    if(!approved)throw new Error('Explicit curve approval is required before saving or inference.');
    if(!sensor.trim()||!session.trim()||!date)throw new Error('Sensor, session and measurement date are required. Use anonymous IDs.');
    return {...artifact,sample_id:sampleId,specimen_group:group,experiment_type:task,source_type:source,
      reference_label:task==='blood'?(label||null) as Sample['reference_label']:null,reference_established:independent,
      cancer_type_optional:task==='blood'?(cancerType.trim()||null):null,
      known_concentration_optional:task!=='blood'&&concentration!==''?Number(concentration):null,
      concentration_unit_optional:task!=='blood'&&concentration!==''?concentrationUnit:null,
      sensor_id:sensor.trim(),measurement_session_id:session.trim(),replicate_id:replicate,measurement_date:date,notes,
      raw_filename:artifact.raw_filename||null,image_filename:artifact.image_filename||null,frequency_unit:unit,s11_unit:'dB',
      provenance:{...artifact.provenance,category:source,reference_metadata:independent?'REFERENCE_LABELED':'UNVERIFIED',software_verification:'not independently authenticated'},
      quality_status:'APPROVED',points:points.map(p=>[p.freq,p.s11]),reference_sample_id:reference||null};
  };
  const setImport=(p:VNAPoint[],s:typeof source,u:Unit,a:Partial<Sample>)=>{setPoints(p);setSource(s);setUnit(u);setArtifact(a);setApproved(false);setResult(null);};
  const card=models.find(m=>m.model_id===modelId);
  const start=(value:Experiment)=>{setTask(value);setStarted(true);setStep(1);setPoints([]);setSelected([]);setReference('');setResult(null);setLabel('');setCancerType('');setConcentration('');setIndependent(false);setApproved(false);setGroup(anonymous());setSampleId(anonymous());setModelId('');setArtifact({});setTrainingEvents([]);};
  const rawImport=(file?:File)=>{if(!file)return;setApproved(false);setPoints([]);setResult(null);void run(async()=>{
    if(file.size>2000000)throw new Error('Raw file maximum 2 MB.');
    const text=await file.text(),parsed=importVNA(text,file.name);
    setImport(parsed.points,'RAW_VNA',parsed.unit,{raw_filename:file.name,raw_content:text,provenance:{unit_detection:parsed.unitBasis}});setStep(2);
  });};
  const train=()=>run(async()=>{
    if(useReference&&!reference)throw new Error('Select an explicit reference first.');
    setTrainingEvents([]);setTrainingStage('Submitting training request');
    try {
      const job=await localAPI('training-jobs',{sample_ids:selected,representation,allow_images:allowImages,seed,reference_sample_id:useReference?reference:null,include_bandwidth:bandwidth,margin_threshold:margin});
      for(;;){
        const state=await localAPI('training-jobs/'+job.job_id);
        setTrainingEvents(state.events);setTrainingStage(state.stage);
        if(state.status==='failed')throw new Error(state.error);
        if(state.status==='complete'){setModelId(state.result.model_id);await refresh();break;}
        await new Promise(resolve=>setTimeout(resolve,400));
      }
    } finally {setTrainingStage('');}
  });
  const steps=['Import Measurement','Review & Calibrate','Sample Metadata','Dataset & Training','Prediction'];
  const completed=[points.length>=8,approved,!!sensor.trim()&&!!session.trim()&&!!date,!!card,!!result];
  return <div className="experimental-lab tab-content-enter">
    <header className="lab-header">
      <div><div className="lab-eyebrow"><Activity size={14}/> MEASUREMENT TO RESEARCH</div><h2>Experimental Sensing Lab</h2>
      <p>VNA-based experimental sensing workflow for blood research, glucose estimation and nitrate estimation.</p></div>
      <div className="lab-backend"><Radio size={16}/><div><strong>Research Backend</strong><span className={connected?'text-emerald-400':'text-muted-foreground'}>● {connected?'Connected':'Local backend not connected'}</span></div></div>
    </header>
    {!connected&&<p className="lab-service-note">Import and preview are available in the browser. Saving, training and inference require the local research backend.</p>}
    <div role="note" className="lab-notice"><ShieldCheck size={18}/><div><strong>Research classification only · Not a medical diagnosis</strong><p>This system has not been clinically validated and must not be used to diagnose or rule out cancer. Reference labels are user-supplied. Use anonymous IDs; measurements are never sent to AI chat.</p></div></div>
    {!started ? <>
      <div className="lab-section-heading"><div><h3>Start your next experiment</h3><p>Choose a research task. Import a measurement, review its quality, then build on your reference data.</p></div><Badge variant="outline">LOCAL-FIRST RESEARCH</Badge></div>
      <div className="lab-tasks">{([
        {id:'blood',title:'Blood Research',icon:Droplet,description:'Reference-class sensing using VNA resonance behavior',tag:'CLASSIFICATION',color:'rose'},
        {id:'glucose',title:'Glucose Analysis',icon:Activity,description:'Regression from calibrated reference concentrations',tag:'REGRESSION',color:'sky'},
        {id:'nitrate',title:'Nitrate Analysis',icon:FlaskConical,description:'Regression from calibrated reference concentrations',tag:'REGRESSION',color:'violet'},
      ] as const).map(t=><article className={'lab-task '+t.color} key={t.id}><div className="lab-task-icon"><t.icon size={28}/></div><span className="lab-eyebrow">{t.tag}</span><h3>{t.title}</h3><p>{t.description}</p><Button className="w-full" variant="outline" aria-label={'Start '+t.title} onClick={()=>start(t.id)}>Start Experiment <ArrowRight size={16}/></Button></article>)}</div>
      <div className="lab-empty"><Database size={24}/><div><strong>Your measurements. Traceable results.</strong><p>Raw VNA is preferred. Reviewed image traces remain labelled separately. Metrics appear only after genuine training and held-out evaluation.</p></div></div>
    </> : <>
      <div className="lab-section-heading"><Button variant="ghost" disabled={busy} onClick={()=>setStarted(false)}><ArrowLeft size={16}/> All experiments</Button><Badge variant="outline">{task.toUpperCase()} · RESEARCH WORKFLOW</Badge></div>
      <nav className="lab-stepper" aria-label="Experiment workflow">{steps.map((name,i)=><button key={name} disabled={busy} aria-current={step===i+1?'step':undefined} onClick={()=>setStep(i+1)}><span>{completed[i]?<Check size={15}/>:String(i+1).padStart(2,'0')}</span><strong>{name}</strong></button>)}</nav>
      {error&&<p role="alert" className="lab-error">{error}</p>}
      <div className="lab-panel" hidden={step!==1&&step!==2}>
        <div hidden={step!==1}>
          <div className="lab-section-heading"><div><h3>Import your measurement</h3><p>Start with the original instrument export for the highest data fidelity.</p></div></div>
          <label className="lab-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();rawImport(e.dataTransfer.files[0]);}}>
            <Upload size={32}/><Badge>RECOMMENDED — Highest data fidelity</Badge><h3>Upload Raw VNA Data</h3><p>Drag a file here, or choose a file</p><span>.s1p / Touchstone / CSV / TXT · up to 2 MB</span><input aria-label="Raw VNA file" type="file" accept=".s1p,.csv,.txt" onChange={e=>rawImport(e.target.files?.[0])}/>
          </label>
          <p className="lab-caption">One-port Touchstone 1.x S/DB, S/MA, S/RI. CSV/TXT require explicit frequency and S11 dB headers. Ambiguous representations are rejected.</p>
        </div>
        <div className={step===2&&source==='IMAGE_EXTRACTED'?'lab-review-grid':''}>
          <div hidden={step===2&&source!=='IMAGE_EXTRACTED'}><ImageDigitizer key={task} review={step===2} onLoaded={()=>{setSource('IMAGE_EXTRACTED');setStep(2);}} onInvalidate={()=>{setApproved(false);setPoints([]);setResult(null);}} onExtract={(p,name,image,cal,corners,trace)=>setImport(p,'IMAGE_EXTRACTED',cal.unit,{image_filename:name,image_data_url:image,provenance:{axis_calibration_confirmed:true,calibration:cal,corners,trace,method:'User-traced projective digitization',confidence:'Unavailable'}})}/></div>
          <section hidden={step!==2} className="space-y-5 min-w-0">
            <div className="lab-section-heading"><div><h3>Review & calibrate</h3><p>{artifact.raw_filename||artifact.image_filename||'Import a measurement to begin.'}</p></div><Badge variant="outline">{source==='RAW_VNA'?'RAW VNA · USER-SUPPLIED':'IMAGE-EXTRACTED'}</Badge></div>
            <div className="lab-metrics"><Metric label="Resonance frequency" value={summary?.resonance_ghz} unit="GHz"/><Metric label="Minimum S11" value={summary?.minimum_s11_db} unit="dB"/><Metric label="Frequency range" value={summary?.frequency_range_ghz.map(v=>v.toFixed(3)).join(' – ')} unit="GHz"/><Metric label="Data points" value={summary?.samples}/><Metric label="Source" value={points.length?source.replace('_',' '):undefined}/></div>
            <div className="lab-chart"><ResponsiveContainer><LineChart data={graph}><XAxis dataKey="freq" type="number" domain={['dataMin','dataMax']} name="Frequency GHz" tick={{fill:'#94a3b8'}}/><YAxis name="S11 dB" tick={{fill:'#94a3b8'}}/><Tooltip contentStyle={{background:'#111c2c',border:'1px solid #334155'}}/><Legend/>
              {compare.map((c,i)=><Line key={i} name={c.name} dataKey={'s'+i} stroke={['#38bdf8','#22c55e','#f43f5e','#a855f7'][i%4]} dot={false} connectNulls={false}/>)}
              {summary&&<ReferenceDot x={summary.resonance_ghz} y={summary.minimum_s11_db} r={5} fill="#f59e0b" label="Minimum"/>}
            </LineChart></ResponsiveContainer></div>
            <p className="lab-caption">Frequency (GHz) → S11 (dB). Input unit: {unit}. Sampled global minimum; lowest-frequency tie. Display may be decimated/interpolated. Source and reference identity are not independently authenticated.</p>
            {summary?.warnings.map(w=><p key={w} className="text-amber-300 text-sm">{w}</p>)}
            <label>Reference curve<select value={reference} onChange={e=>{setReference(e.target.value);setApproved(false);}}><option value="">None — shift unavailable</option>{rows.filter(r=>r.sensor_id===sensor).map(r=><option key={r.sample_id} value={r.sample_id}>{r.sample_id.slice(0,8)} {r.reference_label||r.known_concentration_optional} {r.source_type}</option>)}</select></label>
            <details><summary>Measurement details and XY preview</summary><p>Contiguous −10 dB bandwidth: {summary?.contiguous_minus10db_bandwidth_ghz??'Unavailable'} GHz · Q: Unavailable</p><p>Reference shift: {summary?.delta_frequency_ghz??'Unavailable'} GHz</p><pre>{points.slice(0,100).map(p=>`${p.freq} GHz, ${p.s11} dB`).join('\n')}</pre></details>
            <label className="lab-check"><input type="checkbox" checked={approved} disabled={points.length<8} onChange={e=>setApproved(e.target.checked)}/> I reviewed the curve, units, selected resonance and quality warnings and approve this measurement.</label>
            <Button disabled={!approved} onClick={()=>setStep(3)}>Approve Measurement <ArrowRight size={16}/></Button>
          </section>
        </div>
      </div>
      {step===3&&<section className="lab-panel space-y-5"><div className="lab-section-heading"><div><h3>Sample metadata</h3><p>Keep all scans from one physical specimen in the same group.</p></div><Badge variant="outline">ANONYMOUS RECORD</Badge></div>
        <div className="lab-fields"><label>Anonymous Sample ID<input readOnly value={sampleId}/></label><label>Specimen Group<select aria-label="Existing specimen group" value={group} onChange={e=>setGroup(e.target.value)}><option value={group}>{group}</option>{[...new Set(rows.map(r=>r.specimen_group))].filter(g=>g!==group).map(g=><option key={g}>{g}</option>)}</select></label>
          {[['Sensor ID',sensor,setSensor],['Session ID',session,setSession],['Replicate ID',replicate,setReplicate]].map(([name,value,setter])=><label key={String(name)}>{String(name)}<input value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}
          <label>Measurement date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        </div><Button variant="outline" onClick={()=>setGroup(anonymous())}>New anonymous specimen group</Button>
        <div className="lab-fields">{task==='blood'?<><label>Independently supplied reference label<select value={label} onChange={e=>setLabel(e.target.value)}><option value="">Unknown — no supervised target</option><option>NORMAL_REFERENCE</option><option>CANCER_REFERENCE</option></select></label><label>Optional independently established cancer type<input value={cancerType} onChange={e=>setCancerType(e.target.value)}/></label></>:<><label>Known reference concentration<input type="number" min="0" step="any" value={concentration} onChange={e=>setConcentration(e.target.value)}/></label><label>Unit<select value={concentrationUnit} onChange={e=>setConcentrationUnit(e.target.value)}>{['mg/L','mg/dL','mmol/L','mol/L'].map(u=><option key={u}>{u}</option>)}</select></label></>}</div>
        <p className="lab-caption">{task==='blood'?'Cancer-type model output: Unavailable. Binary reference classification only.':'Leave blank for unknown samples. No unit conversions are performed.'}</p>
        <label className="lab-check"><input type="checkbox" checked={independent} onChange={e=>setIndependent(e.target.checked)}/> Any entered target/type comes from independently established reference metadata, not this application's prediction.</label>
        <label>Non-identifying notes<input maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <Button disabled={busy||!approved} onClick={()=>run(async()=>{await localAPI('samples',makeSample());await refresh();setSampleId(anonymous());setApproved(false);setStep(4);})}>Save approved anonymous sample locally</Button>
      </section>}
      {step===4&&<section className="space-y-5"><div className="lab-metrics"><Metric label="Samples" value={rows.length}/><Metric label="Independent specimens" value={new Set(rows.map(r=>r.specimen_group)).size}/>{['TRAIN','VALIDATION','TEST'].map(s=><Metric key={s} label={s} value={card?.counts?.[s]?.specimens}/>)}</div>
        <div className="lab-panel space-y-5"><div className="lab-section-heading"><div><h3>Your research dataset</h3><p>Select reference-labelled measurements for a new versioned training run.</p></div><Button variant="outline" disabled={busy} onClick={()=>run(refresh)}>Refresh records</Button></div>
        <div className="lab-table"><table><thead><tr>{['Select','Sample / group','Class / target','Source','Session / replicate','Split','Status'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.sample_id}><td><input type="checkbox" aria-label={`Select ${r.sample_id}`} checked={selected.includes(r.sample_id)} onChange={e=>setSelected(e.target.checked?[...selected,r.sample_id]:selected.filter(id=>id!==r.sample_id))}/></td><td>{r.sample_id.slice(0,8)}<small>{r.specimen_group.slice(0,8)}</small></td><td>{r.reference_label??r.known_concentration_optional??'Unknown'} {r.concentration_unit_optional}</td><td><Badge variant="outline">{r.source_type.replace('_',' ')}</Badge></td><td>{r.measurement_session_id} / {r.replicate_id}</td><td>{card?.split_groups?.[r.specimen_group]||'Unassigned'}</td><td><Badge variant="outline">{r.reference_established?'REFERENCE LABEL':'UNVERIFIED'}</Badge></td></tr>)}</tbody></table>{!rows.length&&<div className="lab-empty"><Database/><p>No saved samples yet. Import, approve and save a reference measurement to begin.</p></div>}</div>
        <label>Representation<select value={representation} onChange={e=>setRepresentation(e.target.value)}><option value="physical">Physical features — resonance and curve statistics</option><option value="curve">Standardized curve — 64-point common grid</option></select></label>
        <label className="lab-check"><input type="checkbox" checked={allowImages} onChange={e=>setAllowImages(e.target.checked)}/> Explicitly allow reviewed IMAGE_EXTRACTED data in training (excluded by default).</label>
        <details><summary>Advanced Settings</summary><div className="space-y-4 pt-4"><label className="lab-check"><input type="checkbox" checked={bandwidth} onChange={e=>setBandwidth(e.target.checked)}/> Include contiguous −10 dB bandwidth; unavailable bandwidth blocks training.</label><label className="lab-check"><input type="checkbox" checked={useReference} onChange={e=>setUseReference(e.target.checked)}/> Include reference shift (selected reference must belong to TRAIN).</label><div className="lab-fields"><label>Seed<input type="number" min="0" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label><label>Abstention absolute decision-margin threshold<input type="number" step="0.1" min="0" value={margin} onChange={e=>setMargin(Number(e.target.value))}/></label></div><p>Uncalibrated margins are not probabilities. Blood validation AND test recall/specificity must reach 0.8 for the engineering gate; this does not establish clinical validity.</p></div></details>
        <p className="lab-caption">Minimum: 10 independent specimens per blood class or 20 concentration specimens. TRAIN 60% / VALIDATION 20% / TEST 20%; replicates stay together. Validation selects the model. Never reuse the held-out test for iterative tuning.</p>
        <Button disabled={busy||!selected.length} onClick={train}>{busy?'Training locally…':'Train Model'}</Button>
        {(trainingStage||trainingEvents.length>0)&&<div role="status" className="lab-training"><strong>{trainingStage||'Training run finished'}</strong><ol>{trainingEvents.map((e,i)=><li key={i}><span>{i+1}.</span>{e}</li>)}</ol><p>Stages entered, as reported by the research backend. An entered stage is not a completed result.</p></div>}
        </div><ModelDashboard card={card}/>
      </section>}
      {step===5&&<section className="lab-panel space-y-5"><div className="lab-section-heading"><div><h3>Research prediction</h3><p>Apply a saved, validated model to your approved measurement.</p></div><Badge variant="outline">{result?'TRAINED-MODEL OUTPUT':'NO PREDICTION YET'}</Badge></div>
        <label>Select Model<select aria-label="Experimental model" value={modelId} onChange={e=>{setModelId(e.target.value);setResult(null);}}><option value="">Select local model</option>{models.filter(m=>m.task===task).map(m=><option key={m.model_id} value={m.model_id}>{m.model_type} · {m.model_id.slice(0,8)} · {m.inference_eligible?'research gate passed':'inference unavailable'}</option>)}</select></label>
        <div className="lab-empty"><ShieldCheck/><div><strong>{approved?'Approved measurement ready':'Use Approved Measurement'}</strong><p>{approved?`${points.length} points · ${source}`:'Import and approve a curve, then complete sensor/session metadata.'}</p></div><Button variant="outline" onClick={()=>setStep(approved?3:1)}>{approved?'Review metadata':'Import measurement'}</Button></div>
        <Button disabled={busy||!approved||!modelId} onClick={()=>run(async()=>setResult(await localAPI('predict',{model_id:modelId,sample:makeSample(),margin_threshold:margin})))}>Run Research Prediction</Button>
        <PredictionResult result={result} card={card}/><ModelDashboard card={card}/>
      </section>}
      <footer className="lab-section-heading"><Button variant="outline" disabled={step===1} onClick={()=>setStep(step-1)}><ArrowLeft size={16}/> Back</Button><span className="lab-caption">STEP {step} OF 5 · {steps[step-1]}</span><Button variant="outline" disabled={step===5} onClick={()=>setStep(step+1)}>Next <ArrowRight size={16}/></Button></footer>
    </>}
  </div>;
}
