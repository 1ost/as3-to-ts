#!/usr/bin/env python3
"""Create a closed application profile for one bounded native-oracle AS3 source closure.

This does not change the default Bleach authority or admit unsupported syntax.
The real declaration worker and qualifier still decide whether emission is allowed.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n")
    return path


def source_members(sdk, output, qnames):
    artifact = sdk / "frameworks/libs/air/airglobal.swc"
    with zipfile.ZipFile(artifact) as archive:
        (output / "airglobal.swf").write_bytes(archive.read("library.swf"))
    result = subprocess.run([str(sdk / "bin/swfdump"), "-abc", str(output / "airglobal.swf")],
                            check=True, capture_output=True, text=True, timeout=45)
    (output / "airglobal.abc.txt").write_text(result.stdout)
    class_pattern = re.compile(r"^(?:public|internal)\s+(?:(?:final|dynamic)\s+)*class\s+(?:(?P<package>[\w$.]+)::)?(?P<name>[\w$]+)(?:\s+extends\s+(?P<base>[^\s{]+))?\s*$")
    member_pattern = re.compile(r"^(?:public|protected|private|internal|AS3)\s+(?:(?:final|override|native)\s+)*(?:function\s+(?:get\s+|set\s+)?|var\s+|const\s+)(?:[\w$.]+::)?(?P<name>[\w$]+)\b")
    property_pattern = re.compile(r'^public\s+(?:(?:final|override|native)\s+)*function\s+(get|set)\s+(\w+)\(([^)]*)\):([^\s]+)$')
    classes, current, depth = {}, None, 0
    for raw in result.stdout.splitlines():
        line = raw.strip()
        if current is None:
            match = class_pattern.match(line)
            if not match:
                continue
            name = match['name']
            current = ((match['package'] + '.') if match['package'] else '') + name
            if current in classes:
                raise ValueError('Duplicate AIR class ' + current)
            classes[current] = {'qname': current, 'baseQName': match['base'].replace('::', '.') if match['base'] not in (None, '*') else None,
                                'ownInstanceMemberNames': set(), 'dynamic': 'dynamic' in line.split('class',1)[0].split(), 'properties': []}
            depth = 0
        elif line == '{':
            depth += 1
        elif line == '}':
            depth -= 1
            if depth == 0:
                current = None
        elif depth == 1:
            prop = property_pattern.match(line)
            if prop:
                access, member, argument, result_type = prop.groups()
                classes[current]['properties'].append({'access': 'read' if access == 'get' else 'write',
                    'name': member, 'type': (result_type if access == 'get' else argument).replace('::', '.')})
            match = member_pattern.match(line)
            if match and match['name'] != name:
                classes[current]['ownInstanceMemberNames'].add(match['name'])
    selected, pending = set(), list(qnames | {'Object'})
    while pending:
        qname = pending.pop()
        if qname in selected:
            continue
        row = classes[qname]
        selected.add(qname)
        if row['baseQName']:
            pending.append(row['baseQName'])
    rows = [{k: (sorted(v) if isinstance(v, set) else v) for k, v in classes[q].items() if k != 'properties'} for q in sorted(selected)]
    return write(output / 'source-members.json', {'schema': 'as3-source-member-authority@2',
        'generator': 'air-sdk-swfdump-abc@1', 'sourceArtifactSha256': sha(artifact), 'entryCount': len(rows), 'entries': rows}), len(rows), classes


def primitive_property_mappings(qname, roles, row, capability_id, native_classes):
    """Map native primitive accessors for fixture or full application profiles.

    Callers supply the authenticated SDK class inventory and exact target ledger
    row; the original application's field declarations are never changed.
    """
    mappings, member_uses = [], []
    current, seen, lineage = qname, set(), set()
    while current:
        if current in lineage:
            raise ValueError('Cyclic native property ancestry for ' + qname)
        lineage.add(current)
        native_class = native_classes[current]
        for prop in native_class['properties']:
            key = (prop['name'], prop['access'])
            if key in seen: continue
            seen.add(key)
            target_type = {'Boolean':'boolean','Number':'number','int':'number','uint':'number','String':'string'}.get(prop['type'])
            matches = [m for m in row.get('members', []) if m['name'] == prop['name'] and m['scope'] == 'instance'
                and m['signature'] == target_type and m['kind'] in ('property','get','set','get+set')
                and m['kind'] != ('get' if prop['access'] == 'write' else 'set')
                and (prop['access'] != 'write' or not m.get('readonly'))]
            if target_type is None or len(matches) != 1: continue
            member = matches[0]; writing = prop['access'] == 'write'
            signature = (f"public function set {prop['name']}(value:{prop['type']}) : void" if writing
                         else f"public function get {prop['name']}() : {prop['type']}")
            source_member = {'access':prop['access'], 'name':prop['name'], 'minArgs':int(writing), 'maxArgs':int(writing), 'signature':signature}
            context = 'base-type' if 'base-type' in roles else 'import'
            mappings.append({'sourceQName':qname, 'sourceRoles':[context],
                'sourceMember':source_member, 'targetCapabilityId':capability_id, 'targetModule':row['module'],
                'targetExport':row['export'], 'targetKind':row['kind'], 'targetSignature':row['signature'],
                'targetMember':{k:member[k] for k in ('kind','name','scope','signature')}})
            member_uses.append({'qname':qname,'member':prop['name'],'access':prop['access'],
                'context':context, 'classification':'layaair-flash-api-bridge',
                'preserveNameAndSignature':True, 'signatures':[{k:source_member[k] for k in ('signature','minArgs','maxArgs')}]})
        current = native_class['baseQName']
    return mappings, member_uses


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--entry', required=True)
    p.add_argument('--laya', type=Path, required=True)
    p.add_argument('--air-sdk', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--ffdec-jar', type=Path, help='Recover complete native member signatures and optional arguments from this pinned decompiler')
    p.add_argument('--intrinsic-type', action='append', default=[], choices=['flash.utils.Dictionary', 'flash.utils.ByteArray'],
                   help='Exercise the existing shared compiler intrinsic instead of the optional Laya facade')
    args = p.parse_args()
    if not re.fullmatch(r'[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*', args.entry):
        p.error('Entry must be an AS3 class QName')
    source, laya, sdk, out = (x.resolve() for x in (args.source, args.laya, args.air_sdk, args.output))
    if source == out or source in out.parents or out in source.parents:
        p.error('Source and output must be disjoint')
    entry = source.joinpath(*args.entry.split('.')).with_suffix('.as')
    sources=sorted(source.rglob('*.as'))
    if entry not in sources or len(sources)>128:
        p.error('Fixture requires its entry and at most 128 original AS3 source files')
    text='\n'.join(file.read_text() for file in sources)
    if len(sources) == 1:
        declarations=[{'path':entry,'qname':args.entry,'kind':'class'}]
    else:
        inspected=json.loads(subprocess.check_output(['node',str(ROOT/'tools/inspect-source-declarations.cjs'),str(source),
            *[file.relative_to(source).as_posix() for file in sources]],text=True))
        if any(row['status'] != 'complete' for row in inspected['entries']):
            raise ValueError('Fixture declaration closure is held: '+json.dumps(inspected))
        declarations=[{'path':source/row['sourcePath'],'qname':row['declaration']['qualifiedName'],
            'kind':row['declaration']['declarationKind']} for row in inspected['entries']]
    qnames={row['qname'] for row in declarations}
    if len(qnames)!=len(declarations): p.error('Duplicate fixture QName')
    all_imports=re.findall(r'\bimport\s+([\w$.*]+)\s*;',text)
    if any('*' in q or not q.startswith('flash.') and q not in qnames for q in all_imports):
        p.error('Fixture imports must resolve to explicit Flash QNames or retained local sources')
    imports=sorted({q for q in all_imports if q.startswith('flash.')})
    if set(args.intrinsic_type) - set(imports):
        p.error('Selected intrinsic must be explicitly imported by the retained fixture')
    out.mkdir(parents=True, exist_ok=False)
    source_prefix=source.name+'/'
    target_prefix='generated/application/'
    source_roots={k:source_prefix for k in ('application','bootstrap')}
    target_roots={k:target_prefix for k in ('application','bootstrap')}
    files={}
    files['sourceManifest']=write(out/'sources.json',{'entry':args.entry,'sources':[
        {'qname':row['qname'],'path':row['path'].relative_to(source).as_posix(),'sourceSha256':sha(row['path'])}
        for row in declarations]})
    # This bounded fixture profile admits edges within its closed source set.
    # Runtime evaluation order is independently proved from emitted imports.
    graph={'entries':[{'qname':q,'dependencies':sorted(qnames-{q})} for q in sorted(qnames)]}
    files['dependencyGraphRaw']=write(out/'graph.json',graph)
    files['dependencyGraphSemantic']=write(out/'semantic-graph.json',{'components':[sorted(qnames)]})
    files['localTypeMap']=write(out/'local-types.json',{'schema':'as3-application-local-type-map@1',
        'sourceRoots':source_roots,'targetRoots':target_roots,'entryCount':len(declarations),
        'sourceManifestSha256':sha(files['sourceManifest']),'dependencyGraphRawSha256':sha(files['dependencyGraphRaw']),
        'dependencyGraphSemanticSha256':sha(files['dependencyGraphSemantic']),'entries':[{
            'componentId':'scc-00000','graphSourceSha256':sha(files['dependencyGraphRaw']),'importable':True,
            'module':'application','nodeId':hashlib.sha256(row['qname'].encode()).hexdigest()[:16],
            'prerequisites':sorted(hashlib.sha256(q.encode()).hexdigest()[:16] for q in qnames-{row['qname']}),
            'qname':row['qname'],'sourceContentSha256':sha(row['path']),
            'sourcePath':source_prefix+row['path'].relative_to(source).as_posix(),
            'targetPath':target_prefix+row['qname'].replace('.','/')+'.ts','topologicalLevel':0,'typeKind':row['kind']}
            for row in sorted(declarations,key=lambda row:row['qname'])]})
    target = laya / 'docTool/architecture/authored-content-capabilities.json'
    target_doc = json.loads(target.read_text())
    predicate_input = target.parent / 'flash-runtime-type-predicates.json'
    original = json.loads(predicate_input.read_text())
    by_qname = {r['sourceQName']: r for r in original['types']}
    def target_for(q):
        name = q.rsplit('.', 1)[-1]
        module = by_qname[q]['targetModule'] if q in by_qname else None
        namespace = 'src/layaAir/' + q.rsplit('.', 1)[0].replace('.', '/') + '/'
        candidates = [(c['id'], o) for c in target_doc['capabilities'] if c.get('status') == 'typescript-obligation'
                      for o in c.get('obligations', []) if o.get('export') == name
                      and (o.get('module') == module if module else o.get('module', '').startswith(namespace))]
        if len(candidates) != 1: raise ValueError('No unique Laya capability for ' + q)
        return candidates[0]
    native_api, native_signatures = None, None
    own_names = set(re.findall(r'\b(?:function\s+(?:(?:get|set)\s+)?|var\s+|const\s+)([A-Za-z_$][\w$]*)', text))
    member_text = re.sub(r'\bthis\s*\.\s*([A-Za-z_$][\w$]*)',
                         lambda m: ' ' if m[1] in own_names else m[0], text)
    if len(sources)>1: member_text=text
    used_names = set(re.findall(r'\.\s*([A-Za-z_$][\w$]*)', member_text))
    used_names.update(re.findall(r'\bnew\s+([A-Za-z_$][\w$]*)', text))
    if args.ffdec_jar:
        spec = importlib.util.spec_from_file_location('native_api', ROOT / 'tools/native-api-profile.py')
        native_api = importlib.util.module_from_spec(spec); spec.loader.exec_module(native_api)
        with zipfile.ZipFile(sdk / 'frameworks/libs/air/airglobal.swc') as archive:
            (out / 'airglobal.swf').write_bytes(archive.read('library.swf'))
        native_signatures = native_api.decompile_sdk(out / 'airglobal.swf', args.ffdec_jar.resolve(), out)
        # The profile's authenticated source manifest also records the exact SDK
        # signature evidence used to generate these mappings.
        source_manifest = json.loads(files['sourceManifest'].read_text())
        source_manifest['nativeSignaturesSha256'] = sha(out / 'sdk-signatures.json')
        source_manifest['nativeSdkSha256'] = sha(sdk / 'frameworks/libs/air/airglobal.swc')
        source_manifest['nativeDecompilerSha256'] = sha(args.ffdec_jar.resolve())
        write(files['sourceManifest'], source_manifest)
        local_types = json.loads(files['localTypeMap'].read_text())
        local_types['sourceManifestSha256'] = sha(files['sourceManifest'])
        write(files['localTypeMap'], local_types)
        for qname in imports:
            if re.search(r'\bextends\s+' + qname.rsplit('.', 1)[-1] + r'\b', text):
                used_names.update(m['name'] for m in native_api.native_members(native_signatures, qname)
                                  if m['name'] not in own_names and re.search(r'\b' + re.escape(m['name']) + r'\b', text))
        def has_target(qname):
            try: target_for(qname)
            except ValueError: return False
            return True
        imports = native_api.native_type_closure(imports, native_signatures, used_names, has_target)
    selected, pending = set(), [q for q in imports if q in by_qname]
    while pending:
        q = pending.pop()
        if q in selected:
            continue
        selected.add(q)
        pending.extend(by_qname[q]['heritageClosure'])
        pending.extend(by_qname[q].get('interfaces', []))
    predicates = {**original, 'types': [r for r in original['types'] if r['sourceQName'] in selected]}
    files['runtimeTypePredicates'] = write(out / 'predicates.json', predicates)
    files['runtimeTypeAuthorityLock'] = write(out / 'runtime-lock.json', {
        'schema': 'as3-application-runtime-type-authority-lock@1',
        'layaRevision': subprocess.check_output(['git', '-C', str(laya), 'rev-parse', 'HEAD'], text=True).strip(),
        'predicateAuthorityCanonicalLfSha256': sha(files['runtimeTypePredicates']),
        'predicateAuthorityEntryCount': len(selected), 'predicateAuthorityQNames': sorted(selected)})
    files['sourceMemberAuthority'], member_count, native_classes = source_members(sdk, out, {q for q in selected if by_qname[q].get("kind") != "interface"})
    apis, mappings, member_uses = [], [], []
    for q in sorted(set(imports)):
        name = q.rsplit('.', 1)[1]
        roles = ['import']
        if re.search(r'\bextends\s+' + name + r'\b', text): roles.append('base-type')
        if re.search(r'\bnew\s+' + name + r'\s*\(', text): roles.append('constructor')
        if re.search(r':\s*' + name + r'\b', text): roles.append('instance-member')
        if native_signatures is not None:
            if 'instance-member' not in roles: roles.append('instance-member')
            if re.search(r'\b' + name + r'\s*\.', text): roles.append('static-member')
        roles.sort()
        apis.append({'qname': q, 'roles': roles, 'classification': 'layaair-flash-api-bridge', 'preserve': {'apiName': True, 'signature': True}})
        if q in args.intrinsic_type and q == 'flash.utils.Dictionary':
            # The source API remains SDK-authenticated. Omitting the optional
            # bridge mapping selects the compiler's existing sealed intrinsic.
            continue
        cap, row = target_for(q)
        module = row['module']
        mapping_start = len(mappings)
        mappings.append({'sourceQName': q, 'sourceRoles': roles, 'sourceMember': None, 'targetCapabilityId': cap,
            'targetModule': module, 'targetExport': row['export'], 'targetKind': row['kind'], 'targetSignature': row['signature'], 'targetMember': None})
        properties, uses = (native_api.map_native_members(q, roles, row, cap, native_signatures, used_names)
                            if native_signatures is not None else primitive_property_mappings(q, roles, row, cap, native_classes))
        mappings.extend(properties)
        member_uses.extend(uses)
        if q in args.intrinsic_type:
            del mappings[mapping_start:]
    if native_signatures is not None:
        global_apis, global_mappings = native_api.map_native_globals(out / 'sdk-source',
            set(re.findall(r'\b[A-Za-z_$][\w$]*\b', text)), target_doc)
        apis.extend(global_apis)
        mappings.extend(global_mappings)
        native_api.annotate_native_function_signatures(apis, out / 'sdk-source')
    census = write(out / 'census.json', {'schema': 'swf-capability-census@1', 'as3SourceCapabilities': {'apis': apis, 'memberUses': member_uses}})
    if native_signatures is not None:
        mappings = native_api.select_supported_members(mappings, census, target, out)
    files['capabilityMapping'] = write(out / 'mapping.json', {'schema': 'as3-source-to-laya-capability-map@1', 'mappings': mappings})
    files['localMemberMap'] = out / 'local-members.json'
    subprocess.run(['node', str(ROOT / 'tools/generate-local-member-map.cjs'), str(files['localTypeMap']),
        str(files['localMemberMap']), str(source.parent), str(ROOT / 'lib/declaration-worker.js'), str(census), sha(census)], check=True)
    timer = json.loads((ROOT / 'config/native-timer-authority.json').read_text())
    timer.update(schema='as3-native-timer-authority@1', module='@laya/as3-runtime/AS3Timer', sourceSha256=sha(ROOT / 'src/hardened-runtime/AS3Timer.ts'))
    files['nativeTimerAuthority'] = write(out / 'timer.json', timer)
    members = json.loads(files['localMemberMap'].read_text())
    write(out / 'profile-lock.json', {'schema': 'as3-application-profile-lock@1', 'applicationId': 'laya-native-oracle',
        'runtimePackage': '@laya/as3-runtime', 'typeScriptVersion': '4.9.5', 'sourceRoots': source_roots, 'targetRoots': target_roots,
        'sourceCensusSha256': sha(census), 'targetCapabilitiesSha256': sha(target), 'runtimePredicateQNames': sorted(selected),
        'counts': {'localTypes': len(declarations), 'localMembersComplete': members['completeCount'], 'localMembersHeld': members['heldCount'],
                   'mappedTypes': sum(m['sourceMember'] is None for m in mappings), 'mappedMembers': sum(m['sourceMember'] is not None for m in mappings), 'sourceMemberTypes': member_count},
        'files': {k: {'path': v.name, 'sha256': sha(v)} for k, v in files.items()}})
    write(out / 'generator-inputs.json', {str(v): sha(v) for v in [Path(__file__).resolve(), *sources, ROOT / "tools/inspect-source-declarations.cjs", target, predicate_input,
        sdk / 'frameworks/libs/air/airglobal.swc', sdk / 'lib/swfdump-cli.jar', ROOT / 'lib/declaration-worker.js',
        *([args.ffdec_jar.resolve(), ROOT / 'tools/native-api-profile.py', out / 'sdk-signatures.json'] if native_signatures is not None else [])]})
    print(out / 'profile-lock.json')


if __name__ == '__main__':
    main()
