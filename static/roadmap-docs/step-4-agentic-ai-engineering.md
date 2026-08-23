# Agentic AI engineering

*How to build LLM systems that plan, call tools, and recover from their own mistakes — the agent loop, orchestration frameworks, the Model Context Protocol, guardrails, cost control, and the observability without which none of it is debuggable.*

## What an agent actually is

Strip away the marketing and an agent is a loop:

```
observation ──▶ [ LLM decides ] ──▶ action ──▶ environment ──▶ observation ──▶ …
                       ▲                                            │
                       └────────────── accumulated context ─────────┘
```

Three properties distinguish an agent from a chatbot with functions bolted on:

1. **The model chooses the control flow.** In a workflow, you wrote the `if`. In an agent, the model decides whether to search again, call a different tool, or stop.
2. **The loop is closed by the environment, not by the model's imagination.** Tool results are ground truth injected back into context. An agent that never observes real results is just a planner.
3. **It has a termination condition.** Either the model emits a final answer, or a budget (steps, tokens, wall-clock, dollars) forces a halt. An agent without a hard budget is an outage waiting for a scheduler.

### Do not build an agent first

Anthropic's *Building Effective Agents* makes the point that matters most and is ignored most often: the majority of production LLM value comes from **workflows** — fixed, predictable code paths with LLM calls inside them — not from autonomous agents. Their taxonomy is the right vocabulary:

| Pattern | Control flow | Use when |
|---|---|---|
| **Prompt chaining** | Fixed sequence, optional gates between steps | The task decomposes cleanly and statically |
| **Routing** | Classify, then dispatch to a specialized path | Distinct input categories need distinct prompts |
| **Parallelization** | Fan out, then aggregate (sectioning or voting) | Independent subtasks, or you need multiple attempts |
| **Orchestrator–workers** | A model decomposes at runtime, workers execute | Subtasks are not knowable in advance |
| **Evaluator–optimizer** | Generate → critique → revise loop | Clear evaluation criteria + iterative gains |
| **Autonomous agent** | Model-driven loop with tools and a budget | Open-ended, step count unpredictable |

Agents cost more, latency-wise and dollar-wise, and they fail in ways that are harder to reproduce. Start at the top of that table and move down only when a fixed path demonstrably cannot do the job. The engineering discipline is to keep asking: *which of these steps genuinely needs the model to decide?*

### Context engineering is the real work

Most "the agent is dumb" bugs are context bugs, not model bugs. In a long loop, context degrades in predictable ways:

- **Unbounded growth.** Every tool result appends. At 30 steps a naive agent is re-reading 100k tokens of stale scratch. Fix: summarize completed sub-tasks into a compact state object; keep raw results only for the last N steps; write large artifacts to files or a store and pass references.
- **Poisoning.** One hallucinated fact enters the transcript and is treated as established for the rest of the run. Fix: prefer structured state over free-form transcript for anything the agent must rely on; re-derive from tools rather than from memory when correctness matters.
- **Distraction.** Twenty tools in the schema means twenty chances to pick the wrong one. Fix: expose the smallest sufficient toolset; use routing or dynamic tool filtering so a given step sees only the relevant subset.
- **Missing recovery affordances.** An agent that gets an error string with no guidance loops forever. Fix: make tool errors *actionable* — return `{"error": "invalid_date_format", "hint": "use YYYY-MM-DD", "example": "2026-08-23"}`, not a stack trace.

> A tool description is a prompt. Spend as much care on it as on your system prompt: name the tool for what the model should think it does, document every parameter's format with an example, and state explicitly when *not* to use it. Most tool-selection errors are documentation errors.

## Choosing an orchestrator

### Graph-based (LangGraph)

Model the agent as an explicit state machine: a typed state object, nodes that transform it, and edges — some fixed, some conditional — that route between them. You get durable execution (checkpoints per step), time-travel debugging, deterministic replay, and human-in-the-loop pauses essentially for free, because the framework already has to serialize state between nodes.

