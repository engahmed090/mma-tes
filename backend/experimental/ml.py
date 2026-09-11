"""Reproducible NumPy baselines. Specimens, not replicates, are evaluation units."""
from datetime import datetime, timezone
from uuid import uuid4
import json
import numpy as np
from .records import features, digest
from . import storage
CODE_VERSION="experimental-numpy-v1"
FEATURES=["resonance_ghz","min_s11_db","mean_s11_db","std_s11_db"]

def grouped_split(records, seed=42):
    groups={r["specimen_group"] for r in records}
    rng=np.random.default_rng(seed); out={}
    blood=records[0]["experiment_type"]=="blood"
    buckets=([sorted({r["specimen_group"] for r in records if r["reference_label"]==label})
              for label in ["NORMAL_REFERENCE","CANCER_REFERENCE"]] if blood else [sorted(groups)])
    if any(len(b)<(10 if blood else 20) for b in buckets):
        raise ValueError("Insufficient independent samples for reliable validation. Require 10 specimens per blood class or 20 regression specimens.")
    for bucket in buckets:
        rng.shuffle(bucket); n=len(bucket); a=int(.6*n); b=int(.8*n)
        for split,items in zip(["TRAIN","VALIDATION","TEST"],[bucket[:a],bucket[a:b],bucket[b:]]):
            for group in items: out[group]=split
    return out

def check_leakage(records, assignment):
    seen={}
    for r in records:
        split=assignment.get(r["sample_id"])
        if split not in ("TRAIN","VALIDATION","TEST"): raise ValueError("Every scan requires a valid split.")
        group=r["specimen_group"]
        if group in seen and seen[group]!=split: raise ValueError("Specimen leakage blocked: replicates cross splits.")
        seen[group]=split
    return seen

def validate_training(records, allow_images=False):
    if not records: raise ValueError("No approved training samples.")
    task=records[0]["experiment_type"]; groups={}; hashes={}
    for r in records:
        if r["experiment_type"]!=task: raise ValueError("Do not mix experiment tasks.")
        if r["source_type"] not in (["RAW_VNA","IMAGE_EXTRACTED"] if allow_images else ["RAW_VNA"]):
            raise ValueError("Training source excluded; image-derived data requires explicit review opt-in.")
        if r["quality_status"]!="APPROVED" or not r["reference_established"]: raise ValueError("Independent reference target required.")
        target=r["reference_label"] if task=="blood" else r["known_concentration_optional"]
        if target is None: raise ValueError("Missing reference label or known concentration; never inferred.")
        if task!="blood" and not r["concentration_unit_optional"]: raise ValueError("Explicit concentration unit required.")
        g=r["specimen_group"]; sig=(target,r["concentration_unit_optional"],r["sensor_id"])
        if g in groups and groups[g]!=sig: raise ValueError("Conflicting replicate targets, units or sensor.")
        groups[g]=sig
        h=digest(r["points"])
        if h in hashes and hashes[h]!=g: raise ValueError("Identical curves in different specimen groups: review duplicate/leakage risk.")
        hashes[h]=g
    if len({r["sensor_id"] for r in records})!=1: raise ValueError("A model supports one sensor ID; do not pool different sensors.")
    if task!="blood" and len({r["concentration_unit_optional"] for r in records})!=1:
        raise ValueError("Mixed concentration units rejected; no silent conversion.")

def row_features(r, schema):
    f=features(r["points"],schema.get("reference_resonance"))
    if schema["representation"]=="curve":
        a=np.asarray(r["points"]); grid=np.array(schema["grid_ghz"])
        if a[0,0]>grid[0] or a[-1,0]<grid[-1]: raise ValueError("OUT OF TRAINING DOMAIN: frequency coverage.")
        return np.interp(grid,a[:,0],a[:,1])
    grid=schema["grid_ghz"]
    if abs(r["points"][0][0]-grid[0])>1e-9 or abs(r["points"][-1][0]-grid[-1])>1e-9:
        raise ValueError("Physical features require identical sweep bounds; use curve representation for overlapping sweeps.")
    keys=schema["columns"]
    if any(f[k] is None for k in keys): raise ValueError("Feature unavailable; choose a different representation or reference.")
    return np.array([f[k] for k in keys])

