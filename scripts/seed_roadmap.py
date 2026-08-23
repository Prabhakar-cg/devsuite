#!/usr/bin/env python3
"""Seed the 'ai-mlops-roadmap' Learning Roadmap into the real DevDB.

Usage:
  python scripts/seed_roadmap.py

Idempotent, but not blindly skip-if-present: a step is only (re)filled with its
checklist/course_links/documents when that step is still in its untouched seed
state (empty checklist, empty course_links, empty documents, empty notes) — so
a user's in-progress checklist/notes/links are never clobbered by a re-run, but
running this after an in-place content upgrade (as happened once already, when
each step's banner-only description was replaced with a full checklist, curated
course links, and an original reference doc per step) still backfills anyone
whose store predates that upgrade.

See specs/018-learning-roadmap/spec.md FR-018 for the step content this
mirrors, and data-model.md for the record shape. The full reference doc for
each step lives at static/roadmap-docs/<slug>.md, rendered read-only at
/static/roadmap-doc-viewer.html?doc=<slug>.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import deps  # noqa: E402

ROADMAP_ID = "ai-mlops-roadmap"


def _doc_link(slug: str, title: str) -> dict:
    from urllib.parse import quote

    return {
        "title": f"{title} — DevSuite Guide",
        "url": f"/roadmap/docs?doc={slug}&title={quote(title)}",
    }


STEPS = [
    {
        "title": "ML/LLM systems fundamentals",
        "description": (
            "Model training vs. inference, tokens, embeddings, quantization, GPU "
            "memory math, LLM request lifecycle."
        ),
        "checklist": [
            "Tokenize the same paragraph with tiktoken cl100k_base, o200k_base, and the "
            "Llama 3 tokenizer; record the token counts and explain why they differ.",
            "Implement byte-pair encoding from scratch on a small corpus (train the merge "
            "list, then encode/decode) and compare your token counts against tiktoken's "
            "cl100k_base on the same text.",
            "Measure tokens-per-character for English prose, Python source, JSON, and a "
            "non-Latin script; build a cost table showing the price difference for the "
            "same document.",
            "Compute the input-embedding matrix size for Llama-3-8B (128256 x 4096) by "
            "hand and verify it against the actual safetensors shard sizes.",
            "Embed 10k documents with a sentence-embedding model, L2-normalize them, and "
            "confirm empirically that cosine similarity equals dot product after "
            "normalization.",
            "Implement single-head scaled dot-product attention in NumPy, then derive the "
            "O(s^2 * d) FLOP count and verify your implementation's cost scales "
            "quadratically with sequence length.",
            "Compute prefill FLOPs (2 * P * s) versus attention FLOPs (4 * s^2 * d * L) "
            "for Llama-3-8B at 2K, 8K, and 32K context, and identify the crossover point "
            "where attention dominates.",
            "Write a kv_cache_bytes() function and use it to compute per-token KV cost for "
            "Llama-3-8B (GQA, 8 KV heads) versus a hypothetical full-MHA variant with 32 "
            "KV heads.",
            "Calculate the maximum concurrent 8K-context sequences that fit on one 80GB "
            "H100 running Llama-3-8B in bf16, accounting for weights and ~3GB runtime "
            "overhead.",
            "Derive the batch-1 decode throughput ceiling (memory_bandwidth / model_bytes) "
            "for a model on your GPU, then benchmark actual tok/s and explain the gap.",
            "Compute the roofline ridge point (peak FLOPS / memory bandwidth) for your GPU "
            "and determine the batch size at which LLM decode becomes compute-bound.",
            "Serve the same model at bf16, FP8, and 4-bit AWQ; measure decode tok/s, VRAM "
            "usage, and TTFT, and confirm the speedup tracks the compression ratio.",
            "Compute the effective bits-per-weight for 4-bit quantization at group_size "
            "128 versus 32, and reconcile it with the on-disk size of a real GPTQ or AWQ "
            "checkpoint.",
            "Enable FP8 KV-cache quantization and measure how much your maximum "
            "concurrent-sequence count increases; confirm weight quantization alone did "
            "not change it.",
            "Benchmark static batching against continuous batching at batch sizes 1, 8, "
            "32, and 128; plot throughput and p95 inter-token latency against each other.",
            "Run the same prompt with greedy, temperature 0.8 + top-p 0.95, and min-p "
            "sampling; then add JSON-schema-constrained decoding and measure its per-token "
            "overhead.",
            "Do a full capacity-planning exercise: given a target concurrency, context "
            "length, and TPOT SLO, compute the GPU count needed and justify both the "
            "memory floor and the latency-driven number.",
        ],
        "course_links": [
            {"title": "Stanford CS336: Language Modeling from Scratch", "url": "https://cs336.stanford.edu/"},
            {"title": "Andrej Karpathy — Neural Networks: Zero to Hero", "url": "https://karpathy.ai/zero-to-hero.html"},
            {"title": "Hugging Face LLM Course", "url": "https://huggingface.co/learn/llm-course/chapter1/1"},
            {"title": "MIT 6.5940: TinyML and Efficient Deep Learning Computing (Song Han)", "url": "https://hanlab.mit.edu/courses/2024-fall-65940"},
            {"title": "Transformer Inference Arithmetic (kipply)", "url": "https://kipp.ly/transformer-inference-arithmetic/"},
            {"title": "Modal GPU Glossary", "url": "https://modal.com/gpu-glossary"},
            {"title": "LLM Visualization — Interactive 3D Walkthrough of GPT Internals", "url": "https://bbycroft.net/llm"},
            {"title": "The Ultra-Scale Playbook: Training LLMs on GPU Clusters (Hugging Face)", "url": "https://huggingface.co/spaces/nanotron/ultrascale-playbook"},
        ],
        "doc_slug": "step-1-ml-llm-fundamentals",
    },
    {
        "title": "Model serving & inference infra on Kubernetes",
        "description": (
            "vLLM/TGI, KServe/Seldon, GPU scheduling, KEDA autoscaling, "
            "Grafana/Mimir/Loki metrics."
        ),
        "checklist": [
            "Run vLLM locally with `vllm serve`, hit /v1/chat/completions, /health, and "
            "/metrics, and identify every vllm: metric family in the output.",
            "Tune --max-model-len, --max-num-seqs, and --gpu-memory-utilization one at a "
            "time and record how each changes the reported number of available KV cache "
            "blocks.",
            "Benchmark vLLM against Triton (or SGLang) on identical hardware and prompts; "
            "compare TTFT, TPOT, and total output tokens/sec.",
            "Stand up a GPU-enabled Kubernetes cluster (kind + GPU Operator, minikube, or "
            "a managed GPU node pool) and confirm nvidia.com/gpu appears in `kubectl "
            "describe node`.",
            "Deploy vLLM as a raw Deployment with a startupProbe long enough for weight "
            "loading, and deliberately remove it to observe the CrashLoopBackOff failure "
            "mode.",
            "Run a tensor-parallel deployment with --tensor-parallel-size 2 and reproduce "
            "the /dev/shm NCCL hang, then fix it with a memory-backed emptyDir.",
            "Taint GPU nodes, add tolerations and nodeAffinity on nvidia.com/gpu.product, "
            "and verify non-GPU pods can no longer schedule onto GPU nodes.",
            "Configure GPU time-slicing via the GPU Operator, then partition an A100/H100 "
            "into MIG instances, and document the isolation differences you observe.",
            "Install KServe in RawDeployment mode and deploy the same model as an "
            "InferenceService with a storageUri; compare the generated resources to your "
            "hand-written Deployment.",
            "Define a reusable ClusterServingRuntime for vLLM and deploy two different "
            "models against it with no duplicated pod spec.",
            "Perform a canary rollout with canaryTrafficPercent, verify the traffic split, "
            "then roll back.",
            "Deploy kube-prometheus-stack, add a ServiceMonitor scraping vLLM /metrics, "
            "and build a Grafana dashboard with p95 TTFT, p95 TPOT, queue depth, and KV "
            "cache usage.",
            "Write a KEDA ScaledObject that scales on vllm:num_requests_waiting per "
            "replica, with fast scale-up and a 15-minute scale-down stabilization window.",
            "Load-test with a spike and measure end-to-end scale-out time (node provision "
            "+ image pull + weight load), then cut it using a pre-warmed node pool or a "
            "shared weights PVC.",
            "Drive the server past its KV cache capacity until preemptions occur, and "
            "correlate the preemption rate with the TPOT p95 spike on your dashboard.",
            "Ship logs to Loki and deliberately add a high-cardinality label (request_id) "
            "to see query performance degrade; then move it into the log line and use a "
            "LogQL filter.",
            "Configure Prometheus remote_write into Grafana Mimir and build a "
            "cost-per-million-tokens panel from GPU-hours and vllm:generation_tokens.",
            "Deploy a model too large for one GPU across two nodes using LeaderWorkerSet "
            "or Volcano gang scheduling, and confirm partial scheduling never leaves "
            "orphaned workers.",
        ],
        "course_links": [
            {"title": "vLLM Documentation", "url": "https://docs.vllm.ai/en/latest/"},
            {"title": "KServe Documentation", "url": "https://kserve.github.io/website/"},
            {"title": "Kubernetes Docs: Schedule GPUs", "url": "https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/"},
            {"title": "NVIDIA GPU Operator Documentation (MIG, time-slicing, DCGM)", "url": "https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/index.html"},
            {"title": "KEDA: Prometheus Scaler", "url": "https://keda.sh/docs/latest/scalers/prometheus/"},
            {"title": "NVIDIA Triton Inference Server Documentation", "url": "https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/index.html"},
            {"title": "Grafana Mimir Documentation", "url": "https://grafana.com/docs/mimir/latest/"},
            {"title": "DeepLearning.AI — Efficiently Serving LLMs (free short course)", "url": "https://www.deeplearning.ai/short-courses/efficiently-serving-llms/"},
        ],
        "doc_slug": "step-2-model-serving-inference-k8s",
    },
    {
        "title": "ML pipeline & MLOps tooling",
        "description": (
            "MLflow/W&B, Feast, model registry patterns, CI/CD for ML, "
            "Terraform/Ansible for ML infra provisioning."
        ),
        "checklist": [
            "Stand up a local MLflow tracking server backed by SQLite "
            "(--backend-store-uri sqlite:///mlflow.db) with a local artifact root, and "
            "confirm the Model Registry tab works (it does not with the bare filesystem "
            "backend).",
            "Log 3 runs of a scikit-learn model to that server with params, metrics, an "
            "input_example, and an inferred signature; verify the signature rejects a "
            "column-reordered dataframe at predict time.",
            "Add reproducibility tags to every run: git SHA, a content hash of the "
            "training snapshot, and the owner team. Prove you can reconstruct a run from "
            "tags alone.",
            "Log per-segment slice metrics (val_auc__<segment>) alongside aggregate "
            "metrics, and write an assertion that fails when any slice regresses more "
            "than a set tolerance.",
            "Register the best run as a model version, set a 'challenger' alias, then "
            "flip 'champion' to it and roll back with a single "
            "set_registered_model_alias call; load models:/<name>@champion from a "
            "separate serving script.",
            "Repeat the tracking exercise in Weights & Biases: run a Sweep over 3 "
            "hyperparameters and use use_artifact/log_artifact so the dataset -> model "
            "lineage graph is queryable.",
            "Write a Feast repo: an Entity, a FileSource with timestamp_field, a "
            "FeatureView with a TTL, and a named FeatureService; run feast apply and "
            "feast materialize-incremental.",
            "Build a training set with get_historical_features and prove point-in-time "
            "correctness by constructing a deliberately leaky naive join and showing the "
            "offline metric inflates.",
            "Serve the same feature service with get_online_features from a Redis online "
            "store and assert the online vector matches the offline vector for the same "
            "entity and timestamp.",
            "Write data-contract tests (schema, dtypes, null-rate bounds, PSI/KS drift vs "
            "a reference slice) with Great Expectations or Pandera, and wire them as a "
            "failing CI job.",
            "Write behavioral model tests: one invariance test, one "
            "directional-expectation test, and a minimum-functionality test over curated "
            "edge cases.",
            "Write a serving-parity test that scores the same N rows through the training "
            "code path and the packaged pyfunc/container path and asserts float-tolerance "
            "equality.",
            "Build a GitHub Actions PR gate: lint, unit tests, data-contract tests, a "
            "<3-minute smoke train on 200 rows, and the parity test — with full training "
            "triggered only on merge to main.",
            "Orchestrate the full pipeline (ingest -> validate -> features -> train -> "
            "eval -> register) in Airflow, Dagster, Prefect, or Kubeflow, parameterized so "
            "it can be re-run for any data snapshot.",
            "Deploy the champion behind FastAPI, then shadow-deploy a challenger: mirror "
            "100% of traffic, discard responses, and compare logged output distributions "
            "and p99 latency for a full week before canarying.",
            "Write Terraform for an autoscaling GPU node pool with min_node_count = 0, "
            "spot instances, a nvidia.com/gpu taint, pinned auto_upgrade = false, and "
            "Workload Identity; store state remotely with locking and gate apply behind a "
            "PR approval.",
            "Write an Ansible role that installs a pinned NVIDIA driver and the container "
            "toolkit on a bare-metal GPU host, and articulate in one paragraph why that "
            "job does not belong in Terraform.",
        ],
        "course_links": [
            {"title": "MLOps Zoomcamp (DataTalksClub) — free, self-paced hands-on MLOps course", "url": "https://github.com/DataTalksClub/mlops-zoomcamp"},
            {"title": "MLflow — official documentation (tracking, model registry, deployment)", "url": "https://mlflow.org/docs/latest/index.html"},
            {"title": "Feast — official feature store documentation", "url": "https://docs.feast.dev/"},
            {"title": "Made With ML (Goku Mohandas) — free MLOps course: design, data, model, testing, production", "url": "https://madewithml.com/"},
            {"title": "Weights & Biases — official documentation (Experiments, Sweeps, Artifacts, Registry)", "url": "https://docs.wandb.ai/"},
            {"title": "MLOps: Continuous delivery and automation pipelines in ML (Google Cloud Architecture Center)", "url": "https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning"},
            {"title": "Full Stack Deep Learning 2022 — free lecture series on production ML", "url": "https://fullstackdeeplearning.com/course/2022/"},
            {"title": "Hidden Technical Debt in Machine Learning Systems (Sculley et al., NeurIPS 2015)", "url": "https://proceedings.neurips.cc/paper_files/paper/2015/file/86df7dcfd896fcaf2674f757a2463eba-Paper.pdf"},
        ],
        "doc_slug": "step-3-ml-pipeline-mlops-tooling",
    },
    {
        "title": "Agentic AI engineering",
        "description": (
            "LangGraph/CrewAI/AutoGen/Agents SDK/MCP, tool-use guardrails, "
            "cost-aware orchestration, agent trace observability."
        ),
        "checklist": [
            "Implement a bare agent loop in ~40 lines with no framework: model call, "
            "parse tool calls, execute, append results, repeat — with a hard step cap "
            "and a final-answer termination condition.",
            "Give that loop three real tools defined with strict Pydantic schemas, and "
            "make every tool error return an actionable payload ({error, hint, example}) "
            "rather than a stack trace.",
            "Deliberately degrade a tool description, measure the drop in correct "
            "tool selection over 20 tasks, then fix it — proving most selection "
            "failures are documentation failures.",
            "Reimplement the same agent as a LangGraph StateGraph: a typed State with an "
            "add_messages reducer, an agent node, a ToolNode, and a conditional edge "
            "that loops back.",
            "Put step count and a dollar budget inside the graph State, compile with a "
            "SqliteSaver checkpointer, kill the process mid-run, and resume from the "
            "checkpoint without the budget resetting.",
            "Add a human-in-the-loop approval node using interrupt() and resume it later "
            "with Command(resume=...) from a separate process, showing the run survives "
            "a multi-hour pause.",
            "Rebuild one task as a role-based crew (CrewAI or AutoGen) and compare token "
            "spend, latency, and determinism against the single-agent graph version; "
            "write down when each wins.",
            "Build an MCP server with the Python SDK exposing one tool and one templated "
            "resource, and inspect it end-to-end with `mcp dev` in the MCP Inspector.",
            "Serve that server over Streamable HTTP and connect to it from your own MCP "
            "Client, listing tools and feeding their schemas straight into your agent "
            "loop.",
            "Read the MCP spec's security section and write a threat model for your "
            "server: tool poisoning via untrusted descriptions, the "
            "confused-deputy/lethal-trifecta path, and consent gating for every write "
            "tool.",
            "Add an authorization layer that resolves permissions from the human's "
            "session identity, never from model-supplied IDs; write a prompt-injection "
            "test that tries to refund an order outside session scope and assert it is "
            "refused.",
            "Classify every tool by blast radius (read / reversible write / irreversible "
            "write / privilege-changing) and enforce auto-approve, audit-log, and "
            "human-approval gates accordingly, rendering the resolved action in the "
            "approval UI.",
            "Run code-executing tools in a real sandbox: no network, read-only root FS, "
            "non-root user, dropped capabilities, memory/CPU limits, and a wall-clock "
            "timeout — then verify a fork bomb and an outbound curl both fail.",
            "Restructure your prompt for cache hits: stable system prompt and tool "
            "schemas first, all dynamic content last; measure the cached-token ratio "
            "before and after, and prove a timestamp at the top of the prompt destroys "
            "it.",
            "Implement a model cascade with a verifier that escalates from a small model "
            "to a frontier model only on low confidence, and report cost-per-completed-"
            "task versus always using the frontier model.",
            "Add context compaction: summarize completed sub-tasks into structured "
            "state, offload large tool outputs to storage behind a handle plus digest, "
            "and chart token growth per step against the naive version.",
            "Instrument the agent with OpenTelemetry GenAI semantic conventions — run, "
            "chat, and tool spans carrying model ID, input/output/cached tokens, cost, "
            "tool args, error class, and termination reason — and view the traces in "
            "Langfuse.",
            "Build an evaluation dataset from failed and human-corrected production "
            "traces, add trajectory assertions (right tool, well-formed args, step "
            "count, budget, no forbidden tool) alongside final-answer checks, and gate "
            "CI on pass rate, mean cost, and p95 latency together.",
        ],
        "course_links": [
            {"title": "Building Effective Agents (Anthropic Engineering)", "url": "https://www.anthropic.com/engineering/building-effective-agents"},
            {"title": "Model Context Protocol — official documentation and quickstarts", "url": "https://modelcontextprotocol.io/"},
            {"title": "LangGraph — official documentation (StateGraph, checkpointers, interrupts)", "url": "https://docs.langchain.com/oss/python/langgraph/overview"},
            {"title": "OpenAI Agents SDK (Python) — agents, handoffs, guardrails, sessions, tracing", "url": "https://openai.github.io/openai-agents-python/"},
            {"title": "CrewAI — official documentation (agents, tasks, crews, flows)", "url": "https://docs.crewai.com/"},
            {"title": "Langfuse — open-source LLM observability: tracing, evals, prompt management", "url": "https://langfuse.com/docs"},
            {"title": "OpenTelemetry GenAI Semantic Conventions", "url": "https://github.com/open-telemetry/semantic-conventions-genai"},
            {"title": "AI Agents in LangGraph (DeepLearning.AI, free short course)", "url": "https://www.deeplearning.ai/courses/ai-agents-in-langgraph"},
        ],
        "doc_slug": "step-4-agentic-ai-engineering",
    },
    {
        "title": "Certifications",
        "description": (
            "AWS Certified Machine Learning Engineer – Associate (MLA), NVIDIA-Certified "
            "Professional: AI Operations (NCP-AIO), and CKA as the Kubernetes prerequisite."
        ),
        "checklist": [
            "Download the official AWS Certified Machine Learning Engineer - Associate "
            "exam guide PDF and decide, based on the 28 Sep 2026 MLA-C01 cutoff, whether "
            "you are sitting MLA-C01 or waiting for MLA-C02.",
            "Convert the MLA exam guide's task statements into a spreadsheet with a 1-5 "
            "confidence rating per row; study only the 1s and 2s.",
            "Complete the free AWS Skill Builder 'Exam Prep Plan' for AWS Certified "
            "Machine Learning Engineer - Associate end to end.",
            "Take the AWS Official Practice Question Set for MLA cold, in week one, to "
            "get a domain-level diagnostic; retake at the end and target 80%+.",
            "Build one real end-to-end SageMaker pipeline (S3 -> processing job -> "
            "training -> model registry -> endpoint -> EventBridge retrain trigger) "
            "before sitting MLA.",
            "Book and pay for the MLA exam with a date roughly six weeks out, before you "
            "feel ready.",
            "Optional on-ramp: if generative AI on AWS is new to you, pass AWS Certified "
            "AI Practitioner (AIF-C01, $100, 90 min) first as a two-weekend warm-up.",
            "Register for CKA ($445, includes one free retake plus two Killer.sh "
            "simulator attempts) and schedule it within the 12-month eligibility window.",
            "Drill CKA imperatively: 20 timed sessions of kubectl create/run "
            "--dry-run=client -o yaml, kubectl explain, and navigating kubernetes.io "
            "docs under time pressure.",
            "Score at least 50% on a Killer.sh simulator session (it is deliberately "
            "harder than the real exam) before sitting CKA.",
            "Read 20 target job postings and tally whether they emphasize GPU cluster "
            "operations (-> NCP-AIO) or agent orchestration (-> NCP-AAI); pick exactly "
            "one.",
            "If GPU ops: get hands-on with the NVIDIA GPU Operator on Kubernetes, MIG "
            "partitioning, Slurm/Run:ai scheduling, and DCGM metrics into Prometheus "
            "before booking NCP-AIO ($500, 30 MCQ + 3 hands-on labs).",
            "Optionally pass NCA-AIIO ($125, 50 questions, 60 min) first to build "
            "NVIDIA/data-center vocabulary before attempting a professional-level "
            "NVIDIA exam.",
            "Confirm current exam codes, prices and retirement dates on the official AWS "
            "and NVIDIA pages immediately before every booking — this lineup churns "
            "roughly every 18 months.",
            "Ask your employer about certification reimbursement and standing exam "
            "vouchers before paying out of pocket (full Tier 1 + Tier 2 run is ~$1,100).",
            "Log every exam's expiry date in a calendar on pass day (AWS = 3 years, "
            "NVIDIA and CNCF = 2 years) and stagger renewals so they do not cluster.",
        ],
        "course_links": [
            {"title": "AWS Certified Machine Learning Engineer - Associate (official exam page)", "url": "https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/"},
            {"title": "AWS Certified Machine Learning Engineer - Associate (MLA-C01) Exam Guide (PDF)", "url": "https://d1.awsstatic.com/training-and-certification/docs-machine-learning-engineer-associate/AWS-Certified-Machine-Learning-Engineer-Associate_Exam-Guide.pdf"},
            {"title": "AWS Skill Builder — free Exam Prep for ML Engineer Associate", "url": "https://skillbuilder.aws/exam-prep/machine-learning-engineer-associate"},
            {"title": "AWS Certified AI Practitioner (AIF-C01) — official exam page", "url": "https://aws.amazon.com/certification/certified-ai-practitioner/"},
            {"title": "NVIDIA Certification catalog — all current exams, codes and prices", "url": "https://www.nvidia.com/en-us/learn/certification/"},
            {"title": "NVIDIA-Certified Professional: AI Operations (NCP-AIO)", "url": "https://www.nvidia.com/en-us/learn/certification/ai-operations-professional/"},
            {"title": "Certified Kubernetes Administrator (CKA) — Linux Foundation", "url": "https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/"},
            {"title": "Tutorials Dojo — free MLA-C01 study path guide", "url": "https://tutorialsdojo.com/aws-certified-machine-learning-engineer-associate-mla-c01-exam-guide/"},
        ],
        "doc_slug": "step-5-certifications",
    },
    {
        "title": "Portfolio & positioning",
        "description": (
            "Package NIM agent, ai-precommit-guardian, and JFrog-on-ROSA "
            "migration as public write-ups with architecture diagrams."
        ),
        "checklist": [
            "Draft a shared outline template (Context / Problem / Options considered / "
            "What we built / Results / What I'd do differently) and commit to using it "
            "unchanged across all three write-ups.",
            "For each of the three projects, collect 3-5 verifiable metrics with a "
            "stated measurement method and time window before writing a single "
            "paragraph.",
            "Draft a 1500-2200 word JFrog-on-ROSA write-up with a before/after "
            "architecture diagram, a 'why ROSA over self-managed OpenShift, EKS, or "
            "JFrog SaaS' decision section, and concrete numbers for migration downtime, "
            "storage cost delta, and pull latency.",
            "Draft a 1500-2200 word NIM agent write-up whose 'Options considered' "
            "section compares NVIDIA NIM containers against self-hosted vLLM, Triton "
            "directly, and a hosted API — and states what NIM's packaging cost in "
            "flexibility.",
            "Draft a 1500-2200 word ai-precommit-guardian write-up centred on "
            "false-positive rate and per-commit latency budget, the two numbers that "
            "decide whether developers keep a pre-commit hook installed.",
            "Generate metrics for ai-precommit-guardian by running it across 500 "
            "historical commits from a public repo, counting flags, and hand-reviewing "
            "a sample for precision.",
            "Publish at least one number per write-up that got worse (image size, "
            "control-plane cost, added latency) — trade-off honesty is what makes the "
            "rest credible.",
            "Pick one primary diagramming tool (Excalidraw for narrative sketches, "
            "draw.io for formal before/after infrastructure) and use it consistently "
            "across all three posts.",
            "Produce one before/after infrastructure diagram for JFrog-on-ROSA as a "
            "single stacked image, max 15 boxes, with labelled edges (protocol, mTLS, "
            "timeouts) and legible at phone width.",
            "Rewrite every title to lead with a specific measurable outcome rather than "
            "a technology name (e.g. 'Migrating a 4TB Artifactory instance to ROSA with "
            "12 minutes of write downtime').",
            "Record a scripted 5-8 minute demo video of ai-precommit-guardian blocking a "
            "real commit, showing its reasoning, and the developer resolving it — "
            "include a failure case — and embed it in the write-up.",
            "Stand up a GitHub Pages site on a custom domain as the canonical home, with "
            "a consistent post template and an index page linking all three write-ups.",
            "Cross-post each piece to dev.to using its canonical URL field pointing back "
            "to your own domain; skip Medium and never use LinkedIn articles as the "
            "canonical home.",
            "Rewrite each project repo's README as a landing page: one-sentence purpose, "
            "20-second install-and-run, a GIF or screenshot of real output, and a link "
            "back to the write-up.",
            "Write a standalone 150-200 word LinkedIn summary post per write-up "
            "(problem, surprising lesson, one number, one genuine question) with the "
            "link in the first comment, posted Tue-Thu morning in your target market's "
            "timezone.",
            "Rewrite three resume bullets from the finished write-ups using action + "
            "system + scale + measured result, and update your LinkedIn headline to the "
            "destination role ('Platform Engineer — AI/ML infrastructure, Kubernetes, "
            "GPU workloads') with a Featured section linking all three posts.",
            "Send each finished post directly to 2-3 specific people who run the same "
            "stack — targeted sharing reaches hiring managers far more reliably than "
            "broadcasting.",
        ],
        "course_links": [
            {"title": "Google Technical Writing Courses (free)", "url": "https://developers.google.com/tech-writing"},
            {"title": "The C4 model for software architecture diagrams", "url": "https://c4model.com/"},
            {"title": "Postmortem Culture: Learning from Failure — Google SRE Book", "url": "https://sre.google/sre-book/postmortem-culture/"},
            {"title": "Excalidraw — hand-drawn style diagramming", "url": "https://excalidraw.com/"},
            {"title": "draw.io — free infrastructure and architecture diagramming", "url": "https://www.drawio.com/"},
            {"title": "Julia Evans: Some blogging myths", "url": "https://jvns.ca/blog/2023/06/05/some-blogging-myths/"},
            {"title": "GitHub Pages — host your devlog from a repository", "url": "https://pages.github.com/"},
        ],
        "doc_slug": "step-6-portfolio-positioning",
    },
]


def _step_is_untouched(step: dict) -> bool:
    """True if a step still has its pristine seed shape — no user edits to
    overwrite. Used both for the fresh-seed path and the backfill path."""
    return (
        not step.get("notes")
        and not step.get("checklist")
        and not step.get("course_links")
        and not step.get("documents")
    )


def build_step(index: int, data: dict) -> dict:
    checklist = [
        {"id": f"item-{index}-{i}", "text": text, "done": False}
        for i, text in enumerate(data["checklist"], start=1)
    ]
    return {
        "id": f"step-{index}",
        "order": index,
        "title": data["title"],
        "description": data["description"],
        "notes": "",
        "checklist": checklist,
        "course_links": data["course_links"],
        "documents": [_doc_link(data["doc_slug"], data["title"])],
    }


def build_roadmap() -> dict:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    steps = [build_step(i, data) for i, data in enumerate(STEPS, start=1)]
    return {
        "id": ROADMAP_ID,
        "title": "AI/MLOps & Agentic AI Infrastructure",
        "description": (
            "Learning path from platform/DevOps into MLOps and agentic AI infra."
        ),
        "created_at": now,
        "updated_at": now,
        "steps": steps,
    }


def main() -> None:
    deps._db.open()
    store = deps._db.get_store("roadmaps") or {}

    if ROADMAP_ID not in store:
        store[ROADMAP_ID] = build_roadmap()
        deps._db.set_store("roadmaps", store)
        deps._db.save()
        print(f"Seeded '{ROADMAP_ID}' with {len(STEPS)} steps.")
        return

    roadmap = store[ROADMAP_ID]
    fresh_steps = {i: build_step(i, data) for i, data in enumerate(STEPS, start=1)}
    backfilled = 0
    for step in roadmap.get("steps") or []:
        order = step.get("order")
        fresh = fresh_steps.get(order)
        if fresh is None or not _step_is_untouched(step):
            continue
        step["checklist"] = fresh["checklist"]
        step["course_links"] = fresh["course_links"]
        step["documents"] = fresh["documents"]
        backfilled += 1

    if backfilled == 0:
        print(f"'{ROADMAP_ID}' already exists and has no untouched steps — leaving it untouched.")
        return

    roadmap["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    deps._db.set_store("roadmaps", store)
    deps._db.save()
    print(f"'{ROADMAP_ID}' already existed — backfilled {backfilled} untouched step(s) with checklist/course_links/documents.")


if __name__ == "__main__":
    main()
