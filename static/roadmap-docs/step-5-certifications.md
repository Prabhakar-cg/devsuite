# Certifications

*A working engineer's guide to which AI/MLOps certifications actually move a platform career forward, which ones are résumé filler, and the exact order to take them in.*

## Why this step exists at all

Certifications do not make you good at MLOps. Shipping inference systems does. But certifications do three narrow things well, and if you are a platform/DevOps engineer pivoting into AI infrastructure, all three matter:

1. **They get you past keyword filters.** Recruiters and ATS systems screen on literal strings. "AWS Certified Machine Learning Engineer – Associate" is a string. "I ran a SageMaker pipeline once" is not.
2. **They force breadth you would otherwise skip.** Left alone, you will go deep on the two services your current job uses and never touch feature stores, model registries, drift monitoring, or GPU scheduling. An exam blueprint is a checklist of things a hiring manager assumes you know.
3. **They give you a deadline.** Self-directed learning without a date attached decays into bookmark hoarding. A $150 non-refundable exam booking six weeks out is a remarkably effective forcing function.

What they do *not* do is substitute for artifacts. A certification plus zero public work is weaker than public work plus zero certifications. Treat this step as running in parallel with Step 6 (Portfolio & positioning), not before it.

> The correct number of certifications for this career track is two or three, earned deliberately. Five is a signal that you are collecting badges instead of building systems.

---

## Important corrections to the old plan

The original roadmap text said "AWS ML Specialty or AI Practitioner, NVIDIA NCP-AIO or a Kubernetes-for-ML cert." Two of those four items need updating as of August 2026:

