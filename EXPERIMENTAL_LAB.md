# Experimental Sensing Laboratory

Research use only. This system has not been clinically validated and must not be
used to diagnose or rule out cancer. The workflow collects anonymous, user-reported
measurements and reference metadata; software cannot establish their ground truth.

## Run locally

Use the existing README frontend/backend setup. No additional Python dependencies:
the isolated baselines use NumPy. Start FastAPI on 127.0.0.1:8000 and Vite on
127.0.0.1:8080. Open **Experimental Sensing Lab**. The tab works even if absorber
CST files are unavailable. It does not call chat or the external Streamlit service.
The API `/api/experimental/*` only accepts loopback clients and local UI origins.
Do not publish this API through a public reverse proxy: a proxy can appear local.
There is no authentication, encryption-at-rest, or multi-user access control.
Use a secured local workstation and non-identifying reference codes only.

## Files, schema and privacy

`experimental-data/` is created on first save and ignored by Git:

- `samples/<anonymous-UUID>.json`: approved, append-only record and source artifact.
- `datasets/<SHA256>.json`: immutable selected-sample snapshot plus record hashes.
- `models/<UUID>.json`: versioned NumPy model parameters and preprocessing.
- `models/<UUID>.card.json`: model card without fitted coefficient arrays.

Existing datasets/checkpoints/results are never overwritten. A changed sample
must be saved as a new record; preserve its specimen group. There is no delete UI.
Back up this private directory using your institution's approved storage process;
ignored files are not backed up by Git. No actual experiment or training is
performed on project datasets automatically. Automated test data are fixtures in
temporary directories, not scientific evidence.

Records include sample_id, specimen_group, experiment_type, source_type,
reference_label, reference_established, cancer_type_optional,
known_concentration_optional, concentration_unit_optional, sensor_id,
measurement_session_id, replicate_id, measurement_date, notes, raw_filename,
image_filename, original frequency_unit, s11_unit, provenance, quality_status,
canonical GHz/dB points, reference_sample_id and raw/image source content.
UUID sample IDs are generated automatically. Keep all replicates of a physical
specimen in the same anonymous specimen group; select an existing group for rescans.
Never enter a name, patient ID, identifying note or identifying filename. Images
are re-encoded to remove EXIF before persistence; visible identifying image content
is not automatically redacted. Raw text is retained unchanged and must be reviewed.

Reference targets require explicit independent-reference confirmation. The app
never creates ground-truth labels. Optional cancer type is stored only with an
independently supplied CANCER_REFERENCE label; cancer-type inference is unavailable.
Glucose/nitrate units are explicit mg/L, mg/dL, mmol/L or mol/L; mixed units are
rejected, with no automatic conversion. Blank targets may be saved for unknown
samples but cannot enter supervised training.

## Import, image calibration and review

Raw VNA is preferred. Reuses the existing strict one-port Touchstone 1.x parser
(S parameters, DB/MA/RI) and explicit-unit two-column CSV/text parser. Unsupported
multiport/keyword layouts and ambiguous units fail. Canonical arrays use GHz/dB;
the original detected unit remains recorded. At least eight points are required.

Optional PNG/JPEG digitization is **manual user tracing**, not automated AI/OCR.
Select inside plot corners in top-left, top-right, bottom-right, bottom-left order.
Click at least eight visible curve points. Confirm linear frequency and S11 axis
bounds/units. A planar homography maps traced pixels to calibrated coordinates,
correcting rotation/perspective. The image/trace overlay and numerical preview
must be reviewed before the separate save approval. Confidence is unavailable,
not a fabricated score. Log axes, hidden/overlapping traces, curved screens, and
lens distortion are unsupported. Capture a clear flat graph or use raw VNA instead.
Images are resized to at most 1600 pixels per dimension; fine features may be lost.
Image-derived records are excluded from training unless explicitly enabled.

Resonance uses the global sampled minimum; a tie selects the lowest frequency.
Multiple local minima and boundary minima produce warnings. Shift requires an
explicit same-task/same-sensor reference. Bandwidth is the widest contiguous sampled
passing interval at -10 dB, never bridged over failing samples; absent bands are
unavailable, not guessed. Q is unavailable without a justified half-power model.
Plots may interpolate/decimate for display; stored points are preserved. Blood
comparison displays actual first stored reference-class scans, not generated curves.

