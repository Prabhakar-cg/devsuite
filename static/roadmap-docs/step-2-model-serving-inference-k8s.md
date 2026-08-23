# Model serving & inference infra on Kubernetes

_How to turn an LLM checkpoint into a production service on Kubernetes: choosing an inference engine, getting GPUs scheduled correctly, autoscaling on the metrics that actually predict latency, and observing the system well enough to defend an SLO._

## The shape of the problem

Serving a stateless HTTP microservice on Kubernetes is a solved problem. Serving an LLM is not, because LLM replicas violate almost every assumption the platform makes:

| Assumption Kubernetes makes | Reality for LLM serving |
|---|---|
| Pods start in seconds | Pods take 2–10 minutes (image pull + weight load into VRAM) |
| Replicas are cheap and fungible | A replica is one or more $25k+ GPUs |
| CPU/memory utilization predicts saturation | GPU utilization is a near-useless saturation signal |
| Requests are short and uniform | Requests last 100 ms to 5 minutes and vary 100× in cost |
| Scale-out absorbs load quickly | Scale-out is slower than most traffic spikes |

Every design decision below follows from that table. The goal is a system where a request's **TTFT** (time to first token) and **TPOT** (time per output token) stay inside their SLO while GPU cost per million tokens stays low — two objectives that pull in opposite directions.

## Choosing an inference engine

The engine is the layer that owns the GPU, the KV cache, and the batching scheduler. Everything above it is plumbing.

| Engine | Best for | Batching | Quantization | Protocol | Notes |
|---|---|---|---|---|---|
| **vLLM** | General-purpose LLM serving; the default choice | Continuous + chunked prefill, PagedAttention | AWQ, GPTQ, FP8, INT8, bitsandbytes | OpenAI-compatible `/v1/*` | Broadest model coverage, strong community, first-class Prometheus metrics |
| **SGLang** | High-throughput agentic / structured workloads | Continuous + RadixAttention prefix cache | AWQ, GPTQ, FP8 | OpenAI-compatible | Excellent prefix reuse for tree-shaped and multi-turn workloads |
| **TensorRT-LLM (via Triton)** | Peak per-GPU throughput on NVIDIA, fixed model set | In-flight batching | FP8, INT4 AWQ, SmoothQuant | Triton HTTP/gRPC, OpenAI front-end | Requires an ahead-of-time engine build per model + GPU + parallelism config. Fastest, least flexible. |
| **NVIDIA Triton** | Mixed fleets: LLM + embeddings + classic ML in one server | Dynamic batching, ensembles | backend-dependent | KServe v2 (Open Inference Protocol) | Multi-backend (TensorRT, PyTorch, ONNX, Python, vLLM). The right answer when you serve more than LLMs. |
| **Hugging Face TGI** | Legacy deployments | Continuous batching | bitsandbytes, GPTQ, AWQ | Custom + OpenAI-compatible | **Now in maintenance mode** — Hugging Face directs new work to vLLM and SGLang. Do not start here in 2026. |

> If you are choosing today and have no unusual constraint, choose vLLM. Choose Triton when you must serve heterogeneous model types behind one server, and TensorRT-LLM when you have a small, stable model set and per-GPU throughput is worth an ahead-of-time compilation step in your build pipeline.

### A minimal vLLM invocation

```bash
vllm serve meta-llama/Meta-Llama-3.1-8B-Instruct \
  --host 0.0.0.0 --port 8000 \
  --tensor-parallel-size 1 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --max-num-seqs 128 \
  --enable-prefix-caching \
  --kv-cache-dtype fp8 \
  --served-model-name llama-3.1-8b
```

The flags that matter operationally:

- `--gpu-memory-utilization` is the **fraction of total VRAM vLLM is allowed to claim**, not a target. Everything left over is for the CUDA context, other processes, and headroom. On a dedicated GPU, 0.90–0.95 is right; sharing the card with anything else, drop it.
- `--max-model-len` caps context. Set it to what you actually serve — an unnecessarily large value shrinks the number of concurrent sequences that fit, because vLLM reserves KV space accordingly.
- `--max-num-seqs` caps in-flight sequences. This is your primary **latency knob**: lower it and TPOT improves while throughput and queue depth worsen.
- `--tensor-parallel-size` must divide the model's attention head count and should never exceed the GPUs in one node (TP does an all-reduce per layer and needs NVLink).
- `--enable-prefix-caching` is close to free and is a large win for any workload with a shared system prompt.

The server exposes `/v1/chat/completions`, `/v1/completions`, `/v1/models`, `/health`, and `/metrics`.

