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


def _inspect(laya_root, targets=TARGETS, schema="as3-reflection-provider-target@1", capability=CAPABILITY):
    laya = Path(laya_root).resolve(strict=True)
    target = laya / "docTool/architecture/authored-content-capabilities.json"
    resolver = ROOT / "tools/resolve-laya-export.cjs"
    inputs = {**_tool_inputs(), **{str(p): sha(p) for p in (target, resolver, Path(__file__).resolve())}}
    document = json.loads(target.read_text(encoding="utf-8"))
    capabilities = [row for row in document["capabilities"] if row.get("id") == capability]
    if len(capabilities) != 1 or capabilities[0].get("status") != "typescript-obligation":
        raise ValueError("Reflection provider requires one admitted shared capability")
    source_inputs, target_rows = {}, []
    for target_spec in targets:
        module, exported, signature = target_spec[:3]
        constructors = target_spec[3] if len(target_spec) == 4 else None
        rows = [row for row in capabilities[0]["obligations"]
                if row.get("module") == module and row.get("export") == exported]
        if (len(rows) != 1 or rows[0].get("kind") != ("class" if constructors else "function")
                or rows[0].get("signature") != signature
                or constructors and rows[0].get("constructors") != constructors):
            raise ValueError("Reflection provider requires exact unique function signatures")
        row = rows[0]
        request = {"root": str(laya), "facade": {"module": module, "export": exported, "sha256": row["sha256"]}, "candidates": [row], "validateConstructors": bool(constructors)}
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
        target_rows.append({"module": module, "export": exported, "signature": signature, "sha256": row["sha256"]})
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Reflection provider inputs changed during inspection")
    proof = {"schema": schema, "targetCapabilitiesSha256": inputs[str(target)],
             "targetCapabilityId": capability, "targets": target_rows, "targetSources": source_inputs}
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


STRING_PATTERN_TARGETS = (
    ("src/layaAir/flash/utils/AS3StringIntrinsics.ts", "compileSourceStringPattern",
     "(source: string, flags?: string) => SourceStringPattern"),
    ("src/layaAir/flash/utils/AS3StringIntrinsics.ts", "sourceStringReplace",
     "(value: string, pattern: SourceStringPattern, replacement: unknown) => string"),
)


def inspect_string_pattern_provider_inputs(laya_root, regexp=False, members=False):
    return _inspect_string_patterns(laya_root, regexp, members)[1]


def _inspect_string_patterns(laya_root, regexp=False, members=False):
    proof, inputs = _inspect(laya_root, REGEXP_MEMBER_TARGETS if members else REGEXP_TARGETS if regexp else STRING_PATTERN_TARGETS,
                             "as3-string-pattern-provider-target@3" if members else "as3-string-pattern-provider-target@2" if regexp else "as3-string-pattern-provider-target@1")
    worker = ROOT / "tools/qualify-laya-string-pattern.cjs"
    inputs[str(worker)] = sha(worker)
    return proof, inputs


def produce_string_pattern_provider_profile(*, profile_root, laya_root, regexp=False, members=False):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect_string_patterns(laya_root, regexp, members)
    destination = root / "string-pattern-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("String pattern provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

REGEXP_TARGETS = STRING_PATTERN_TARGETS + (
    ("src/layaAir/flash/utils/AS3RegExp.ts", "sourceRegExpReplaceWithInvoker",
     "(value: string, expression: AS3RegExp | null, replacement: unknown, invoke: (target: Function, args: unknown[]) => unknown) => string"),
    ("src/layaAir/flash/utils/AS3RegExp.ts", "AS3RegExp", "typeof AS3RegExp",
     ["new (input?: unknown, options?: unknown): AS3RegExp"]),
    ("src/layaAir/flash/utils/AS3RegExp.ts", "isAS3RegExp", "(value: unknown) => value is AS3RegExp"),
    ("src/layaAir/flash/utils/AS3RegExp.ts", "sourceRegExpReplace",
     "(value: string, expression: AS3RegExp | null, replacement: unknown) => string"),
)

