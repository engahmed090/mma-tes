# Stage 4 scientific provenance audit

This is a code/source-provenance audit, not experimental replication. No dataset,
checkpoint, stored metric, or numerical browser weight was edited. Scientific
values were not replaced with guessed values. Changes to executable trainers affect
future runs only; no training was performed during this cleanup.

## Source categories and decisions

| Source / claim family | Classification and evidence | Treatment |
| --- | --- | --- |
| public/data/*.txt and corresponding root CST exports | Simulated: repository-supplied CST text files. Original CST projects/measurement traceability are not provided. | Preserve samples; label simulation. Legacy isReal means simulation, not measured. |
| Root *.pt absorber checkpoints | Trained-model artifacts; activations and original trainers absent. | Preserve; backend fails with 503 until verified contracts exist. No synthetic fallback. |
| public/models/weights.json and scalers.json | Actual browser network computation; stored RMSE/R²/sample counts lack independent evaluation provenance. | Preserve files and inference. Display reported fit metrics as unverified, not validated accuracy. |
| blood_sensing_metrics.json and fwd_blood_sensing.pt | Historical results archive, marked PyTorch but lacking source-run provenance and original blood raw inputs. | Preserve archive; do not promote its contents as validation. |
| bloodSensingData.ts baseline resonance/depth/width, permittivity and geometry constants | Analytical calibration/assumptions with unverified original-source provenance. | Keep numerical baseline unchanged; explicit analytical/unverified metadata. No clinical claim. |
| Hardcoded DNN accuracy, training points, losses, comparison RMSE/MAE/R² in bloodSensingData.ts | Unsupported; do not match the preserved pipeline archive's fit results. | Removed. Training metrics are unavailable. |
| Hardcoded sensitivity/resonance KPI table | Unverified historical constants; no corresponding raw-source verification. | Numeric table metrics unavailable. No invented replacement. |
| BioSensingTab curves and resonant frequencies | Analytical Lorentzian evaluation of the retained unverified baseline. | Label analytical reference, not AI/neural inference; not cancer diagnosis. |
| Manual VNA frequency entries | User-reported, unverified frequency shifts; no measured S11 amplitude. | Frequency-only vertical markers. Removed fabricated −10 dB ordinate. |
| Uploaded VNA S11 | User-supplied measured claim, not independently authenticated. Parser validates units and representation only. | Label user-supplied/unverified provenance; preserve uploaded values. |
| Absorption from S11 | Analytical derived estimate using A=1−|S11|², requiring negligible transmission. | State S21=0 assumption; not a directly measured absorption claim. |
| Bandwidth from curves | Computed widest contiguous sampled passing band; no interpolation across gaps. | Preserve computation and disclose sampling/threshold interpretation. |
| Synthetic literature curves | Generated demonstration curves; no published experimental dataset establishes them. | Excluded by default; explicit opt-in and SYNTHETIC / DEMONSTRATION DATA labels and metadata. |
| Auto-design expected S11/absorption and literature-backed performance | Unsupported numerical predictions/citation association. | Removed lookup and automatic curve substitution. No-result card shows unavailable. |
| AIWorkingPanel architecture, activations and feature encodings | Invented decorative execution display, not checkpoint telemetry. | Remove numerical activations/encoding, generic workflow labels and explicit illustration notice. UI elapsed time includes animation, not an inference benchmark. |
| blood_sensing_pipeline.py | Actual optimization only if all CST datasets and declared source-verified widths exist and PyTorch succeeds. | Remove fabricated metric fallback, generated training samples and assumed width; actual source-only fit, in-sample evaluation metadata, source hashes, no overwrite. |
| ml_pipeline/train_dnn.py | Legacy analytical augmentation; assumed 10mm baseline unverified, in-sample evaluation. | Requires explicit demonstration opt-in plus all source inputs and a new output directory. Missing data never becomes substitute curves. Output provenance discloses augmentation. |
| ml_pipeline/train_hybrid_vna.py | Legacy assumptions about units, geometry and patch width; incompatible with current blood model. | CLI entry point disabled with explicit error. Retained internal implementation is unsupported. |
| Supabase chat and literature suggestions | Generated language/literature-reference suggestions, not verified scientific measurements or diagnoses. | Prompt requires source classification and unverified/unavailable labels; no invented metrics/citations. Model compliance is not guaranteed. |
| Nitrate/sugar | No validated nitrate/sugar experiment or dedicated prediction path established in the repository. | Unavailable/unverified; chat must not imply validation. |
| Exports / reports | Derived simulation or explicit synthetic/demo data, with per-shape source labels. | Remove thesis-ready claim; state absorption/bandwidth assumptions and source type. |
| Test fixtures | Deliberately constructed regression inputs, not research data. | Never exposed as scientific predictions or accuracy evidence. |

## Removed or relabelled claims

- Random/fixed fallback training histories, MSE, RMSE, R², epochs and training-point counts.
- Unsupported static DNN architecture/performance/comparison tables in the blood UI data layer.
- "Virtual AI Laboratory", "DNN prediction" for Lorentzian curves, and "CST Real Data" sensitivity claims.
- Invented hidden activations, ReLU architecture labels, parameter counts and normalization displays.
- "AI Auto-Design" expected performance and generated no-result fallback curves.
- "Literature" names on generated search curves, replaced by explicit synthetic/demo labels.
- "VNA Real Data" for unverified uploads, and fake S11 amplitudes on manual frequency entries.
- "CST trained" and "Thesis-Ready" report labels where only simulations/computations exist.

## Remaining limits

This cleanup establishes honest availability/type boundaries, not research validity.
Original blood raw datasets and source setup/width verification are still absent.
Existing analytical baselines, sample permittivities, clinical relevance and stored
fit provenance are unverified. Demonstration training remains an explicitly named
legacy workflow; do not treat its fit as measured or held-out accuracy. CST geometry
macros need execution validation. External chat may still make unsupported claims;
responses require source review. Historical numeric archives are preserved as
requested and must not be cited as independently validated results.

## Keyword coverage ledger

The inventory below records all matching lines in executable source at audit time
for accuracy, R²/R2, MAE, loss, AI prediction, trained model, cancer, blood, nitrate,
sugar, resonance, absorption, bandwidth, literature, experimental, measured and VNA.
A mention is not automatically a scientific assertion (for example a parser field
or a test). Each file is governed by the category/decision above; unresolved source
claims remain unverified. Dataset/binary archives and lockfiles are classified above
rather than rewritten. Line numbers are review pointers, not validation evidence.

| File | Matching lines |
| --- | --- |
| `backend/main.py` | 61 |
| `backend/test_prediction.py` | 51 |
| `backend/test_scientific_integrity.py` | 3, 7, 15, 43, 55, 58, 64 |
| `blood_sensing_pipeline.py` | 3, 5, 6, 8, 9, 10, 27, 29, 32, 33, 35, 38, 39, 41, 69, 70, 75, 76, 81, 82, 96, 97, 98, 114, 122, 135, 136, 138, 139, 142, 149, 159, 166, 167, 168, 170, 174, 175, 177, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 190, 192, 193, 194, 196, 197, 199, 208, 209, 218, 225, 232, 251, 252, 262, 275, 278, 280, 283, 287, 288, 290, 291, 294, 295, 297, 306, 308, 314, 317, 338, 342, 345, 348, 360, 369, 370, 371, 372, 373, 374 |
| `ml_pipeline/train_dnn.py` | 3, 5, 6, 7, 8, 29, 33, 34, 35, 36, 37, 38, 39, 40, 41, 46, 48, 49, 54, 58, 147, 162, 166, 172, 175, 176, 181, 201, 247, 268, 269, 273, 280, 282, 297 |
| `ml_pipeline/train_hybrid_vna.py` | 3, 6, 10, 37, 38, 67, 82, 86, 87, 88, 105, 106, 135, 144, 149, 153, 156, 167, 168, 178, 179, 180, 181, 183, 184, 185, 192, 193, 215, 216, 217, 219, 222, 224, 226, 227, 232, 233 |
| `src/components/absorber/AutoDesignCard.tsx` | 5 |
| `src/components/absorber/BioSensingTab.tsx` | 2, 7, 8, 17, 18, 28, 32, 33, 34, 43, 47, 54, 56, 61, 62, 65, 66, 69, 75, 81, 82, 85, 88, 89, 98, 100, 103, 104, 105, 108, 110, 122, 123, 127, 128, 130, 131, 132, 136, 138, 140, 141, 142, 143, 144, 146, 147, 148, 151, 152, 154, 155, 156, 170, 176, 206, 235, 236, 237, 238, 246, 247, 248, 257, 259, 260, 261, 262, 264, 265, 266, 271, 273, 320, 324, 337, 353, 367, 369, 378, 407, 411, 413, 419, 427, 428, 438, 440 |
| `src/components/absorber/ChatTab.tsx` | 21, 27, 50, 67 |
| `src/components/absorber/CombinedPlot.tsx` | 4, 23, 24, 31, 83 |
| `src/components/absorber/DNNPredictorTab.tsx` | 10, 11, 14, 28, 30, 31, 32, 33, 34, 47, 50, 54, 55, 67, 80, 81, 84, 88, 89, 91, 94, 95, 96, 102, 103, 104, 105, 115, 116, 118, 121, 122, 123, 124, 129, 143, 148, 176, 243, 245, 247, 270, 273, 283, 284, 286, 296, 300, 305, 309, 310, 312, 329, 330, 332, 338, 340, 342, 347, 348, 358, 364, 365, 375, 378 |
| `src/components/absorber/DeepLearningOptimizationBox.tsx` | 18, 67, 77 |
| `src/components/absorber/ExportTab.tsx` | 4, 77, 82, 85, 86, 94, 98, 103, 105, 116, 261, 265, 385, 595, 631, 682, 683, 709, 721, 778, 779, 787, 788 |
| `src/components/absorber/FindBestTab.tsx` | 13, 76, 81, 161, 169, 209 |
| `src/components/absorber/InverseDesignTab.tsx` | 11 |
| `src/components/absorber/ReportTab.tsx` | 5, 27, 29, 33, 42, 47 |
| `src/components/absorber/ScientificIntegrity.test.tsx` | 9 |
| `src/data/bloodSensingData.ts` | 2, 4, 5, 12, 16, 22, 26, 32, 60, 61, 62, 63, 75, 77, 99, 100 |
| `src/data/shapes.ts` | 47, 86, 107, 127, 152 |
| `src/lib/s11Model.test.ts` | 6 |
| `src/lib/s11Model.ts` | 9, 24, 28, 29, 30, 40, 79 |
| `src/pages/Index.test.tsx` | 13 |
| `src/pages/Index.tsx` | 18, 50, 55 |
| `src/utils/math.ts` | 17, 37, 155, 172, 183, 193, 194 |
| `src/utils/stage2.test.ts` | 2, 3, 12, 13, 14, 15, 18, 22, 26, 27, 30 |
| `src/utils/vna.ts` | 1, 4, 12, 46, 52, 55, 57 |
| `supabase/functions/ai-chat/index.ts` | 148, 152, 154, 156, 160 |
