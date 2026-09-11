"""Constructed test fixtures only; never research measurements or model evidence."""
from uuid import uuid4
import json
import subprocess
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend import main
from backend.experimental import storage, ml
from backend.experimental.records import Sample, features

@pytest.fixture
def local(tmp_path,monkeypatch):
    monkeypatch.setattr(storage,"ROOT",tmp_path/"experimental-data")
    return storage.ROOT

def record(i=0,task="blood",source="RAW_VNA"):
    f=np.linspace(1,3,16); centre=1.4 if i<10 else 2.5
    y=-2-15*np.exp(-((f-centre)/.3)**2)+i*.005
    return Sample(specimen_group=str(uuid4()),experiment_type=task,source_type=source,
        reference_label=("NORMAL_REFERENCE" if i<10 else "CANCER_REFERENCE") if task=="blood" else None,
        reference_established=True, known_concentration_optional=float(i+1) if task!="blood" else None,
        concentration_unit_optional="mg/L" if task!="blood" else None,sensor_id="fixture-sensor",measurement_session_id="fixture-session",
        replicate_id="1",measurement_date="2026-01-01",frequency_unit="GHz",quality_status="APPROVED",
        provenance={"axis_calibration_confirmed":True} if source=="IMAGE_EXTRACTED" else {},points=list(zip(f,y))).model_dump(mode="json")

def test_missing_labels_and_concentrations_never_invented():
    for task in ("blood","glucose","nitrate"):
        r=record(task=task);r["reference_label"]=None;r["known_concentration_optional"]=None
        with pytest.raises(ValueError,match="Missing reference"):ml.validate_training([r])
    r=record();r["cancer_type_optional"]="independent metadata"
    with pytest.raises(ValueError,match="Cancer type"):Sample.model_validate(r)

def test_image_default_exclusion_and_axis_validation():
    r=record(source="IMAGE_EXTRACTED")
    with pytest.raises(ValueError,match="excluded"):ml.validate_training([r])
    ml.validate_training([r],allow_images=True)
    r["provenance"]={}
    with pytest.raises(ValueError,match="calibration"):Sample.model_validate(r)

def test_leakage_and_conflicting_reference_blocked():
    a=record();b={**a,"sample_id":str(uuid4()),"replicate_id":"2"}
    with pytest.raises(ValueError,match="leakage"):ml.check_leakage([a,b],{a["sample_id"]:"TRAIN",b["sample_id"]:"TEST"})
    b["reference_label"]="CANCER_REFERENCE"
    with pytest.raises(ValueError,match="Conflicting"):ml.validate_training([a,b])

def test_duplicate_curves_cannot_masquerade_as_independent():
    a=record();b={**a,"sample_id":str(uuid4()),"specimen_group":str(uuid4())}
    with pytest.raises(ValueError,match="Identical curves"):ml.validate_training([a,b])

def test_small_dataset_has_no_fake_metrics_or_saved_model(local):
    with pytest.raises(ValueError,match="Insufficient independent samples"):ml.train([record()])
    assert not local.exists()

def test_training_scaler_and_test_metrics_use_their_own_partitions(local):
    records=[record(i) for i in range(20)]
    card=ml.train(records,margin_threshold=0)
    saved=json.loads((local/"models"/(card["model_id"]+".json")).read_text())
    train=[r for r in records if card["split_groups"][r["specimen_group"]]=="TRAIN"]
    test=[r for r in records if card["split_groups"][r["specimen_group"]]=="TEST"]
    X,y,_=ml.matrix(train,card["feature_schema"])
    np.testing.assert_allclose(saved["model"]["mean"],X.mean(0))
    tx,ty,_=ml.matrix(test,card["feature_schema"])
    assert card["metrics"]["held_out_test"]==ml.evaluate(ty,ml.scores(saved["model"],tx),True)
    assert card["counts"]["TEST"]["specimens"]==4
    assert len(card["metrics"]["train_grouped_cv"]["logistic"])==3
    assert card["dataset_version"]==storage.snapshot(records)
    assert (local/"datasets"/(card["dataset_version"]+".json")).exists()
    assert ml.predict(saved,train[0],margin_threshold=1e6)["status"].startswith("INSUFFICIENT")
    outside={**train[0],"sensor_id":"different sensor"}
    assert "sensor" in ml.predict(saved,outside)["reason"]
    # Feature-domain check with same sensor and valid curve bounds.
    outside={**train[0],"points":[[f,y-1000] for f,y in train[0]["points"]]}
    assert "bounds" in ml.predict(saved,outside)["reason"]
    assert ml.predict(saved,train[0])["probability"] is None
    next_card=ml.train(records,margin_threshold=0)
    assert next_card["model_id"]!=card["model_id"]
    assert next_card["dataset_version"]==card["dataset_version"]

def test_regression_metrics_and_unit_rejection(local):
    rows=[record(i,"glucose") for i in range(20)]
    card=ml.train(rows,representation="curve")
    assert card["metrics"]["held_out_test"]["independent_samples"]==4
    assert set(card["metrics"]["held_out_test"])=={"mae","rmse","r2","independent_samples"}
    rows[-1]["concentration_unit_optional"]="mmol/L"
    with pytest.raises(ValueError,match="Mixed concentration"):ml.validate_training(rows)
    assert ml.evaluate(np.ones(4),np.ones(4),False)["r2"] is None
    assert ml.evaluate(np.array([0,2]),np.array([1,1]),False)["mae"]==1

def test_bandwidth_gaps_and_shift():
    data=[[1,-12],[2,-13],[3,-2],[4,-12],[5,-13]]
    result=features(data,1.5)
    assert result["bandwidth_ghz"]==1
    assert result["shift_ghz"]==.5
    assert result["q"] is None

def test_store_is_append_only_and_local_api_rejects_remote_origin(local):
    r=Sample.model_validate(record());storage.save_sample(r)
    with pytest.raises(FileExistsError):storage.save_sample(r)
    client=TestClient(main.app)
    assert client.get("/api/experimental/samples").status_code==200
    assert client.post("/api/experimental/samples",json=r.model_dump(mode="json"),headers={"Origin":"https://untrusted.example"}).status_code==403

def test_experimental_files_ignored_by_git():
    result=subprocess.run(["git","check-ignore","experimental-data/samples/private.json","experimental-data/models/private.json"],capture_output=True,text=True)
    assert result.returncode==0 and len(result.stdout.splitlines())==2


def test_cross_validation_never_uses_a_held_out_reference():
    rows=[record(i) for i in range(20)]
    schema={"representation":"physical","columns":ml.FEATURES+["shift_ghz"],"grid_ghz":np.linspace(1,3,64).tolist(),
            "reference_resonance":features(rows[0]["points"])["resonance_ghz"],"reference_sample_id":rows[0]["sample_id"]}
    folds=ml.cross_validate(rows,schema,"logistic",True,42)
    assert sum(m.get("status")=="unavailable" for m in folds)==1
    assert any("reference leakage" in m.get("reason","") for m in folds)
