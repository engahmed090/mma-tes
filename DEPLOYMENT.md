# GitHub to Vercel production

Repository: engahmed090/mma-tes. Production branch: master.
Vercel project: mma-tes in ahmadosman20152016-8516s-projects.
Production URL: https://metamaterial-absorber-ai-platform.vercel.app

Use repository root (leave Root Directory empty / ./), framework Vite, Node 24.x.
vercel.json pins pnpm 11.19.0 installation with a frozen lockfile and explicit
--ignore-scripts, builds with pnpm, and publishes dist. The explicit pnpm version
avoids package-manager autodetection differences. No scientific backend is deployed.
Native build packages use their platform packages; validate a deployment build rather
than assuming a cached local install proves every platform works.

The routes first dispatch `/api/ai-chat` to the Node Vercel function. Other `/api`
requests return an explicit 503 unavailable response instead of index.html. Static
files and React SPA navigation remain supported. See CHAT_DEPLOYMENT.md for chat secrets. Public build
metadata at /deployment.json reports VERCEL_GIT_COMMIT_SHA and branch, allowing
the production alias to be checked against GitHub after deployment.

Public frontend Supabase configuration remains in the existing tracked .env.
Never add service-role/provider secrets to VITE_* variables. VITE_PREDICTION_API_URL
and VITE_STREAMLIT_URL may be empty; production values must be HTTPS and not loopback.
Only configure an absorber backend after separately deploying and securing it with
verified model metadata and correct CORS. Missing metadata must still fail closed.
The optional Streamlit service stays disabled when its URL is empty.

Experimental VNA/image import and preview work in the hosted browser. Experimental
records, snapshots and models stay local: saving/training/inference are intentionally
blocked on non-loopback hosts before any measurement request is sent. To collect
and train, run the existing Vite + FastAPI local workflow described in EXPERIMENTAL_LAB.md.
Do not route the private experimental API through the public deployment.

Vercel Settings must connect this GitHub repository and use master as Production
Branch. An older project/domain alias or failed build can keep the old site live.
Check the deployment's Git SHA, status and production domain assignment, then request
/deployment.json and verify the Experimental Sensing Lab tab. A successful git push
alone is not evidence of a successful production deployment.