DATE_TARGETS = (
    ("src/layaAir/flash/utils/AS3Date.ts", "AS3Date", "typeof AS3Date",
     ["new (...components: (number | string)[]): AS3Date"]),
    ("src/layaAir/flash/utils/AS3Date.ts", "isFlashDate", "(candidate: unknown) => candidate is AS3Date"),
    ("src/layaAir/flash/utils/AS3Date.ts", "as3DateReceiver", "(candidate: unknown) => AS3Date"),
)

def inspect_date_provider_inputs(laya_root):
    return _inspect(laya_root, DATE_TARGETS, "as3-date-provider-target@1")[1]

def produce_date_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, DATE_TARGETS, "as3-date-provider-target@1")
    destination = root / "date-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Date provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

STRING_RANGE_TARGETS = tuple(("src/layaAir/flash/utils/AS3StringIntrinsics.ts", "sourceString" + name,
    "(value: unknown, args: unknown[], coerce?: (value: unknown) => number) => string")
    for name in ("CharAt", "Slice", "Substring")) + ((
        "src/layaAir/flash/utils/AS3StringIntrinsics.ts", "sourceStringCharCodeAt",
        "(value: unknown, args: unknown[], coerce?: (value: unknown) => number) => number"), (
        "src/layaAir/flash/utils/AS3StringIntrinsics.ts", "sourceStringFromCharCodes",
        "(codes: unknown) => string"),)

def inspect_string_range_provider_inputs(laya_root):
    return _inspect(laya_root, STRING_RANGE_TARGETS, "as3-string-range-provider-target@1")[1]

def produce_string_range_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, STRING_RANGE_TARGETS, "as3-string-range-provider-target@1")
    destination = root / "string-range-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("String range provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

REGEXP_MEMBER_TARGETS = REGEXP_TARGETS + (("src/layaAir/flash/utils/AS3RegExp.ts", "as3RegExpReceiver", "(value: unknown) => AS3RegExp"),)

ARRAY_SORT_TARGETS = (("src/layaAir/flash/utils/AS3ArraySort.ts", "sourceArraySortCallback",
    "(value: unknown, callback: unknown, invoke: (target: unknown, args: unknown[]) => unknown, coerce: (value: unknown) => number) => unknown[]"),
    ("src/layaAir/flash/utils/AS3ArraySort.ts", "as3ArraySortOn",
    "<T>(values: T[], fieldName: unknown, options?: unknown, ..._ignored: unknown[]) => T[] | number[] | 0"))

def inspect_array_sort_provider_inputs(laya_root):
    return _inspect(laya_root, ARRAY_SORT_TARGETS, "as3-array-sort-provider-target@1")[1]

def produce_array_sort_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, ARRAY_SORT_TARGETS, "as3-array-sort-provider-target@1")
    destination = root / "array-sort-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Array sort provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

ARRAY_SOME_TARGETS = (("src/layaAir/flash/utils/AS3ArraySome.ts", "sourceArraySome",
    "(value: unknown[], callback: Function | null, receiver: unknown, read: (value: unknown, index: number) => unknown) => boolean"),)

def inspect_array_some_provider_inputs(laya_root):
    return _inspect(laya_root, ARRAY_SOME_TARGETS, "as3-array-some-provider-target@1")[1]

def produce_array_some_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, ARRAY_SOME_TARGETS, "as3-array-some-provider-target@1")
    destination = root / "array-some-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Array some provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

REGEXP_MEMBER_TARGETS = REGEXP_TARGETS + (("src/layaAir/flash/utils/AS3RegExp.ts", "as3RegExpReceiver", "(value: unknown) => AS3RegExp"),)