## Getting GPUs scheduled

### The device plugin model

Kubernetes does not know what a GPU is. A **device plugin** — in practice the NVIDIA device plugin, usually installed by the **GPU Operator** — advertises an extended resource named `nvidia.com/gpu` on each node. The GPU Operator additionally manages the driver, the container toolkit, GPU Feature Discovery (node labels), and DCGM for metrics, so you do not hand-install drivers on nodes.

Extended resources have a rule people trip over constantly:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1      # you MUST set the limit
  # requests is optional; if set it must EQUAL the limit
```

You cannot request GPUs without a limit, and you cannot over-commit them. A GPU is allocated whole to one container unless you enable sharing (below).

### Placing pods on the right GPUs

A heterogeneous cluster (L4s, A100s, H100s) needs explicit targeting. GPU Feature Discovery labels nodes with `nvidia.com/gpu.product`, `nvidia.com/gpu.memory`, `nvidia.com/gpu.count`, and more. Combine node affinity with a taint/toleration so that non-GPU work never lands on expensive nodes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llama-31-8b
spec:
  replicas: 2
  selector:
    matchLabels: { app: llama-31-8b }
  template:
    metadata:
      labels: { app: llama-31-8b }
    spec:
      tolerations:
        - key: nvidia.com/gpu
          operator: Exists
          effect: NoSchedule
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: nvidia.com/gpu.product
                    operator: In
                    values: ["NVIDIA-H100-80GB-HBM3", "NVIDIA-A100-SXM4-80GB"]
      containers:
        - name: vllm
          image: vllm/vllm-openai:latest
          args:
            - "--model=meta-llama/Meta-Llama-3.1-8B-Instruct"
            - "--max-model-len=8192"
            - "--gpu-memory-utilization=0.90"
            - "--enable-prefix-caching"
          ports:
            - { containerPort: 8000, name: http }
          resources:
            limits:
              nvidia.com/gpu: 1
              memory: 32Gi
              cpu: "8"
          env:
            - name: HUGGING_FACE_HUB_TOKEN
              valueFrom:
                secretKeyRef: { name: hf-token, key: token }
          volumeMounts:
            - { name: model-cache, mountPath: /root/.cache/huggingface }
            - { name: shm, mountPath: /dev/shm }
          startupProbe:
            httpGet: { path: /health, port: http }
            periodSeconds: 10
            failureThreshold: 60        # allow 10 minutes to load weights
          readinessProbe:
            httpGet: { path: /health, port: http }
            periodSeconds: 5
          lifecycle:
            preStop:
              exec: { command: ["sleep", "30"] }
      terminationGracePeriodSeconds: 120
      volumes:
        - name: model-cache
          persistentVolumeClaim: { claimName: model-cache-pvc }
        - name: shm
          emptyDir: { medium: Memory, sizeLimit: 8Gi }
```

Four details in that manifest are load-bearing and are the most common sources of production incidents:

1. **`startupProbe` with a long `failureThreshold`.** Weight loading takes minutes. Without a startup probe, the liveness probe kills the pod mid-load and you get a CrashLoopBackOff that looks like a model bug.
2. **`/dev/shm` sized up.** Multi-GPU tensor parallelism uses shared memory for NCCL/IPC. The container default of 64 MB causes hangs or cryptic NCCL errors as soon as `--tensor-parallel-size > 1`.
3. **`preStop` sleep + long `terminationGracePeriodSeconds`.** On SIGTERM the pod is removed from endpoints, but in-flight streaming generations may still have 60+ seconds to run. The sleep gives the endpoint removal time to propagate; the grace period lets in-flight work finish instead of severing streams mid-sentence.
4. **A PVC or node-local cache for weights.** Pulling 16 GB from Hugging Face on every pod start adds minutes to scale-out and will rate-limit you.

### Sharing a GPU: time-slicing, MPS, and MIG

Whole-GPU allocation wastes money on small models. Three options, in increasing order of isolation:

- **Time-slicing** — the device plugin advertises `N` "replicas" of one physical GPU and the driver context-switches between them. **No memory isolation and no fault isolation**: one process OOMing takes down the others. Fine for dev, inference of tiny models, and notebooks. Never for production LLM serving.
- **MPS (Multi-Process Service)** — concurrent kernel execution from multiple processes without context-switch overhead, with optional memory limits. Better throughput than time-slicing, still weak isolation.
- **MIG (Multi-Instance GPU)** — hardware partitioning on A100/H100/H200 into up to 7 instances with **dedicated SMs, L2 slices, and memory**. Profiles look like `1g.10gb`, `2g.20gb`, `3g.40gb`, `7g.80gb` on an 80 GB card; the plugin advertises them as `nvidia.com/mig-1g.10gb`. Real isolation, real QoS, at the cost of static partitioning and no NVLink between instances.