- **AWS Certified Machine Learning – Specialty (MLS-C01) no longer exists.** AWS retired the exam on **31 March 2026**. Existing holders keep the credential for its normal three-year term, but you can no longer sit it. Its replacement is the **AWS Certified Machine Learning Engineer – Associate (MLA-C01)** — and despite the "Associate" label being a step down in AWS's tiering, MLA is *more* aligned with an MLOps job than MLS-C01 ever was: it is weighted toward pipelines, deployment, CI/CD, monitoring and cost, not toward algorithm selection trivia.
- **MLA-C01 itself is mid-refresh.** Registration for the updated **MLA-C02** opened **1 September 2026**, and **28 September 2026** is the last day to sit MLA-C01 in English. If you are reading this in late August 2026, you have a real decision to make — see "Timing the MLA-C01 to MLA-C02 switch" below.
- **"NCP-AIO" is a real, current exam** — NVIDIA-Certified Professional: AI Operations. The name in the original plan was correct. What the plan understated is that NVIDIA now has a whole *family* of AI-infrastructure professional certs (AI Infrastructure, AI Operations, AI Networking, AI Rack and Interconnect, Agentic AI), and AIO is only one of them, at the top of the price range.
- **There is no CNCF/Linux Foundation "Kubernetes for ML" individual certification.** This is the item most likely to send you chasing a ghost. CNCF launched a **Certified Kubernetes AI Conformance Program** in November 2025 — but that certifies *platforms* (distributions like RKE2, cloud vendors' managed Kubernetes), not people. There is no personal badge attached to it. The individual credential that carries weight for Kubernetes-for-ML work is still plain **CKA**, optionally followed by the newer **CNPE** (Certified Cloud Native Platform Engineer).

---

## The certification landscape, compared

| Certification | Code | Level | Assumed knowledge | Format & length | Cost (USD) | Validity | Ideal for |
|---|---|---|---|---|---|---|---|
| AWS Certified AI Practitioner | AIF-C01 | Foundational | ~6 months exposure to AI/ML concepts; no build experience required | 65 questions (50 scored), multiple choice, 90 min | $100 | 3 years | Vocabulary + Bedrock/SageMaker service map; a two-weekend on-ramp |
| AWS Certified Machine Learning Engineer – Associate | MLA-C01 (→ MLA-C02) | Associate | ~1 year in a backend/DevOps/data engineering role plus hands-on SageMaker | 65 questions (50 scored), 130 min | $150 | 3 years | **The core cert for this track.** Data prep, training, deployment, CI/CD for ML, monitoring |
| NVIDIA-Certified Associate: AI Infrastructure and Operations | NCA-AIIO | Associate | Basic data-center infrastructure literacy | 50 questions, 60 min | $125 | 2 years | Fast, cheap credibility on GPU/DC vocabulary before committing to a professional NVIDIA exam |
| NVIDIA-Certified Professional: AI Operations | NCP-AIO | Professional | 2–3 years operating a data center with NVIDIA hardware; Linux CLI, Slurm, Kubernetes, Base Command Manager | 30 multiple-choice questions **+ 3 hands-on labs**, 120 min | $500 | 2 years | Engineers who actually run GPU clusters; the hardest and most differentiating item on this list |
| NVIDIA-Certified Professional: AI Infrastructure | NCP-AII | Professional | Deployment/bring-up of GPU systems | 120 min | $400 | 2 years | Build-and-deploy side of GPU estates rather than day-2 operations |
| NVIDIA-Certified Professional: Agentic AI | NCP-AAI | Professional | 1–2 years AI/ML plus production agentic work: orchestration, multi-agent frameworks, tool/model integration, evals, guardrails | 60–70 questions, 120 min | $200 | 2 years | Directly on-thesis if your target roles say "agentic AI infrastructure" |
| Certified Kubernetes Administrator | CKA | Professional (hands-on) | Comfortable operating Kubernetes from a terminal | Performance-based; live cluster tasks, 120 min, Kubernetes v1.35 | $445 exam-only (bundles $625 / $645); includes one free retake + two Killer.sh simulator attempts | 2 years | The prerequisite credential for GPU scheduling, Kubeflow, KServe, Ray on K8s |
| Certified Cloud Native Platform Engineer | CNPE | Professional (hands-on) | CKA-level Kubernetes plus platform/GitOps experience | Performance-based | See CNCF pricing | 2 years | Platform engineers building the internal developer platform that ML teams consume |

Prices and windows above are the published figures as of August 2026; re-check the official pages before booking, because AWS runs periodic discount vouchers and CNCF discounts CKA aggressively around KubeCon.

---

## What actually matters, ranked honestly

### Tier 1 — earn these

**AWS Certified Machine Learning Engineer – Associate (MLA).** This is the single highest-leverage exam on the list for a platform engineer moving into MLOps. Its blueprint is essentially your job description: ingest and transform data, train and tune, choose deployment infrastructure and endpoints, configure autoscaling, and build CI/CD pipelines that orchestrate ML workflows. Roughly the back half of the exam is DevOps work applied to models — which means your existing skills transfer, and the gap you need to close is narrower than it looks.

**CKA.** If your target job description contains the words "GPU," "Kubeflow," "KServe," "Ray," "Volcano," or "node pool," CKA is table stakes. It is also the only exam here that is entirely performance-based against a live cluster, which makes it the one people believe. If you already administer Kubernetes daily, it is two weekends of `kubectl` drills and an exam booking, not a course.

### Tier 2 — earn one, if it matches your target job

**NCP-AIO** *or* **NCP-AAI**. Pick based on the roles you are actually applying to. If the postings talk about GPU cluster operations, Base Command Manager, Slurm, Run:ai, MIG partitioning, and DCGM telemetry, take **AIO** — its three hands-on labs make it genuinely hard to fake and therefore genuinely worth something. If the postings talk about agent orchestration, multi-agent frameworks, evaluation harnesses, observability for LLM apps, and guardrails, take **AAI** — it is also less than half the price. Do not take both in the same cycle.

### Tier 3 — nice to have, low signal

**AWS Certified AI Practitioner (AIF-C01).** Foundational-tier and explicitly aimed at non-builders — AWS's own target audience list includes business analysts, marketing professionals and sales staff. For an experienced infrastructure engineer it will not impress a hiring manager on its own. It has exactly two legitimate uses: (a) as a cheap, fast structured tour of the Bedrock/SageMaker/Q service surface if generative AI on AWS is genuinely new to you, and (b) as a way to bank an early win and build exam-taking momentum. Note that passing MLA also satisfies AIF recertification, so the effort is not wasted if you do both.

**NCA-AIIO.** Same logic on the NVIDIA side: a $125, one-hour associate exam that teaches you the vocabulary (DGX, NVLink, MIG, Base Command, NIM, Triton, DCGM) you will need before an NCP exam stops feeling like a foreign language. Skip it if you already operate GPU fleets.

### Do not chase

- **A "Kubernetes for ML" personal certification.** It does not exist. Anyone selling you one is selling a course, not a credential.
- **MLS-C01.** Retired. Remove it from your résumé plan; if you see it recommended in a 2024-era roadmap, that roadmap is stale.
- **Vendor certs for tools you will never touch.** A Databricks or Snowflake ML cert is excellent *if* your target employers run Databricks or Snowflake, and dead weight otherwise. Read twenty job postings before you buy anything.

---

## Timing the MLA-C01 → MLA-C02 switch

This is a live decision in the second half of 2026, so be deliberate about it:

- **Take MLA-C01 before 28 September 2026 if** you can realistically be ready in the window. C01 has two years of community study material, practice question banks, and write-ups behind it — a mature ecosystem is worth a lot, and the credential you earn is identical in name on your profile.
- **Wait for MLA-C02 if** you are more than about six weeks from ready. Cramming against a hard deadline you cannot meet is worse than starting clean, and C02's blueprint will skew further toward generative-AI operationalization, which is where the market is moving anyway.

Either way, **download the official Exam Guide PDF for the version you intend to sit** and treat its task-statement list as your syllabus. AWS publishes the domain weightings; study time should be allocated proportionally, not evenly.

---

## A suggested twelve-month sequence

This assumes roughly 6–8 hours of study per week alongside a full-time job.

| Months | Focus | Exam | Why here |
|---|---|---|---|
| 0–1 | Optional on-ramp: AIF-C01 and/or NCA-AIIO | Foundational/associate | Cheap, fast, builds vocabulary and exam momentum. Skip if you are already fluent |
| 1–4 | AWS ML Engineer – Associate | MLA-C01 or MLA-C02 | The anchor credential. Everything else is context around it |
| 4–6 | CKA | CKA | Highest-credibility hands-on exam; the gateway to GPU scheduling work |
| 6–9 | NVIDIA professional: AIO or AAI | NCP-AIO / NCP-AAI | Pick to match your target job postings. Requires real hands-on time first |
| 9–12 | No new exam — build | — | Convert what you learned into the Step 6 write-ups. Certificates without artifacts stall |

Notice the last block. Three months of the year is deliberately spent *not* studying. If every quarter is an exam quarter you will finish the year with four badges and nothing to show a hiring manager.

---

## How to actually prepare (the part most guides skip)

**Read the exam guide first, not last.** Every one of these programs publishes a blueprint with domains and percentage weightings. Turn it into a spreadsheet with one row per task statement and a confidence rating of 1–5. Study only the 1s and 2s. This alone cuts prep time roughly in half versus watching a course end to end.

**Practice questions are diagnostics, not content.** Take a full practice set *early* — while you still feel unprepared — because a 45% score with a domain breakdown tells you exactly where to spend the next month. Taking practice tests only at the end wastes their diagnostic value.

**For performance-based exams, drill the terminal, not the slides.** CKA and the NCP-AIO labs are timed and hands-on. Time yourself. Learn `kubectl explain`, imperative `kubectl create ... --dry-run=client -o yaml`, and where things live in the official docs (which you are allowed to consult during CKA — but only if you can navigate them fast). The Killer.sh simulator sessions bundled with your CKA registration are deliberately harder than the real exam; treat scoring 50% there as a pass signal.

**Build the thing before you sit the exam.** For MLA, stand up one real SageMaker pipeline end to end — data in S3, a processing job, training, model registry, an endpoint, and a CodePipeline/EventBridge trigger that retrains on new data. For NCP-AIO, get hands on GPU scheduling: MIG partitioning, the NVIDIA GPU Operator on Kubernetes, DCGM metrics into Prometheus. Two weekends of building beats twenty hours of video, and it doubles as raw material for Step 6.

**Book the exam before you feel ready.** Pick a date roughly six weeks out and pay for it. Readiness expands to fill available time; a booked slot collapses it.

**Budget realistically.** A full Tier 1 + Tier 2 run — MLA ($150) + CKA ($445) + NCP-AIO ($500) — is around $1,100 before practice materials. Many employers reimburse certification costs and some have standing vouchers; ask before you pay out of pocket. AWS also issues a 50%-off voucher on recertification in some programs, and CNCF runs recurring CKA discounts.

**Log the failures too.** If you fail an exam, write down what you missed and retake within the free-retake window where one exists (CKA registration includes one). A failed first attempt is not a story a hiring manager will ever hear; an ungathered credential is.

---

## Renewal and drift

Note the asymmetry in the table above: AWS credentials last **three years**, NVIDIA and CNCF credentials last **two**. If you earn NCP-AIO and CKA in the same quarter, you have created a double renewal cliff two years out. Stagger deliberately, and put the expiry dates in a calendar the day you pass — an expired credential on a LinkedIn profile reads worse than no credential.

Also accept that the AI-infrastructure certification landscape churns faster than any other. MLS-C01 died in March 2026. MLA-C01 is being replaced eighteen months after launch. NVIDIA has added four professional-level AI exams in about two years. Re-verify names, codes, and prices on the official pages before every booking — including against this document, which will itself go stale.

> The half-life of a certification blueprint in this field is about eighteen months. The half-life of a well-written case study about a system you actually built is roughly forever.

---

## Where to go next

- **[AWS Certified Machine Learning Engineer – Associate](https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/)** — start here. Download the exam guide PDF, confirm which version (C01 or C02) you are targeting, and check the current transition dates before you book anything.
- **[NVIDIA Certification catalog](https://www.nvidia.com/en-us/learn/certification/)** — the authoritative list of current NVIDIA exams, codes, and prices. Use it to choose between NCP-AIO and NCP-AAI based on your target job postings, and to confirm nothing in the table above has shifted.
- **[Certified Kubernetes Administrator (CKA)](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)** — the hands-on credential that unlocks GPU-scheduling and ML-platform work. Registration includes the Killer.sh simulator; start there rather than with a video course.