Reach for a graph when: the workflow has cycles you want to bound explicitly, you need to pause for approval mid-run and resume hours later, runs are long enough that crash recovery matters, or you need to reason about "what state was the agent in when it did that?"

```python
from typing import Annotated, Literal, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.prebuilt import ToolNode

class State(TypedDict):
    messages: Annotated[list, add_messages]   # reducer: append, don't overwrite
    steps: int
    budget_usd: float

def call_model(state: State) -> dict:
    if state["steps"] >= 12 or state["budget_usd"] <= 0:
        return {"messages": [{"role": "assistant",
                              "content": "Budget exhausted; stopping with partial results."}]}
    resp = llm_with_tools.invoke(state["messages"])
    return {"messages": [resp], "steps": state["steps"] + 1,
            "budget_usd": state["budget_usd"] - cost_of(resp)}

def route(state: State) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END

builder = StateGraph(State)
builder.add_node("agent", call_model)
builder.add_node("tools", ToolNode(TOOLS))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", route, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")          # the loop

with SqliteSaver.from_conn_string("checkpoints.db") as saver:
    graph = builder.compile(checkpointer=saver)
    out = graph.invoke(
        {"messages": [{"role": "user", "content": "Reconcile invoice 8821"}],
         "steps": 0, "budget_usd": 0.50},
        config={"configurable": {"thread_id": "inv-8821"}},
    )
```

Note what the state buys you: `steps` and `budget_usd` are *in the checkpoint*, so a resumed run cannot restart its budget. Putting budgets in a local variable is a classic way to make a retry loop cost ten times what you planned.

Human-in-the-loop is the same mechanism — a node calls `interrupt(...)`, the graph persists and returns; later you resume with a `Command(resume=...)` carrying the human's decision, and execution continues from exactly that point:

```python
from langgraph.types import interrupt, Command

def approve_payment(state: State) -> dict:
    decision = interrupt({"action": "wire_transfer",
                          "amount": state["amount"],
                          "payee": state["payee"]})
    if decision != "approve":
        return {"messages": [{"role": "tool", "content": "Payment rejected by reviewer."}]}
    return {"messages": [{"role": "tool", "content": execute_transfer(state)}]}

# later, possibly in a different process, hours later:
graph.invoke(Command(resume="approve"), config={"configurable": {"thread_id": "inv-8821"}})
```

### Role-based multi-agent (CrewAI, AutoGen)

Instead of a graph, you declare *personas* — a researcher, a writer, a critic — plus tasks and a process (sequential, hierarchical) or a conversation topology, and let delegation emerge. This is much faster to express for tasks that genuinely decompose along role lines, and CrewAI's Flows layer adds explicit routing and durable state when the pure-crew abstraction gets too loose.

The trade-off is control. Emergent multi-agent conversation is expensive (every agent re-reads shared context), non-deterministic, and hard to bound. Multi-agent is genuinely warranted when subtasks are **parallelizable and context-isolated** — several independent research threads each burning their own context window, results merged at the end. It is usually *not* warranted for sequential work that one agent with good tools could do, where it mostly multiplies token spend and failure modes.

### Raw agent SDKs (OpenAI Agents SDK, Anthropic's agent tooling)

A thin layer over the provider's own loop: agents with instructions and tools, handoffs for delegation, guardrails for I/O validation, sessions for memory, and built-in tracing. Minimal abstraction, minimal ceremony, fewest concepts to learn — and correspondingly less machinery when you need durable execution or complex branching.

### Comparison