For LLM serving the practical rule is: **give a replica whole GPUs, or give it a MIG slice.** Time-slicing an LLM server is asking for an OOM cascade.

### Multi-GPU and multi-node

A 70B model in bf16 (≈141 GB of weights) does not fit on one 80 GB card. Options:

- **Within a node**: `--tensor-parallel-size 4`, one pod requesting `nvidia.com/gpu: 4`. Requires NVLink for acceptable performance.
- **Across nodes**: pipeline parallelism, or TP across nodes over InfiniBand/RoCE. This needs *gang scheduling* — all workers must start together or none should. Plain Deployments cannot express this. Use **LeaderWorkerSet** (purpose-built for multi-host inference), **Kueue** (queueing plus all-or-nothing admission), or **Volcano** (gang scheduling for batch/AI).

> Never model a multi-node inference replica as a plain Deployment with `replicas: N`. Partial scheduling leaves you with workers idling on GPUs waiting for a leader that will never be scheduled — burning full GPU cost at zero throughput, indefinitely.

## KServe and Seldon: the model-serving control plane

You can run vLLM as a bare Deployment. A serving platform adds: a declarative model abstraction, storage-URI resolution, canary traffic splitting, scale-to-zero, request/response logging, and a standard protocol.

### KServe

KServe's core CRD is the `InferenceService` ("isvc"). It runs in two modes:

- **Serverless mode** (Knative-backed) — request-driven autoscaling including scale-to-zero, with queue-proxy-based concurrency metrics.
- **RawDeployment mode** — plain Deployment + Service + HPA, no Knative dependency. **This is the usual choice for LLMs**, because Knative's queue proxy is a poor fit for long-lived streaming responses and cold starts make scale-to-zero unattractive at LLM sizes.

A generative-AI `InferenceService` backed by vLLM:

```yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: llama-31-8b
  annotations:
    serving.kserve.io/deploymentMode: RawDeployment
    serving.kserve.io/autoscalerClass: external      # let KEDA drive scaling
spec:
  predictor:
    minReplicas: 1
    maxReplicas: 8
    tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
    model:
      modelFormat:
        name: huggingface
      runtime: kserve-huggingfaceserver
      storageUri: "s3://models/llama-3.1-8b-instruct/"
      args:
        - "--max-model-len=8192"
        - "--gpu-memory-utilization=0.90"
        - "--enable-prefix-caching"
      resources:
        limits:
          nvidia.com/gpu: "1"
          memory: 32Gi
          cpu: "8"
```

Key concepts worth internalizing:

- **`ServingRuntime` / `ClusterServingRuntime`** — reusable pod templates keyed by model format. You define "how to run a Hugging Face model" once; each `InferenceService` just references it. This is what stops every team from copy-pasting a 90-line vLLM Deployment.
- **`storageUri`** — S3/GCS/Azure/PVC/OCI. A `storage-initializer` init container downloads weights before the server starts. For large models prefer a shared PVC or KServe's local model cache so you download once per node, not once per pod.
- **Canary rollouts** — `canaryTrafficPercent: 10` splits traffic between the last-good and newly-deployed revision. For GPU workloads remember a canary is a *whole extra replica*, i.e. a whole extra GPU.
- **Protocols** — KServe standardized the **Open Inference Protocol** (`/v2/models/...`) for predictive models; for generative models the OpenAI-compatible surface is what clients actually use. Newer KServe releases add a dedicated LLM-oriented resource for disaggregated prefill/decode and router topologies.

### Seldon Core v2

Seldon Core v2 takes a different shape: `Server` (a running inference server), `Model` (a model loaded onto a server), and `Pipeline` (a dataflow graph of models joined over Kafka). Its distinguishing features are **multi-model serving** — many models packed onto shared servers with overcommit and demand-based loading/unloading — and Kafka-native pipelines, which make async, streaming, and inference-graph use cases first-class. Note Seldon Core v2 is under the Business Source License; check licensing before adopting it commercially. Choose Seldon when you have hundreds of small models or genuinely need dataflow pipelines; choose KServe for a smaller number of large models behind a standard API.

## Autoscaling: scaling on the right signal

### Why the obvious metrics fail

