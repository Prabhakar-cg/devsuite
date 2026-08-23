# ML pipeline & MLOps tooling

*A practitioner's guide to the machinery that turns a notebook experiment into a versioned, reproducible, continuously-deployed model service — experiment tracking, feature stores, model registries, ML-aware CI/CD, and infrastructure as code.*

## Why ML systems need their own operations discipline

A conventional service has one moving part that changes: code. An ML system has three — **code**, **data**, and the **model artifact** produced by their interaction — and each can regress independently. You can ship a bit-identical binary and watch quality collapse because an upstream table changed its null rate. You can retrain on identical data and get a different model because a library bumped its default random seed. Sculley et al.'s *Hidden Technical Debt in Machine Learning Systems* named the pathologies precisely: entanglement (changing anything changes everything), undeclared consumers, correction cascades, and above all **data dependencies that cost more than code dependencies** because nothing type-checks them.

MLOps is the set of practices that makes those three moving parts jointly reproducible and jointly deployable. Google's architecture guide frames the maturity ladder usefully:

- **Level 0** — manual. A data scientist trains in a notebook, hands a pickle to an engineer. Deployment cadence: months.
- **Level 1** — pipeline automation. Training is an orchestrated, parameterized pipeline; retraining triggers on new data, on schedule, or on drift. Feature engineering is shared between training and serving.
- **Level 2** — CI/CD for pipelines. The *pipeline itself* is the deployed unit. Committing to the training repo builds, tests, and rolls out a new pipeline; the pipeline then produces and registers models continuously.

Everything below is the tooling that gets you from 0 to 2.

> The single highest-leverage habit is making every artifact addressable by an immutable ID: a git SHA for code, a content hash or snapshot ID for data, a run ID for the training job, a version number for the model. If you cannot name it, you cannot roll it back.

## Experiment tracking

### What a tracking server actually stores

An experiment tracker is a append-only ledger with four record types, and understanding the split matters more than the API surface:

| Record | Cardinality | Backed by | Example |
|---|---|---|---|
| **Params** | Write-once per run | Relational DB | `learning_rate=3e-4`, `git_sha=a1b2c3` |
| **Metrics** | Time-series per run | Relational DB | `val_auc` logged at each epoch |
| **Tags** | Mutable per run | Relational DB | `stage=candidate`, `owner=fraud-team` |
| **Artifacts** | Arbitrary blobs | Object store | model weights, confusion matrix PNG, SHAP plot |

MLflow makes this split explicit: a **backend store** (SQLite, Postgres, MySQL) for the structured records and an **artifact store** (local dir, S3, GCS, Azure Blob) for the blobs. Running with `--backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlruns` is the correct local setup; using the bare filesystem backend is a trap, because the Model Registry requires a database-backed store.

```bash
# Local tracking server: DB-backed (registry works) + local artifact root
mlflow server \
  --backend-store-uri sqlite:///mlflow.db \
  --default-artifact-root ./mlartifacts \
  --host 127.0.0.1 --port 5000
```

### A logging snippet that is actually reproducible

Most tutorial snippets log a metric and stop. The version below logs everything you need to rebuild the run six months later: code version, data version, environment, signature, and input example.

```python
import mlflow, mlflow.sklearn, subprocess, hashlib, json
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from mlflow.models import infer_signature

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("fraud-scoring")

git_sha = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
data_hash = hashlib.sha256(open("data/train.parquet", "rb").read()).hexdigest()[:12]

params = {"n_estimators": 300, "learning_rate": 0.05, "max_depth": 3}

with mlflow.start_run(run_name="gbdt-baseline") as run:
    mlflow.set_tags({"git_sha": git_sha, "data_sha": data_hash, "owner": "fraud-team"})
    mlflow.log_params(params)

    model = GradientBoostingClassifier(**params).fit(X_train, y_train)

    for split, (X, y) in {"train": (X_train, y_train), "val": (X_val, y_val)}.items():
        proba = model.predict_proba(X)[:, 1]
        mlflow.log_metric(f"{split}_auc", roc_auc_score(y, proba))

    # Slice metrics catch fairness/segment regressions that aggregate AUC hides
    for segment, mask in segments.items():
        mlflow.log_metric(f"val_auc__{segment}",
                          roc_auc_score(y_val[mask], model.predict_proba(X_val[mask])[:, 1]))

    signature = infer_signature(X_val, model.predict_proba(X_val))
    mlflow.sklearn.log_model(
        model,
        name="model",
        signature=signature,             # enforces column names/dtypes at serve time
        input_example=X_val.iloc[:5],
        registered_model_name="fraud_scorer",
    )
    mlflow.log_dict(json.dumps(feature_spec), "feature_spec.json")
    print("run_id:", run.info.run_id)
```

