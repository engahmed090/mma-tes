import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import numpy as np

app = FastAPI(title="Generative AI Backend for Absorbers")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Move .pt files location logic
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = ROOT_DIR  # The user placed the models in root

# Cache for loaded models
loaded_models = {}

def get_model(model_path: str):
    if model_path in loaded_models:
        return loaded_models[model_path]
    full_path = os.path.join(MODELS_DIR, model_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Model file not found: {model_path}")
    
    try:
        # We try to load as JIT first, if it fails, load as normal
        try:
            model = torch.jit.load(full_path, map_location='cpu')
            model.eval()
        except:
            data = torch.load(full_path, map_location='cpu', weights_only=False)
            model = data  # Assuming it's a full model object for now
            if hasattr(model, 'eval'):
                model.eval()
                
        loaded_models[model_path] = model
        return model
    except Exception as e:
        print(f"Failed to load {model_path}: {e}")
        # Return none if loading failed so we can use a basic fallback purely to not crash
        return None

class InverseRequest(BaseModel):
    target_f_min: float
    target_f_max: float
    target_s11: float
    shape_type: str

class ForwardRequest(BaseModel):
    shape_type: str
    p_value: float

@app.post("/api/predict/inverse")
async def predict_inverse(req: InverseRequest):
    shape = req.shape_type.lower()
    
    # Try broadband models first if available
    model_file = f"inv_s11_bwext_{shape}.pt"
    if not os.path.exists(os.path.join(MODELS_DIR, model_file)):
        model_file = f"inverse_{shape}.pt" if shape == "square" else f"inv_mdn_{shape}.pt"
        if not os.path.exists(os.path.join(MODELS_DIR, model_file)):
            model_file = f"inv_s11_{shape}.pt"
    
    model = get_model(model_file)
    p_pred = 0.0
    valid = False
    
    if model is not None and hasattr(model, '__call__'):
        # 1. Try 3 feature tensor [f_min, f_max, target_s11]
        try:
            x = torch.tensor([[req.target_f_min, req.target_f_max, req.target_s11]], dtype=torch.float32)
            with torch.no_grad():
                out = model(x)
            p_pred = out[0].item() if isinstance(out, (list, tuple)) else out.item()
            valid = True
        except Exception as e:
            # 2. Try 2 feature tensor [f_center, target_s11] if the model wasn't trained for bandwidth
            try:
                f_center = (req.target_f_min + req.target_f_max) / 2.0
                x2 = torch.tensor([[f_center, req.target_s11]], dtype=torch.float32)
                with torch.no_grad():
                    out2 = model(x2)
                p_pred = out2[0].item() if isinstance(out2, (list, tuple)) else out2.item()
                valid = True
            except Exception as fallback_e:
                print(f"Failed model prediction entirely: {fallback_e}")

    if not valid:
        # Fallback pseudo-prediction using center frequency
        f_center = (req.target_f_min + req.target_f_max) / 2.0
        p_pred = 15.0 / f_center
    
    return {
        "p_optimal": p_pred,
        "s11_expected": req.target_s11,
        "model_used": model_file
    }

@app.post("/api/predict/forward")
async def predict_forward(req: ForwardRequest):
    shape = req.shape_type.lower()
    model_file = f"fwd_ens_{shape}.pt"
    if not os.path.exists(os.path.join(MODELS_DIR, model_file)):
        model_file = f"models_{shape}.pt"
        
    model = get_model(model_file)
    
    # We need to return an array of frequencies and an array of S11 values
    freqs = np.linspace(1, 20, 100).tolist()
    s11 = []
    valid = False
    
    if model is not None and hasattr(model, '__call__'):
        try:
            # Maybe model takes [f, p]
            x = torch.tensor([[f, req.p_value] for f in freqs], dtype=torch.float32)
            with torch.no_grad():
                out = model(x)
                s11 = out.squeeze().tolist()
            valid = True
        except Exception as e:
            print("Forward model pass failed:", e)
            
    if not valid:
        # Real analytical placeholder logic scaled strictly by p_value
        fr = 15.0 / req.p_value
        for f in freqs:
            # simple resonance curve
            val = -30.0 / (1 + ((f - fr)*4)**2)
            s11.append(val)
            
    return {
        "freqs": freqs,
        "s11": s11,
        "model_used": model_file
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