| | LangGraph | CrewAI | AutoGen | OpenAI Agents SDK |
|---|---|---|---|---|
| **Control-flow model** | Explicit graph: nodes + conditional edges | Roles + tasks + process (sequential/hierarchical); Flows for explicit routing | Conversational message passing between agents | Built-in agent loop + handoffs |
| **State management** | Typed state object with reducers; checkpointed per step | Crew/task context; Flow state with persistence | Conversation history per agent | Sessions (SQLite/Redis/etc.) |
| **Multi-agent** | Subgraphs / supervisor patterns you wire yourself | First-class, the core abstraction | First-class group chat | Handoffs between agents |
| **Durability / resume** | Strong — checkpointers, time travel, replay | Flow-level persistence | Weaker; app-managed | Session-scoped |
| **Human-in-the-loop** | `interrupt()` + `Command(resume=)` at any node | Human-in-the-loop triggers on tasks | Human proxy agent in the chat | Guardrail/approval hooks |
| **Observability** | LangSmith native; OTel exporters | Built-in event listeners + OTel integrations | Runtime logging + OTel | Built-in tracing, exportable |
| **Learning curve** | Steepest | Gentle | Moderate | Gentlest |
| **Best for** | Long-running, auditable, approval-gated workflows | Content/research pipelines that decompose by role | Research on agent collaboration; dynamic group problem solving | Straightforward tool-using assistants |

The honest advice: prototype with the simplest thing (a raw SDK, or a plain `while` loop of your own — an agent loop is about forty lines), and migrate to a graph only when you feel the need for durability, branching, or approvals. Frameworks are a tax you should pay knowingly.

## The Model Context Protocol

### The problem it solves

Before MCP, connecting M AI applications to N tool integrations was an M×N problem: every app wrote its own Slack connector, its own Postgres connector, its own file reader, each with a bespoke schema and auth flow. MCP is the same trick LSP played for editors and language servers — define one protocol, and the problem becomes M+N. Write a server once; every MCP-speaking host can use it.

The architecture has three roles:

- **Host** — the LLM application (an IDE, a chat client, your agent runtime). It owns the model and the user relationship.
- **Client** — a connector inside the host, one per server, maintaining a session.
- **Server** — a process exposing capabilities. It knows nothing about the model.

Messages are JSON-RPC 2.0. Transports are **stdio** (server runs as a local subprocess — the default for local tools) and **Streamable HTTP** (server runs remotely — the one you deploy). Capabilities are negotiated at initialization, so a client and server of different versions can still interoperate over their common subset.

### The three server primitives

The distinction is about *who is in control*, and it is worth internalizing:

- **Tools** — *model-controlled*. Functions the model may decide to invoke. `read_file`, `create_ticket`, `run_query`.
- **Resources** — *application-controlled*. Addressable context the host chooses to include, identified by URI. `file:///repo/README.md`, `db://orders/schema`. The model does not call these; the app attaches them.
- **Prompts** — *user-controlled*. Templated workflows a user explicitly invokes, typically surfaced as slash commands.

Clients can also expose **elicitation**, letting a server ask the user for additional input mid-operation.

### A minimal server and client

```python
# server.py — a complete MCP server: one tool, one templated resource
from mcp.server import MCPServer

mcp = MCPServer("Invoices")

@mcp.tool()
def lookup_invoice(invoice_id: str) -> dict:
    """Fetch an invoice by its ID.

    Args:
        invoice_id: The invoice identifier, e.g. "INV-8821".
    Returns a dict with amount_cents, currency, payee and status.
    Use this before any reconciliation; do not guess invoice contents.
    """
    return db.fetch_invoice(invoice_id)

@mcp.resource("policy://reconciliation")
def reconciliation_policy() -> str:
    """The current reconciliation policy document."""
    return open("policies/reconciliation.md").read()
```

You wrote no JSON Schema — the type hints *are* the schema — and no protocol handling. Run and inspect it locally:

```bash
uv run mcp dev server.py                         # opens the MCP Inspector
uv run mcp run server.py --transport streamable-http   # deployable HTTP transport
```

The client side is symmetric:

```python
import asyncio
from mcp import Client

async def main() -> None:
    async with Client("http://localhost:8000/mcp") as client:
        tools = await client.list_tools()          # feed these schemas to your model
        result = await client.call_tool("lookup_invoice", {"invoice_id": "INV-8821"})
        print(result.structured_content)

asyncio.run(main())
```

