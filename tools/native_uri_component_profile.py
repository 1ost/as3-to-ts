"""Retain exact SDK and AIR/browser evidence for one-String encodeURIComponent."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SDK_SHA = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
SOURCE_SHA = "7825ee4f0a278edbbdec0f78065a886c4692c36c0ef189ae1ab7bde32db7fe47"
REVISION = "1563e72a6f3849554c3ccb3eacd615fd3083f435"
RUNTIME_SHA = "2264c65a2c22fa66d4d14b97b299fe88ba0342f924cc948bf20df159c5cee8bf"
EVIDENCE = {
    "EncodeURIComponentProbe.as": "d02d738d978520fd8b4a6288393042c8d2e775d6a46ca830ba489abbd1fd6e6e",
    "README.md": "fcbd516f77cd15d8800c2754f2bef2e765b47bf6a020f01363ce28adb5494967",
    "browser-air.json": "427ae9b7408c6da2026090df4e3321af78719d49ea77e2e2d8046d8853f85adf",
    "browser-pin.json": "42c5d4efebeb0eba8e4f98c9efd8b8529435033b35432b56188d14c0f61879b2",
    "native-air.json": "6e6fb03ff5373b9d57f2b4ce9f2b877619b48c12b93c789191780baa0fa470b2",
    "run-browser.mjs": "b8def9ff4b3446822336d98b34e494ea6bce2acad2e05b4a53db15ef8d9b7def",
    "scenario.json": "7e8cb57dba7c5fc74d7f818cd3072da68e2298c071b76ff1116be647de5bbd79",
}
DECODE_SOURCE_SHA = "fb3c28c303631a83e412a2f00f2e33563a116b76e6551316cb42593edb55cb90"
DECODE_ERROR_DECLARATION_SHA = "8e0caed79bcb9712343ad85d3932cdae9c80334219715fb1828eafa8ad94187e"
DECODE_RUNTIME_SHA = "2f5a8b644405350d04a72c768270d0fd7a29323b5642e2ff5b1e0b5e5b052f02"
# Requalified after the additive TextSnapshot and display-coordinate error
# factories. The URIError factory and typed-catch predicate are unchanged,
# and the retained AIR decoder comparison passes against this source revision.
DECODE_ERROR_SHA = "46394f6863d753f0ceb7d9eccb5564c2bc43a9ba04a3f96816e7d6f02e0d5776"
DECODE_EVIDENCE = {
    "DecodeURIComponentProbe.as": "3cd30573a0805ebccd8163866ce92ac1a13ff0ae1f6c7e245fd1ceb386c2979d",
    "scenario.json": "dcd1432cfba7a7ec47c762bf52e35bdd7e33a01acee31c152f817309d224d8ec",
    "native-capture.json": "7eeeeefc716f6538b971813d37c51633fe278dc12f479ae55707386f1af3f21c",
    "native-receipt.json": "07221590ed5d3ba5b2dea0529a5447fad0c849196e6bb7be488c03801a47f47c",
    "oracle.swf": "3ada944c97ebfd40246a1048bd72bdd642b41aea31a3e7793e46843d6ef5ffa7",
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def _ordinary(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file() or path.resolve() != path:
        raise ValueError("URI component evidence requires canonical ordinary files")
    return path


def inspect_native_uri_component_inputs(air_sdk, laya):
    sdk = Path(air_sdk).resolve()
    repository = Path(laya).resolve()
    swc = _ordinary(sdk / "frameworks/libs/air/airglobal.swc")
    retained = subprocess.run(["git", "-C", str(repository), "merge-base", "--is-ancestor", REVISION, "HEAD"],
                              env={"PATH": "/usr/bin:/bin", "GIT_NO_REPLACE_OBJECTS": "1"},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if retained.returncode != 0 or sha(swc) != SDK_SHA:
        raise ValueError("URI component SDK/evidence revision requires requalification")
    evidence_root = repository / "tests/nativeFlashOracle/encode-uri-component"
    inputs = {str(swc): sha(swc), str(Path(__file__).resolve()): sha(Path(__file__).resolve()),
              str(ROOT / "src/hardened-runtime/AS3URI.ts"): sha(ROOT / "src/hardened-runtime/AS3URI.ts")}
    if inputs[str(ROOT / "src/hardened-runtime/AS3URI.ts")] != RUNTIME_SHA:
        raise ValueError("URI component runtime helper requires requalification")
    for name, digest in EVIDENCE.items():
        path = _ordinary(evidence_root / name)
        if sha(path) != digest:
            raise ValueError("URI component retained evidence bytes changed")
        inputs[str(path)] = digest
    for relative, digest in (("src/layaAir/flash/utils/AS3URI.ts", DECODE_RUNTIME_SHA),
                             ("src/layaAir/flash/errors/AS3SourceError.ts", DECODE_ERROR_SHA)):
        path = _ordinary(repository / relative)
        if sha(path) != digest:
            raise ValueError("URI decoder shared Laya bridge requires requalification")
        inputs[str(path)] = digest
    for name, digest in DECODE_EVIDENCE.items():
        path = _ordinary(repository / "tests/nativeFlashOracle/decode-uri-component" / name)
        if sha(path) != digest:
            raise ValueError("URI decoder AIR evidence requires requalification")
        inputs[str(path)] = digest
    return inputs


def produce_native_uri_component_profile(*, profile_root, air_sdk, laya, sdk_declaration, sdk_signatures):
    inspected = inspect_native_uri_component_inputs(air_sdk, laya)
    root = Path(profile_root).resolve()
    declaration, signatures = _ordinary(Path(sdk_declaration).resolve()), _ordinary(Path(sdk_signatures).resolve())
    if sha(declaration) != SOURCE_SHA:
        raise ValueError("URI component SDK declaration requires requalification")
    if declaration.read_text().splitlines().count('   public native function encodeURIComponent(param1:String = "undefined") : String;') != 1:
        raise ValueError("URI component source signature changed")
    inputs = json.loads(signatures.read_text()).get("inputs", {})
    matches = [key for key in inputs if key.endswith("/sdk-source/scripts/encodeURIComponent.as")]
    if len(matches) != 1 or inputs[matches[0]] != SOURCE_SHA:
        raise ValueError("URI component source is not bound to SDK extraction")
    decode_declaration = _ordinary(declaration.with_name("decodeURIComponent.as"))
    error_declaration = _ordinary(declaration.with_name("URIError.as"))
    if sha(decode_declaration) != DECODE_SOURCE_SHA or decode_declaration.read_text().splitlines().count(
            '   public native function decodeURIComponent(param1:String = "undefined") : String;') != 1:
        raise ValueError("URI decoder SDK declaration requires requalification")
    decode_matches = [key for key in inputs if key.endswith("/sdk-source/scripts/decodeURIComponent.as")]
    if len(decode_matches) != 1 or inputs[decode_matches[0]] != DECODE_SOURCE_SHA:
        raise ValueError("URI decoder source is not bound to SDK extraction")
    if sha(error_declaration) != DECODE_ERROR_DECLARATION_SHA or "public dynamic class URIError extends Error" not in error_declaration.read_text():
        raise ValueError("URIError SDK declaration requires requalification")
    error_matches = [key for key in inputs if key.endswith("/sdk-source/scripts/URIError.as")]
    if len(error_matches) != 1 or inputs[error_matches[0]] != DECODE_ERROR_DECLARATION_SHA:
        raise ValueError("URIError source is not bound to SDK extraction")
    evidence_root = Path(laya).resolve() / "tests/nativeFlashOracle/encode-uri-component"
    destination = root / "native-uri-component"
    destination.mkdir()
    copied_declaration = destination / "encodeURIComponent.as"
    copied_signatures = destination / "sdk-signatures.json"
    copied_declaration.write_bytes(declaration.read_bytes())
    copied_decode_declaration = destination / "decodeURIComponent.as"
    copied_decode_declaration.write_bytes(decode_declaration.read_bytes())
    copied_error_declaration = destination / "URIError.as"
    copied_error_declaration.write_bytes(error_declaration.read_bytes())
    copied_signatures.write_bytes(signatures.read_bytes())
    evidence = []
    for name, digest in sorted(EVIDENCE.items()):
        copied = destination / name
        copied.write_bytes((evidence_root / name).read_bytes())
        if sha(copied) != digest:
            raise ValueError("URI component evidence changed while copied")
        evidence.append({"name": name, "path": copied.relative_to(root).as_posix(), "sha256": digest})
    decode_evidence = []
    for name, digest in sorted(DECODE_EVIDENCE.items()):
        copied = destination / ("decode-" + name)
        copied.write_bytes((Path(laya).resolve() / "tests/nativeFlashOracle/decode-uri-component" / name).read_bytes())
        if sha(copied) != digest:
            raise ValueError("URI decoder evidence changed while copied")
        decode_evidence.append({"name": name, "path": copied.relative_to(root).as_posix(), "sha256": digest})
    proof = {"schema": "as3-native-uri-component-authority@1", "sourceArtifactSha256": SDK_SHA,
             "declarationPath": copied_declaration.relative_to(root).as_posix(), "declarationSha256": SOURCE_SHA,
             "signaturesPath": copied_signatures.relative_to(root).as_posix(), "signaturesSha256": sha(copied_signatures),
             "evidenceRevision": REVISION, "evidence": evidence,
             "decode": {"declarationPath": copied_decode_declaration.relative_to(root).as_posix(),
                        "declarationSha256": DECODE_SOURCE_SHA, "evidence": decode_evidence,
                        "errorDeclarationPath": copied_error_declaration.relative_to(root).as_posix(),
                        "errorDeclarationSha256": DECODE_ERROR_DECLARATION_SHA,
                        "runtimeSourceSha256": DECODE_RUNTIME_SHA, "errorSourceSha256": DECODE_ERROR_SHA},
             "runtime": {"module": "@laya/as3-runtime/AS3URI", "export": "as3EncodeURIComponent",
                         "sourcePath": "src/hardened-runtime/AS3URI.ts", "sourceSha256": RUNTIME_SHA}}
    proof_file = root / "native-uri-component-proof.json"
    proof_file.write_bytes(canonical(proof))
    if inspected != inspect_native_uri_component_inputs(air_sdk, laya):
        raise ValueError("URI component authority inputs changed during generation")
    return {"file": {"path": proof_file.relative_to(root).as_posix(), "sha256": sha(proof_file)},
            "manifestPins": {"nativeSdkSha256": SDK_SHA, "nativeSignaturesSha256": sha(signatures),
                             "nativeUriComponentDeclarationSha256": SOURCE_SHA,
                             "nativeUriComponentEvidenceRevision": REVISION,
                             "nativeUriComponentRuntimeSourceSha256": RUNTIME_SHA},
            "generatorInputs": inspected}
