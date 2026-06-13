# AURA — Engineering Abstract (ECE Capstone Review)

## Abstract (≈300 words)

AURA is a browser-native intelligent styling platform that demonstrates the
convergence of real-time computer vision, edge signal processing, and
cloud-orchestrated AI inference within a single full-stack web architecture.
The system ingests a live webcam stream and executes a client-side digital
signal pipeline using Google's MediaPipe FaceMesh, which regresses 468
three-dimensional facial landmarks per frame at interactive frame rates,
entirely on the user's device. No raw imagery leaves the client, preserving
privacy by design — a deliberate edge-computing decision that offloads
inference from the server and eliminates network round-trip latency from the
perception loop.

From this normalized landmark tensor, the platform derives quantitative
craniofacial features: the inter-pupillary distance, forehead-to-jaw ratios,
and a face-height-to-cheek-width aspect ratio that drives a deterministic
geometric classifier for face shape. Concurrently, the pipeline samples
pixel-level chrominance at canonical cheek landmarks and computes a
representative skin-tone hex value, which a warm/cool undertone heuristic maps
to a seasonal color palette. These extracted parameters are transmitted over a
secured internal API route to a large language model (Claude), which acts as an
automated style-intelligence engine returning structured color and styling
recommendations.

The augmented-reality subsystem implements the rigid-body transform problem in
two dimensions: per frame, the platform computes translation from anchor
midpoints, rotation from the eye-line via a four-quadrant arctangent, and scale
proportional to the measured facial span, then composites a transparent product
overlay onto an HTML5 Canvas using affine matrix operations. Depth is inferred
from landmark span, so overlays track naturally as the subject moves.

The infrastructure layer uses Next.js App Router with serverless API routes,
a repository-pattern data abstraction enabling a zero-code switch between mock
and live PostgreSQL (Supabase), and an automated GitHub-to-Vercel CI/CD
pipeline with strict client/server secret segregation. The project integrates
embedded perception, low-latency rendering mathematics, secure API design, and
cloud deployment into one cohesive, defensible engineering system.

---

### Defensible complexity, by domain

- **Client-side computer vision:** 468-point landmark regression, geometric
  face-shape classification, chrominance sampling for skin-tone extraction.
- **Low-latency rendering:** per-frame affine transform (translate · rotate ·
  scale) computed from live geometry; depth via span proportionality; reduced-
  motion accessibility honored.
- **Cloud architecture:** serverless routes, repository abstraction (mock ↔
  Supabase), RLS-secured public data, segregated secrets, automated CI/CD.