### MCP security, which is not optional

The specification is blunt about this, and the failure modes are real:

- **Tool descriptions are untrusted input.** A server you did not write can put instructions in a tool description that your model will read as if they came from you — *tool poisoning*. Only connect servers you trust, pin their versions, and treat description text as data.
- **The confused deputy / lethal trifecta.** An agent with (a) access to private data, (b) exposure to untrusted content, and (c) the ability to communicate externally can be induced to exfiltrate. Break at least one leg: don't give a data-reading agent an unrestricted network tool.
- **Explicit consent before invocation.** Hosts must obtain user consent before invoking tools and before exposing user data to a server. Build the approval UI; do not auto-approve write operations.
- **Auth belongs at the transport.** For remote servers use OAuth 2.1 with proper audience binding, not a static bearer token pasted into a config file.

> Running an MCP server "locally, so it's fine" is not a security argument. A local stdio server has your filesystem and your network. Sandbox it the way you would sandbox any code you did not write.

## Tool-use guardrails

Guardrails are layered. Each layer assumes the previous one failed.

### 1. Input validation

Validate the model's arguments against a strict schema *before* they reach your code — not the loose schema you advertised, but the tightest one your business logic permits. Pydantic models, enums instead of free strings, bounded numerics, and explicit rejection of anything unexpected.

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal

class RefundArgs(BaseModel):
    order_id: str = Field(pattern=r"^ORD-\d{8}$")
    amount_cents: int = Field(gt=0, le=50_000)          # hard cap, model cannot exceed
    reason: Literal["damaged", "not_received", "duplicate", "other"]

    @field_validator("order_id")
    @classmethod
    def must_belong_to_session(cls, v: str) -> str:
        if v not in SESSION.visible_orders:
            raise ValueError("order not in this session's scope")
        return v
```

The last validator is the important one: **authorization must be evaluated against the human's identity, never the model's assertion.** If the model says "refund order ORD-00000001," your code checks whether *this user* may refund *that order*. Agents are prompt-injectable; your authorization layer is not.

### 2. Allowlisting and capability scoping

Deny by default. An agent gets an explicit allowlist of tools, and each tool gets an explicit scope: which tables, which paths, which hosts, which HTTP methods. Read and write should be separate tools with separate approval requirements, so that "summarize this repo" cannot become "push to main." Scope the *credential*, not just the code path — give the agent's service account exactly the IAM permissions its allowlist implies, so a bug in your tool layer is contained by the cloud's authorization.

### 3. Human-in-the-loop approval gates

Classify every tool by blast radius and gate accordingly:

| Class | Examples | Gate |
|---|---|---|
| **Read, idempotent** | search, fetch document, list files | Auto-approve |
| **Write, reversible** | create draft, add label, open PR | Auto-approve with audit log |
| **Write, irreversible or costly** | send email, delete rows, transfer money, deploy | Explicit human approval |
| **Privilege-changing** | grant access, rotate credentials, modify allowlist | Human approval + second reviewer |

Two design details make approval gates survive contact with users. First, show the **resolved** action, not the model's intent — "wire $4,182.00 to ACME Ltd, account ending 4471" beats "call `wire_transfer`." Second, make the gate *resumable*, not blocking: persist state, return, and let the human respond minutes or hours later. That is exactly what LangGraph's `interrupt` provides and why durable execution and HITL are the same feature.

### 4. Output validation and sandboxing

Tool *outputs* are untrusted too — a fetched web page is attacker-controlled text entering your model's context. Sanitize or clearly delimit it, strip anything that looks like instructions, and cap length. For code execution, use a real sandbox: a container with no network, a read-only root filesystem, a non-root user, dropped capabilities, seccomp, memory and CPU limits, and a wall-clock timeout. A `subprocess.run` with a timeout is not a sandbox.

Validate the agent's *final* output too, against the same schema discipline: structured outputs where possible, a rules-based check for PII and secrets, and — for high-stakes surfaces — an LLM-as-judge pass that can veto.

## Cost-aware orchestration

An agent multiplies token spend in a way single-turn chat does not: with a naive loop, step N re-sends the entire accumulated transcript, so cost grows roughly quadratically in the number of steps. Four levers, in the order they pay off.

### Budgets, enforced in state

Every run gets a hard ceiling in tokens, steps, wall-clock, and dollars, checked before each model call and stored in the checkpointed state so retries and resumes cannot reset it. Degrade gracefully at the limit — return partial results with an explicit "budget exhausted" marker rather than throwing.

### Prompt caching

The largest single win for agent loops, because the loop's prefix (system prompt, tool schemas, early turns) is identical across steps. Cached input tokens are dramatically cheaper than uncached ones. The engineering requirement is a **stable prefix**: put the system prompt and tool definitions first and never mutate them mid-run, keep dynamic content (timestamps, retrieved chunks, per-step scratch) at the *end*, and append rather than rewrite history. A single injected "current time" string at the top of the prompt invalidates the cache on every turn — this is one of the most common and most expensive mistakes in agent code.

### Model routing and cascading

Not every step needs the frontier model. **Routing** classifies the request up front and dispatches to a tier; **cascading** tries the cheap model first and escalates only when a verifier says the answer is inadequate. Cascading typically saves more because most steps are easy, but it adds latency on escalation.

```python
TIERS = ["small", "mid", "frontier"]   # cheapest -> most capable

