# ML/LLM systems fundamentals

_A systems engineer's working model of how large language models actually consume compute, memory, and bandwidth — from byte-pair encoding through KV-cache arithmetic to the roofline that decides whether your GPU is fast or idle._

## Why a systems view, not a modelling view

Most LLM material is written for people who want to *train better models*. If your job is to run them, you need a different mental model. The questions that matter to you are:

- How many bytes must move across the memory bus to produce one token?
- How much of the GPU's 80 GB is weights, how much is KV cache, and how much is wasted?
- Why does the first token take 400 ms and the next 60 tokens take 600 ms?
- Why does batch size 1 leave a $30,000 accelerator running at 1% of its FLOPs?

Everything below is aimed at answering those. The recurring theme: **inference is a memory-bandwidth problem long before it is a compute problem**, and almost every optimization in the ecosystem — quantization, paged attention, continuous batching, speculative decoding — is a way of buying back bandwidth or filling idle arithmetic units.

## Training vs. inference: two different machines

Training and inference share a model definition and share almost nothing else operationally.

Training is a throughput job. It is offline, restartable, batch-oriented, and its unit of success is *samples per second per dollar*. It holds, per parameter: the weights, the gradients, and optimizer state. For Adam in mixed precision that is roughly 2 bytes (bf16 weights) + 4 bytes (fp32 master weights) + 4 + 4 bytes (Adam's first and second moments) + 2 bytes (bf16 gradients) ≈ 16 bytes per parameter, before activations. An 8-billion-parameter model therefore needs on the order of 128 GB just for state — which is why training an "8B" model does not fit on a single 80 GB card and why ZeRO/FSDP sharding exists.

Inference is a latency job. It is online, its unit of success is *tokens per second at a p95 latency bound*, and it holds only the weights plus a per-request cache. The same 8B model in bf16 is 16 GB of weights. That fits comfortably. The hard part is not fitting the model; it is keeping the GPU busy while 200 concurrent users each want their next token *now*.

> The single most common planning error is sizing an inference cluster with training intuitions. Inference capacity is governed by KV cache headroom and memory bandwidth, not by parameter count alone.

There is a third regime worth naming: **fine-tuning**, especially LoRA/QLoRA. It has training's memory profile for a tiny fraction of parameters (adapters of rank 8–64) and inference's deployment profile, which is why multi-LoRA serving — one base model, dozens of hot-swapped adapters — became a standard production pattern.

## Tokens: the unit of everything

### What a tokenizer actually does

A tokenizer maps a byte string to a sequence of integer ids drawn from a fixed vocabulary. Nearly all modern LLMs use **byte-level BPE** (byte-pair encoding) or a close variant (SentencePiece Unigram in some families).

Byte-level BPE works like this:

1. Start with the 256 possible bytes as the base vocabulary. This guarantees *no* input is ever unrepresentable — no `<UNK>` token, ever, for any Unicode, emoji, or binary garbage.
2. Count adjacent pairs across a training corpus. Merge the most frequent pair into a new symbol. Record the merge.
3. Repeat until the vocabulary reaches the target size.

At encode time you apply the recorded merges in learned order. The merge list *is* the tokenizer.

A minimal, correct implementation of the training loop:

```python
from collections import Counter

def get_pair_counts(words):
    """words: dict mapping tuple-of-symbols -> corpus frequency."""
    counts = Counter()
    for symbols, freq in words.items():
        for a, b in zip(symbols, symbols[1:]):
            counts[(a, b)] += freq
    return counts

def merge_pair(words, pair):
    a, b = pair
    merged = {}
    for symbols, freq in words.items():
        out, i = [], 0
        while i < len(symbols):
            if i < len(symbols) - 1 and symbols[i] == a and symbols[i + 1] == b:
                out.append(a + b)
                i += 2
            else:
                out.append(symbols[i])
                i += 1
        merged[tuple(out)] = merged.get(tuple(out), 0) + freq
    return merged

def train_bpe(corpus, num_merges):
    words = Counter(corpus.split())
    words = {tuple(w.encode("utf-8").decode("latin-1")) : f for w, f in words.items()}
    merges = []
    for _ in range(num_merges):
        counts = get_pair_counts(words)
        if not counts:
            break
        best = max(counts, key=counts.get)
        merges.append(best)
        words = merge_pair(words, best)
    return merges
```

Real tokenizers add a **pre-tokenization regex** that splits text before BPE ever runs — this is what stops merges from crossing word boundaries and what makes whitespace handling deterministic. GPT-4's `cl100k_base` uses a regex that keeps a leading space attached to the following word, which is why `" hello"` and `"hello"` are *different tokens*.

### Numbers worth memorizing

| Property | Typical value |
|---|---|
| English text density | ~4 characters/token, ~0.75 words/token |
| `cl100k_base` (GPT-4) vocab | 100,277 |
| `o200k_base` (GPT-4o family) vocab | ~200,000 |
| Llama 3 / 3.1 vocab | 128,256 (128,000 learned + 256 reserved/special) |
| Code density | ~3 characters/token (worse — punctuation and indentation fragment) |
| Non-Latin scripts | often 2–4× more tokens per character than English |

That last row has real cost implications: the same document in Japanese or Hindi can cost several times more to process than its English translation under a Latin-biased tokenizer.

### Gotchas that will bite you

- **Token counts are model-specific.** Never estimate one model's usage with another's tokenizer. A 1,000-token prompt under `cl100k_base` may be 1,150 tokens under Llama 3's vocabulary.
- **Numbers tokenize badly.** Many tokenizers split digits into 1–3 digit chunks, which is a large part of why LLMs are erratic at arithmetic.
- **Trailing whitespace is a bug source.** A prompt ending in `" "` puts the model in a state where the natural next token (a space-prefixed word) is now unlikely, and quality degrades visibly.
- **Context limits are token limits, not character limits**, and the limit covers prompt + generated output together.

## Embeddings and the vector view

An embedding matrix is a lookup table of shape `[vocab_size, d_model]`. Token id 4,271 selects row 4,271. For Llama-3-8B that is `[128256, 4096]` in bf16 = 128,256 × 4096 × 2 bytes ≈ **1.05 GB** for the input embedding alone — about 6.5% of the whole model. Models that do not tie input and output embeddings pay this twice.

Two distinct things get called "embeddings" and conflating them causes real bugs:

- **Token embeddings** — internal, per-token, one row per vocabulary entry, meaningful only inside the model.
- **Sentence/document embeddings** — a single fixed-length vector per input, produced by a dedicated model (E5, BGE, GTE, `text-embedding-3-*`), used for retrieval.

For retrieval, the operational facts are: dimensionality is typically 384–4096; cosine similarity is the standard metric; **and if you L2-normalize your vectors, cosine similarity and dot product become identical**, which lets you use faster inner-product indexes. Storage math is simple and worth doing before you pick a vector database: 10 million documents × 1024 dims × 4 bytes (fp32) = **41 GB** of raw vectors. Store them as fp16 and it is 20 GB; use binary quantization and it is 1.3 GB with a re-ranking pass to recover accuracy.

> Embeddings from different models are not comparable. Re-embedding your whole corpus is the unavoidable cost of changing embedding models — budget for it as a migration, not a config change.

## The transformer forward pass, costed

### Shape of the computation

For a decoder-only transformer with `L` layers, model dimension `d`, and sequence length `s`, each layer does:

1. **Attention projections** — Q, K, V, and the output projection. Four matmuls of roughly `[s, d] × [d, d]`.
2. **Attention itself** — `softmax(QKᵀ/√d_head)·V`. Cost is `O(s² · d)` per layer, and memory for the naive attention matrix is `O(s²)` per head.
3. **Feed-forward network** — two or three matmuls with an intermediate dimension typically 3.5–4× `d` (for SwiGLU: gate, up, down).

The widely used approximation for a forward pass is **2 FLOPs per parameter per token** (one multiply, one add). Training's backward pass roughly doubles that again, giving the familiar `6 · P · tokens` estimate for training FLOPs.

### When does attention actually dominate?

Engineers over-index on the `O(s²)` term. Let us cost it for Llama-3-8B (`L=32`, `d=4096`, `P=8×10⁹`) on a 2,000-token prompt.

Dense matmul FLOPs (all the projections and FFNs):

```
2 · P · s = 2 × 8e9 × 2000 = 3.2e13 FLOPs  = 32 TFLOPs
```

Attention FLOPs (`QKᵀ` plus `A·V`, each `2·s²·d` per layer):

```
4 · s² · d · L = 4 × (2000²) × 4096 × 32 ≈ 2.1e12 FLOPs = 2.1 TFLOPs
```

Attention is about **6.5% of prefill compute at 2K context**. But it scales quadratically while the dense term scales linearly, so at 32K context the ratio flips: attention becomes roughly 50% of prefill, and beyond that it dominates completely. This is exactly why FlashAttention (which is a tiling/IO-reduction technique, not an approximation — it never materializes the `s×s` matrix in HBM) matters far more for long-context workloads than for chat-length ones.

### FlashAttention in one paragraph

Naive attention writes the `s×s` score matrix to HBM, reads it back for softmax, writes it again, reads it again for the `·V` product. FlashAttention tiles the computation so that blocks of Q, K, V are loaded into SRAM once, and softmax is computed with an online (streaming) normalization trick that never requires the full row in memory. The FLOP count is unchanged; the HBM traffic drops from `O(s²)` to `O(s²·d / M)` where `M` is SRAM size. It is a pure win and you should assume it is on by default in any serious serving stack.

## The LLM request lifecycle

A single request has two phases with completely different hardware behaviour. Understanding this split is the core insight of LLM serving.

### Phase 1: Prefill

The entire prompt is processed in one forward pass. All `s` prompt tokens go through the model simultaneously, so the matmuls are large and dense. This phase is **compute-bound**: it saturates tensor cores and achieves high FLOP utilization.

Prefill determines **TTFT (time to first token)**. Using the 32 TFLOPs figure above on an H100 SXM (989 TFLOPS dense BF16 peak, realistically ~40–50% achieved):

```
32e12 / (0.45 × 989e12) ≈ 72 ms
```

That is your TTFT floor for a 2K prompt on one H100, before queueing, tokenization, or network.

### Phase 2: Decode

Tokens are generated one at a time, autoregressively. Each step processes exactly **one** new token per sequence. The matmuls degenerate into matrix–vector products, which have terrible arithmetic intensity. This phase is **memory-bandwidth-bound**: the GPU must stream every weight from HBM to produce a single token.

The upper bound on single-stream decode speed is simply:

```
tokens/sec ≤ memory_bandwidth / model_size_in_bytes
```

For Llama-3-8B in bf16 (16 GB) on an H100 SXM (3.35 TB/s):

```
3.35e12 / 16e9 ≈ 209 tokens/sec  (theoretical ceiling, batch=1)
```

Real-world single-stream throughput lands well below this — typically 100–150 tok/s — because of KV-cache reads, kernel launch overhead, and imperfect bandwidth utilization. The relevant per-token metric is **TPOT (time per output token)**, sometimes called inter-token latency; 10 ms TPOT is 100 tok/s, comfortably faster than human reading speed (~5–8 tok/s).

### The roofline that explains everything

At batch size 1, decode performs about 2 FLOPs for every weight *byte* read — an arithmetic intensity of ~1 FLOP/byte. The H100's ridge point is:

```
989e12 FLOPS / 3.35e12 bytes/s ≈ 295 FLOPs/byte
```

You are running at roughly **1/295th** of the machine's arithmetic capability. Batching is the fix: at batch size `B`, you read the weights once and do `B` times the arithmetic, so intensity scales linearly with `B`. You need batch sizes in the low hundreds before an LLM decode step becomes compute-bound. This is the entire economic argument for continuous batching, and the reason a single-user local LLM leaves a datacenter GPU almost completely idle.

## GPU memory math

### The budget

Total memory on the card must hold:

```
weights + KV cache + activations + runtime overhead (CUDA context, graphs, fragmentation)
```

Runtime overhead is 1–3 GB and is not negligible on a 24 GB card. Activations during decode are small (a few hundred MB); during prefill with large chunk sizes they can be several GB.

### Weights

Parameters × bytes-per-parameter. For a dense model this is exact:

| Model | Params | BF16 | FP8/INT8 | INT4 (≈4.2 bits eff.) |
|---|---|---|---|---|
| Llama-3-8B | 8.03B | 16.1 GB | 8.0 GB | ~4.2 GB |
| Llama-3-70B | 70.6B | 141 GB | 70.6 GB | ~37 GB |
| Mistral-7B | 7.24B | 14.5 GB | 7.2 GB | ~3.8 GB |

Note what this means for placement: a 70B in bf16 does not fit on one 80 GB H100. It needs tensor parallelism across 2 GPUs at minimum, and in practice 4 so there is KV-cache room left over. Quantized to INT4, the same 70B fits on a single 80 GB card with ~40 GB free for cache.

### KV cache — the formula that actually matters

Every generated token must remember the key and value vectors of every previous token, at every layer. The size, per token, is:

```
kv_bytes_per_token = 2 · L · n_kv_heads · head_dim · dtype_bytes
```

The leading `2` is for K and V. Note it uses **`n_kv_heads`, not `n_heads`** — this is where grouped-query attention (GQA) pays off enormously.

```python
def kv_cache_bytes(n_layers, n_kv_heads, head_dim, dtype_bytes, seq_len, batch):
    per_token = 2 * n_layers * n_kv_heads * head_dim * dtype_bytes
    return per_token * seq_len * batch

# Llama-3-8B: 32 layers, 8 KV heads (32 query heads), head_dim 128, bf16
per_tok = 2 * 32 * 8 * 128 * 2          # = 131072 bytes = 128 KiB
print(per_tok / 1024, "KiB/token")

# One full 8K-context sequence:
print(kv_cache_bytes(32, 8, 128, 2, 8192, 1) / 2**30, "GiB")   # -> 1.0 GiB

# 64 concurrent users at 8K context:
print(kv_cache_bytes(32, 8, 128, 2, 8192, 64) / 2**30, "GiB")  # -> 64.0 GiB
```

Read that last line again. Sixty-four concurrent 8K-context users on an 8B model need **64 GB of KV cache** — four times the size of the model itself. On an 80 GB H100 holding 16 GB of weights, you have ~61 GB of cache headroom, so you top out near 60 concurrent full-context sequences. **KV cache, not parameter count, is what sets your concurrency.**

Now the GQA comparison. If Llama-3-8B used full multi-head attention (32 KV heads instead of 8):

```
2 × 32 × 32 × 128 × 2 = 524,288 bytes = 512 KiB/token
```

A 4× increase — you would fit 15 concurrent users instead of 60. GQA is the highest-leverage architectural change for serving economics in the last several years. Multi-head latent attention (MLA), used by the DeepSeek family, pushes this further by compressing K/V into a low-rank latent vector.

For Llama-3-70B (80 layers, 8 KV heads, head_dim 128, bf16): `2 × 80 × 8 × 128 × 2 = 320 KiB/token`, or 2.5 GiB for a single 8K sequence.

### PagedAttention: why fragmentation was eating half your memory

Pre-2023 servers pre-allocated a contiguous KV buffer per request sized to `max_model_len`. A request that generated 200 tokens against a 8,192-token limit wasted 97.5% of its allocation. Measured internal fragmentation in early systems ran 60–80%.

PagedAttention (the idea vLLM is built on) borrows virtual memory: the KV cache is split into fixed-size **blocks** (commonly 16 tokens), a per-sequence block table maps logical positions to physical blocks, and blocks are allocated on demand. Fragmentation drops to under one block per sequence. It also makes **prefix caching** nearly free — two requests sharing a system prompt can share the same physical blocks copy-on-write, so a 2,000-token system prompt is prefilled once and reused across every request that starts with it.

## Quantization

Quantization reduces bytes per parameter. Because decode is bandwidth-bound, halving the weight bytes roughly *doubles* decode throughput — the speedup is close to linear in the compression ratio, which is not true of most optimizations.

### The formats

| Format | Bits | Calibration | Where it runs | Notes |
|---|---|---|---|---|
| **BF16/FP16** | 16 | none | everywhere | Baseline. BF16 has FP32's exponent range, fewer mantissa bits — preferred for stability. |
| **FP8 (E4M3)** | 8 | minimal | Hopper/Ada + | Native tensor-core support on H100/L40S. Near-lossless; the current default for serious serving. |
| **INT8 (SmoothQuant / LLM.int8())** | 8 | activation stats | broad | SmoothQuant migrates activation outliers into weights so both can be INT8. |
| **GPTQ** | 3–4 | second-order (Hessian), one-shot | broad | Layer-wise error compensation. Fast on GPU; needs a calibration set. |
| **AWQ** | 4 | activation-aware scaling | broad | Protects the ~1% of "salient" channels. Often better than GPTQ at 4-bit; very fast kernels. |
| **GGUF (Q4_K_M etc.)** | 2–8 | k-quant blocks | CPU + GPU offload | The llama.cpp format. Mixed precision per tensor type. Ideal for local/CPU-hybrid, not for datacenter throughput. |
| **bitsandbytes NF4** | 4 | none (data-free) | GPU | Zero-setup, used by QLoRA for fine-tuning. Slower inference than AWQ/GPTQ. |

### Effective bit width is not the nominal bit width

4-bit quantization stores a scale (and often a zero-point) per *group* of weights. With group size 128 and an FP16 scale plus a 4-bit zero-point:

```
4 + (16 / 128) + (4 / 128) ≈ 4.16 bits per weight
```

So "4-bit Llama-3-8B" is ~4.2 GB, not 4.0 GB. Smaller group sizes (32) improve accuracy and cost ~4.6 bits. This is also why a Llama-3-8B `Q4_K_M` GGUF file is about 4.9 GB — k-quants keep some tensors (attention output, some FFN) at higher precision.

### What quantization does *not* shrink

**Quantizing weights does not shrink the KV cache.** They are separate budgets. If concurrency is your bottleneck, you want FP8 or INT8 *KV cache* quantization (`--kv-cache-dtype fp8` in vLLM), which halves the per-token cost — dropping Llama-3-8B from 128 KiB/token to 64 KiB/token and doubling your concurrent-user ceiling. KV-cache quantization is usually more forgiving than weight quantization, because errors do not compound across layers the same way.

> Always evaluate a quantized model on your own task before shipping. Perplexity barely moves at 4-bit; instruction-following, JSON-schema adherence, and multi-step reasoning degrade noticeably and perplexity will not warn you.

## Throughput techniques you should be able to explain

- **Continuous batching (iteration-level scheduling).** Instead of running a fixed batch to completion, the scheduler re-forms the batch every decode step: finished sequences leave, queued ones join immediately. Reported throughput gains over static batching are large (an order of magnitude in the original Orca results) because no slot idles waiting for the longest sequence.

- **Chunked prefill.** A long prefill monopolizes the GPU and stalls every in-flight decode, spiking everyone's TPOT. Chunked prefill splits the prompt into pieces and interleaves them with decode steps, trading slightly worse TTFT for dramatically smoother inter-token latency.

- **Prefix caching.** Cache the KV blocks of shared prefixes. With a 1,500-token system prompt and a 50-token user turn, you skip ~97% of prefill work on a cache hit.

- **Speculative decoding.** A small draft model proposes `k` tokens; the large model verifies all `k` in one forward pass and accepts the longest correct prefix. Because verification is one batched pass over the *same* weights, you get 1.5–3× on latency when the acceptance rate is high — with **mathematically identical output distribution** to sampling from the target model. Self-speculative variants (Medusa, EAGLE, n-gram lookup) avoid needing a separate draft model.

- **Tensor parallelism vs. pipeline parallelism.** TP splits each matmul across GPUs and requires an all-reduce per layer — use it *within* a node over NVLink. PP splits layers across GPUs, communicates only at boundaries, but introduces bubbles — use it *across* nodes over slower interconnect.

## Sampling and the decoding loop

The model's output is a logit vector over the vocabulary. What happens next is pure CPU-side policy and it shapes perceived quality more than most people expect:

- **Temperature** `T` divides logits before softmax. `T→0` is greedy; `T>1` flattens the distribution.
- **Top-k** keeps the k highest-probability tokens. Blunt: k=50 is far too many in a confident position, far too few in an uncertain one.
- **Top-p (nucleus)** keeps the smallest set whose cumulative probability exceeds `p`. Adapts to the distribution's shape — the usual default at `p=0.9`–`0.95`.
- **Min-p** keeps tokens with probability ≥ `p × max_prob`. Often better-behaved than top-p at high temperature.
- **Repetition / frequency / presence penalties** subtract from logits of already-seen tokens. Overuse causes the model to avoid necessary words (like the subject of the sentence).

For structured output, **constrained decoding** (grammar- or JSON-schema-guided) masks invalid tokens to `-inf` at each step, guaranteeing parseable output. It is not free — the mask must be computed per step from an FSM over the grammar — but it eliminates an entire class of retry logic.

Note that greedy decoding is *not* fully deterministic on GPU in practice: floating-point reduction order varies with batch composition, so the same prompt in a different batch can occasionally tie-break differently. Do not build tests that assume bit-identical generations across load conditions.

## A capacity-planning worked example

You are asked: *how many H100 80GB GPUs to serve Llama-3-8B to 500 concurrent users averaging 4,000 tokens of context?*

1. **Weights**: 16.1 GB bf16. Quantize to FP8 → 8.0 GB, and decode throughput roughly doubles.
2. **KV per token**: 128 KiB bf16; with FP8 KV cache, 64 KiB.
3. **KV per user**: 4,000 × 64 KiB = 250 MiB.
4. **Per-GPU cache headroom**: 80 GB − 8 GB weights − 3 GB overhead ≈ 69 GB, and vLLM's `--gpu-memory-utilization 0.90` will only claim ~72 GB total, so call it ~61 GB usable cache.
5. **Users per GPU**: 61 GiB / 250 MiB ≈ **250 concurrent sequences**.
6. **Answer**: 2 GPUs for memory. Then check latency — 250 concurrent sequences per GPU is well past the ridge point, so you are compute-bound and TPOT will rise. If your SLO is 20 ms TPOT you likely need 3–4 GPUs and should cap `--max-num-seqs` around 128 per replica.

Memory capacity gives you the floor. Latency SLO gives you the real number. Always compute both.

## Where to go next

- **[Stanford CS336: Language Modeling from Scratch](https://cs336.stanford.edu/)** — the definitive systems-oriented LLM course. Assignments have you build the tokenizer, the transformer, the training loop, and the inference path yourself. Lectures and code are public.
- **[Andrej Karpathy — Neural Networks: Zero to Hero](https://karpathy.ai/zero-to-hero.html)** — do "Let's build GPT from scratch" and "Let's build the GPT Tokenizer" before anything else here if the forward pass still feels abstract.
- **[Transformer Inference Arithmetic](https://kipp.ly/transformer-inference-arithmetic/)** — the single best derivation of the latency and memory equations in this document. Read it once you can already state the KV-cache formula from memory; it will sharpen every estimate you make afterwards.

Once the arithmetic is second nature, the next step is running it in production: continuous batching, autoscaling, and GPU scheduling on Kubernetes.
