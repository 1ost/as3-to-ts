"""Optional SDK-bound Date proof; no application source or capability mappings are changed."""
import argparse
import hashlib
import json
from pathlib import Path

CONSTRUCTOR = "public function Date(year:* = undefined, month:* = undefined, date:* = undefined, hours:* = undefined, minutes:* = undefined, seconds:* = undefined, ms:* = undefined)"
DECLARATIONS = [CONSTRUCTOR, "AS3 native function valueOf() : Number;", "AS3 native function getTime() : Number;",
                "public function get time() : Number", "public dynamic class Date"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def inspect_native_date_inputs(air_sdk):
    sdk = Path(air_sdk).resolve()
    swc = sdk / "frameworks/libs/air/airglobal.swc"
    if not swc.is_file() or swc.is_symlink():
        raise ValueError("Date proof requires an ordinary SDK SWC")
    return {str(swc): sha(swc), str(Path(__file__).resolve()): sha(Path(__file__).resolve())}


def produce_native_date_profile(*, profile_root, air_sdk, sdk_declaration, sdk_signatures):
    root, declaration, signatures = Path(profile_root).resolve(), Path(sdk_declaration), Path(sdk_signatures)
    inputs = inspect_native_date_inputs(air_sdk)
    for path in (declaration, signatures):
        if path.is_symlink() or path.resolve()!=path or not path.is_file():
            raise ValueError("Date SDK declarations/signatures require canonical ordinary files")
    if (sha(Path(air_sdk).resolve() / "frameworks/libs/air/airglobal.swc") != "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
            or sha(declaration) != "5831f64888b139d562e5b0bf3fad6df476aaaa7b8ebe943b634a5f48e02db12e"):
        raise ValueError("Date SDK/source pair requires native requalification")
    text = declaration.read_bytes().decode("utf8")
    lines = [line.strip() for line in text.splitlines()]
    if any(lines.count(value)!=1 for value in DECLARATIONS):
        raise ValueError("Date SDK constructor or AS3 namespace declarations changed")
    members = [m for m in json.loads(signatures.read_text())["classes"]["Date"]["members"] if m.get("constructor")]
    if len(members)!=1 or members[0]["signature"]!=CONSTRUCTOR or members[0]["minArgs"]!=0 or members[0]["maxArgs"]!=7:
        raise ValueError("Date SDK constructor signature authority changed")
    destination = root / "native-date"
    destination.mkdir()
    source = destination / "Date.as"
    source.write_bytes(declaration.read_bytes())
    copied_signatures = destination / "sdk-signatures.json"
    copied_signatures.write_bytes(signatures.read_bytes())
    swc = Path(air_sdk).resolve() / "frameworks/libs/air/airglobal.swc"
    proof = {"schema":"as3-native-date-authority@1", "sourceArtifactSha256":sha(swc),
             "declarationPath":source.relative_to(root).as_posix(),"declarationSha256":sha(source),
             "signaturesPath":copied_signatures.relative_to(root).as_posix(),"signaturesSha256":sha(copied_signatures)}
    proof_file = root / "native-date-proof.json"
    proof_file.write_bytes(canonical(proof))
    if inputs != inspect_native_date_inputs(air_sdk):
        raise ValueError("Date profile inputs changed")
    return {"file":{"path":proof_file.relative_to(root).as_posix(),"sha256":sha(proof_file)},
            "manifestPins":{"nativeSdkSha256":sha(swc),"nativeSignaturesSha256":sha(signatures),
                            "nativeDateDeclarationSha256":sha(source)},"generatorInputs":inputs}


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    for name in ["profile-root","air-sdk","sdk-declaration","sdk-signatures"]:
        parser.add_argument("--"+name,required=True,type=Path)
    args=parser.parse_args()
    print(json.dumps(produce_native_date_profile(**vars(args)),sort_keys=True))