Two details do disproportionate work. **`signature`** attaches an input/output schema to the artifact so that `mlflow.pyfunc` raises on a column-order or dtype mismatch at inference rather than silently producing garbage. **Slice metrics** (`val_auc__<segment>`) are what make an automated promotion gate meaningful — aggregate AUC can improve while the model quietly degrades on a minority segment.

### MLflow versus Weights & Biases

Both do tracking; they optimize for different things.

| Dimension | MLflow | Weights & Biases |
|---|---|---|
| Hosting | Fully self-hostable OSS; DB + object store you own | SaaS-first; self-hosted available on paid tiers |
| Core strength | Model packaging + registry + deployment flavors | Experiment visualization, sweeps, collaborative reports |
| Artifact lineage | Run → model version, registry-centric | `wandb.Artifact` DAG with explicit `use_artifact`/`log_artifact` edges |
| Hyperparameter search | Bring your own (Optuna, Ray Tune) | Built-in Sweeps agent (grid/random/Bayes) |
| LLM/agent tracing | MLflow Tracing | W&B Weave |
| Lock-in risk | Low — plain DB + blobs, open format | Higher — hosted service is the system of record |

A pragmatic combination in larger orgs: W&B for the research loop (sweeps, plots, reports), MLflow as the production registry and packaging format. The bridge is cheap — log the W&B run URL as an MLflow tag and vice versa.

W&B's artifact lineage is worth copying conceptually even if you use MLflow:

```python
import wandb
run = wandb.init(project="fraud-scoring", config=params)

ds = run.use_artifact("train-set:v7")          # declares an input edge
path = ds.download()

# ... train ...

art = wandb.Artifact("fraud-scorer", type="model", metadata={"val_auc": auc})
art.add_file("model.pkl")
run.log_artifact(art)                           # declares an output edge
```

Because inputs are *declared*, the platform can answer "which models were trained on the dataset version we just found a labelling bug in?" — the single most valuable query in an incident.

## Feature stores

### The problem: training/serving skew

Train on a feature computed in a Spark job over 90 days of history; serve using a hand-written Python function reading Redis. The two implementations drift within weeks — different null handling, different timezone, different window boundary — and the model degrades for reasons no one can see in the metrics. This is **training/serving skew**, and it is the single most common cause of "great offline, mediocre online."

A feature store fixes it by making one declaration the source of truth for both paths:

- **Offline store** (warehouse/lake: BigQuery, Snowflake, Parquet on S3) serves *point-in-time-correct* historical joins for training.
- **Online store** (Redis, DynamoDB, Postgres) serves the *latest* feature values at single-digit-millisecond latency for inference.
- **Materialization** copies offline → online on a schedule or stream.

### Point-in-time correctness

This is the concept people skip and then regret. If you build a training set by joining "customer's 7-day transaction count" onto a label observed on 2026-03-01, you must use the value *as of* 2026-03-01, not today's value. Naively joining leaks the future into the past, inflates offline metrics, and produces a model that cannot reproduce them in production. Feature stores implement this as an **as-of join** keyed on an entity plus an event timestamp, bounded by a TTL.

### A concrete Feast feature view

```python
# features/repo.py
from datetime import timedelta
from feast import Entity, FeatureView, Field, FileSource, FeatureService, ValueType
from feast.types import Float32, Int64

customer = Entity(name="customer", join_keys=["customer_id"], value_type=ValueType.INT64)

txn_stats_source = FileSource(
    name="txn_stats_source",
    path="s3://lake/features/customer_txn_stats/",
    timestamp_field="event_timestamp",       # when the feature value became true
    created_timestamp_column="created",      # when the row landed (for late-arriving data)
)

customer_txn_stats = FeatureView(
    name="customer_txn_stats",
    entities=[customer],
    ttl=timedelta(days=2),                   # how stale an online value may be
    schema=[
        Field(name="txn_count_7d", dtype=Int64),
        Field(name="txn_amount_avg_7d", dtype=Float32),
        Field(name="days_since_first_txn", dtype=Int64),
    ],
    online=True,
    source=txn_stats_source,
    tags={"team": "fraud"},
)

fraud_v1 = FeatureService(name="fraud_scorer_v1",
                          features=[customer_txn_stats[["txn_count_7d", "txn_amount_avg_7d"]]])
```