## Reproducible baseline training

Select approved reference-labelled scans from one task and sensor. Default sources:
RAW_VNA only. Explicit opt-in permits reviewed IMAGE_EXTRACTED. MANUAL, ANALYTICAL,
UNVERIFIED and MODEL_OUTPUT are not admitted as training measurements.

Training requires at least 20 independent specimens: at least 10 per blood class,
or 20 for regression. Blood stratifies by reference class; both tasks shuffle
specimen groups using the recorded seed (default 42) into 60/20/20 TRAIN/VALIDATION/
TEST. All replicates stay together and mean feature vectors give each specimen
one vote. Conflicting replicate targets and identical curves assigned to different
groups are rejected. These minimum counts are engineering collection gates, not
proof of statistical reliability or a clinical sample-size justification.

Representations:

- Physical: sampled resonance, minimum S11, mean/std S11. Optional contiguous
  bandwidth and explicit-reference shift (unavailable values block training).
  All physical-feature curves must share identical sweep bounds.
- Curve: 64 evenly spaced frequencies within TRAIN's common overlap; linear
  interpolation only, no extrapolation. Validation/test/inference must cover it.

Reference-shift preprocessing requires the reference specimen to be in TRAIN.
Grid selection, mean/std normalization and model fitting use TRAIN only.
Saved preprocessing is reused unchanged for validation, test and inference.

Blood compares regularized logistic and nearest-centroid baselines. Concentration
compares a mean-target baseline with ridge regression (alpha 0.1, 1, 10).
Selection uses validation balanced recall/specificity or validation RMSE, never
training accuracy. Three-fold specimen-level cross-validation is reported within
TRAIN and refits normalization and grid selection inside each fold. A fold is
unavailable if its selected reference is held out or sweep coverage is insufficient;
it never substitutes reference information from held-out groups. No DNN is added.

Metrics are computed from actual held-out predictions: confusion matrix,
recall/specificity/precision/F1, score-based ROC-AUC (ties handled), or MAE/RMSE/R2.
Undefined metrics are null/unavailable (e.g. R2 for constant targets). Model cards
separate train-fold CV, validation candidate results and selected-model test results,
with specimen and scan counts. No in-sample accuracy is presented as validation.
Do not repeatedly tune against the test set: independent external validation is
still needed, and the app does not stop you reusing a specimen across different runs.

## Local inference and abstention

Select a saved model and approve the unknown curve. Inputs must match task, sensor,
source policy, sweep coverage and observed TRAIN feature bounds. Out-of-domain
inputs abstain. Regression estimates outside TRAIN's concentration range abstain.
Units and training calibration range are returned with a valid estimate.

Blood additionally requires validation **and** held-out test recall/specificity
at least 0.8; otherwise classification is disabled. Passing this engineering gate
is not clinical validation. An absolute decision margin below the configured
threshold (default 1.0) abstains. Logistic logit and centroid distance margins are
model-specific **uncalibrated scores, not probabilities**; probability is unavailable.
Thresholds must be justified prospectively, not tuned to the reported test results.
The application returns model/dataset versions and input provenance for predictions
and abstentions. Cancer-type prediction remains unavailable.

## Validation and limitations

Run `pnpm typecheck`, `pnpm test`, `python -m pytest -q`, `pnpm build`, and
`git diff --check`. `RUN_LOCAL_INTEGRATION=1` with both servers enables the existing
API proxy smoke test. New tests cover calibration, import rejection, group leakage,
source exclusion, missing targets, train-only preprocessing, held-out calculations,
abstention, domain rejection, append-only versions and Git ignore behavior.

No real-world accuracy or clinical utility is claimed. Sensor drift, batch/session
confounding, independently verified specimen identity, probability calibration,
external validation, image extraction accuracy, and institution-specific governance
remain operator/research responsibilities. Sessions are recorded but not themselves
held out: specimen grouping does not eliminate shared-session confounding. Collection
is suitable only for anonymous non-clinical research on an access-controlled local
workstation; not a production clinical database or diagnostic system.