BYTEARRAY_AMF3_TARGETS = (("src/layaAir/flash/utils/AMF3Reader.ts", "readSourceAMF3",
    "(bytes: Uint8Array, position: number, createByteArray: (bytes: Uint8Array) => unknown, commitPosition: (position: number) => void) => unknown"),
    ("src/layaAir/flash/utils/AMF3Writer.ts", "writeSourceAMF3",
    "(value: unknown, readByteArray: (value: unknown) => Uint8Array | null) => Uint8Array"))

def inspect_bytearray_amf3_provider_inputs(laya_root):
    return _inspect(laya_root, BYTEARRAY_AMF3_TARGETS, "as3-bytearray-amf3-target@1")[1]

def produce_bytearray_amf3_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, BYTEARRAY_AMF3_TARGETS, "as3-bytearray-amf3-target@1")
    destination = root / "bytearray-amf3-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("ByteArray AMF3 provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

REGEXP_MEMBER_TARGETS = REGEXP_TARGETS + (("src/layaAir/flash/utils/AS3RegExp.ts", "as3RegExpReceiver", "(value: unknown) => AS3RegExp"),)

MATH_FLOOR_TARGETS = (("src/layaAir/flash/utils/AS3Math.ts", "sourceMathFloor",
    "(value: number) => number"),
    ("src/layaAir/flash/utils/AS3Math.ts", "sourceMathRandom", "() => number"))

def inspect_math_floor_provider_inputs(laya_root):
    return _inspect(laya_root, MATH_FLOOR_TARGETS, "as3-math-floor-provider-target@1")[1]

def produce_math_floor_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, MATH_FLOOR_TARGETS, "as3-math-floor-provider-target@1")
    destination = root / "math-floor-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Math floor provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

OBJECT_HAS_OWN_TARGETS = (("src/layaAir/flash/utils/AS3Property.ts", "as3HasOwnProperty",
    "(target: unknown, key: unknown) => boolean"),)

OBJECT_CONSTRUCTOR_TARGETS = (("src/layaAir/flash/utils/AS3DynamicObject.ts", "as3CreateDynamicObject",
    "() => Record<string, any>"),)

def inspect_object_constructor_provider_inputs(laya_root):
    return _inspect(laya_root, OBJECT_CONSTRUCTOR_TARGETS, "as3-object-constructor-provider-target@1")[1]

def produce_object_constructor_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, OBJECT_CONSTRUCTOR_TARGETS, "as3-object-constructor-provider-target@1")
    destination = root / "object-constructor-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Object constructor provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

def inspect_object_has_own_provider_inputs(laya_root):
    return _inspect(laya_root, OBJECT_HAS_OWN_TARGETS, "as3-object-has-own-provider-target@1")[1]

def produce_object_has_own_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _inspect(laya_root, OBJECT_HAS_OWN_TARGETS, "as3-object-has-own-provider-target@1")
    destination = root / "object-has-own-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Object hasOwnProperty provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

REGEXP_MEMBER_TARGETS = REGEXP_TARGETS + (("src/layaAir/flash/utils/AS3RegExp.ts", "as3RegExpReceiver", "(value: unknown) => AS3RegExp"),)

TYPE_ERROR_TARGETS = (("src/layaAir/flash/utils/AS3TypeError.ts", "sourceTypeError",
    "(message?: string) => Error"),)
TYPE_ERROR_SDK = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
TYPE_ERROR_DECLARATION = "9be7f8c1e931148b71f5b6fd0e48e7407d6b49b7472211e8b583799b1dc3ff41"

def _type_error_provider(laya_root):
    target, inputs = _inspect(laya_root, TYPE_ERROR_TARGETS, "as3-type-error-provider-target@1")
    declaration = ROOT / "tools/retained-sdk/TypeError.as.txt"
    if sha(declaration) != TYPE_ERROR_DECLARATION:
        raise ValueError("TypeError SDK declaration requires requalification")
    inputs[str(declaration)] = sha(declaration)
    proof = {"schema": "as3-type-error-provider@1", "sourceArtifactSha256": TYPE_ERROR_SDK,
             "declaration": declaration.read_bytes().decode("utf-8"), "target": target}
    return proof, inputs