Training and serving then read the *same* declaration:

```python
from feast import FeatureStore
store = FeatureStore(repo_path="features/")

# TRAINING — point-in-time correct join against the offline store
training_df = store.get_historical_features(
    entity_df=labels_df,                     # must contain customer_id + event_timestamp
    features=store.get_feature_service("fraud_scorer_v1"),
).to_df()

# SERVING — latest values from the online store, sub-10ms
vectors = store.get_online_features(
    features=store.get_feature_service("fraud_scorer_v1"),
    entity_rows=[{"customer_id": 4711}],
).to_dict()
```

```bash
feast apply                                   # register definitions in the registry
feast materialize-incremental $(date -u +%FT%TZ)   # offline -> online
```

> The `FeatureService` is the piece to be disciplined about: pin your model to a *named, versioned feature service*, not to a loose list of features. Then "which features did model v12 consume?" has an answer, and adding a feature to a feature view cannot silently change an existing model's input vector.

Feature stores are not free — they add a registry, a materialization job, and an online datastore to operate. The honest heuristic: adopt one when you have **more than one model sharing features**, or **streaming features**, or a team that has already been burned by skew. A single batch model with five features does not need Feast; a `features.py` module imported by both the training job and the serving container is sufficient and much cheaper.

## Model registry lifecycle and aliasing

The registry is the boundary between "a model exists" and "a model is the one we serve." It should be the only thing your serving layer resolves against.

### Stages are out; aliases are in

MLflow's original `Staging`/`Production`/`Archived` stages were a fixed enum and are now deprecated in favor of **aliases** — arbitrary, mutable, named pointers to a specific version — plus **tags** for metadata. Aliases are strictly more expressive: you can have `champion`, `challenger`, `canary`, `eu-champion`, and `last-known-good` simultaneously.

```python
from mlflow import MlflowClient
client = MlflowClient()

mv = client.create_model_version(
    name="fraud_scorer",
    source=f"runs:/{run_id}/model",
    run_id=run_id,
)
client.set_model_version_tag("fraud_scorer", mv.version, "val_auc", "0.913")
client.set_registered_model_alias("fraud_scorer", "challenger", mv.version)

# ... after the challenger wins its shadow evaluation ...
client.set_registered_model_alias("fraud_scorer", "champion", mv.version)
```

Serving code never hard-codes a version:

```python
import mlflow.pyfunc
model = mlflow.pyfunc.load_model("models:/fraud_scorer@champion")
```

A rollback is then `set_registered_model_alias("fraud_scorer", "champion", previous_version)` — one API call, no rebuild, no redeploy. Cache the resolved version ID in your service and log it with every prediction so that any prediction can be traced back to an exact artifact.

### A promotion policy worth copying

1. Training pipeline registers every successful run as a new version, tagged with metrics, `git_sha`, `data_sha`, and feature-service name.
2. An automated gate compares the candidate against `models:/<name>@champion` on a **held-out, time-split** evaluation set: aggregate metric must improve by more than a noise threshold, and **no slice** may regress by more than a tolerance.
3. Passing candidates get the `challenger` alias and enter shadow serving.
4. A human (or a scheduled job with a hard business-metric guardrail) promotes `challenger` → `champion`.
5. The previous champion is tagged `last-known-good` and never deleted.

## CI/CD for machine learning

### What differs from ordinary CI/CD

Ordinary CI answers "does this code build and pass tests?" ML CI must additionally answer "is this *model* good, and is the *data* it was trained on sane?" Concretely, four things are new:

**1. Data and model versioning are first-class.** Git holds code; git does not hold a 40 GB Parquet snapshot. Use DVC, LakeFS, Delta/Iceberg time travel, or plain immutable partitioned paths — but whatever you choose, the training run must record the exact identifier, and CI must be able to re-resolve it.

**2. Training is a pipeline stage, not a build step.** Full training is too slow and too expensive for every PR. The standard split:

- On **every PR**: lint, unit tests, *data validation* tests, and a **smoke train** on a tiny fixed sample that must complete in a couple of minutes. This catches shape errors, schema drift, and NaN explosions, not quality regressions.
- On **merge to main**: build and push the pipeline container, then trigger the full training pipeline in the orchestrator (Airflow, Kubeflow, Metaflow, Dagster, Prefect, Argo Workflows, Vertex/SageMaker Pipelines).
- On **schedule or drift trigger**: continuous training. The deployed unit at Google's Level 2 is the *pipeline*, not the model.

