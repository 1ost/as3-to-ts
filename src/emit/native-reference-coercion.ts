import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {NativeGeneratedDeclarationPlan, nativeGeneratedConsumerResolver} from './native-generated-declarations';
import {generatedModule} from './native-generated-emission';

export interface NativeReferenceCoercionOptions {
    plan: NativeGeneratedDeclarationPlan;
    module: string;
    coercionModule: string;
}
export interface ReferenceLocal {node: Node; name: string; exported: string; header: boolean; parameter: boolean;}
const functions = [K.FUNCTION,K.LAMBDA,K.GET,K.SET];
function fail(reason: string): never {throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: ' + reason);}

/** Exact source bindings, distinct from TS structural type assertions. */
export class NativeReferenceCoercion {
    readonly root: Node;
    readonly owner: string;
    readonly resolve: (name: string) => string;
    private declarations = new Map<number, ReferenceLocal>();
    private scopes = new Map<number, Map<string, ReferenceLocal>>();
    constructor(source: string, readonly options: NativeReferenceCoercionOptions, generated: boolean) {
        if (!options || Object.keys(options).some(key => ['plan','module','coercionModule'].indexOf(key) < 0)) fail('exact plan/module/coercion configuration required');
        generatedModule(options.module); generatedModule(options.coercionModule);
        const consumer = nativeGeneratedConsumerResolver(options.plan, source);
        this.root = consumer.root; this.owner = consumer.owner; this.resolve = consumer.resolve;
        const walk = (node: Node, fn: Node): void => {
            if (functions.indexOf(node.kind) >= 0) {
                if (fn) fail('nested consumer functions require lexical scope qualification');
                fn = node; this.scopes.set(fn.start,new Map<string, ReferenceLocal>());
                const type = node.findChild(K.TYPE);
                if (!generated && type && this.type(type.qualifiedName || type.text)) fail('reference return coercion requires separate lowering');
            }
            if (node.kind === K.NAME_TYPE_INIT) {
                const name = node.findChild(K.NAME).text, type = node.findChild(K.TYPE);
                const exported = type && this.type(type.qualifiedName || type.text);
                if (exported && !generated && node.parent.kind === K.PARAMETER) fail('reference parameter entry requires separate lowering');
                if (exported && !fn && !generated) fail('reference field storage requires generated class registration');
                if (fn) {
                    const scope = this.scopes.get(fn.start);
                    if (scope.has(name) && (exported || scope.get(name))) fail('duplicate local declaration requires default-order authority: ' + name);
                    if (exported && [K.CONST,K.CONST_LIST].indexOf(node.parent.kind) >= 0) fail('reference local constant lowering required');
                    let header = false;
                    for (let value = node; value && value !== fn; value = value.parent) {
                        const parent = value.parent;
                        if (parent && [K.FORIN,K.FOREACH].indexOf(parent.kind) >= 0 && parent.children[0] === value) header = true;
                    }
                    const local = exported ? {node, name, exported, header, parameter:node.parent.kind === K.PARAMETER} : null;
                    scope.set(name,local);
                    if (local) this.declarations.set(node.start,local);
                }
            }
            node.children.forEach(child => walk(child,fn));
        };
        walk(this.root,null);
        const guard = (node: Node): void => {
            if ([K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC,K.DELETE].indexOf(node.kind) >= 0) {
                const target = unwrapEncapsulatedExpression(node.children[0]);
                if (target && target.kind === K.IDENTIFIER && this.local(target,target.text)) fail('reference update/delete requires separate lowering');
            }
            if (node.kind === K.EXTENDS && this.sourceClass(node.qualifiedName || node.text) && !generated)
                fail('source reference ancestry requires generated class registration');
            if ([K.AS,K.RELATION].indexOf(node.kind) >= 0 && node.children.some(child =>
                child.kind === K.TYPE && !!this.type(child.qualifiedName || child.text)))
                fail('reference type operation requires class-evaluation authority');
            if (node.kind === K.RELATION && node.children.some(child => child.text === 'as' || child.text === 'is')
                && this.type(node.lastChild.qualifiedName || node.lastChild.text))
                fail('reference type operation requires class-evaluation authority');
            if (node.kind === K.DOT) {
                const qualified = (value: Node): string => value.kind === K.IDENTIFIER ? value.text
                    : value.kind === K.DOT && value.children[1].kind === K.LITERAL
                    ? qualified(value.children[0]) + '.' + value.children[1].text : '';
                const name = qualified(node);
                if (name && options.plan.bindings.some(binding => binding.qname === name))
                    fail('qualified reference class value requires source binding resolution');
            }
            node.children.forEach(guard);
        };
        guard(this.root);
    }
    type(name: string): string {
        if (!name) return null;
        const identity = this.resolve(name), plan = this.options.plan;
        const source = plan.bindings.find(binding => binding.qname === identity);
        const native = plan.nativeBindings.find(binding => binding.qname === identity);
        return source ? source.tokenExport : native ? native.referenceExport : null;
    }
    sourceClass(name: string): boolean {
        const identity = this.resolve(name);
        return this.options.plan.bindings.some(binding => binding.qname === identity);
    }
    declaration(node: Node): ReferenceLocal {return node && this.declarations.get(node.start);}
    local(node: Node, name: string): ReferenceLocal {
        for (let value = node; value; value = value.parent) {
            const scope = functions.indexOf(value.kind) >= 0 && this.scopes.get(value.start);
            if (scope && scope.has(name)) return scope.get(name);
            if (value.kind === K.CATCH && value.children.some(child => child.kind === K.NAME && child.text === name)) return null;
        }
        return null;
    }
    defaults(block: Node): ReferenceLocal[] {
        const scope = block.parent && functions.indexOf(block.parent.kind) >= 0 && this.scopes.get(block.parent.start);
        return scope ? Array.from(scope.values()).filter(local => local && !local.header && !local.parameter) : [];
    }
}