def inspect_type_error_provider_inputs(laya_root):
    return _type_error_provider(laya_root)[1]

def produce_type_error_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _type_error_provider(laya_root)
    destination = root / "type-error-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("TypeError provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

ERROR_STACK_TARGETS = (("src/layaAir/flash/utils/AS3ErrorStack.ts", "sourceErrorStack",
    "(value: Error, firstLine: string) => string"),)
ERROR_TYPE_TARGETS = (
    ("src/layaAir/flash/errors/AS3SourceError.ts", "AS3Error", "typeof AS3Error",
     ["new (message?: unknown, id?: unknown): AS3Error"]),
    ("src/layaAir/flash/errors/AS3SourceError.ts", "isAS3ErrorRuntimeType",
     "(value: unknown) => boolean"),
)
ERROR_STACK_SDK = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"

def _error_stack_provider(laya_root):
    stack_target, stack_inputs = _inspect(laya_root, ERROR_STACK_TARGETS,
                                          "as3-error-stack-provider-target@1")
    type_target, type_inputs = _inspect(laya_root, ERROR_TYPE_TARGETS,
                                        "as3-error-runtime-type-target@1", "api.flash.errors")
    inputs = dict(stack_inputs)
    for name, digest in type_inputs.items():
        if name in inputs and inputs[name] != digest:
            raise ValueError("Error provider inputs disagree")
        inputs[name] = digest
    proof = {"schema": "as3-error-stack-provider@1", "sourceArtifactSha256": ERROR_STACK_SDK,
             "stackTarget": stack_target, "typeTarget": type_target}
    return proof, inputs

def inspect_error_stack_provider_inputs(laya_root):
    return _error_stack_provider(laya_root)[1]

def produce_error_stack_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _error_stack_provider(laya_root)
    destination = root / "error-stack-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("Error stack provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}

JSON_DEFINITION_TARGETS = (("src/layaAir/flash/utils/AS3JSONDefinition.ts", "isSourceJSONDefinition", "(value: unknown) => boolean"),
    ("src/layaAir/flash/utils/AS3JSONDefinition.ts", "callSourceJSONDefinition",
     "(value: unknown, name: string, args: unknown[], coerceString: (value: unknown) => string | null) => unknown"))
JSON_DEFINITION_SDK = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
JSON_DEFINITION_DECLARATION = "4ab05ed7fd98f7471d0d2e3ca24e906e1c6e221187a771a39a2003c7b6f73b52"

def _json_definition_provider(laya_root):
    target, inputs = _inspect(laya_root, JSON_DEFINITION_TARGETS, "as3-json-definition-provider-target@1")
    declaration = ROOT / "tools/retained-sdk/JSON.as.txt"
    if sha(declaration) != JSON_DEFINITION_DECLARATION:
        raise ValueError("JSON SDK declaration requires requalification")
    inputs[str(declaration)] = sha(declaration)
    proof = {"schema": "as3-json-definition-provider@1", "sourceArtifactSha256": JSON_DEFINITION_SDK,
             "declaration": declaration.read_bytes().decode("utf-8"), "target": target}
    return proof, inputs

def inspect_json_definition_provider_inputs(laya_root):
    return _json_definition_provider(laya_root)[1]

def produce_json_definition_provider_profile(*, profile_root, laya_root):
    root = Path(profile_root).resolve(strict=True)
    proof, inputs = _json_definition_provider(laya_root)
    destination = root / "json-definition-provider.json"
    data = canonical(proof)
    with destination.open("xb") as stream:
        stream.write(data)
    if any(sha(Path(name)) != digest for name, digest in inputs.items()):
        raise ValueError("JSON provider inputs changed during publication")
    return {"file": {"path": destination.name, "sha256": hashlib.sha256(data).hexdigest()},
            "manifestPins": {}, "generatorInputs": inputs}