**3. Tests include data and model tests.** Beyond `pytest`:

- *Schema tests* — column presence, dtypes, allowed ranges, null-rate bounds (Great Expectations, Pandera, `deequ`).
- *Distribution tests* — PSI/KS between the new training slice and the reference slice, failing the build on a large shift.
- *Behavioral tests* — invariance ("changing an irrelevant field must not change the prediction"), directional expectations ("raising transaction amount must not lower the fraud score"), and minimum-functionality tests on curated edge cases. This is the CheckList idea applied to tabular and NLP models.
- *Serving parity test* — score N rows through the training code path and the packaged `pyfunc`/container path and assert the outputs match to within float tolerance. This one test catches most skew bugs.

**4. Deployment strategies are probabilistic, not binary.** A model can be "up" and wrong.

| Strategy | Traffic to new model | Compares against | Best for |
|---|---|---|---|
| **Shadow / dark launch** | 0% (mirrored requests, responses discarded) | Offline comparison of logged outputs | Validating latency + output distribution with zero user risk |
| **Canary** | 1% → 5% → 25% → 100% | Live business metrics with automatic rollback | Most production promotions |
| **A/B (interleaved)** | 50/50 with randomized assignment | Statistically-powered business metric | When you need a causal quality read, not just safety |
| **Multi-armed bandit** | Adaptive | Online reward | High-volume ranking/recsys with fast feedback |
| **Blue/green** | Atomic swap | Pre-cutover smoke tests | Heavy models where dual-serving is too costly |

Shadow deployment deserves emphasis: it is the cheapest way to catch the two most common production surprises — a p99 latency blowup from an unexpectedly heavy preprocessing path, and an output distribution that differs from offline because the online feature values differ from the offline ones. Run shadow for at least one full business cycle (a week, so weekday/weekend both appear) before canarying.

```yaml
# .github/workflows/ml-ci.yml — PR-time gate
name: ml-ci
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements-dev.txt
      - run: ruff check . && mypy src/
      - run: pytest tests/unit -q
      - name: Data contract tests
        run: pytest tests/data -q          # schema, null rates, PSI vs reference
      - name: Smoke train (200 rows, must finish < 3 min)
        run: python -m src.train --config configs/smoke.yaml --max-rows 200
      - name: Serving parity
        run: pytest tests/parity -q        # train path output == pyfunc output
```

> Never let a CI job promote an alias. CI *registers and evaluates*; promotion to `champion` is a separate, auditable action with its own approval. Conflating them means a bad merge can page you at 3am.

## Infrastructure as code for ML

### Terraform and Ansible do different jobs

The division is clean once stated: **Terraform provisions, Ansible configures.** Terraform is declarative and stateful — it holds a state file, computes a diff against the cloud API, and creates/destroys resources (VPCs, buckets, IAM roles, Kubernetes clusters, node pools, managed databases). Ansible is procedural and stateless — it SSHes into machines that already exist and converges their contents (drivers, CUDA toolkit, daemons, config files, cron entries).

In a Kubernetes-based ML platform, Terraform does 90% of the work and Ansible does almost none, because node configuration is handled by container images and DaemonSets. Ansible earns its place when you have **long-lived bare-metal or VM GPU hosts** — on-prem DGX boxes, a fixed reserved-instance training fleet, or air-gapped environments — where you genuinely need to install NVIDIA drivers, the container toolkit, node exporters, and Slurm on hosts that are not immutable.

### A realistic GPU node pool

```hcl
# gpu_pool.tf — autoscaling, preemptible A100 pool for training jobs
resource "google_container_node_pool" "gpu_training" {
  name     = "gpu-a100-training"
  cluster  = google_container_cluster.ml.id
  location = var.region

  # Scale to zero: no GPU billed when no training job is queued
  autoscaling {
    min_node_count = 0
    max_node_count = 8
    location_policy = "ANY"      # take capacity wherever the zone has it
  }

  management {
    auto_repair  = true
    auto_upgrade = false          # pin: driver/CUDA compatibility is fragile
  }

  node_config {
    machine_type = "a2-highgpu-1g"
    disk_size_gb = 200
    disk_type    = "pd-ssd"
    spot         = true           # ~60-90% cheaper; jobs MUST checkpoint

    guest_accelerator {
      type  = "nvidia-tesla-a100"
      count = 1

      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"   # GKE installs the driver for you
      }
    }

    # Taint so only workloads that explicitly tolerate GPUs land here
    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }

    labels = {
      workload = "training"
      team     = "fraud"
    }

    shielded_instance_config {
      enable_secure_boot = true
    }

    workload_metadata_config {
      mode = "GKE_METADATA"       # Workload Identity: no static service-account keys
    }
  }

  lifecycle {
    ignore_changes = [node_config[0].labels]   # avoid fighting the autoscaler
  }
}
```

