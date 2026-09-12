# Scientific data readiness — platform upgrade

No source dataset, checkpoint, or stored scientific result is rewritten by this upgrade.

## Non-blood data and one recommendation pool

The tracked source inventory has no standalone non-blood file named 1–5 GHz.
Two existing non-blood files cover that interval within **1–50 GHz** sweeps:

| Public source | Canonical shape | Schema / geometry mapping |
| --- | --- | --- |
| public/data/ring_ro_sweep.txt | ring_ro_sweep | CST frequency GHz / S11 dB blocks keyed by ro (mm); fixed inner radius 1 mm, substrate 1.6 mm |
| public/data/tringle.txt | triangle1 | One fixed CST frequency GHz / S11 dB curve; vertices (-4.5,6), (5.5,-6), (6.5,6) mm |

Original root files remain preserved. Materials and other geometry follow the existing
src/data/shapes.ts configuration, which is software metadata, not independent physical
verification. Fixed entries specify FR-4 (lossy) and annealed copper for these shapes.
No shape or material was inferred from S11. S11-derived absorption assumes negligible
transmission; S21 is not supplied here. Manufacturing validity is not established by ranking.

These files already entered useShapeData before this upgrade. No duplicate dataset or
separate model was created. The upgrade makes their low-frequency coverage explicit and
adds real-file regression tests at 1.5 GHz. The same S11-at-target ranking pool returns
Top-1/Top-2 with unchanged canonical shape, selected parameter and shared 3D renderer.
A result need not pass the requested threshold; weak candidates remain labelled FAIL.
No source-type preference is applied. No missing model performance is fabricated.

Existing absorber checkpoints cannot be extended or claimed operational without verified
inference-contract metadata (including activation and feature semantics). Stage 1's
fail-closed model runtime remains in place; reconstruction tests use isolated fixtures.
Stored CST ranking works independently. No guessed architecture or retraining was attempted.

## Blood sources and why no classifier was trained from the archive

Existing blood-specific artifacts are blood_sensing_metrics.json and fwd_blood_sensing.pt,
with blood_sensing_pipeline.py, ml_pipeline/train_dnn.py and public/models weights/scalers
for the earlier simulation-regression workflow. The JSON archive describes simulation
permittivity cases (air / normal_blood / cancer_blood), 1–5 GHz and geometric parameters.
It is not an independently labelled collection of physical specimens. Aggregate curves
contain frequency resets and lack per-specimen/session/replicate grouping; reconstructing
those identities or assigning clinical ground truth would require guesses.

The training scripts reference without-blood-1-5ghz.txt, normal-blood-1-5ghz.txt,
bood-cancer-1-5ghz.txt and abs-with-blood1-5ghz-* aliases. Those raw inputs are absent
from the tracked repository. Archived metrics have not acquired new provenance and are
not imported into the Experimental Lab's held-out dashboards. Current real blood
classification metrics therefore remain **Unavailable**.

The practical workflow is implemented for future independently reference-labelled uploads:
RAW_VNA preferred; reviewed IMAGE_EXTRACTED explicitly opt-in; anonymous specimen IDs;
all replicates in one split; specimen-mean features; TRAIN-only preprocessing; 60/20/20
grouped separation; validation-only selection; genuine held-out evaluation and TRAIN-only
grouped cross-validation. Existing NumPy logistic/centroid classifiers and mean/ridge
regressors remain unchanged. No DNN or extra dependency is justified by missing samples.
Research inference abstains on invalid domains, failed gates or insufficient margins.
Cancer subtype remains unavailable. Glucose/nitrate require known concentrations and
reject predictions outside the saved calibration range. No medical diagnosis is provided.

At 1.5 GHz the strongest stored ring uses ro=12 mm, while inherited configuration
specifies a 16 mm unit cell. That diameter exceeds the configured cell width. The UI
explicitly warns UNVERIFIED GEOMETRY beside the original 3D rendering; no source
dimension was resized or silently corrected. Both 1.5 GHz candidates fail −10 dB.
These are stored-data exploration results, not fabrication-ready recommendations.
