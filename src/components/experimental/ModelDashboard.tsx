import { Badge } from '@/components/ui/badge';
export function Metric({label,value,unit}:{label:string;value?:number|string|null;unit?:string}) {
  const available=value!=null && (typeof value!=='number'||Number.isFinite(value));
  return <div className="lab-metric"><span>{label}</span><strong>{available?(typeof value==='number'?Number(value.toFixed(4)).toString():value):'Unavailable'}</strong>{available&&unit&&<small>{unit}</small>}</div>;
}
export default function ModelDashboard({card}:{card?:any}) {
  if(!card)return <div className="lab-panel"><h3>Model evaluation</h3><p role="status" className="lab-caption">No trained model selected. Metrics unavailable until actual reference data are trained and evaluated.</p></div>;
  const blood=card.task==='blood';
  const keys=blood?[['recall','Sensitivity / recall'],['specificity','Specificity'],['precision','Precision'],['f1','F1'],['roc_auc','ROC-AUC']]:[['mae','MAE'],['rmse','RMSE'],['r2','R²']];
  const splits=[['VALIDATION',card.metrics?.validation_candidates?.[card.model_type]],['HELD-OUT TEST',card.metrics?.held_out_test]] as const;
  return <div className="lab-panel space-y-5"><div className="lab-section-heading"><div><h3>Model evaluation</h3><p>{card.model_type} · {card.model_id?.slice(0,8)}</p></div><Badge variant="outline">{card.inference_eligible?'RESEARCH GATE PASSED':'INFERENCE UNAVAILABLE'}</Badge></div>
    {splits.map(([name,metrics])=><section key={name} className="space-y-3"><h4 className="lab-eyebrow">{name} · {metrics?.independent_samples??'Unavailable'} independent specimens</h4><div className="lab-metrics">{keys.map(([key,label])=><Metric key={key} label={label} value={metrics?.[key]}/>)}</div>
      {blood&&<div className="lab-table"><table aria-label={name+' confusion matrix'}><caption>Actual rows / predicted columns — confusion matrix</caption><thead><tr><th>Reference class</th><th>Normal</th><th>Cancer-reference</th></tr></thead><tbody>{['Normal','Cancer-reference'].map((label,i)=><tr key={label}><th>{label}</th>{[0,1].map(j=><td key={j}>{metrics?.confusion_matrix?.[i]?.[j]??'Unavailable'}</td>)}</tr>)}</tbody></table></div>}
    </section>)}
    {!blood&&<Metric label="TRAIN calibration range" value={card.concentration_range?.join(' – ')} unit={card.concentration_unit}/>}
    <details><summary>TRAIN grouped cross-validation and model provenance</summary><p>TRAIN-only grouped folds; no held-out test specimens are used here.</p><pre>{JSON.stringify(card.metrics?.train_grouped_cv??'Unavailable',null,2)}</pre><p>Model version: {card.model_id}</p><p>Dataset version: {card.dataset_version}</p><p>Domain: {card.frequency_range?.join(' – ')} GHz; sensor {card.sensor_id}</p><p>{card.preprocessing}</p>{card.provenance_limitations?.map((s:string)=><p key={s}>{s}</p>)}</details>
  </div>;
}
export function PredictionResult({result,card}:{result?:any;card?:any}) {
  if(!result)return <p role="status" className="lab-empty">No result. Metrics and predictions unavailable until actual data are supplied.</p>;
  const title=result.research_prediction?(result.research_prediction.includes('CANCER-REFERENCE')?'CANCER-REFERENCE PATTERN':'NORMAL REFERENCE PATTERN'):result.status;
  return <div role="status" className="lab-result space-y-4"><Badge variant="outline">{result.source||'Unavailable'} · {result.input_provenance||'Unavailable'}</Badge><h3>{title}</h3>{result.reason&&<p>{result.reason}</p>}<div className="lab-metrics"><Metric label="Decision score (uncalibrated margin)" value={result.decision_margin}/><Metric label="Estimated concentration" value={result.predicted_concentration} unit={result.unit}/></div><p>Model version: {result.model_version}</p><p>Dataset version: {result.dataset_version}</p><p>Supported domain: {card?.frequency_range?.join(' – ')||'Unavailable'} GHz · sensor {card?.sensor_id||'Unavailable'}</p><p className="lab-caption">Scores are not probabilities. RESEARCH CLASSIFICATION ONLY — NOT A MEDICAL DIAGNOSIS. Cancer type: Unavailable.</p></div>;
}