def matrix(records,schema):
    # Each specimen contributes one mean feature vector; replicates cannot inflate counts.
    groups=sorted({r["specimen_group"] for r in records}); X=[]; y=[]
    for g in groups:
        rows=[r for r in records if r["specimen_group"]==g]
        X.append(np.mean([row_features(r,schema) for r in rows],axis=0))
        y.append(int(rows[0]["reference_label"]=="CANCER_REFERENCE") if rows[0]["experiment_type"]=="blood" else rows[0]["known_concentration_optional"])
    return np.asarray(X),np.asarray(y),groups

def fit(X,y,kind):
    mean=X.mean(0); std=X.std(0); std=np.where(std<1e-12,1.,std); z=(X-mean)/std
    model={"kind":kind,"mean":mean.tolist(),"std":std.tolist()}
    if kind=="centroid": model["centres"]=[z[y==c].mean(0).tolist() for c in (0,1)]
    elif kind=="logistic":
        a=np.column_stack((np.ones(len(z)),z)); w=np.zeros(a.shape[1])
        for _ in range(800):
            p=1/(1+np.exp(-np.clip(a@w,-30,30)))
            w-=.05*(a.T@(p-y)/len(y)+.01*np.r_[0,w[1:]])
        model["weights"]=w.tolist()
    elif kind=="mean": model["constant"]=float(y.mean())
    else:
        alpha=float(kind.split(":")[1]); a=np.column_stack((np.ones(len(z)),z))
        penalty=np.eye(a.shape[1])*alpha; penalty[0,0]=0
        model["weights"]=np.linalg.solve(a.T@a+penalty,a.T@y).tolist()
    return model

def scores(model,X):
    z=(X-np.array(model["mean"]))/np.array(model["std"])
    if model["kind"]=="centroid":
        c=np.array(model["centres"]); return np.linalg.norm(z-c[0],axis=1)-np.linalg.norm(z-c[1],axis=1)
    if model["kind"]=="mean": return np.full(len(X),model["constant"])
    return np.column_stack((np.ones(len(z)),z))@np.array(model["weights"])

def evaluate(y,score,blood):
    if not blood:
        residual=y-score; total=float(np.sum((y-y.mean())**2))
        return {"mae":float(np.mean(abs(residual))),"rmse":float(np.sqrt(np.mean(residual**2))),
                "r2":None if total==0 else float(1-np.sum(residual**2)/total),"independent_samples":len(y)}
    pred=score>=0; pos=y==1; neg=~pos
    tp=int(np.sum(pred&pos)); tn=int(np.sum(~pred&neg)); fp=int(np.sum(pred&neg)); fn=int(np.sum(~pred&pos))
    ratio=lambda a,b: a/b if b else None
    auc=None
    if pos.any() and neg.any():
        comp=score[pos,None]-score[None,neg]; auc=float(np.mean((comp>0)+.5*(comp==0)))
    return {"confusion_matrix":[[tn,fp],[fn,tp]],"class_order":["NORMAL_REFERENCE","CANCER_REFERENCE"],
            "recall":ratio(tp,tp+fn),"specificity":ratio(tn,tn+fp),"precision":ratio(tp,tp+fp),
            "f1":ratio(2*tp,2*tp+fp+fn),"roc_auc":auc,"independent_samples":len(y)}

