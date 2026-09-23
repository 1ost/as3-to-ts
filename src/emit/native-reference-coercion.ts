import {nativeNumericProductConstant} from './native-numeric-product-constant';
import {nativeUintOrConstants} from './native-uint-or-constants';
import Node, {outerEncapsulatedExpression, unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {NativeGeneratedDeclarationPlan, nativeGeneratedConsumerResolver, nativeGeneratedDeclarationInputs} from './native-generated-declarations';
import {generatedModule} from './native-generated-emission';

export interface NativeReferenceCoercionOptions {
    plan: NativeGeneratedDeclarationPlan;
    module: string;
    coercionModule: string;
}
export interface ReferenceLocal {node: Node; name: string; exported: string; header: boolean; parameter: boolean; stringLocal?: boolean;}
export interface ReferenceSignature {
    node: Node; returned: string; builtinReturn: string;
    parameters: {node: Node; name: string; type: string; exported: string; optional: boolean}[];
    argumentsUsed: boolean;
}
const functions = [K.FUNCTION,K.LAMBDA,K.GET,K.SET];
function fail(reason: string): never {throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: ' + reason);}

/** Exact source bindings, distinct from TS structural type assertions. */
export class NativeReferenceCoercion {
    readonly root: Node;
    readonly owner: string;
    readonly resolve: (name: string) => string;
    private declarations = new Map<number, ReferenceLocal>();
    private constantDeclarations = new Map<string, Node>();
    private scopes = new Map<number, Map<string, ReferenceLocal>>();
    private signatures = new Map<number, ReferenceSignature>();
    constructor(source: string, readonly options: NativeReferenceCoercionOptions, private generated: boolean, nativeDate = false, stringLocals = false, nativeEvent = false, nativeXML: string[] = [], nativeDisplayObject = false) {
        if (!options || Object.keys(options).some(key => ['plan','module','coercionModule'].indexOf(key) < 0)) fail('exact plan/module/coercion configuration required');
        generatedModule(options.module); generatedModule(options.coercionModule);
        const consumer = nativeGeneratedConsumerResolver(options.plan, source);
        this.root = consumer.root; this.owner = consumer.owner; this.resolve = consumer.resolve;
        const walk = (node: Node, fn: Node): void => {
            if (functions.indexOf(node.kind) >= 0) {
                if (fn&&!generated) fail('nested consumer functions require lexical scope qualification');
                fn = node; this.scopes.set(fn.start,new Map<string, ReferenceLocal>());
                const type = node.findChild(K.TYPE);
                if (!generated) {
                    const returned = type && this.type(type.qualifiedName || type.text);
                    const list = node.findChild(K.PARAMETER_LIST);
                    const parameters = list ? list.children.map(parameter => {
                        const value = parameter.findChild(K.NAME_TYPE_INIT), t = value && value.findChild(K.TYPE);
                        const name = value && value.findChild(K.NAME);
                        return {node:value, name:name && name.text, type:t ? this.resolve(t.qualifiedName || t.text) : '*',
                            exported:t && this.type(t.qualifiedName || t.text), optional:!!(value && value.findChild(K.INIT))};
                    }) : [];
                    if (returned || parameters.some(p => !!p.exported)) {
                        if (node.kind !== K.FUNCTION || node.findChild(K.NAME).text === this.owner.split('.').pop())
                            fail('reference constructor/accessor signatures require separate qualification');
                        if (returned && this.resolve(type.qualifiedName || type.text) === 'Date' && !nativeDate)
                            fail('Date reference requires its explicit native global binding');
                        const resultType = type && this.resolve(type.qualifiedName || type.text);
                        const builtinReturn = !returned && ['Number','int','uint','Boolean','String','Object','Array'].indexOf(resultType) >= 0 ? resultType : null;
                        if (type && !returned && !builtinReturn && ['void','*'].indexOf(resultType) < 0)
                            fail('non-reference return conversion in reference signatures requires qualification');
                        let optional = false;
                        parameters.forEach(p => {
                            if (!p.node) fail('reference signatures with rest parameters require qualification');
                            if (p.name === 'arguments') fail('shadowed arguments in reference signatures');
                            if (!p.exported && ['*','Number','int','uint','String'].indexOf(p.type) < 0)
                                fail('unqualified mixed reference parameter: ' + p.type);
                            if (optional && !p.optional) fail('required parameter follows optional parameter');
                            optional = optional || p.optional;
                            if (p.optional && (p.exported || p.type === '*')) {
                                const init = p.node.findChild(K.INIT);
                                if (!p.exported || source.slice(init.start,init.end).trim() !== 'null')
                                    fail('reference parameter default must be literal null');
                            }
                        });
                        this.signatures.set(node.start,{node,returned,builtinReturn,parameters,argumentsUsed:false});
                    }
                }
            }
            if (node.kind === K.NAME_TYPE_INIT) {
                const name = node.findChild(K.NAME).text, type = node.findChild(K.TYPE);
                const exported = type && this.type(type.qualifiedName || type.text);
                if (exported && this.resolve(type.qualifiedName || type.text) === 'Date' && !nativeDate)
                    fail('Date reference requires its explicit native global binding');
                if (exported && !fn && !generated) fail('reference field storage requires generated class registration');
                if (fn) {
                    const stringLocal = stringLocals && !generated && node.parent.kind !== K.PARAMETER
                        && type && this.resolve(type.qualifiedName || type.text) === 'String';
                    if (stringLocal) for (let parent = node.parent; parent && parent !== fn; parent = parent.parent) {
                        if (parent.kind === K.CATCH && parent.children.some(child => child.kind === K.NAME && child.text === name))
                            fail('String declaration shadows catch storage');
                    }
                    const scope = this.scopes.get(fn.start);
                    // Generated locals (including repeated declarations) belong to
                    // NativeTypedLocals; keep parameter storage conflicts here.
                    if (scope.has(name) && (scope.get(name) || (exported || stringLocal) && (!generated || node.parent.kind === K.PARAMETER)))
                        fail('duplicate local declaration requires default-order authority: ' + name);
                    if ((exported || stringLocal) && [K.CONST,K.CONST_LIST].indexOf(node.parent.kind) >= 0) fail('reference local constant lowering required');
                    let header = false;
                    for (let value = node; value && value !== fn; value = value.parent) {
                        const parent = value.parent;
                        if (parent && [K.FORIN,K.FOREACH].indexOf(parent.kind) >= 0 && parent.children[0] === value) header = true;
                    }
                    // Generated method storage is lowered once by NativeTypedLocals.
                    const local = (exported || stringLocal)&&(!generated||node.parent.kind===K.PARAMETER) ? {node, name, exported, header, parameter:node.parent.kind === K.PARAMETER, stringLocal} : null;
                    scope.set(name,local);
                    if (local) this.declarations.set(node.start,local);
                }
            }
            node.children.forEach(child => walk(child,fn));
        };
        walk(this.root,null);
        const guard = (node: Node): void => {
            const signature = this.signature(node);
            if (signature && node.kind === K.NAME_TYPE_INIT && node.findChild(K.NAME).text === 'arguments')
                fail('shadowed arguments in reference signatures');
            if (signature && node.kind === K.CATCH && node.children.some(child => child.kind === K.NAME && child.text === 'arguments'))
                fail('shadowed arguments in reference signatures');
            if (signature && node.kind === K.RETURN && (signature.returned || signature.builtinReturn) && !node.children.length)
                fail('bare reference return requires source authority');
            if (signature && node.kind === K.IDENTIFIER && node.text === 'arguments') {
                const parent = node.parent;
                const index = parent && parent.kind === K.ARRAY_ACCESSOR && parent.children[0] === node;
                const length = parent && parent.kind === K.DOT && parent.children[0] === node && parent.children[1].text === 'length';
                if (!index && !length) fail('escaping or method-valued arguments requires source Array qualification');
                const target = outerEncapsulatedExpression(parent), operation = target && target.parent;
                if (length && operation && operation.children[0] === target && [K.ASSIGN,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC,K.DELETE].indexOf(operation.kind) >= 0)
                    fail('arguments length mutation requires source Array qualification');
                if (index) {
                    const key = parent.children[1];
                    const literal = key && source.slice(key.start,key.end).trim();
                    if (!literal || !/^(0|[1-9][0-9]*)$/.test(literal))
                        fail('arguments indexing requires an exact nonnegative integer literal');
                    if (operation && operation.children[0] === target &&
                        [K.ASSIGN,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC,K.DELETE].indexOf(operation.kind) >= 0) {
                        const count = signature.parameters.filter(p => !p.optional).length;
                        if (operation.kind !== K.ASSIGN || operation.children[1].text !== '=' || Number(literal) >= count)
                            fail('arguments mutation requires an existing required entry and simple assignment');
                    }
                }
                signature.argumentsUsed = true;
            }
            if ([K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC,K.DELETE].indexOf(node.kind) >= 0) {
                const target = unwrapEncapsulatedExpression(node.children[0]);
                if (target && target.kind === K.IDENTIFIER && this.local(target,target.text)) fail('reference update/delete requires separate lowering');
            }
            if (node.kind === K.EXTENDS && this.sourceClass(node.qualifiedName || node.text) && !generated)
                fail('source reference ancestry requires generated class registration');
            if (node.kind === K.IMPLEMENTS_LIST && !generated && node.children.some(child =>
                !!this.sourceInterface(child.qualifiedName || child.text)))
                fail('source interface implementation requires generated class registration');
            if ([K.AS,K.RELATION].indexOf(node.kind) >= 0 && node.children.some(child =>
                child.kind === K.TYPE && !!this.type(child.qualifiedName || child.text)))
                fail('reference type operation requires class-evaluation authority');
            const nativeDateTest = nativeDate && node.kind === K.RELATION && node.children.some(child => child.text === 'is')
                && node.lastChild.kind === K.IDENTIFIER
                && this.resolve(node.lastChild.qualifiedName || node.lastChild.text) === 'Date'
                && options.plan.nativeBindings.some(binding => binding.qname === 'Date');
            const nativeXMLTest = generated && node.kind === K.RELATION && node.children.some(child => child.text === 'is')
                && node.lastChild.kind === K.IDENTIFIER && nativeXML.indexOf(this.resolve(node.lastChild.text)) >= 0
                && options.plan.nativeBindings.some(binding => binding.qname === this.resolve(node.lastChild.text));
            const nativeEventTest = nativeEvent && generated && node.kind === K.RELATION && node.children.some(child => child.text === 'is')
                && node.lastChild.kind === K.IDENTIFIER && this.resolve(node.lastChild.text) === 'flash.events.Event'
                && options.plan.nativeBindings.some(binding => binding.qname === 'flash.events.Event' && !!binding.eventBaseExport);
            const sourceAs = generated && node.kind===K.RELATION && node.children.length===3
                && node.children[1].kind===K.AS && node.lastChild.kind===K.IDENTIFIER
                && (this.sourceClass(node.lastChild.text) || !!this.sourceInterface(node.lastChild.text));
            const sourceIs = generated && node.kind===K.RELATION && node.children.length===3
                && node.children[1].text==='is' && node.lastChild.kind===K.IDENTIFIER
                && (!!this.sourceClass(node.lastChild.text) || !!this.nativeInterface(node.lastChild.text));
            const displayTest = nativeDisplayObject && generated && node.kind===K.RELATION && node.children.length===3
                && ['is','as'].indexOf(node.children[1].text)>=0 && node.lastChild.kind===K.IDENTIFIER
                && this.resolve(node.lastChild.text)==='flash.display.DisplayObject';
            if (node.kind === K.RELATION && node.children.some(child => child.text === 'as' || child.text === 'is')
                && this.type(node.lastChild.qualifiedName || node.lastChild.text) && !nativeDateTest && !nativeEventTest && !nativeXMLTest && !sourceAs && !sourceIs && !displayTest)
                fail('reference type operation requires class-evaluation authority');
            if (node.kind === K.DOT) {
                const qualified = (value: Node): string => value.kind === K.IDENTIFIER ? value.text
                    : value.kind === K.DOT && value.children[1].kind === K.LITERAL
                    ? qualified(value.children[0]) + '.' + value.children[1].text : '';
                const name = qualified(node);
                if (name && options.plan.bindings.some(binding => binding.qname === name))
                    fail('qualified reference class value requires source binding resolution');
            }
            if (node.kind === K.NEW) {
                const expression=unwrapEncapsulatedExpression(node.children[0]);
                const target=expression&&expression.kind===K.CALL?expression.children[0]:expression;
                if(target&&target.kind===K.IDENTIFIER&&this.sourceInterface(target.text))
                    fail('an interface token is not a source constructor');
            }
            node.children.forEach(guard);
        };
        guard(this.root);
    }
    signature(node: Node): ReferenceSignature {
        for (let value = node; value; value = value.parent) {
            if (functions.indexOf(value.kind) >= 0) return this.signatures.get(value.start);
        }
        return null;
    }
    type(name: string): string {
        if (!name) return null;
        const identity = this.resolve(name), plan = this.options.plan;
        const contract = plan.interfaces.find(binding => binding.qname === identity);
        if (contract) {
            // Ordinary method boundaries use the same authenticated nominal token.
            // This does not publish the consumer itself as an interface implementer.
            return contract.tokenExport;
        }
        const source = plan.bindings.find(binding => binding.qname === identity);
        const native = plan.nativeBindings.find(binding => binding.qname === identity);
        return source ? source.tokenExport : native ? native.referenceExport : null;
    }
    literalStaticConstant(name:string, member:string): {type:string; literal:string} {
        const identity=this.resolve(name),plan=this.options.plan;
        if(!plan.bindings.some(binding=>binding.qname===identity))return null;
        const input=nativeGeneratedDeclarationInputs(plan,plan.scope),source=input.sources[identity].source;
        let declaration=this.constantDeclarations.get(identity);
        if(!declaration){
            declaration=nativeGeneratedConsumerResolver(plan,source).root.findChild(K.PACKAGE).findChild(K.CONTENT).findChild(K.CLASS);
            this.constantDeclarations.set(identity,declaration);
        }
        for(const group of declaration.findChild(K.CONTENT).children){
            if(group.kind!==K.CONST_LIST)continue;
            const mods=group.findChild(K.MOD_LIST),flags=mods?mods.children.map(mod=>mod.text):[];
            if(flags.indexOf('public')<0||flags.indexOf('static')<0||flags.some(flag=>['public','static'].indexOf(flag)<0))continue;
            const value=group.findChildren(K.NAME_TYPE_INIT).find(field=>field.findChild(K.NAME).text===member);
            if(!value)continue;
            const type=value.findChild(K.TYPE),init=value.findChild(K.INIT);
            if(!type||!init||value.findChild(K.VECTOR))
                fail('consumer constant requires a primitive literal declaration');
            if(['String','Number','int','uint','Boolean'].indexOf(type.text)<0) {
                const reference=plan.references.find(item=>item.owner===identity&&item.start===type.start&&item.end===type.end);
                if(!this.generated||!reference||reference.kind!=='declaration'
                    &&!(reference.kind==='intrinsic'&&['Object','Array'].indexOf(reference.identity)>=0))
                    fail('consumer constant requires a primitive literal declaration');
                return {type:type.text,literal:null};
            }
            const end=(node:Node):number=>node.children.reduce((last,child)=>Math.max(last,end(child)),Math.max(node.start,node.end));
            const literal=source.slice(init.start,end(init)).trim();
            const uintOr=nativeUintOrConstants(declaration,source).constants[member];
            if(uintOr!==undefined)return {type:type.text,literal:uintOr};
            if(!/^(?:null|true|false|[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(literal) && !nativeNumericProductConstant(literal,type.text))
                fail('computed consumer constant requires initialization authority');
            return {type:type.text,literal:literal.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')};
        }
        return null;
    }
    publicStaticMethod(name:string,member:string):boolean {
        const identity=this.resolve(name),plan=this.options.plan;
        if(!plan.bindings.some(binding=>binding.qname===identity))return false;
        const input=nativeGeneratedDeclarationInputs(plan,plan.scope),source=input.sources[identity].source;
        let declaration=this.constantDeclarations.get(identity);
        if(!declaration){
            declaration=nativeGeneratedConsumerResolver(plan,source).root.findChild(K.PACKAGE).findChild(K.CONTENT).findChild(K.CLASS);
            this.constantDeclarations.set(identity,declaration);
        }
        return declaration.findChild(K.CONTENT).children.some(node=>{
            if(node.kind!==K.FUNCTION||node.findChild(K.NAME).text!==member)return false;
            const mods=node.findChild(K.MOD_LIST),flags=mods?mods.children.map(mod=>mod.text):[];
            return flags.indexOf('public')>=0&&flags.indexOf('static')>=0
                &&flags.every(flag=>['public','static','final'].indexOf(flag)>=0);
        });
    }
    sourceClass(name: string): boolean {
        const identity = this.resolve(name);
        return this.options.plan.bindings.some(binding => binding.qname === identity);
    }
    sourceInterface(name: string): string {
        const identity = this.resolve(name);
        const binding = this.options.plan.interfaces.find(item => item.qname === identity);
        return binding ? binding.tokenExport : this.nativeInterface(name);
    }
    nativeInterface(name: string): string {
        const identity = this.resolve(name);
        const native = this.options.plan.nativeBindings.find(item => item.qname === identity && item.nativeInterface);
        return native ? native.referenceExport : null;
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