- **CPU utilization** — meaningless. The GPU does the work.
- **GPU utilization (`DCGM_FI_DEV_GPU_UTIL`)** — this counter reports *the fraction of time at least one kernel was resident*, not how much of the GPU's capability is used. A batch-size-1 decode loop reports ~100% while using under 1% of the FLOPs. It saturates long before the server does, so it cannot distinguish "busy" from "overloaded."
- **Requests per second** — a request may be 50 tokens or 5,000. RPS does not measure load.

### What to scale on

The signal that actually leads latency degradation is **queue depth**: requests admitted but not yet running. vLLM exposes it directly, alongside the other metrics you need:

| Metric | Meaning | Use |
|---|---|---|
| `vllm:num_requests_waiting` | requests queued, not yet in a batch | **Primary autoscaling trigger** |
| `vllm:num_requests_running` | sequences in the current batch | saturation vs. `--max-num-seqs` |
| `vllm:kv_cache_usage_perc` | fraction of KV blocks in use | capacity headroom; preemption risk |
| `vllm:time_to_first_token_seconds` | TTFT histogram | SLO |
| `vllm:time_per_output_token_seconds` | inter-token latency histogram | SLO |
| `vllm:e2e_request_latency_seconds` | end-to-end latency histogram | SLO |
| `vllm:prompt_tokens` / `vllm:generation_tokens` | token counters | cost accounting, real load |
| `vllm:prefix_cache_hits` | prefix cache effectiveness | tuning |

A KEDA `ScaledObject` on queue depth:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: llama-31-8b-scaler
spec:
  scaleTargetRef:
    name: llama-31-8b          # the Deployment created by the isvc
  minReplicaCount: 1           # do NOT scale to zero for large models
  maxReplicaCount: 8
  pollingInterval: 15          # seconds between metric queries
  cooldownPeriod: 600          # wait 10 min before scaling down
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 0
          policies:
            - type: Pods
              value: 2
              periodSeconds: 60
        scaleDown:
          stabilizationWindowSeconds: 900     # 15 min — GPUs are expensive to churn
          policies:
            - type: Pods
              value: 1
              periodSeconds: 300
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus.monitoring.svc:9090
        query: |
          sum(vllm:num_requests_waiting{service="llama-31-8b"})
          /
          count(vllm:num_requests_running{service="llama-31-8b"})
        threshold: "5"
        activationThreshold: "1"
```

Notes on that configuration:

- KEDA does not replace the HPA — it **creates and feeds one**, translating external metrics into something the HPA understands. Never point an HPA and a KEDA `ScaledObject` at the same Deployment.
- `threshold` is a **per-replica target**, exactly like an HPA target. The query divides by replica count so "5" means "5 waiting requests per replica."
- **Asymmetric scaling behavior is the whole game.** Scale up fast (a spike is already hurting users). Scale down slowly — a GPU node costs minutes to reacquire, and thrashing between 3 and 4 replicas costs more than just staying at 4.
- `activationThreshold` controls the 0→1 transition specifically. Only relevant if you scale to zero.

### The cold-start problem

Scale-up latency is the sum of: node provisioning by the cluster autoscaler (60–300 s if no warm node exists) + image pull (a vLLM image is several GB) + weight download + weight load into VRAM + CUDA graph capture. Realistically **2–10 minutes**. Autoscaling therefore cannot respond to a spike — it can only respond to a trend.

Mitigations, roughly in order of cost-effectiveness:

1. **Overprovision deliberately.** Run at ~70% target utilization so a spike has headroom. This is cheaper than the alternative of missing SLOs.
2. **Warm node pools** — keep GPU nodes provisioned even when pods are not, so you pay only image-pull + load time.
3. **Cache weights node-local** — a ReadOnlyMany PVC, a node-local model cache, or an OCI image containing the weights.
4. **Balloon / pause pods** — low-priority placeholder pods that hold GPU nodes and get preempted instantly when a real pod needs the space.
5. **Predictive scaling** — scale on a schedule if your traffic has a daily shape. Most enterprise traffic does.

### Routing matters as much as scaling

Round-robin load balancing is wrong for LLMs. Two requests are not equal, and the KV cache makes replicas *stateful in effect*: a replica that already holds a conversation's prefix can answer far faster than one that must re-prefill. **Prefix-aware / cache-aware routing** — sending a session to the replica holding its KV blocks — and **least-queued routing** are both large wins. The Kubernetes **Gateway API Inference Extension** standardizes this with an `InferencePool` abstraction and an endpoint-picker that routes on live engine metrics rather than connection counts; it is the direction the ecosystem is converging on.

## Observability

### The metrics pipeline

```
vLLM /metrics ─┐
DCGM exporter ─┼─► Prometheus (scrape) ─► remote_write ─► Grafana Mimir ─► Grafana
kube-state-metrics ─┘                                          ▲
                                                               │
