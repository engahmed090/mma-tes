import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceDot, ScatterChart, Scatter } from 'recharts';
import { VNAPoint } from '@/utils/vna';
import { Experiment, importVNA, localAPI, Sample, summarize, Unit } from './lab';
import ImageDigitizer from './ImageDigitizer';
const anonymous=()=>crypto.randomUUID();
export default function ExperimentalLab() {
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
  const refresh=async()=>{const [r,m]=await Promise.all([localAPI('samples'),localAPI('models')]);setRecords(r);setModels(m);};
  useEffect(()=>{refresh().catch(e=>setError(String(e)));},[]);
  useEffect(()=>{setReference('');setApproved(false);},[sensor]);
  const rows=records.filter(r=>r.experiment_type===task);
  const ref=rows.find(r=>r.sample_id===reference);
  const asPoints=(r:Sample)=>r.points.map(([freq,s11])=>({freq,s11}));
  const summary=summarize(points,ref?asPoints(ref):undefined);
  const compare=useMemo(()=>{
    const chosen=task==='blood'?['NORMAL_REFERENCE','CANCER_REFERENCE'].map(l=>rows.find(r=>r.reference_label===l&&r.sensor_id===sensor)).filter(Boolean) as Sample[]:[];
    if(ref&&!chosen.includes(ref))chosen.push(ref);
    return [{name:'Imported unknown / sample',points},...chosen.map(r=>({name:`${r.reference_label||'Selected reference'} · ${r.sample_id.slice(0,8)} · ${r.source_type}`,points:asPoints(r)}))];
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
    return {...artifact,sample_id:anonymous(),specimen_group:group,experiment_type:task,source_type:source,
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
  return <div className="space-y-5">
    <h2 className="text-xl font-bold">Experimental Sensing Lab</h2>
    <p role="note" className="border border-amber-500 p-3">Research use only. This system has not been clinically validated and must not be used to diagnose or rule out cancer. RESEARCH CLASSIFICATION ONLY — NOT A MEDICAL DIAGNOSIS.</p>
    <p>Local storage only in ignored experimental-data/. Do not enter names, patient identifiers or identifying filenames/notes. Raw VNA is preferred. Reference labels are user-supplied, not verified by this software. Measurements are never sent to the AI chat.</p>
    <label>Experiment <select value={task} onChange={e=>{setTask(e.target.value as Experiment);setPoints([]);setSelected([]);setReference('');setResult(null);setLabel('');setCancerType('');setConcentration('');setIndependent(false);setApproved(false);setGroup(anonymous());setModelId('');}}>
      <option value="blood">Blood research classification</option><option value="glucose">Glucose concentration estimation</option><option value="nitrate">Nitrate concentration estimation</option></select></label>
    {error&&<p role="alert" className="text-destructive whitespace-pre-wrap">{error}</p>}
    <section className="border p-4 space-y-3">
      <h3>1. Import raw VNA — MEASURED DATA (user-supplied, unverified)</h3>
      <input aria-label="Raw VNA file" type="file" accept=".s1p,.csv,.txt" onChange={e=>{const file=e.target.files?.[0];if(!file)return;setApproved(false);setPoints([]);setResult(null);run(async()=>{
        if(file.size>2000000)throw new Error('Raw file maximum 2 MB.');const text=await file.text(),parsed=importVNA(text,file.name);
        setImport(parsed.points,'RAW_VNA',parsed.unit,{raw_filename:file.name,raw_content:text,provenance:{unit_detection:parsed.unitBasis}});
      });}}/>
      <p>One-port Touchstone 1.x S/DB, S/MA, S/RI only; text/CSV requires explicit frequency and S11 dB headers. Unsupported or ambiguous layouts are rejected.</p>
    </section>
    <ImageDigitizer onInvalidate={()=>{setApproved(false);setPoints([]);setResult(null);}} onExtract={(p,name,image,cal,corners,trace)=>setImport(p,'IMAGE_EXTRACTED',cal.unit,{image_filename:name,image_data_url:image,provenance:{axis_calibration_confirmed:true,calibration:cal,corners,trace,method:'User-traced projective digitization',confidence:'Unavailable'}})}/>
    <section className="border p-4 space-y-3">
      <h3>2. Review curve and explicit reference</h3>
      <label>Reference curve <select value={reference} onChange={e=>{setReference(e.target.value);setApproved(false);}}><option value="">None — shift unavailable</option>{rows.filter(r=>r.sensor_id===sensor).map(r=><option key={r.sample_id} value={r.sample_id}>{r.sample_id.slice(0,8)} {r.reference_label||r.known_concentration_optional} {r.source_type}</option>)}</select></label>
      <p>Preview file: {artifact.raw_filename||artifact.image_filename||'None'}. Source: {source==='RAW_VNA'?'MEASURED DATA / RAW_VNA (unverified)':'IMAGE-EXTRACTED DATA'}. Detected/confirmed input frequency unit: {unit}; canonical plot GHz / S11 dB. Comparisons use the first stored sample of each actual reference class for the selected sensor; no fabricated references. Plot may be decimated with linear interpolation for display.</p>
      <div className="h-80"><ResponsiveContainer><LineChart data={graph}><XAxis dataKey="freq" type="number" domain={['dataMin','dataMax']} name="Frequency GHz"/><YAxis name="S11 dB"/><Tooltip/><Legend/>
        {compare.map((c,i)=><Line key={i} name={c.name} dataKey={'s'+i} stroke={['#38bdf8','#22c55e','#f43f5e','#a855f7'][i%4]} dot={false} connectNulls={false}/>)}
        {summary&&<ReferenceDot x={summary.resonance_ghz} y={summary.minimum_s11_db} r={5} fill="#f59e0b" label="Selected minimum"/>}
      </LineChart></ResponsiveContainer></div>
      <pre className="text-xs whitespace-pre-wrap">{summary?JSON.stringify(summary,null,2):'No imported curve. Metrics unavailable.'}</pre>
      <details><summary>Digitized/imported XY preview (first 100 samples)</summary><pre>{points.slice(0,100).map(p=>`${p.freq} GHz, ${p.s11} dB`).join('\n')}</pre></details>
      <label><input type="checkbox" checked={approved} disabled={points.length<8} onChange={e=>setApproved(e.target.checked)}/> I reviewed the curve, units, selected resonance and quality warnings and approve this measurement.</label>
    </section>
    <section className="border p-4 space-y-3">
      <h3>3. Anonymous specimen metadata and reference targets</h3>
      <p>Specimen group: {group}. All replicates of the same physical specimen MUST use the same group.</p>
      <button className="border p-1" onClick={()=>setGroup(anonymous())}>New anonymous specimen group</button>{' '}
      <select aria-label="Existing specimen group" value={group} onChange={e=>setGroup(e.target.value)}><option value={group}>{group}</option>{[...new Set(rows.map(r=>r.specimen_group))].filter(g=>g!==group).map(g=><option key={g}>{g}</option>)}</select>
      <div className="flex flex-wrap gap-3">{[['Sensor ID',sensor,setSensor],['Session ID',session,setSession],['Replicate ID',replicate,setReplicate]] .map(([name,value,setter])=><label key={String(name)}>{String(name)} <input className="border" value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}
      <label>Measurement date <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
      {task==='blood'?<><label>Independently supplied reference label <select value={label} onChange={e=>setLabel(e.target.value)}><option value="">Unknown — no supervised target</option><option>NORMAL_REFERENCE</option><option>CANCER_REFERENCE</option></select></label>
        <label className="block">Optional independently established cancer type <input value={cancerType} onChange={e=>setCancerType(e.target.value)}/></label><p>Cancer-type model output: Unavailable. Only binary research reference classification is implemented.</p></>:
        <label>Known reference concentration <input type="number" min="0" step="any" value={concentration} onChange={e=>setConcentration(e.target.value)}/><select value={concentrationUnit} onChange={e=>setConcentrationUnit(e.target.value)}>{['mg/L','mg/dL','mmol/L','mol/L'].map(u=><option key={u}>{u}</option>)}</select> Leave blank for unknown samples. No unit conversions are performed.</label>}
      <label className="block"><input type="checkbox" checked={independent} onChange={e=>setIndependent(e.target.checked)}/> Any entered target/type comes from independently established reference metadata, not this application's prediction.</label>
      <label className="block">Non-identifying notes <input className="border w-full" maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <button disabled={busy||!approved} className="border p-2" onClick={()=>run(async()=>{const saved=await localAPI('samples',makeSample());setResult(saved.features);await refresh();setApproved(false);})}>Save approved anonymous sample locally</button>
    </section>
    <section className="border p-4 space-y-3">
      <h3>4. Dataset builder and training</h3>
      <p>Select reference-labelled specimens. Minimum collection gate: 10 independent specimens per blood class or 20 concentration specimens. These counts do not establish reliable clinical performance. Replicates are averaged per specimen; splits are TRAIN 60%, VALIDATION 20%, TEST 20%. Model selection uses validation only.</p>
      <button onClick={()=>run(refresh)}>Refresh local records/models</button>
      <div className="max-h-64 overflow-auto"><table className="text-xs w-full"><thead><tr><th>Train selection</th><th>Sample/group</th><th>Reference label/target</th><th>Provenance</th><th>Session/replicate</th></tr></thead><tbody>{rows.map(r=><tr key={r.sample_id}>
        <td><input type="checkbox" aria-label={`Select ${r.sample_id}`} checked={selected.includes(r.sample_id)} onChange={e=>setSelected(e.target.checked?[...selected,r.sample_id]:selected.filter(id=>id!==r.sample_id))}/></td>
        <td>{r.sample_id.slice(0,8)} / {r.specimen_group.slice(0,8)}</td><td>{r.reference_label??r.known_concentration_optional??'Unknown'} {r.concentration_unit_optional} {r.reference_established?'REFERENCE LABEL':'UNVERIFIED'}</td><td>{r.source_type}</td><td>{r.measurement_session_id}/{r.replicate_id}</td></tr>)}</tbody></table></div>
      <label><input type="checkbox" checked={allowImages} onChange={e=>setAllowImages(e.target.checked)}/> Explicitly allow reviewed IMAGE_EXTRACTED data in training (excluded by default).</label>
      <label className="block">Representation <select value={representation} onChange={e=>setRepresentation(e.target.value)}><option value="physical">Resonance, min S11, mean and standard deviation</option><option value="curve">64-point interpolated common frequency grid</option></select></label>
      <label><input type="checkbox" checked={bandwidth} onChange={e=>setBandwidth(e.target.checked)}/> Include contiguous −10 dB bandwidth; unavailable bandwidth blocks training.</label>
      <label className="block"><input type="checkbox" checked={useReference} onChange={e=>setUseReference(e.target.checked)}/> Include shift against selected reference (must belong to TRAIN; otherwise rejected).</label>
      <label>Seed <input type="number" min="0" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label>
      <label>Abstention absolute decision-margin threshold <input type="number" step="0.1" min="0" value={margin} onChange={e=>setMargin(Number(e.target.value))}/></label>
      <p>Margins are model-specific, uncalibrated scores, not probabilities. Blood inference additionally requires validation and test recall/specificity ≥0.8; this is a configurable research workflow's engineering gate, not clinical validation.</p>
      <button disabled={busy||!selected.length} className="border p-2" onClick={()=>run(async()=>{if(useReference&&!reference)throw new Error('Select an explicit reference first.');const trained=await localAPI('train',{sample_ids:selected,representation,allow_images:allowImages,seed,reference_sample_id:useReference?reference:null,include_bandwidth:bandwidth,margin_threshold:margin});setResult(trained);setModelId(trained.model_id);await refresh();})}>{busy?'Working locally…':'Train local baselines → new immutable snapshot/model'}</button>
    </section>
    <section className="border p-4 space-y-3">
      <h3>5. Model registry / unknown-sample inference</h3>
      <select aria-label="Experimental model" value={modelId} onChange={e=>{setModelId(e.target.value);setResult(null);}}><option value="">Select local model</option>{models.filter(m=>m.task===task).map(m=><option key={m.model_id} value={m.model_id}>{m.model_type} {m.model_id} ({m.inference_eligible?'research gate passed':'inference unavailable'})</option>)}</select>
      {card&&<details><summary>Model card: split counts, held-out metrics, limitations</summary><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(card,null,2)}</pre></details>}
      <button disabled={busy||!approved||!modelId} className="border p-2" onClick={()=>run(async()=>{setResult(await localAPI('predict',{model_id:modelId,sample:makeSample(),margin_threshold:margin}));})}>Apply saved model to approved curve</button>
      {task!=='blood'&&<><p>Observed reference concentration versus measured resonance (not a fitted calibration law). Unit: {concentrationUnit}. Predicted values outside the model's calibration range are rejected.</p><div className="h-60"><ResponsiveContainer><ScatterChart><XAxis type="number" dataKey="concentration" name={concentrationUnit}/><YAxis type="number" dataKey="resonance" name="GHz"/><Tooltip/><Scatter data={rows.filter(r=>r.known_concentration_optional!==null&&r.concentration_unit_optional===concentrationUnit&&r.sensor_id===sensor).map(r=>({concentration:r.known_concentration_optional,resonance:summarize(asPoints(r))!.resonance_ghz}))} fill="#38bdf8"/></ScatterChart></ResponsiveContainer></div></>}
      <pre role="status" className="text-xs whitespace-pre-wrap">{result?JSON.stringify(result,null,2):'No result. Metrics and predictions unavailable until actual data are supplied.'}</pre>
    </section>
  </div>;
}
