"""Produce the optional shared static-reflection target proof; no native QName mapping.

The SDK describeType proof is independent (native_describe_type_profile.py).
Callers attach returned file as profile-lock files.reflectionProvider and merge
returned generatorInputs into their cache identity. Existing profiles are untouched.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CAPABILITY = "api.flash.utils"
TARGETS = (
    ("src/layaAir/flash/utils/FlashReflectionMetadata.ts", "createFlashReflectionMetadata",
     "(bindings: readonly FlashReflectionClassBinding[]) => FlashReflectionMetadata"),
    ("src/layaAir/flash/utils/describeTypeXml.ts", "describeTypeXml",
     "(value: unknown, metadata: FlashReflectionMetadata) => FlashReflectionXml"),
)


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def sha(path):
    path = Path(path)
    if path.is_symlink() or path.resolve() != path or not path.is_file():
        raise ValueError("Reflection evidence requires canonical ordinary files")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_reflection_provider_inputs(laya_root):
    """Read-only pre-cache inspection; checks real signatures and source closure."""
    return _inspect(laya_root)[1]


def _tool_inputs():
    # Resolve exactly as the Node resolver does, from this compiler installation.
    # Pin implementation bytes, not merely the version declared in a lockfile.
    script = "const fs=require('node:fs');const root=process.argv[1];process.stdout.write(JSON.stringify(['typescript-4-9','typescript-4-9/package.json'].map(name=>fs.realpathSync(require.resolve(name,{paths:[root]})))));"
    result = subprocess.run(["node", "-e", script, str(ROOT)], cwd=ROOT,
                            capture_output=True, text=True, timeout=30, check=False)
    if result.returncode:
        raise ValueError("Reflection resolver dependency resolution failed: " + result.stderr)
    paths = json.loads(result.stdout)
    if not isinstance(paths, list) or len(paths) != 2 or not all(isinstance(path, str) for path in paths):
        raise ValueError("Reflection resolver dependency paths are invalid")
    files = [Path(path) for path in paths]
    lock = ROOT / "package-lock.json"
    if lock.exists():
        files.append(lock)
    return {str(path): sha(path) for path in files}


def _inspect(laya_root):
    laya = Path(laya_root).resolve(strict=True)
    target = laya / "docTool/architecture/authored-content-capabilities.json"
    resolver = ROOT / "tools/resolve-laya-export.cjs"
    inputs = {**_tool_inputs(), **{str(p): sha(p) for p in (target, resolver, Path(__file__).resolve())}}
    document = json.loads(target.read_text(encoding="utf-8"))
    capabilities = [row for row in document["capabilities"] if row.get("id") == CAPABILITY]
    if len(capabilities) != 1 or capabilities[0].get("status") != "typescript-obligation":
        raise ValueError("Reflection provider requires one admitted shared capability")
    source_inputs, targets = {}, []
    for module, exported, signature in TARGETS:
        rows = [row for row in capabilities[0]["obligations"]
                if row.get("module") == module and row.get("export") == exported]
        if len(rows) != 1 or rows[0].get("kind") != "function" or rows[0].get("signature") != signature:
            raise ValueError("Reflection provider requires exact unique function signatures")
        row = rows[0]
        request = {"root": str(laya), "facade": {"module": module, "export": exported, "sha256": row["sha256"]}, "candidates": [row]}
        result = subprocess.run(["node", str(resolver)], input=json.dumps(request), capture_output=True,
                                text=True, timeout=90, check=False)
        if result.returncode:
            raise ValueError("Reflection provider target resolution failed: " + result.stderr)
        resolved = json.loads(result.stdout)
        if resolved.get("index") != 0 or not isinstance(resolved.get("inputs"), dict):
            raise ValueError("Reflection provider resolver returned invalid authority")
        for name, digest in resolved["inputs"].items():
            path = Path(name)
            if not path.is_absolute() or path.resolve() != path or not path.is_relative_to(laya):
                raise ValueError("Reflection provider source escapes canonical target root")
            if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest) or sha(path) != digest:
                raise ValueError("Reflection provider source hash changed")
            if name in inputs and inputs[name] != digest:
                raise ValueError("Reflection provider closure changed between exports")
            inputs[name] = digest
            source_inputs[path.relative_to(laya).as_posix()] = digest
        if module not in source_inputs:
            raise ValueError("Reflection provider resolver omitted defining source")
        targets.append({"module": module, "export": exported, "signature": signature, "sha256": row["sha256"]})
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Reflection provider inputs changed during inspection")
    proof = {"schema": "as3-reflection-provider-target@1", "targetCapabilitiesSha256": inputs[str(target)],
             "targetCapabilityId": CAPABILITY, "targets": targets, "targetSources": source_inputs}
    return proof, inputs


def produce_reflection_provider_profile(*, profile_root, laya_root):
    """Write a new proof after successful inspection; never mutate an existing lock."""
    root = Path(profile_root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Reflection profile root must be an existing directory")
    proof, inputs = _inspect(laya_root)
    destination = root / "reflection-provider.json"
    data = canonical(proof)
    # Exclusive publication rejects accidental replacement of another producer's proof.
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Reflection provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}