promtail / Alloy ──► Grafana Loki ─────────────────────────────┘
```

Prometheus scrapes locally; **Mimir** provides horizontally scalable, multi-tenant, long-term storage behind it (metrics that survive cluster rebuilds and let you compare this month's cost per token to last quarter's). **Loki** indexes only labels and stores compressed logs in object storage. Its main operational hazard is label cardinality — never label logs with pod IDs, request IDs, or user IDs; put those in the log line and use LogQL filters.

Scrape vLLM with a `ServiceMonitor`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: vllm
  labels: { release: kube-prometheus-stack }
spec:
  selector:
    matchLabels: { app: llama-31-8b }
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

### The SLIs to alert on

Define your SLOs in the user's terms, not the GPU's:

- **TTFT p95** — the perceived responsiveness of the product. Driven by queue time + prefill.
- **TPOT p95** (inter-token latency) — perceived "typing speed." Driven by batch size and memory bandwidth.
- **End-to-end latency p99** — for non-streaming clients.
- **Throughput** — output tokens/sec per replica, the denominator of your cost model.
- **Error rate**, split into 4xx (client), 5xx (server), and **preemptions** — sequences evicted because KV cache filled. Preemption is a silent latency killer that shows up as TPOT variance, not as an error.
- **Cost per million tokens** — `(GPU-hours × hourly rate) / (tokens generated / 1e6)`. This is the number that makes engineering tradeoffs legible to the business.

Useful PromQL:

```promql
# p95 TTFT over 5 minutes
histogram_quantile(0.95,
  sum by (le, model_name) (rate(vllm:time_to_first_token_seconds_bucket[5m])))

# Output tokens/sec per replica
sum by (pod) (rate(vllm:generation_tokens_total[5m]))

# KV cache pressure — sustained >0.9 means you are about to preempt
max by (pod) (vllm:kv_cache_usage_perc)

# GPU memory actually used, from DCGM
DCGM_FI_DEV_FB_USED / (DCGM_FI_DEV_FB_USED + DCGM_FI_DEV_FB_FREE)
```

> Alert on **queue time and preemption rate**, not on GPU utilization. By the time GPU utilization is a useful signal, your users have already been waiting for thirty seconds.

Add **tracing** (OpenTelemetry) across gateway → router → engine so you can attribute a slow request to queueing versus prefill versus decode. Without it, "the model is slow" is unfalsifiable.

## A production checklist

Before you call a deployment production-ready:

- [ ] `startupProbe` allows the full model-load time; `readinessProbe` gates traffic on `/health`.
- [ ] `preStop` + `terminationGracePeriodSeconds` let in-flight streams drain.
- [ ] `/dev/shm` is sized for multi-GPU NCCL.
- [ ] Weights are cached node-local or on a shared PVC — not re-downloaded per pod.
- [ ] `PodDisruptionBudget` prevents node drains from taking out all replicas at once.
- [ ] Autoscaling triggers on queue depth, scales up fast, scales down slowly.
- [ ] Multi-node replicas use gang scheduling (LeaderWorkerSet / Kueue / Volcano).
- [ ] GPU nodes are tainted; only GPU workloads tolerate them.
- [ ] `ResourceQuota` per namespace caps `nvidia.com/gpu` so one team cannot consume the fleet.
- [ ] Dashboards show TTFT/TPOT percentiles, KV cache usage, queue depth, preemptions, and cost per million tokens.
- [ ] Rollouts are canaried; rollback is one `kubectl` command.
- [ ] Model artifacts are versioned and immutable — `storageUri` points at a digest or versioned prefix, never at a mutable `latest`.

## Where to go next

- **[vLLM Documentation](https://docs.vllm.ai/en/latest/)** — start with the engine arguments, the production metrics page, and the distributed-serving guide. Everything in this document about batching, KV cache, and metric names is grounded there.
- **[KServe Documentation](https://kserve.github.io/website/)** — read the architecture overview, then `ServingRuntime` and generative-inference guides. It is the fastest way to see how the control plane, storage initializer, and autoscaler fit together.
- **[Kubernetes: Schedule GPUs](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)** — short, authoritative, and the source of the `limits`-only rule that trips up most first deployments.

The natural next step from here is inference cost and reliability engineering: multi-model routing, disaggregated prefill/decode, spot-GPU strategies, and building the cost-per-token dashboards that make the whole system defensible.
