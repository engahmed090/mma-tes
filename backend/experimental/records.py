"""Local anonymous research records. No patient identifiers or clinical claims."""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
import hashlib
import json
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator

class Sample(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    sample_id: str = Field(default_factory=lambda: str(uuid4()), pattern=r"^[a-f0-9-]{36}$")
    specimen_group: str = Field(pattern=r"^[a-f0-9-]{36}$")
    experiment_type: Literal["blood", "glucose", "nitrate"]
    source_type: Literal["RAW_VNA", "IMAGE_EXTRACTED", "MANUAL", "ANALYTICAL", "UNVERIFIED"]
    reference_label: Literal["NORMAL_REFERENCE", "CANCER_REFERENCE"] | None = None
    reference_established: bool = False
    cancer_type_optional: str | None = Field(default=None, max_length=80)
    known_concentration_optional: float | None = Field(default=None, ge=0)
    concentration_unit_optional: Literal["mg/L", "mg/dL", "mmol/L", "mol/L"] | None = None
    sensor_id: str = Field(min_length=1, max_length=80)
    measurement_session_id: str = Field(min_length=1, max_length=80)
    replicate_id: str = Field(min_length=1, max_length=80)
    measurement_date: str = Field(max_length=40)
    notes: str = Field(default="", max_length=1000)
    raw_filename: str | None = Field(default=None, max_length=255)
    image_filename: str | None = Field(default=None, max_length=255)
    raw_content: str | None = Field(default=None, max_length=2000000)
    image_data_url: str | None = Field(default=None, max_length=8000000)
    frequency_unit: Literal["Hz", "kHz", "MHz", "GHz"]
    s11_unit: Literal["dB"] = "dB"
    provenance: dict = Field(default_factory=dict)
    quality_status: Literal["APPROVED"]
    points: list[tuple[float, float]] = Field(min_length=8, max_length=50000)
    reference_sample_id: str | None = Field(default=None, pattern=r"^[a-f0-9-]{36}$")
    # Always canonical GHz / dB, independent of original import units.
    @model_validator(mode="after")
    def validate_record(self):
        a = np.asarray(self.points)
        if not np.isfinite(a).all() or (a[:,0] <= 0).any() or (np.diff(a[:,0]) <= 0).any():
            raise ValueError("Curve requires finite, strictly increasing positive GHz and finite S11 dB.")
        if (self.reference_label or self.cancer_type_optional or self.known_concentration_optional is not None) and not self.reference_established:
            raise ValueError("Reference targets require independently established metadata confirmation.")
        if self.cancer_type_optional and self.reference_label != "CANCER_REFERENCE":
            raise ValueError("Cancer type requires a supplied CANCER_REFERENCE label; never inferred.")
        if self.known_concentration_optional is not None and not self.concentration_unit_optional:
            raise ValueError("Known concentration requires an explicit unit.")
        if self.image_data_url and not self.image_data_url.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")):
            raise ValueError("Only PNG/JPEG image artifacts are supported.")
        if self.source_type == "IMAGE_EXTRACTED" and not self.provenance.get("axis_calibration_confirmed"):
            raise ValueError("Image axis calibration must be confirmed.")
        return self

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()

def features(points, reference_resonance=None, threshold=-10.0):
    a=np.asarray(points); f,y=a[:,0],a[:,1]
    # Deterministic global minimum; tied minima use lowest frequency.
    i=int(np.argmin(y)); best=0.; start=None; has_band=False
    for k,v in enumerate(y):
        if v <= threshold:
            if start is None: start=k
            best=max(best,float(f[k]-f[start])); has_band=True
        else: start=None
    minima=[int(k) for k in range(1,len(y)-1) if y[k] < y[k-1] and y[k] <= y[k+1]]
    return {"resonance_ghz":float(f[i]), "min_s11_db":float(y[i]),
        "shift_ghz":None if reference_resonance is None else float(f[i]-reference_resonance),
        "bandwidth_ghz":best if has_band else None, "mean_s11_db":float(y.mean()), "std_s11_db":float(y.std()),
        "q":None, "q_reason":"No justified half-power resonance model supplied.",
        "resonance_rule":"Global sampled minimum; lowest-frequency tie. No interpolation of minima.",
        "local_minima_ghz":[float(f[k]) for k in minima],
        "warnings": (["Multiple local minima; global-minimum rule applied."] if len(minima)>1 else []) +
            (["Minimum at frequency boundary; resonance may be outside sweep."] if i in (0,len(y)-1) else []) +
            (["Positive S11: review calibration/passivity."] if (y>0).any() else [])}