def cascade(task, budget, min_confidence=0.75):
    """Try cheap models first; escalate only when the answer fails verification."""
    spent = 0.0
    for tier in TIERS:
        est = estimate_cost(tier, task)
        if spent + est > budget:
            break
        answer, usage = call_model(tier, task)
        spent += price(tier, usage)

        score = verify(answer, task)       # rules, schema check, or a small judge model
        if score >= min_confidence:
            return {"answer": answer, "tier": tier, "cost_usd": spent}

    return {"answer": answer, "tier": tier, "cost_usd": spent, "degraded": True}


def route(task):
    """Cheaper alternative: classify once, dispatch once."""
    if task.kind in {"extract", "classify", "reformat"}:
        return call_model("small", task)
    if task.requires_multi_step_reasoning or task.tool_count > 6:
        return call_model("frontier", task)
    return call_model("mid", task)
```

Route the *sub-steps*, not just the request: summarization, extraction, and routing itself are almost always small-model jobs even inside an otherwise frontier-model agent.

### Context compaction and semantic caching

Compact aggressively — summarize completed sub-tasks into a few hundred tokens of structured state and drop the raw transcript; store large tool outputs externally and pass a handle plus a short digest; trim tool schemas to the subset relevant to the current phase. Separately, a **semantic cache** (embed the request, return a stored answer above a similarity threshold) is highly effective for repetitive read-only queries and useless for stateful actions — never semantically cache anything that mutates.

Track cost per *task completed*, not per token. An agent that costs 3× more per run but succeeds without human intervention is usually far cheaper than the alternative.

## Agent trace observability

You cannot debug an agent from logs. You need traces, because the question is never "what did this call return" but "why, on step 9, did it choose that tool given what it had seen."

### The span model

Adopt OpenTelemetry's tracing vocabulary and the GenAI semantic conventions rather than inventing your own, so your agent traces sit in the same backend as the rest of your system. The natural hierarchy:

```
trace: user request  (trace_id, user_id, session_id)
├── span: agent.run                       [12 steps, $0.41, 48s]
│   ├── span: gen_ai.chat  (step 1)       [model, prompt/completion tokens, cached tokens, finish_reason]
│   ├── span: execute_tool web_search     [args, result size, latency, error?]
│   ├── span: gen_ai.chat  (step 2)
│   ├── span: execute_tool run_query      [args, rows returned, latency]
│   ├── span: guardrail.approval          [gate=irreversible, decision, reviewer, wait_time]
│   └── span: gen_ai.chat  (final)
└── span: postprocess.validate            [schema ok, pii scan clean]
```

Attributes worth setting on every model span: the provider and model ID, the operation name, input/output/cached token counts, computed cost, latency, temperature and other sampling params, the finish reason, and a prompt-version identifier. On tool spans: tool name, serialized arguments, result size, success/failure, and error class. On the run span: total cost, step count, termination reason (`final_answer` / `budget` / `max_steps` / `error`), and whether a human intervened.

### What to log, and what not to

Log enough to reproduce: the exact rendered prompt (or a hash plus the prompt template version and variables), the tool schemas as presented, the full tool arguments and results, and the model's raw response including tool calls. Correlate with `session_id` and `user_id` so you can reconstruct a whole conversation.

Do not log raw secrets, credentials, or unredacted PII. Run a redaction pass at the SDK boundary, sample verbosely rather than logging every field of every production run at full fidelity, and set a retention policy — trace payloads containing user content are personal data.

### Tooling

- **LangSmith** — deepest integration with LangChain/LangGraph; excellent step-through of graph state, plus datasets and evaluators.
- **Langfuse** — open-source and self-hostable, framework-agnostic, with tracing, sessions, prompt management with versioned deployment labels, evaluations (LLM-as-judge, code evaluators, human annotation), and cost dashboards. The best default when you want to own your data.
- **OpenTelemetry GenAI semantic conventions** — the vendor-neutral schema for GenAI spans, metrics, and events, including MCP and provider-specific conventions. Instrument to this and you can switch backends without re-instrumenting.
- **Built-in tracing** in the agent SDKs (OpenAI Agents SDK tracing, MLflow Tracing, W&B Weave) — fine to start with, and most can export to OTel.

### From traces to evaluation

Traces are the raw material for the only loop that actually improves an agent:

1. **Build a dataset from production.** Every failed or human-corrected run becomes a test case. This is why you log inputs verbatim.
2. **Define graded checks.** Final-answer correctness is necessary but insufficient. Also assert on *trajectory*: was the right tool called, were arguments well-formed, did it terminate in a reasonable number of steps, did it stay within budget, did it avoid the forbidden tool?
3. **Run the suite in CI.** Fail the build on regression. Track pass rate, mean cost, mean steps, and p95 latency as a package — a change that improves accuracy by 2% while doubling cost is a decision, not an obvious win.
4. **Version prompts like code.** Prompt changes are the highest-frequency, highest-blast-radius change in an agent system. They belong in git, they belong in the trace attributes, and they belong behind the same evaluation gate as code.

> Alert on the *shape* of runs, not just errors. A sudden rise in mean step count, a spike in `max_steps` terminations, or a jump in cost per completed task all indicate degradation long before your error rate moves — usually because a tool started returning subtly worse results.

## A build order that works

1. Write the plain loop yourself — model call, parse tool calls, execute, append, repeat — with a hard step cap. Forty lines. Now you understand what every framework abstracts.
2. Add real tools with strict Pydantic schemas and actionable error messages. Measure how often the model picks correctly; fix the *descriptions* first.
3. Add tracing before you add a framework. You cannot improve what you cannot see.
4. Add budgets and an approval gate for anything irreversible.
5. Only now pick an orchestrator, chosen by which of durability, branching, or role decomposition you actually need.
6. Build an eval set from your traces and put it in CI. Everything after this point is iteration against that number.

## Where to go next

- **[Building Effective Agents (Anthropic Engineering)](https://www.anthropic.com/engineering/building-effective-agents)** — read this before you write a line of agent code. The workflow-versus-agent taxonomy will save you from over-engineering the first three systems you build.
- **[Model Context Protocol — official documentation](https://modelcontextprotocol.io/)** — work through building a server *and* a client, then read the specification's security section twice. Tool integration is where agentic systems get compromised.
- **[Langfuse documentation](https://langfuse.com/docs)** — self-host it, instrument your loop, and build your first evaluation dataset from real traces. The gap between "an agent demo" and "an agent system" is exactly this feedback loop.
