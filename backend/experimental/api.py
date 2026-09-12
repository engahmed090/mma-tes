from pathlib import Path
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from .records import Sample, features
from . import storage, ml

def local_only(request: Request):
    if request.client and request.client.host not in ("127.0.0.1","::1","testclient"):
        raise HTTPException(403,"Experimental API is local-only; do not expose through a public proxy.")
    origin=request.headers.get("origin")
    if origin and origin not in ("http://127.0.0.1:8080","http://localhost:8080"):
        raise HTTPException(403,"Experimental writes require the local research UI origin.")

router=APIRouter(prefix="/api/experimental",dependencies=[Depends(local_only)])

@router.get("/samples")
def list_samples(): return storage.samples()

@router.post("/samples")
def add_sample(sample: Sample):
    try:
        ref=None
        if sample.reference_sample_id:
            ref=next((r for r in storage.samples() if r["sample_id"]==sample.reference_sample_id),None)
            if ref is None or ref["experiment_type"]!=sample.experiment_type or ref["sensor_id"]!=sample.sensor_id:
                raise ValueError("Reference must exist and match experiment and sensor.")
        result=storage.save_sample(sample)
        return {"sample":result,"features":features(sample.points,features(ref["points"])["resonance_ghz"] if ref else None)}
    except (ValueError,FileExistsError) as e: raise HTTPException(422,str(e)) from e

class TrainRequest(BaseModel):
    sample_ids: list[str] = Field(min_length=1,max_length=2000)
    representation: str = "physical"
    allow_images: bool = False
    seed: int = Field(default=42,ge=0,le=2147483647)
    reference_sample_id: str | None = None
    include_bandwidth: bool = False
    margin_threshold: float = Field(default=1.,ge=0,allow_inf_nan=False)

def run_training(request: TrainRequest, progress=None):
    try:
        records=storage.samples(); rows=[r for r in records if r["sample_id"] in request.sample_ids]
        if len(rows)!=len(set(request.sample_ids)): raise ValueError("Unknown sample ID.")
        reference=next((r for r in rows if r["sample_id"]==request.reference_sample_id),None)
        if request.reference_sample_id and reference is None: raise ValueError("Reference must be selected in the dataset.")
        return ml.train(rows, request.representation, request.allow_images, request.seed, reference, request.include_bandwidth, request.margin_threshold, progress=progress)
    except (ValueError,OSError) as e: raise HTTPException(422,str(e)) from e

@router.get("/models")
def models():
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted((storage.ROOT/"models").glob("*.card.json"))]

class PredictionRequest(BaseModel):
    model_id: UUID
    sample: Sample
    margin_threshold: float | None = Field(default=None,ge=0,allow_inf_nan=False)

@router.post("/predict")
def predict(request: PredictionRequest):
    path=storage.ROOT/"models"/(str(request.model_id)+".json")
    if not path.is_file(): raise HTTPException(404,"Experimental model unavailable.")
    try: return ml.predict(json.loads(path.read_text(encoding="utf-8")),request.sample.model_dump(mode="json"),request.margin_threshold)
    except ValueError as e: raise HTTPException(422,str(e)) from e


@router.post("/train")
def train(request: TrainRequest):
    return run_training(request)

# One local training worker, bounded job history. No measurements leave this process.
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import uuid4
import copy
_executor = ThreadPoolExecutor(max_workers=1)
_jobs = {}
_jobs_lock = Lock()

@router.post("/training-jobs", status_code=202)
def start_training_job(request: TrainRequest):
    with _jobs_lock:
        if any(j["status"] == "running" for j in _jobs.values()):
            raise HTTPException(409, "A local training run is already in progress.")
        while len(_jobs) >= 20:
            _jobs.pop(next(iter(_jobs)))
        job_id = str(uuid4())
        _jobs[job_id] = {"status": "running", "stage": "Queued", "events": []}
    def update(stage):
        with _jobs_lock:
            _jobs[job_id]["stage"] = stage
            _jobs[job_id]["events"].append(stage)
    def work():
        try:
            result = run_training(request, update)
            with _jobs_lock:
                _jobs[job_id].update(status="complete", stage="Complete", result=result)
        except Exception as exc:
            with _jobs_lock:
                _jobs[job_id].update(status="failed", stage="Failed", error=str(exc.detail) if isinstance(exc, HTTPException) else "Local training failed; no validated result is available.")
    _executor.submit(work)
    return {"job_id": job_id}

@router.get("/training-jobs/{job_id}")
def training_job(job_id: UUID):
    with _jobs_lock:
        job = _jobs.get(str(job_id))
        if job is None:
            raise HTTPException(404, "Training job unavailable; local server may have restarted.")
        return copy.deepcopy(job)
