# MMA project: local setup and readiness

React/Vite frontend, FastAPI/PyTorch prediction service, and separate optional
Supabase chat and Streamlit services. This repository is not research-validated.

## Frontend

Validated with Node 24.19 and pnpm 11.19.0. Install that pnpm version, then:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:8080. The dev server binds to loopback and proxies `/api`
to http://127.0.0.1:8000. The checked-in lockfile records the installed dependency
graph; no dependency version upgrades were requested for Stage 3. pnpm may ask
for dependency build-script approval: review esbuild and @swc/core before allowing
those build tools. Do not approve unrelated scripts blindly.

## Backend (second terminal)

Validated on Windows with Python 3.12 and CPU PyTorch. From the repository root:

```sh
python -m venv .venv
# Windows PowerShell: .venv/Scripts/Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install torch==2.14.0 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r backend/requirements-dev.txt -c backend/constraints-tested.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

`requirements.txt` pins direct runtime packages; `requirements-dev.txt` adds tests.
`constraints-tested.txt` captures the validated environment's transitive versions.
It is a Windows/Python 3.12 snapshot, not a universal cross-platform lock. For GPU
or other Python/platform versions, select a compatible official PyTorch wheel and
validate separately. Gunicorn was removed from the core requirements because it
is not used by this project and is not a Windows server requirement.

## Configuration and secrets

Copy `.env.example` to `.env.local` only for overrides. The tracked `.env` contains
public Supabase browser configuration; preserve it unless intentionally switching
projects. Commented example Supabase entries do not override it with blank values.

| Variable | Where | Default / purpose |
| --- | --- | --- |
| VITE_PREDICTION_API_URL | Vite env | Empty: same-origin `/api`; optional absolute HTTP(S) service base |
| VITE_STREAMLIT_URL | Vite env | Empty: live twin disabled; set only for a separately running service |
| VITE_SUPABASE_URL | Vite env | Existing public project URL; used by chat |
| VITE_SUPABASE_PUBLISHABLE_KEY | Vite env | Public client key; never a service-role key |
| VITE_SUPABASE_PROJECT_ID | Vite env | Public project identifier |
| PREDICTION_PROXY_TARGET | Shell running Vite | http://127.0.0.1:8000; development only |
| CORS_ORIGINS | Backend shell | Comma-separated localhost/127.0.0.1 frontend origins on port 8080 |

VITE_* values are embedded in browser bundles and are never secret. Keep private
keys in server-side secret stores or ignored environment files. Backend settings
are read from the process environment, not automatically from a dotenv file.
Restart Vite after changing variables. Production static hosting needs a reverse
proxy for `/api`, or an explicit API URL plus matching backend CORS configuration.
There is no automatic production localhost fallback. Vite preview is a static
build preview, not the backend or a production API proxy.

## API contracts and integration

- GET `/api/health`: service liveness only; does not claim model readiness.
- POST `/api/predict/inverse`: `{shape_type, target_f_min, target_f_max, target_s11}`.
  Canonical shape names match the dataset configurations. Frequency endpoints must
  be equal: this is a point inverse, not a broadband optimizer.
- Genuine inverse success: `{p_optimal, model_used, prediction_source:"pytorch",
  inference_mode:"point_inverse"}`. The frontend rejects unverified responses.
- POST `/api/predict/forward`: `{shape_type, p_value}`; genuine success contains
  `{freqs, s11, model_used, prediction_source:"pytorch"}` over the trained domain.
- Invalid requests return 422; missing model files 404; unavailable metadata or
  failed inference 503. Errors contain `detail`, never synthetic prediction fields.

With both services running, request `/api/health` through port 8080, then POST an
inverse request for square, 10 GHz, -10 dB. The expected current result is **503**
with a missing verified inference contract message. This verifies transport and
honest unavailability; it is not a successful scientific prediction.

## Models and training prerequisites

See [backend/PREDICTION_MODELS.md](backend/PREDICTION_MODELS.md). Absorber checkpoint
activations are missing and original absorber trainers are absent. Real absorber
inference must remain disabled until source-backed metadata is supplied. Do not
infer activations from layer shapes, retrain to conceal missing metadata, or use
synthetic results as model output.

The browser blood-sensing JSON model is separate. Its bundled numeric weights
are unchanged; reported fit metrics are labelled unverified, not validation accuracy.

`blood_sensing_pipeline.py` now requires all three original source CST datasets,
PyTorch, and an explicit `--widths-json` file mapping air/normal_blood/cancer_blood
to patch widths in mm verified against the source setup. It does not fabricate
missing samples or assume widths. Missing/invalid inputs return `status: unavailable`
and no training metrics. No output is written unless a new `--output-dir` is supplied;
existing artifacts cannot be overwritten. A completed fit reports **in-sample**
metrics only, with source metadata; it is not held-out evaluation or clinical proof.

```sh
python blood_sensing_pipeline.py --data-dir SOURCE_DIRECTORY --widths-json VERIFIED_WIDTHS.json --output-dir NEW_OUTPUT_DIRECTORY
```

`ml_pipeline/train_dnn.py` is a legacy **analytically augmented demonstration** trainer.
It refuses to run without `--allow-analytical-augmentation`, all original CST inputs,
and a new output directory. Its 10mm baseline assumption is unverified, and its
reported fits are not experimental or research validation. No training is run in
this cleanup. `train_hybrid_vna.py`'s entry point is disabled pending verified
per-measurement geometry/units and a compatible input contract. Retained legacy
internals are not a supported training workflow.

See [SCIENTIFIC_PROVENANCE.md](SCIENTIFIC_PROVENANCE.md) for the claim audit,
source classifications, removed claims and limitations. Historical metrics JSON
and checkpoints remain unchanged archives; their presence is not validation proof.

## Validation

```sh
pnpm typecheck
pnpm test
python -m pytest -q
pnpm build
git diff --check
```

With both local servers running, set `RUN_LOCAL_INTEGRATION=1` in the test shell
and run the backend suite to include the live frontend-proxy test. It is otherwise
skipped. This smoke test expects the current disabled model state.

Tests cover real browser JSON decoding, API failure contracts, known test-only
checkpoint reconstruction, VNA formats, contiguous bandwidth, and CST export
commands. Test fixtures are not scientific datasets or accuracy measurements.

## Remaining production/research gates

- Verify absorber trainer metadata and then validate actual inference against
  independent reference outputs and held-out measured data.
- Analytical sensing is labelled unverified demonstration; synthetic search data is
  excluded by default and clearly labelled after explicit opt-in. Unsupported
  auto-design performance substitutions have been removed.
- CST macros have not been executed in CST. Unsupported geometry and missing
  substrate properties are rejected; existing FR-4 defaults are not measurements.
- Configure and independently validate Supabase access policies/chat secrets and
  the external Streamlit app. They are not supplied by the local backend.
- Add deployment authentication, request/resource limits, HTTPS and monitoring
  before exposing compute publicly. CORS is not authentication.
- Production build still warns about the large frontend bundle. Dependency
  deprecation warnings remain; no broad dependency upgrade was performed.

## Experimental Sensing Lab

The new local research-only tab supports approved VNA imports, calibrated manual
image digitization, anonymous specimen groups, dataset snapshots and NumPy baseline
training. See [EXPERIMENTAL_LAB.md](EXPERIMENTAL_LAB.md) for setup, privacy, schemas,
validation gates and limitations. Experimental files live in ignored
`experimental-data/` and are never sent to chat. This is not a diagnostic system.
