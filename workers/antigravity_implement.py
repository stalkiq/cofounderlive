#!/usr/bin/env python3
"""Theo's Antigravity coding worker.

Uses the Google Antigravity SDK (Vertex) to implement a real app workspace.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from pathlib import Path


def load_payload(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def collect_client_source(workspace: Path) -> str:
    source = []
    for path in workspace.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".js", ".mjs", ".jsx", ".ts", ".tsx"}:
            continue
        if "node_modules" in path.parts or ".git" in path.parts:
            continue
        if any(part in {"server", "backend", "api", "lib", "scripts", "test", "tests"} for part in path.parts[:-1]):
            if path.suffix.lower() != ".html":
                continue
        try:
            source.append(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, OSError):
            continue
    return "\n".join(source)


def workspace_uses_memory_api(workspace: Path) -> bool:
    return bool(re.search(r"/api/(memory|entries|items|records)", collect_client_source(workspace), re.IGNORECASE))


def workspace_has_product_screens(workspace: Path) -> bool:
    source = collect_client_source(workspace)
    return bool(
        re.search(r"onboard", source, re.IGNORECASE)
        and re.search(r"(workflow|dashboard|main workflow|core workflow)", source, re.IGNORECASE)
        and re.search(r"(settings|history)", source, re.IGNORECASE)
    )


def workspace_has_smoke_proof(workspace: Path) -> bool:
    smoke = any(
        path.is_file() and re.search(r"(^|/)(scripts/)?smoke-test\.(mjs|js|cjs)$", str(path.relative_to(workspace)))
        for path in workspace.rglob("*")
    )
    readme = workspace / "README.md"
    if not smoke or not readme.exists():
        return False
    try:
        text = readme.read_text(encoding="utf-8")
    except OSError:
        return False
    return bool(re.search(r"How to try it|Screens|Durable memory", text, re.IGNORECASE))


async def run(payload: dict) -> dict:
    from google.antigravity import Agent, LocalAgentConfig

    workspace = Path(payload["workspace"]).resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    os.chdir(workspace)

    project = payload.get("project") or os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
    location = payload.get("location") or os.environ.get("VERTEX_LOCATION") or "global"
    model = payload.get("model") or os.environ.get("ANTIGRAVITY_MODEL") or "gemini-3.5-flash"
    instruction = payload["instruction"]
    mode = str(payload.get("mode") or "create").strip().lower()
    revise = mode == "revise"

    system = (
        "You are Theo's Antigravity coding worker inside Cofounder Live. "
        "The workspace already contains a working multi-screen app. "
        "Apply the founder's change request to that existing app. "
        "Do not rebuild from scratch and do not discard unrelated working screens. "
        "Preserve durable memory endpoints at POST/GET /api/memory unless the change requires edits. "
        "Keep onboarding, main workflow, and settings/history. "
        "Do not invent fake traction. Do not embed API keys or secrets."
        if revise
        else (
            "You are Theo's Antigravity coding worker inside Cofounder Live. "
            "Build a real, deployable, product-specific application in the current workspace. "
            "Prefer Node.js + Express, a multi-screen web UI, Dockerfile, founder-facing README, "
            "and scripts/smoke-test.mjs. "
            "Required screens: onboarding, main workflow, and settings/history. "
            "Implement durable memory endpoints at POST/GET /api/memory so forms persist data. "
            "The workflow UI must call fetch('/api/memory') to save and list entries. "
            "Do not invent fake traction. Do not embed API keys or secrets. "
            "Do not ship a single generic create/list storage page as the whole product. "
            "Keep the implementation focused and runnable."
        )
    )

    config = LocalAgentConfig(
        vertex=True,
        project=project,
        location=location,
        model=model,
        system_instructions=system,
    )

    async with Agent(config) as agent:
        response = await agent.chat(instruction)
        await response.text()
        repaired = False

        if not workspace_uses_memory_api(workspace) or not workspace_has_product_screens(workspace):
            repair = await agent.chat(
                "Review the application in the workspace. Preserve its product-specific design and copy. "
                "Ensure there are three distinct product areas: onboarding, main workflow, and settings/history. "
                "Wire the main workflow create/save action to POST /api/memory with JSON data, and load saved "
                "records with GET /api/memory into history (or an equivalent product history view). "
                "Do not replace the app with a generic single-page storage form. "
                "Make these fixes directly in the workspace."
            )
            await repair.text()
            repaired = True

        if not workspace_has_smoke_proof(workspace):
            proof = await agent.chat(
                "Add delivery proof files without changing the product screens unnecessarily: "
                "1) scripts/smoke-test.mjs that checks onboarding/workflow/history-or-settings markers "
                "and /api/memory wiring, exiting non-zero on failure. "
                "2) A founder-facing README.md with sections for What this app does, Screens, "
                "How to try it, Durable memory, and Proof it works (npm run smoke). "
                "Also ensure package.json has scripts.smoke and scripts.test."
            )
            await proof.text()
            repaired = True

    if revise:
        change = instruction.split("FOUNDER CHANGE REQUEST (required):")[-1].splitlines()[0].strip()[:160]
        summary = f"Applied your change in place{': ' + change if change else '.'}"
    else:
        summary = "Built the multi-screen app with durable memory, smoke proof, and delivery files."

    files = []
    for path in sorted(workspace.rglob("*")):
        if not path.is_file():
            continue
        rel = str(path.relative_to(workspace))
        if rel.startswith(".git/") or "/node_modules/" in f"/{rel}" or rel.startswith("node_modules/"):
            continue
        if rel in {"CHANGE_REQUEST.md", "product-spec.json"}:
            continue
        if path.stat().st_size > 400_000:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        files.append({"path": rel, "content": content})

    return {
        "ok": True,
        "engine": "antigravity-sdk",
        "model": model,
        "mode": "revise" if revise else "create",
        "summary": (summary or "").strip()[:400],
        "files": files,
        "fileCount": len(files),
        "storageContractRepaired": repaired,
        "usesMemoryApi": workspace_uses_memory_api(workspace),
        "productScreens": workspace_has_product_screens(workspace),
        "smokeProof": workspace_has_smoke_proof(workspace),
        "workspace": str(workspace),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "payload path required"}))
        return 2
    payload_path = Path(sys.argv[1])
    try:
        payload = load_payload(payload_path)
        result = asyncio.run(run(payload))
        print(json.dumps(result))
        return 0
    except Exception as error:  # noqa: BLE001 - surface to Node orchestrator
        print(json.dumps({
            "ok": False,
            "engine": "antigravity-sdk",
            "error": str(error)[:2000],
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
