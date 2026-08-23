#!/usr/bin/env python3
"""Seed the 'ai-mlops-roadmap' Learning Roadmap into the real DevDB.

Usage:
  python scripts/seed_roadmap.py

Idempotent: if 'ai-mlops-roadmap' already exists in the 'roadmaps' store, the
script leaves it untouched (prints a message) rather than overwriting it —
seeding is a one-time bootstrap, not a re-sync, so a user's in-progress
checklist/notes/links on the seeded roadmap are never clobbered by a re-run.

See specs/018-learning-roadmap/spec.md FR-018 for the step content this
mirrors, and data-model.md for the record shape.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import deps  # noqa: E402

ROADMAP_ID = "ai-mlops-roadmap"

STEPS = [
    (
        "ML/LLM systems fundamentals",
        "Model training vs. inference, tokens, embeddings, quantization, GPU "
        "memory math, LLM request lifecycle.",
    ),
    (
        "Model serving & inference infra on Kubernetes",
        "vLLM/TGI, KServe/Seldon, GPU scheduling, KEDA autoscaling, "
        "Grafana/Mimir/Loki metrics.",
    ),
    (
        "ML pipeline & MLOps tooling",
        "MLflow/W&B, Feast, model registry patterns, CI/CD for ML, "
        "Terraform/Ansible for ML infra provisioning.",
    ),
    (
        "Agentic AI engineering",
        "LangGraph/CrewAI/AutoGen/Agents SDK/MCP, tool-use guardrails, "
        "cost-aware orchestration, agent trace observability.",
    ),
    (
        "Certifications",
        "AWS ML Specialty or AI Practitioner, NVIDIA NCP-AIO or a "
        "Kubernetes-for-ML cert.",
    ),
    (
        "Portfolio & positioning",
        "Package NIM agent, ai-precommit-guardian, and JFrog-on-ROSA "
        "migration as public write-ups with architecture diagrams.",
    ),
]


def build_roadmap() -> dict:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    steps = [
        {
            "id": f"step-{i}",
            "order": i,
            "title": title,
            "description": description,
            "notes": "",
            "checklist": [],
            "course_links": [],
            "documents": [],
        }
        for i, (title, description) in enumerate(STEPS, start=1)
    ]
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

    if ROADMAP_ID in store:
        print(f"'{ROADMAP_ID}' already exists — leaving it untouched.")
        return

    store[ROADMAP_ID] = build_roadmap()
    deps._db.set_store("roadmaps", store)
    deps._db.save()
    print(f"Seeded '{ROADMAP_ID}' with {len(STEPS)} steps.")


if __name__ == "__main__":
    main()
