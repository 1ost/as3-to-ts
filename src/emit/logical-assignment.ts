import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';

interface Binding { as3Type?: string; bound?: string; }
const fail = (reason: string): never => { throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: ' + reason); };
function ancestor(node: Node, kind: NodeKind): Node {
    for (let value = node.parent; value; value = value.parent) if (value.kind === kind) return value;
    return null;
}

/** Resolve only lexical bindings and same-package, same-file ordinary traits. */
export function logicalAssignmentType(node: Node, lookup: (name: string) => Binding): string {
    node = unwrapEncapsulatedExpression(node);
    if (node.kind === NodeKind.IDENTIFIER) {
        const binding = lookup(node.text);
        if (!binding || !Object.prototype.hasOwnProperty.call(binding, 'as3Type'))
            return fail('unresolved identifier target: ' + node.text);
        const owner = ancestor(node, NodeKind.CLASS);
        if (binding.bound) {
            if (!owner || binding.bound !== 'this' && binding.bound !== owner.findChild(NodeKind.NAME).text)
                return fail('implicit target requires a proven own class trait');
            // Scope records for accessors do not retain the setter parameter's
            // AS3 type. Resolve bound identifiers through the same AST authority
            // as this.value/Class.value instead of treating absent metadata as *.
            return writableTraitType(owner, owner, node.text, binding.bound !== 'this');
        }
        return binding.as3Type || '*';
    }
    if (node.kind !== NodeKind.DOT || node.children[1].kind !== NodeKind.LITERAL)
        return fail('only identifiers and proven ordinary dot traits are supported');
    const owner = ancestor(node, NodeKind.CLASS), receiver = unwrapEncapsulatedExpression(node.children[0]);
    const content = owner && owner.findChild(NodeKind.CONTENT);
    let targetClass: Node = null;
    let type: string = null;
    let isStatic = false;
    if (receiver.kind === NodeKind.IDENTIFIER) {
        if (receiver.text === 'this') targetClass = owner;
        else if (owner && receiver.text === owner.findChild(NodeKind.NAME).text && !(lookup(receiver.text) || {}).as3Type) {
            targetClass = owner; isStatic = true;
        } else type = (lookup(receiver.text) || {}).as3Type;
    } else if (receiver.kind === NodeKind.CALL && content) {
        const callee = receiver.children[0];
        const methodName = callee.kind === NodeKind.DOT && callee.children[0].text === 'this' ? callee.children[1].text
            : callee.kind === NodeKind.IDENTIFIER && (lookup(callee.text) || {}).bound === 'this' ? callee.text : null;
        const method = content.children.filter(child => child && child.kind === NodeKind.FUNCTION
            && child.findChild(NodeKind.NAME).text === methodName);
        if (method.length === 1) type = (method[0].findChild(NodeKind.TYPE) || {} as Node).text;
    }
    if (!targetClass && type) {
        const pkg = ancestor(node, NodeKind.PACKAGE);
        const declarations = pkg && pkg.findChild(NodeKind.CONTENT).children.filter(child => child && child.kind === NodeKind.CLASS
            && child.findChild(NodeKind.NAME).text === type);
        if (declarations && declarations.length === 1) targetClass = declarations[0];
    }
    return writableTraitType(targetClass, owner, node.children[1].text, isStatic);
}

function writableTraitType(targetClass: Node, owner: Node, name: string, isStatic: boolean): string {
    if (!targetClass || targetClass.findChild(NodeKind.EXTENDS)) return fail('dot target requires a proven own ordinary class trait');
    const mods = targetClass.findChild(NodeKind.MOD_LIST);
    if (mods && mods.children.some(mod => mod.text === 'dynamic')) return fail('dynamic receiver traits require separate authority');
    const traits: Node[] = [];
    const accessible = (member: Node): boolean => {
        const modifiers = member.findChild(NodeKind.MOD_LIST);
        const values = modifiers ? modifiers.children : [];
        return !values.some(mod => ['public','private','protected','internal','static','final','override','native'].indexOf(mod.text) < 0)
            && !(targetClass !== owner && values.some(mod => mod.text === 'private' || mod.text === 'protected'))
            && values.some(mod => mod.text === 'static') === isStatic;
    };
    targetClass.findChild(NodeKind.CONTENT).children.forEach(member => {
        if (!member || !accessible(member)) return;
        if (member.kind === NodeKind.VAR_LIST) {
            member.findChildren(NodeKind.NAME_TYPE_INIT).forEach(field => {
                if (field.findChild(NodeKind.NAME).text === name) traits.push(field);
            });
        } else if (member.kind === NodeKind.SET && member.findChild(NodeKind.NAME).text === name) {
            const readable = targetClass.findChild(NodeKind.CONTENT).children.some(getter => getter
                && getter.kind === NodeKind.GET && getter.findChild(NodeKind.NAME).text === name
                && accessible(getter));
            if (!readable) return;
            const parameters = member.findChild(NodeKind.PARAMETER_LIST);
            const parameter = parameters && parameters.children[0];
            const field = parameter && (parameter.findChild(NodeKind.NAME_TYPE_INIT) || parameter);
            if (field) traits.push(field);
        }
    });
    if (traits.length !== 1) return fail('dot assignment requires a unique writable declared trait: ' + name);
    return (traits[0].findChild(NodeKind.TYPE) || {} as Node).text || '*';
}