def cross_validate(records,schema,kind,blood,seed):
    # Each fold rebuilds frequency-grid preprocessing from its own TRAIN groups.
    import copy
    _,y,groups=matrix(records,schema)
    rng=np.random.default_rng(seed); folds=[[] for _ in range(3)]
    for idx in ([np.where(y==c)[0] for c in (0,1)] if blood else [np.arange(len(y))]):
        rng.shuffle(idx)
        for k,part in enumerate(np.array_split(idx,3)): folds[k].extend(part.tolist())
    metrics=[]
    for test in folds:
        held={groups[i] for i in test}
        training=[r for r in records if r["specimen_group"] not in held]
        testing=[r for r in records if r["specimen_group"] in held]
        fold_schema=copy.deepcopy(schema)
        if schema.get("reference_sample_id") and not any(r["sample_id"]==schema["reference_sample_id"] for r in training):
            metrics.append({"status":"unavailable","reason":"Selected reference is held out in this fold; no reference leakage permitted."})
            continue
        lo=max(r["points"][0][0] for r in training); hi=min(r["points"][-1][0] for r in training)
        fold_schema["grid_ghz"]=np.linspace(lo,hi,64).tolist()
        try:
            X,ytrain,_=matrix(training,fold_schema); tx,ty,_=matrix(testing,fold_schema)
            m=fit(X,ytrain,kind); metrics.append(evaluate(ty,scores(m,tx),blood))
        except ValueError as e: metrics.append({"status":"unavailable","reason":str(e)})
    return metrics

def train(records, representation="physical", allow_images=False, seed=42, reference=None, include_bandwidth=False, margin_threshold=1.0, assignment=None):
    validate_training(records,allow_images)
    if representation not in ("physical","curve"): raise ValueError("Unknown representation.")
    if not np.isfinite(margin_threshold) or margin_threshold<0: raise ValueError("Invalid abstention margin.")
    groups=check_leakage(records,assignment) if assignment else grouped_split(records,seed)
    partitions={s:[r for r in records if groups[r["specimen_group"]]==s] for s in ["TRAIN","VALIDATION","TEST"]}
    blood=records[0]["experiment_type"]=="blood"
    # Applies also to manually supplied assignments.
    for s,rows in partitions.items():
        n=len({r["specimen_group"] for r in rows})
        if n<(12 if s=="TRAIN" else 4): raise ValueError("Insufficient independent samples for reliable validation.")
        if blood and any(len({r["specimen_group"] for r in rows if r["reference_label"]==c})<(6 if s=="TRAIN" else 2) for c in ["NORMAL_REFERENCE","CANCER_REFERENCE"]):
            raise ValueError("Insufficient independent samples per reference class.")
    training=partitions["TRAIN"]
    if reference and reference["specimen_group"] not in {r["specimen_group"] for r in training}:
        raise ValueError("Feature reference must belong to TRAIN, never validation/test.")
    lo=max(r["points"][0][0] for r in training); hi=min(r["points"][-1][0] for r in training)
    if hi<=lo: raise ValueError("Training curves have no common frequency interval.")
    schema={"representation":representation,"columns":FEATURES.copy(),"grid_ghz":np.linspace(lo,hi,64).tolist(),
            "reference_resonance":features(reference["points"])["resonance_ghz"] if reference else None,"reference_sample_id":reference["sample_id"] if reference else None,"bandwidth_threshold_db":-10.}
    if reference: schema["columns"].append("shift_ghz")
    if include_bandwidth: schema["columns"].append("bandwidth_ghz")
    matrices={s:matrix(rows,schema) for s,rows in partitions.items()}; X,y,_=matrices["TRAIN"]
    candidates=["logistic","centroid"] if blood else ["mean","ridge:0.1","ridge:1","ridge:10"]
    fits={k:fit(X,y,k) for k in candidates}; valX,valy,_=matrices["VALIDATION"]
    validation={k:evaluate(valy,scores(m,valX),blood) for k,m in fits.items()}
    objective=lambda k: -(validation[k]["recall"]+validation[k]["specificity"])/2 if blood else validation[k]["rmse"]
    chosen=min(candidates,key=objective); model=fits[chosen]
    testX,testy,_=matrices["TEST"]; test=evaluate(testy,scores(model,testX),blood)
    eligible=all(validation[chosen][k] is not None and validation[chosen][k]>=.8 and test[k] is not None and test[k]>=.8 for k in ["recall","specificity"]) if blood else len(np.unique(y))>=3
    snapshot=storage.snapshot(records); model_id=str(uuid4())
    result={"model_id":model_id,"model_type":chosen,"task":records[0]["experiment_type"],"created_at":datetime.now(timezone.utc).isoformat(),
        "dataset_version":snapshot,"feature_schema":schema,"frequency_range":[lo,hi],"preprocessing":"Mean/std fit on TRAIN specimens only; mean replicate features per specimen",
        "counts":{s:{"scans":len(partitions[s]),"specimens":len(matrices[s][2])} for s in partitions},
        "split_groups":groups,"metrics":{"validation_candidates":validation,"held_out_test":test,
        "train_grouped_cv":{k:cross_validate(training,schema,k,blood,seed) for k in candidates}},
        "code_version":CODE_VERSION,"seed":seed,"model":model,"training_feature_min":X.min(0).tolist(),"training_feature_max":X.max(0).tolist(),
        "sensor_id":records[0]["sensor_id"],"concentration_unit":records[0]["concentration_unit_optional"],
        "concentration_range":None if blood else [float(y.min()),float(y.max())],"allow_images":allow_images,
        "margin_threshold":margin_threshold,"inference_eligible":eligible,"probability":None,
        "validation_policy":"At least 20 specimens (10/class for blood); blood validation AND test recall/specificity >=0.8. Engineering gate, not clinical validation.",
        "provenance_limitations":["Research only; not clinically validated.","Reference labels and specimen identity are user-supplied, not independently verified by software.",
        "Scores are uncalibrated margins, never probabilities. Minimum counts do not establish statistical reliability.","Held-out test must not be reused for iterative tuning; repeated snapshots can reuse specimens.",
        "Cancer-type inference unavailable; binary reference-class task only."]}
    storage.write_new(storage.ROOT/"models"/(model_id+".json"),result)
    storage.write_new(storage.ROOT/"models"/(model_id+".card.json"),{k:v for k,v in result.items() if k!="model"})
    return {k:v for k,v in result.items() if k!="model"}

