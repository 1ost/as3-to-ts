"""Shared optional ByteArray native-target proof producer; never rewrites AS3."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SIGNATURE = 'public function uncompress(algorithm:String = "zlib") : void'
MODULE = 'src/layaAir/flash/utils/ByteArray.ts'

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def _inspect_target(laya_root, air_sdk):
    laya, sdk = Path(laya_root).resolve(), Path(air_sdk).resolve()
    target = laya / 'docTool/architecture/authored-content-capabilities.json'
    target_doc = json.loads(target.read_text())
    candidates = [(cap['id'], row) for cap in target_doc['capabilities']
        if cap.get('status') == 'typescript-obligation' for row in cap.get('obligations', [])
        if row.get('module') == MODULE and row.get('export') == 'ByteArray' and row.get('kind') == 'class']
    if len(candidates) != 1: raise ValueError('Native ByteArray requires one exact target obligation')
    cap, row = candidates[0]
    resolver = ROOT / 'tools/resolve-laya-export.cjs'
    request = {'root': str(laya), 'facade': {'module': MODULE, 'export': 'ByteArray', 'sha256': row['sha256']}, 'candidates': [row]}
    resolved = subprocess.run(['node', str(resolver)], input=json.dumps(request), capture_output=True, text=True, timeout=90)
    if resolved.returncode: raise ValueError('Native ByteArray target resolution failed: '+resolved.stderr)
    inputs = json.loads(resolved.stdout)['inputs']
    artifact = sdk / 'frameworks/libs/air/airglobal.swc'
    generator_inputs = {**inputs, **{str(p):sha(p) for p in
        [Path(__file__).resolve(), resolver, artifact, target]}}
    return cap, row, inputs, generator_inputs


def inspect_native_bytearray_inputs(laya_root, air_sdk):
    """Fingerprint pre-cache inputs with exact target export/closure validation.

    Does not read or create a profile. The caller separately pins FFDec and the
    shared SDK extractor, which produce declarations only after cache selection.
    """
    return _inspect_target(laya_root, air_sdk)[3]


def produce_native_bytearray_proof(*, profile_root, laya_root, air_sdk, sdk_signatures, sdk_declaration):
    """Return proof path, source-manifest pins, generator inputs and census use.

    SDK files must already be extracted by the shared native-api producer inside
    profile_root. Merge manifestPins before generating dependent local maps.
    Add censusUse before generating census-bound local-member authority. Register
    proofPath as optional profile-lock files.byteArrayNative using actual bytes.
    """
    out, laya, sdk, signatures_path, declaration = map(lambda p: Path(p).resolve(),
        [profile_root, laya_root, air_sdk, sdk_signatures, sdk_declaration])
    signatures_relative = signatures_path.relative_to(out).as_posix()
    declaration_relative = declaration.relative_to(out).as_posix()
    target = laya / 'docTool/architecture/authored-content-capabilities.json'
    cap, row, inputs, generator_inputs = _inspect_target(laya, sdk)
    signatures = json.loads(signatures_path.read_text())
    native_member = [m for m in signatures['classes']['flash.utils.ByteArray']['members'] if m['name']=='uncompress' and m['access']=='call']
    if (len(native_member)!=1 or native_member[0]['signature']!=SIGNATURE
        or native_member[0]['minArgs']!=0 or native_member[0]['maxArgs']!=1
        or native_member[0]['scope']!='instance' or native_member[0]['type']!='void'
        or SIGNATURE not in declaration.read_text()):
        raise ValueError('Native SDK uncompress signature changed')
    artifact = sdk / 'frameworks/libs/air/airglobal.swc'
    proof = {'schema':'as3-bytearray-native-target@1', 'sourceQName':'flash.utils.ByteArray',
        'sourceMember':'uncompress', 'sourceSignature':SIGNATURE, 'sourceMinArgs':0,'sourceMaxArgs':1,
        'sourceArtifactSha256':sha(artifact),
        'sourceDeclarationPath':declaration_relative, 'sourceDeclarationSha256':sha(declaration),
        'sourceSignaturesPath':signatures_relative,'sourceSignaturesSha256':sha(signatures_path),
        'targetCapabilitiesSha256':sha(target), 'targetCapabilityId':cap,
        'targetModule':MODULE,'targetExport':row['export'],'targetSignature':row['signature'],
        'targetConstructors':row.get('constructors',[]),
        'targetMembers':[m for m in row['members'] if m['name'] in ['buffer','position','endian','uncompress']],
        'targetSources':{Path(file).relative_to(laya).as_posix():digest for file,digest in inputs.items()}}
    proof_path = out / 'bytearray-native.json'
    proof_path.write_text(json.dumps(proof, sort_keys=True, separators=(',', ':'), ensure_ascii=False)+'\n')
    return {'proofPath':proof_path,
        'manifestPins':{'nativeSdkSha256':sha(artifact),'nativeSignaturesSha256':sha(signatures_path)},
        'generatorInputs':{**generator_inputs, **{str(p):sha(p) for p in [signatures_path,declaration]}},
        'censusUse':{'qname':'flash.utils.ByteArray','member':'uncompress','access':'call','context':'instance-member',
            'receiverType':'flash.utils.ByteArray','argumentCount':0,'classification':'layaair-flash-api-bridge',
            'preserveNameAndSignature':True,'signatures':[{'signature':SIGNATURE,'minArgs':0,'maxArgs':1,'returnType':'void'}]}}
