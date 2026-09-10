from pathlib import Path
from typing import Literal
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
try:
    from .model_runtime import ModelUnavailable, load_predictor
except ImportError:
    from model_runtime import ModelUnavailable, load_predictor

app = FastAPI(title="Generative AI Backend for Absorbers")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
MODELS_DIR = Path(__file__).resolve().parent.parent
CONTRACTS_PATH = Path(__file__).with_name("model_contracts.json")
Shape = Literal["square", "ring", "rectangle", "ring_ro_sweep", "triangle1", "octa_resonator", "two_resonator"]

class InverseRequest(BaseModel):
    target_f_min: float = Field(gt=0, allow_inf_nan=False)
    target_f_max: float = Field(gt=0, allow_inf_nan=False)
    target_s11: float = Field(allow_inf_nan=False)
    shape_type: Shape

class ForwardRequest(BaseModel):
    shape_type: Shape
    p_value: float = Field(ge=0, allow_inf_nan=False)

def get_model(shape, inverse=False):
    # Combined checkpoints explicitly name the frequency-conditioned inverse.
    filename, section = f"{shape}.pt", "inverse_f_s11_to_p" if inverse else "forward"
    if not inverse and (Path(MODELS_DIR) / f"fwd_ens_{shape}.pt").is_file():
        filename, section = f"fwd_ens_{shape}.pt", "forward_ensemble"
    path = Path(MODELS_DIR) / filename
    if not path.is_file():
        raise HTTPException(404, f"Model file not found: {filename}")
    try:
        return load_predictor(path, section, CONTRACTS_PATH)
    except ModelUnavailable as error:
        raise HTTPException(503, str(error)) from error

def check_domain(value, lower, upper, label):
    if not lower <= value <= upper:
        raise HTTPException(422, f"{label} must be within the trained domain [{lower}, {upper}].")

def infer(model, values):
    try:
        return model(values)
    except Exception as error:
        raise HTTPException(503, "Model inference failed; no prediction was made.") from error

@app.post("/api/predict/inverse")
def predict_inverse(req: InverseRequest):
    if req.target_f_min != req.target_f_max:
        raise HTTPException(422, "Available inverse models take one frequency and S11, not bandwidth endpoints.")
    if req.shape_type in ("triangle1", "octa_resonator", "two_resonator"):
        raise HTTPException(422, "This fixed geometry has no tunable parameter for inverse design.")
    model = get_model(req.shape_type, inverse=True)
    r = model.ranges
    check_domain(req.target_f_min, r["fmin"], r["fmax"], "Frequency")
    check_domain(req.target_s11, r.get("s11_min", r.get("smin", -float("inf"))),
                 r.get("s11_max", r.get("smax", float("inf"))), "S11")
    p = infer(model, [[req.target_f_min, req.target_s11]])[0, 0].item()
    check_domain(p, r["pmin"], r["pmax"], "Predicted parameter")
    return {"p_optimal": p, "model_used": model.filename,
            "prediction_source": "pytorch", "inference_mode": "point_inverse"}

@app.post("/api/predict/forward")
def predict_forward(req: ForwardRequest):
    model = get_model(req.shape_type)
    r = model.ranges
    check_domain(req.p_value, r["pmin"], r["pmax"], "Parameter")
    freqs = np.linspace(r["fmin"], r["fmax"], 100)
    values = np.column_stack((freqs, np.full_like(freqs, req.p_value)))
    s11 = infer(model, values)[:, 0].tolist()
    return {"freqs": freqs.tolist(), "s11": s11, "model_used": model.filename,
            "prediction_source": "pytorch"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