def predict(card,sample, margin_threshold=None):
    base={"source":"MODEL_OUTPUT","model_version":card["model_id"],"dataset_version":card["dataset_version"],"input_provenance":sample["source_type"],"probability":None,"cancer_type":"Unavailable"}
    def abstain(reason): return {**base,"status":"INSUFFICIENT CONFIDENCE / OUT OF TRAINING DOMAIN","reason":reason}
    if not card["inference_eligible"]: return abstain("Validation requirements not met.")
    if sample["experiment_type"]!=card["task"] or sample["sensor_id"]!=card["sensor_id"]: return abstain("Task or sensor mismatch.")
    if sample["source_type"] not in (["RAW_VNA","IMAGE_EXTRACTED"] if card["allow_images"] else ["RAW_VNA"]): return abstain("Unsupported input provenance.")
    a=np.asarray(sample["points"]);lo,hi=card["frequency_range"]
    if a[0,0]>lo or a[-1,0]<hi: return abstain("Insufficient frequency coverage.")
    try: x=row_features(sample,card["feature_schema"])
    except ValueError as e: return abstain(str(e))
    low=np.array(card["training_feature_min"]); high=np.array(card["training_feature_max"])
    if ((x<low-1e-10)|(x>high+1e-10)).any(): return abstain("Feature outside observed TRAIN bounds.")
    score=float(scores(card["model"],x[None,:])[0])
    if card["task"]=="blood":
        threshold=card["margin_threshold"] if margin_threshold is None else margin_threshold
        if not np.isfinite(threshold) or threshold<0: raise ValueError("Invalid abstention threshold.")
        if abs(score)<threshold: return abstain("Uncalibrated decision margin below configured threshold.")
        return {**base,"status":"RESEARCH CLASSIFICATION ONLY — NOT A MEDICAL DIAGNOSIS", "research_prediction":"Pattern consistent with "+("CANCER-REFERENCE" if score>=0 else "NORMAL")+" reference class", "decision_margin":score,"margin_threshold":threshold}
    low,high=card["concentration_range"]
    if not low<=score<=high: return abstain("Predicted concentration exceeds training calibration range; no extrapolation.")
    return {**base,"status":"RESEARCH ESTIMATE ONLY","predicted_concentration":score,"unit":card["concentration_unit"],"validation_range":card["concentration_range"]}
