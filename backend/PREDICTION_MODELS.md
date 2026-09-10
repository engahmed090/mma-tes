# Stage 1 inference status

The browser model is defined by `ml_pipeline/train_dnn.py`: normalized frequency,
patch width and permittivity, SiLU hidden layers, linear S11 output. Its JSON
weights and scalers are unchanged.

The absorber `.pt` files save state dictionaries and normalization statistics,
but no activation functions. The included blood-sensing trainers do not define
these networks. Consequently the backend returns HTTP 503 until the original
absorber trainer or a verified inference contract is supplied. No activation has
been guessed and no synthetic fallback is returned.

## Checkpoint formats inspected

- `fwd_ens_square.pt` / `fwd_ens_ring.pt`: three 2-256-256-128-1 networks,
  linear layer indices 0,3,6,9, dropout 0.1, per-member X/y mean and std.
- Combined shape files: forward and `inverse_f_s11_to_p` sections,
  2-256-256-128-64-1 networks, layer indices 0,2,4,6,8, x/y scalers.
- `inverse_square.pt`: 2-256-256-128-1 point inverse.
- MDN inverse files have mixture heads; this endpoint does not reinterpret them
  as ordinary regression outputs.
- `inv_s11_bwext_*`: ONE input (S11), TWO outputs (parameters for maximum/minimum
  bandwidth). They are not models accepting frequency interval endpoints.

Canonical shape names select checkpoints; rendering geometry names are not API
identifiers. In particular `ring` and `ring_ro_sweep` must remain distinct.
Forward curves span each checkpoint's trained frequency domain. The inverse
endpoint accepts one frequency (equal min/max) and S11 and returns a candidate,
not a guarantee of a bandwidth or the requested S11. Fixed geometries reject
parameter optimization.

## Supplying verified metadata

After inspecting the original trainer, add `backend/model_contracts.json`, keyed
by filename then section (`forward`, `forward_ensemble`, or
`inverse_f_s11_to_p`). Each entry requires:

- `source`: precise trainer location/revision supporting the contract;
- `activation`: the actual hidden activation (supported: relu, silu, tanh, gelu);
- `inputs`: `["frequency_ghz", "p_mm"]` for forward or
  `["frequency_ghz", "s11_db"]` for inverse;
- `outputs`: `["s11_db"]` for forward or `["p_mm"]` for inverse.

An equivalent `inference_contract` inside a checkpoint section is supported.
The current adapter supports ordinary linear-output MLPs with standardization;
verify these details against the trainer before enabling a contract. Additional
architectures or transforms require a source-backed adapter, not a guessed
contract. Strict state loading, CPU evaluation mode, saved scaler application,
and finite-output checks are enforced. Ensemble members are decoded separately
before averaging physical predictions.

## Validation

Install backend requirements plus pytest and httpx, then run
`python -m pytest backend/test_prediction.py -q` from the project root.
Frontend: `pnpm exec vitest run`; build: `pnpm exec vite build`.
Tests reconstruct a known test checkpoint and verify normalization, routing,
error responses and safe deserialization of bundled checkpoints. They do not
claim scientific validation of the absorber weights without their trainer.

Local development uses same-origin `/api` with Vite proxying to port 8000.
Set `VITE_PREDICTION_API_URL` only for an explicit alternate service; there is no
hardcoded hosted fallback. See the root README for setup and production routing.
