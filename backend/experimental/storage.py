"""Append-only local storage; no external upload or model pickle loading."""
from pathlib import Path
import json
from .records import Sample, digest
ROOT = Path(__file__).resolve().parents[2] / "experimental-data"

def write_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as f:
        json.dump(value, f, allow_nan=False, indent=2)

def save_sample(sample: Sample):
    data=sample.model_dump(mode="json")
    write_new(ROOT / "samples" / (sample.sample_id+".json"), data)
    return data

def samples():
    return [Sample.model_validate_json(p.read_text(encoding="utf-8")).model_dump(mode="json")
            for p in sorted((ROOT/"samples").glob("*.json"))]

def snapshot(records):
    rows=sorted(records,key=lambda r:r["sample_id"])
    version=digest(rows)
    manifest={"dataset_version":version,"samples":rows,"file_hashes":{r["sample_id"]:digest(r) for r in rows}}
    path=ROOT/"datasets"/(version+".json")
    if not path.exists(): write_new(path,manifest)
    elif json.loads(path.read_text(encoding="utf-8")) != manifest: raise ValueError("Dataset snapshot integrity mismatch.")
    return version
