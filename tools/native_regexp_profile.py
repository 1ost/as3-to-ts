"""Optional SDK-bound RegExp proof; no application source or capability mappings are changed."""
import argparse
import hashlib
import json
from pathlib import Path

CONSTRUCTOR = "public function RegExp(pattern:* = undefined, options:* = undefined)"
DECLARATIONS = [CONSTRUCTOR, 'AS3 native function exec(param1:String = "") : *;',
                'AS3 function test(s:String = "") : Boolean', "public dynamic class RegExp"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def inspect_native_regexp_inputs(air_sdk):
    sdk = Path(air_sdk).resolve()
    swc = sdk / "frameworks/libs/air/airglobal.swc"
    if not swc.is_file() or swc.is_symlink():
        raise ValueError("RegExp proof requires an ordinary SDK SWC")
    return {str(swc): sha(swc), str(Path(__file__).resolve()): sha(Path(__file__).resolve())}


def produce_native_regexp_profile(*, profile_root, air_sdk, sdk_declaration, sdk_signatures):
    root, declaration, signatures = Path(profile_root).resolve(), Path(sdk_declaration), Path(sdk_signatures)
    inputs = inspect_native_regexp_inputs(air_sdk)
    for path in (declaration, signatures):
        if path.is_symlink() or path.resolve()!=path or not path.is_file():
            raise ValueError("RegExp SDK declarations/signatures require canonical ordinary files")
    if (sha(Path(air_sdk).resolve() / "frameworks/libs/air/airglobal.swc") != "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546"
            or sha(declaration) != "44aeb3fc7839a380337c64e9947e7e3a8b98ddcd41ead039ed65adfcddd553c0"):
        raise ValueError("RegExp SDK/source pair requires native requalification")
    text = declaration.read_bytes().decode("utf8")
    lines = [line.strip() for line in text.splitlines()]
    if any(lines.count(value)!=1 for value in DECLARATIONS):
        raise ValueError("RegExp SDK constructor or AS3 namespace declarations changed")
    members = [m for m in json.loads(signatures.read_text())["classes"]["RegExp"]["members"] if m.get("constructor")]
    if len(members)!=1 or members[0]["signature"]!=CONSTRUCTOR or members[0]["minArgs"]!=0 or members[0]["maxArgs"]!=2:
        raise ValueError("RegExp SDK constructor signature authority changed")
    destination = root / "native-regexp"
    destination.mkdir()
    source = destination / "RegExp.as"
    source.write_bytes(declaration.read_bytes())
    copied_signatures = destination / "sdk-signatures.json"
    copied_signatures.write_bytes(signatures.read_bytes())
    swc = Path(air_sdk).resolve() / "frameworks/libs/air/airglobal.swc"
    proof = {"schema":"as3-native-regexp-authority@1", "sourceArtifactSha256":sha(swc),
             "declarationPath":source.relative_to(root).as_posix(),"declarationSha256":sha(source),
             "signaturesPath":copied_signatures.relative_to(root).as_posix(),"signaturesSha256":sha(copied_signatures)}
    proof_file = root / "native-regexp-proof.json"
    proof_file.write_bytes(canonical(proof))
    if inputs != inspect_native_regexp_inputs(air_sdk):
        raise ValueError("RegExp profile inputs changed")
    return {"file":{"path":proof_file.relative_to(root).as_posix(),"sha256":sha(proof_file)},
            "manifestPins":{"nativeSdkSha256":sha(swc),"nativeSignaturesSha256":sha(signatures),
                            "nativeRegExpDeclarationSha256":sha(source)},"generatorInputs":inputs}


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    for name in ["profile-root","air-sdk","sdk-declaration","sdk-signatures"]:
        parser.add_argument("--"+name,required=True,type=Path)
    args=parser.parse_args()
    print(json.dumps(produce_native_regexp_profile(**vars(args)),sort_keys=True))