Four things in that snippet are the difference between a demo and a production pool:

1. **`min_node_count = 0`.** GPU nodes are the dominant line item. A pool that cannot scale to zero will quietly cost more than the team's salaries.
2. **`spot = true` plus taints.** Spot/preemptible capacity is the single largest cost lever for training, but it only works if your training code checkpoints to object storage and resumes — treat preemption as expected, not exceptional.
3. **`auto_upgrade = false`.** GPU driver ↔ CUDA ↔ framework version compatibility is brittle. Upgrade node pools deliberately, in a canary pool first.
4. **Workload Identity.** The training pod needs to read the lake and write to the artifact store. Bind a Kubernetes service account to a cloud IAM identity rather than mounting a long-lived key.

Where Ansible slots in, for the bare-metal case:

```yaml
# roles/gpu_node/tasks/main.yml
- name: Install pinned NVIDIA driver
  ansible.builtin.apt:
    name: "nvidia-driver-{{ nvidia_driver_version }}"
    state: present
  notify: reboot node

- name: Install NVIDIA container toolkit
  ansible.builtin.apt:
    name: nvidia-container-toolkit
    state: present

- name: Verify GPUs are visible
  ansible.builtin.command: nvidia-smi --query-gpu=name,memory.total --format=csv
  register: smi
  changed_when: false
  failed_when: smi.rc != 0
```

### Structuring the Terraform itself

- **Remote state with locking** (GCS/S3 + DynamoDB or the native lock). Local state on a laptop is how two engineers destroy each other's clusters.
- **Environment = directory, not workspace-only.** `envs/dev`, `envs/staging`, `envs/prod`, each with its own backend key, consuming shared `modules/`. Workspaces alone make it too easy to `apply` to prod from a dev shell.
- **Plan in CI, apply behind approval.** `terraform plan` on PR posting the diff as a comment; `terraform apply` only on merge with a required reviewer.
- **Never put secrets in `.tfvars`.** Reference a secret manager; Terraform state stores resource attributes in plaintext, so anything you pass in is readable to anyone with state access.
- **Tag/label every resource** with `team`, `env`, `cost-center`, and `owner`. Cost attribution for GPU spend is impossible retroactively.

## A minimal end-to-end reference stack

If you want one concrete stack to build as a portfolio project, this one is coherent, entirely free to run locally, and exercises every concept above:

```
data/            immutable Parquet snapshots, path = s3://.../dt=YYYY-MM-DD/
features/        Feast repo (entities, feature views, feature services)
src/train.py     parameterized; logs to MLflow; registers a model version
tests/           unit + data-contract + behavioral + serving-parity
pipelines/       orchestrator DAG: ingest -> validate -> features -> train -> eval -> register
serving/         FastAPI container loading models:/<name>@champion, emits OTel traces
infra/           Terraform: cluster, node pools, buckets, IAM, MLflow backing store
.github/         PR gate (lint/test/smoke-train) + main pipeline trigger
```

Build it in that order and resist the urge to add tools. Every component you add must answer "what failure does this prevent?" — a feature store prevents skew, a registry prevents untraceable rollbacks, data tests prevent silent poisoning. A tool that prevents no specific failure is debt with a nice UI.

## Where to go next

- **[MLOps Zoomcamp (DataTalksClub)](https://github.com/DataTalksClub/mlops-zoomcamp)** — the best free, hands-on path through this exact material. Work the modules in order and actually do the capstone; it forces you to wire tracking, registry, orchestration, deployment, and monitoring together rather than reading about them separately.
- **[MLOps: Continuous delivery and automation pipelines in machine learning (Google Cloud)](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)** — read this once you have built something, and use the Level 0/1/2 ladder to honestly grade your own system.
- **[Hidden Technical Debt in Machine Learning Systems (Sculley et al., NeurIPS 2015)](https://proceedings.neurips.cc/paper_files/paper/2015/file/86df7dcfd896fcaf2674f757a2463eba-Paper.pdf)** — nine pages, still the sharpest explanation of *why* all of the above tooling exists. Re-read it annually.
