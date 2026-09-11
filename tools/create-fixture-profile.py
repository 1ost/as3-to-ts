#!/usr/bin/env python3
"""Create a closed application profile for one independent native-oracle AS3 class.

This does not change the default Bleach authority or admit unsupported syntax.
The real declaration worker and qualifier still decide whether emission is allowed.
"""
import argparse
import hashlib
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
                                'ownInstanceMemberNames': set(), 'properties': []}
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
    return write(output / 'source-members.json', {'schema': 'as3-source-member-authority@1',
        'generator': 'air-sdk-swfdump-abc@1', 'sourceArtifactSha256': sha(artifact), 'entryCount': len(rows), 'entries': rows}), len(rows), classes


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--entry', required=True)
    p.add_argument('--laya', type=Path, required=True)
    p.add_argument('--air-sdk', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if not re.fullmatch(r'[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*', args.entry):
        p.error('Entry must be an AS3 class QName')
    source, laya, sdk, out = (x.resolve() for x in (args.source, args.laya, args.air_sdk, args.output))
    if source == out or source in out.parents or out in source.parents:
        p.error('Source and output must be disjoint')
    entry = source.joinpath(*args.entry.split('.')).with_suffix('.as')
    if list(source.rglob('*.as')) != [entry]:
        p.error('This profile requires exactly one independent AS3 class')
    text = entry.read_text()
    imports = re.findall(r'\bimport\s+([\w$.*]+)\s*;', text)
    if any(not q.startswith('flash.') or '*' in q for q in imports):
        p.error('Fixture imports must be explicit Flash QNames; local dependencies need a full application profile')
    out.mkdir(parents=True, exist_ok=False)
    # Paths are relative to the source parent, independently of the consuming repo.
    source_prefix = source.name + '/'
    target_prefix = 'generated/application/'
    source_roots = {k: source_prefix for k in ('application', 'bootstrap')}
    target_roots = {k: target_prefix for k in ('application', 'bootstrap')}
    files = {}
    files['sourceManifest'] = write(out / 'sources.json', {'entry': args.entry, 'sourceSha256': sha(entry)})
    graph = {'qname': args.entry, 'dependencies': []}
    files['dependencyGraphRaw'] = write(out / 'graph.json', graph)
    files['dependencyGraphSemantic'] = write(out / 'semantic-graph.json', {'components': [[args.entry]]})
    files['localTypeMap'] = write(out / 'local-types.json', {'schema': 'as3-application-local-type-map@1',
        'sourceRoots': source_roots, 'targetRoots': target_roots, 'entryCount': 1,
        'sourceManifestSha256': sha(files['sourceManifest']), 'dependencyGraphRawSha256': sha(files['dependencyGraphRaw']),
        'dependencyGraphSemanticSha256': sha(files['dependencyGraphSemantic']), 'entries': [{
            'componentId': 'scc-00000', 'graphSourceSha256': sha(files['dependencyGraphRaw']), 'importable': True,
            'module': 'application', 'nodeId': hashlib.sha256(args.entry.encode()).hexdigest()[:16],
            'prerequisites': [], 'qname': args.entry, 'sourceContentSha256': sha(entry),
            'sourcePath': source_prefix + entry.relative_to(source).as_posix(),
            'targetPath': target_prefix + args.entry.replace('.', '/') + '.ts', 'topologicalLevel': 0, 'typeKind': 'class'}]})
    target = laya / 'docTool/architecture/authored-content-capabilities.json'
    target_doc = json.loads(target.read_text())
    predicate_input = target.parent / 'flash-runtime-type-predicates.json'
    original = json.loads(predicate_input.read_text())
    by_qname = {r['sourceQName']: r for r in original['types']}
    selected, pending = set(), [q for q in imports if q in by_qname]
    while pending:
        q = pending.pop()
        if q in selected:
            continue
        selected.add(q)
        pending.extend(by_qname[q]['heritageClosure'])
    predicates = {**original, 'types': [r for r in original['types'] if r['sourceQName'] in selected]}
    files['runtimeTypePredicates'] = write(out / 'predicates.json', predicates)
    files['runtimeTypeAuthorityLock'] = write(out / 'runtime-lock.json', {
        'schema': 'as3-application-runtime-type-authority-lock@1',
        'layaRevision': subprocess.check_output(['git', '-C', str(laya), 'rev-parse', 'HEAD'], text=True).strip(),
        'predicateAuthorityCanonicalLfSha256': sha(files['runtimeTypePredicates']),
        'predicateAuthorityEntryCount': len(selected), 'predicateAuthorityQNames': sorted(selected)})
    files['sourceMemberAuthority'], member_count, native_classes = source_members(sdk, out, selected)
    apis, mappings, member_uses = [], [], []
    for q in sorted(set(imports)):
        name = q.rsplit('.', 1)[1]
        roles = ['import']
        if re.search(r'\bextends\s+' + name + r'\b', text): roles.append('base-type')
        if re.search(r'\bnew\s+' + name + r'\s*\(', text): roles.append('constructor')
        if re.search(r':\s*' + name + r'\b', text): roles.append('instance-member')
        roles.sort()
        apis.append({'qname': q, 'roles': roles, 'classification': 'layaair-flash-api-bridge', 'preserve': {'apiName': True, 'signature': True}})
        module = by_qname[q]['targetModule'] if q in by_qname else 'src/layaAir/' + q.replace('.', '/') + '.ts'
        candidates = [(c['id'], o) for c in target_doc['capabilities'] if c.get('status') == 'typescript-obligation'
                      for o in c.get('obligations', []) if o.get('module') == module and o.get('export') == name]
        if len(candidates) != 1:
            raise ValueError('No unique Laya capability for ' + q)
        cap, row = candidates[0]
        mappings.append({'sourceQName': q, 'sourceRoles': roles, 'sourceMember': None, 'targetCapabilityId': cap,
            'targetModule': module, 'targetExport': row['export'], 'targetKind': row['kind'], 'targetSignature': row['signature'], 'targetMember': None})
        # Recover primitive properties from the actual SDK, including inherited
        # accessors. Never infer source types from the browser implementation.
        current, seen = q, set()
        while current:
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
                mappings.append({'sourceQName':q, 'sourceRoles':['base-type' if 'base-type' in roles else 'import'],
                    'sourceMember':source_member, 'targetCapabilityId':cap, 'targetModule':module,
                    'targetExport':row['export'], 'targetKind':row['kind'], 'targetSignature':row['signature'],
                    'targetMember':{k:member[k] for k in ('kind','name','scope','signature')}})
                member_uses.append({'qname':q,'member':prop['name'],'access':prop['access'],
                    'context':'base-type' if 'base-type' in roles else 'import', 'classification':'layaair-flash-api-bridge',
                    'preserveNameAndSignature':True, 'signatures':[{k:source_member[k] for k in ('signature','minArgs','maxArgs')}]})
            current = native_class['baseQName']
    census = write(out / 'census.json', {'schema': 'swf-capability-census@1', 'as3SourceCapabilities': {'apis': apis, 'memberUses': member_uses}})
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
        'counts': {'localTypes': 1, 'localMembersComplete': members['completeCount'], 'localMembersHeld': members['heldCount'],
                   'mappedTypes': len(apis), 'mappedMembers': len(member_uses), 'sourceMemberTypes': member_count},
        'files': {k: {'path': v.name, 'sha256': sha(v)} for k, v in files.items()}})
    write(out / 'generator-inputs.json', {str(v): sha(v) for v in [Path(__file__).resolve(), entry, target, predicate_input,
        sdk / 'frameworks/libs/air/airglobal.swc', sdk / 'lib/swfdump-cli.jar', ROOT / 'lib/declaration-worker.js']})
    print(out / 'profile-lock.json')


if __name__ == '__main__':
    main()
