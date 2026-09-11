import builtins
import pytest
import blood_sensing_pipeline as pipeline

@pytest.fixture
def sources(tmp_path):
    # Deliberately tiny parser fixtures, not measured scientific datasets.
    for sample in pipeline.DATASETS.values():
        (tmp_path / sample["file"]).write_text("Frequency GHz S11\n1 -5\n2 -10\n3 -5\n")
    return tmp_path

def assert_unavailable(result):
    assert result["status"] == "unavailable"
    assert result["metrics"] is None
    assert not {"loss_history", "final_mse", "final_rmse", "r2_score", "training_points", "pred_curves"}.intersection(result)
    assert "dnn_metrics" not in result

def test_missing_datasets_produce_no_training_metrics_or_files(tmp_path):
    result = pipeline.run_pipeline(str(tmp_path), str(tmp_path / "out"))
    assert_unavailable(result)
    assert "missing" in result["reason"]
    assert not (tmp_path / "out").exists()

def test_missing_widths_are_not_assumed(sources):
    assert_unavailable(pipeline.run_pipeline(str(sources)))

def test_missing_torch_preserves_only_source_derived_results(sources, monkeypatch):
    original = builtins.__import__
    def unavailable_torch(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("PyTorch unavailable")
        return original(name, *args, **kwargs)
    monkeypatch.setattr(builtins, "__import__", unavailable_torch)
    result = pipeline.run_pipeline(str(sources), str(sources / "out"), {k: 10 for k in pipeline.DATASETS})
    assert_unavailable(result)
    assert result["datasets"]["air"]["provenance"]["type"] == "simulated"
    assert result["datasets"]["air"]["s11_at_fr_db"] == -10
    assert not (sources / "out").exists()

def test_training_failure_has_no_fabricated_fallback(sources, monkeypatch):
    def fail(*args):
        raise RuntimeError("Training failed")
    monkeypatch.setattr(pipeline, "train_blood_dnn", fail)
    result = pipeline.run_pipeline(str(sources), sample_widths={k: 10 for k in pipeline.DATASETS})
    assert_unavailable(result)
    assert result["reason"] == "Training failed"
    assert not hasattr(pipeline, "generate_synthetic_dnn_metrics")

def test_invalid_input_is_unavailable(sources):
    (sources / pipeline.DATASETS["air"]["file"]).write_text("Frequency GHz S11\n")
    assert_unavailable(pipeline.run_pipeline(str(sources), sample_widths={k: 10 for k in pipeline.DATASETS}))

def test_existing_checkpoint_is_not_overwritten(sources):
    parsed = {k: {"w_mm": 10, "eps_r": d["eps_r"], "freq_ghz": [1., 2.], "s11_db": [-5., -10.]} for k, d in pipeline.DATASETS.items()}
    checkpoint = sources / "fwd_blood_sensing.pt"
    checkpoint.write_bytes(b"test-only existing artifact")
    with pytest.raises(ValueError, match="Output exists"):
        pipeline.train_blood_dnn(parsed, {}, str(sources))
    assert checkpoint.read_bytes() == b"test-only existing artifact"

@pytest.mark.parametrize("script,extra", [
    ("train_dnn.py", []),
    ("train_dnn.py", ["--allow-analytical-augmentation"]),
    ("train_hybrid_vna.py", []),
])
def test_legacy_training_never_silently_substitutes_missing_inputs(tmp_path, script, extra):
    import subprocess
    import sys
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    command = [sys.executable, str(root / "ml_pipeline" / script)]
    if script == "train_dnn.py":
        command += ["--data-dir", str(tmp_path), "--out", str(tmp_path / "new-output"), "--epochs", "1"] + extra
    result = subprocess.run(command, cwd=tmp_path, capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert result.returncode != 0
    assert "Unavailable" in result.stderr
    assert not (tmp_path / "new-output").exists()
