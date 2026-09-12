"""Recover SDK call signatures (including optional arguments) from retained FFDec output.

The SDK bytes and decompiler are inputs, not hand-authored API declarations.
Only public members with an unambiguous target surface can be mapped.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

BUILTINS = {'*', 'void', 'int', 'uint', 'Number', 'Boolean', 'String', 'Array', 'Object', 'Class', 'Function',
            'XML', 'XMLList', 'Namespace', 'QName', 'Error', 'RegExp', 'Date'}


def signature_tokens(text):
    """Yield unquoted tokens with balanced delimiters; arrow heads are not generics."""
    stack, quote, escaped = [], None, False
    for i, ch in enumerate(text):
        if quote:
            if escaped: escaped = False
            elif ch == '\\': escaped = True
            elif ch == quote: quote = None
        elif ch in "\"'": quote = ch
        else:
            if ch in '(<[{': stack.append(ch)
            elif ch in ')>]}' and not (ch == '>' and i > 0 and text[i - 1] == '='):
                if not stack or stack.pop() != {')': '(', '>': '<', ']': '[', '}': '{'}[ch]:
                    raise ValueError('Malformed native parameter signature')
            yield i, ch, len(stack)
    if quote or stack:
        raise ValueError('Malformed native parameter signature')


def split_parameters(text):
    """Split declaration arguments without splitting strings or generic/array values."""
    values, start = [], 0
    for i, ch, depth in signature_tokens(text):
        if ch == ',' and depth == 0:
            values.append(text[start:i].strip()); start = i + 1
    if text[start:].strip(): values.append(text[start:].strip())
    return values


def read_native_declarations(directory):
    result = {}
    files = sorted(Path(directory).rglob('*.as'))
    texts = {path: path.read_text() for path in files}
    declared = set()
    for text in texts.values():
        package = re.search(r'\bpackage(?:\s+([\w.]+))?\s*\{', text)
        definition = re.search(r'\bpublic\s+(?:(?:final|dynamic)\s+)*(?:class|interface)\s+(\w+)', text)
        if package and definition: declared.add(((package[1] + '.') if package[1] else '') + definition[1])
    for path in files:
        text = texts[path]
        package_match = re.search(r'\bpackage(?:\s+([\w.]+))?\s*\{', text)
        definition = re.search(r'\bpublic\s+(?:(?:final|dynamic)\s+)*(class|interface)\s+(\w+)(?:\s+extends\s+([\w.]+))?', text)
        if not package_match or not definition: continue
        package = package_match[1] or ''
        name, base = definition[2], definition[3]
        qname = (package + '.' if package else '') + name
        imports = {q.rsplit('.', 1)[-1]: q for q in re.findall(r'\bimport\s+([\w.]+)\s*;', text)}
        wildcards = re.findall(r'\bimport\s+([\w.]+)\.\*\s*;', text)
        def qualify(t):
            if t in BUILTINS: return t
            if t.startswith('Vector.<') and t.endswith('>'): return 'Vector.<' + qualify(t[8:-1]) + '>'
            if t in imports: return imports[t]
            if '.' in t: return t
            local = (package + '.' if package else '') + t
            if local in declared: return local
            candidates = sorted({prefix + '.' + t for prefix in wildcards if prefix + '.' + t in declared})
            if len(candidates) == 1: return candidates[0]
            if t in declared: return t
            raise ValueError('Unresolved native signature type ' + qname + ': ' + t)
        members = []
        for match in re.finditer(r'^\s*((?:(?:static|override|final|native)\s+)*public\s+(?:(?:static|override|final|native)\s+)*)function\s+(?:(get|set)\s+)?(\w+)\s*\(([^\n)]*)\)\s*(?::\s*([\w.*<>]+))?', text, re.M):
            modifiers, accessor, member_name, raw_parameters, return_type = match.groups()
            parameters, required, rest = [], 0, False
            for raw in split_parameters(raw_parameters):
                parameter = re.fullmatch(r'(\.\.\.)?\s*(\w+)\s*(?::\s*([\w.*<>]+))?(?:\s*=\s*(.+))?', raw)
                if not parameter: raise ValueError('Unrecognized native argument: ' + raw)
                variadic, pname, ptype, default = parameter.groups()
                ptype = qualify(ptype or '*')
                rest = bool(variadic)
                if default is None and not rest: required += 1
                parameters.append({'name': pname, 'type': ptype, 'optional': default is not None,
                                   'default': default, 'rest': rest})
            is_constructor = member_name == name
            rtype = qname if is_constructor else qualify(return_type or 'void')
            access = 'read' if accessor == 'get' else 'write' if accessor == 'set' else 'call'
            prefix = 'public ' + ('static ' if 'static' in modifiers.split() else '') + 'function '
            signature = prefix + (accessor + ' ' if accessor else '') + member_name + '(' + ', '.join(
                ('...' if p['rest'] else '') + p['name'] + ':' + p['type'] + (' = ' + p['default'] if p['optional'] else '') for p in parameters) + ')'
            if not is_constructor: signature += ' : ' + rtype
            members.append({'name': member_name, 'access': access, 'scope': 'static' if is_constructor or 'static' in modifiers.split() else 'instance',
                'constructor': is_constructor, 'signature': signature, 'minArgs': required, 'maxArgs': 1000000 if rest else len(parameters),
                'type': parameters[0]['type'] if access == 'write' else rtype, 'parameters': parameters})
        for match in re.finditer(r'^\s*public\s+(static\s+)?(const|var)\s+(\w+)\s*:\s*([\w.*<>]+)(?:\s*=\s*([^\r\n;]+))?', text, re.M):
            static, kind, member_name, t, value = match.groups()
            for access in (['read'] if kind == 'const' else ['read', 'write']):
                members.append({'name': member_name, 'access': access, 'scope': 'static' if static else 'instance', 'constructor': False,
                    'signature': 'public ' + ('static ' if static else '') + kind + ' ' + member_name + ':' + qualify(t) + (' = ' + value.strip() if value else ''),
                    'minArgs': int(access == 'write'), 'maxArgs': int(access == 'write'), 'type': qualify(t), 'parameters': []})
        if qname in result: raise ValueError('Duplicate native declaration ' + qname)
        result[qname] = {'base': qualify(base) if base else None, 'members': members, 'source': str(path)}
    return result


def native_members(classes, qname):
    seen, ancestry = set(), set()
    current = qname
    while current and current in classes:
        if current in ancestry: raise ValueError('Native class ancestry cycle')
        ancestry.add(current)
        row = classes[current]
        for member in row['members']:
            if member['constructor'] and current != qname: continue
            key = (member['name'], member['access'], member['scope'])
            if key in seen: continue
            seen.add(key)
            yield {**member, 'declaredBy': current}
        current = row['base']


def native_type_closure(roots, classes, used_names, has_target):
    """Follow real SDK receiver/argument/result types without editing source imports."""
    closure, pending = set(roots), list(roots)
    while pending:
        qname = pending.pop()
        for member in native_members(classes, qname):
            if member['name'] not in used_names:
                continue
            for value in [member['declaredBy'], member['type'], *[p['type'] for p in member['parameters']]]:
                for dependency in re.findall(r'flash(?:\.[A-Za-z_$][\w$]*)+', value):
                    if dependency not in closure and has_target(dependency):
                        closure.add(dependency)
                        pending.append(dependency)
    return sorted(closure)


def target_arity(signature):
    if signature.startswith('<'):
        for index, character, depth in signature_tokens(signature):
            if character == '>' and depth == 0:
                signature = signature[index + 1:]
                break
        else: return None
    if signature.startswith('new '): signature = signature[4:]
    if not signature.startswith('('): return None
    for index, character, depth in signature_tokens(signature):
        if character == ')' and depth == 0:
            if not re.fullmatch(r'(?:: | => ).+', signature[index + 1:]): return None
            parameters = split_parameters(signature[1:index])
            break
    else: return None
    if any(':' not in p for p in parameters): return None
    return (sum(not p.startswith('...') and '?' not in p.split(':', 1)[0] for p in parameters),
            1000000 if any(p.startswith('...') for p in parameters) else len(parameters))


def map_native_members(qname, roles, row, capability_id, classes, used_names):
    mappings, uses = [], []
    for native in native_members(classes, qname):
        # Inherited operations are mapped on their actual declaring class. The
        # adapter follows the separately authenticated native ancestry.
        if native['declaredBy'] != qname: continue
        if native['name'] not in used_names and not (native['constructor'] and 'constructor' in roles): continue
        if native['constructor'] and 'constructor' not in roles: continue
        target_name = 'flashAutoSize' if qname == 'flash.text.TextField' and native['name'] == 'autoSize' else native['name']
        candidates = ([{'name': row['export'], 'kind': 'constructor', 'scope': 'static', 'signature': signature}
                       for signature in row.get('constructors', [])] if native['constructor'] else
                      [m for m in row.get('members', []) if m['name'] == target_name and m['scope'] == native['scope']])
        if native['access'] == 'call':
            candidates = [m for m in candidates if m['kind'] == ('constructor' if native['constructor'] else 'method')
                and target_arity(m['signature']) is not None
                and (target_arity(m['signature']) == (native['minArgs'], native['maxArgs']) if native['constructor'] else
                     target_arity(m['signature'])[0] <= native['minArgs'] and target_arity(m['signature'])[1] >= native['maxArgs'])]
        else:
            candidates = [m for m in candidates if m['kind'] in ('property', 'get', 'set', 'get+set')
                and m['kind'] != ('get' if native['access'] == 'write' else 'set')
                and not (native['access'] == 'write' and m.get('readonly'))]
            def value_type(candidate):
                signature = candidate['signature']
                split = re.fullmatch(r'get (.+); set (.+)', signature)
                return split[1 if native['access'] == 'read' else 2] if split else signature
            def compatible(candidate):
                target = value_type(candidate)
                if native['access'] == 'write' and target in ('unknown', 'any'): return True
                primitive = {'Boolean': 'boolean', 'Number': 'number', 'int': 'number', 'uint': 'number', 'String': 'string'}.get(native['type'])
                if primitive:
                    return target == primitive or (primitive == 'string' and target in ('string | null', 'null | string')) or (native['scope'] == 'static' and native['access'] == 'read'
                        and primitive == 'string' and target.startswith('"'))
                if native['type'] == 'Array': return bool(re.fullmatch(r'(?:readonly )?[A-Za-z_$][\w$]*(?:\[\])(?: \| null)?', target))
                if native['type'].startswith('flash.'):
                    return bool(re.search(r'\b' + re.escape(native['type'].rsplit('.', 1)[-1]) + r'\b', target))
                return False
            candidates = [m for m in candidates if compatible(m)]
        if len(candidates) != 1: continue
        member = candidates[0]
        context = ('constructor' if native['constructor'] else 'static-member' if native['scope'] == 'static'
                   else 'instance-member' if 'instance-member' in roles else 'base-type')
        if context not in roles: continue
        source_member = {k: native[k] for k in ('name', 'access', 'signature', 'minArgs', 'maxArgs')}
        if ' const ' in source_member['signature'] or ' var ' in source_member['signature']:
            source_member['signature'] += ';'
        mappings.append({'sourceQName': qname, 'sourceRoles': [context], 'sourceMember': source_member,
            'targetCapabilityId': capability_id, 'targetModule': row['module'], 'targetExport': row['export'],
            'targetKind': row['kind'], 'targetSignature': row['signature'],
            'targetMember': {k: member[k] for k in ('kind', 'name', 'scope', 'signature')}})
        is_constant = native['scope'] == 'static' and native['access'] == 'read' and ' const ' in native['signature']
        kind = 'constructor' if native['constructor'] else 'method' if native['access'] == 'call' else 'const' if is_constant else 'get' if native['access'] == 'read' else 'set'
        uses.append({'qname': qname, 'member': native['name'], 'access': native['access'], 'context': context,
            'receiverType': qname, 'argumentCount': None if native['access'] != 'call' else native['minArgs'],
            'classification': 'layaair-flash-api-bridge', 'preserveNameAndSignature': True,
            'signatures': [{'signature': source_member['signature'], 'minArgs': source_member['minArgs'],
                'maxArgs': None if is_constant else source_member['maxArgs'], 'declaredBy': native['declaredBy'], 'kind': kind,
                'static': native['scope'] == 'static' and not native['constructor'],
                'returnType': qname.rsplit('.', 1)[-1] if native['constructor'] else 'void' if native['access'] == 'write' else native['type']}]})
    return mappings, uses


def decompile_sdk(swf, ffdec, output):
    with (output / 'sdk-export.log').open('w') as log:
        subprocess.run(['java', '-Xmx768m', '-jar', str(ffdec), '-export', 'script', str(output / 'sdk-source'), str(swf)],
                       check=True, stdout=log, stderr=subprocess.STDOUT, timeout=120)
    classes = read_native_declarations(output / 'sdk-source')
    if not classes: raise ValueError('SDK export contains no native class declarations')
    inputs = [Path(__file__), swf, ffdec, *sorted((output / 'sdk-source').rglob('*.as'))]
    (output / 'sdk-signatures.json').write_text(json.dumps({'schema': 'native-sdk-signatures@1', 'classes': classes,
        'inputs': {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}}, sort_keys=True) + '\n')
    return classes


def select_supported_members(mappings, census_path, target_path, output):
    """Retain all source uses, but map only members accepted by the real compiler gate."""
    candidates = output / 'native-api-candidates.json'
    candidates.write_text(json.dumps({'schema': 'as3-source-to-laya-capability-map@1', 'mappings': mappings},
                                    sort_keys=True, separators=(',', ':')) + '\n')
    report = output / 'native-api-selection.json'
    subprocess.run(['node', str(Path(__file__).with_name('select-native-api-profile.cjs')),
                    str(census_path), str(target_path), str(candidates), str(report)], check=True, timeout=60)
    return json.loads(report.read_text())['mappings']
