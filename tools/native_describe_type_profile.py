"""Retain exact SDK describeType source; shared provider proof is separately required."""
import hashlib
import json
from pathlib import Path

SDK_SHA = "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
SOURCE_SHA = "9166be1cec8a61485506033aa85d40f838b74ba8487cde153fe25e98295a0b16"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def produce_native_describe_type_profile(*, profile_root, air_sdk, sdk_declaration, sdk_signatures):
    root = Path(profile_root).resolve()
    swc = Path(air_sdk).resolve() / "frameworks/libs/air/airglobal.swc"
    declaration, signatures = Path(sdk_declaration), Path(sdk_signatures)
    for path in (swc, declaration, signatures):
        if path.is_symlink() or path.resolve() != path or not path.is_file():
            raise ValueError("describeType evidence requires canonical ordinary files")
    if sha(swc) != SDK_SHA or sha(declaration) != SOURCE_SHA:
        raise ValueError("describeType SDK/source pair requires native requalification")
    if declaration.read_text().splitlines().count("   public function describeType(value:*) : XML") != 1:
        raise ValueError("describeType source signature changed")
    inputs = json.loads(signatures.read_text())["inputs"]
    matches = [key for key in inputs if key.endswith("/sdk-source/scripts/flash/utils/describeType.as")]
    if len(matches) != 1 or inputs[matches[0]] != SOURCE_SHA:
        raise ValueError("describeType source is not bound to SDK extraction")
    before = {str(path): sha(path) for path in (swc, declaration, signatures)}
    destination = root / "native-describe-type"
    destination.mkdir()
    copied_source, copied_signatures = destination / "describeType.as", destination / "sdk-signatures.json"
    copied_source.write_bytes(declaration.read_bytes())
    copied_signatures.write_bytes(signatures.read_bytes())
    proof = {"schema": "as3-native-describe-type-authority@1", "sourceArtifactSha256": SDK_SHA,
             "declarationPath": copied_source.relative_to(root).as_posix(), "declarationSha256": sha(copied_source),
             "signaturesPath": copied_signatures.relative_to(root).as_posix(), "signaturesSha256": sha(copied_signatures)}
    proof_file = root / "native-describe-type-proof.json"
    proof_file.write_bytes(canonical(proof))
    if before != {str(path): sha(path) for path in (swc, declaration, signatures)}:
        raise ValueError("describeType evidence changed during generation")
    return {"file": {"path": proof_file.relative_to(root).as_posix(), "sha256": sha(proof_file)},
            "manifestPins": {"nativeSdkSha256": SDK_SHA, "nativeSignaturesSha256": sha(signatures),
                             "nativeDescribeTypeDeclarationSha256": SOURCE_SHA},
            "generatorInputs": {**before, str(Path(__file__).resolve()): sha(Path(__file__).resolve())}}
