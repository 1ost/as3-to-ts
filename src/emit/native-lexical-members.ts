import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {nativeSourceTypeIdentity} from './native-source-type';
import {NativeTypedLocals} from './native-typed-locals';

export interface NativeLexicalTrait {
    name: string; visibility: 'private' | 'protected'; static: boolean;
    kind: 'variable' | 'method'; type?: string; parameterCount?: number;
    start: number; key: string; access: string;
}
/** Compiler-only source declaration plan. Names are resolved while AS3 scopes exist. */
export class NativeLexicalMembers {
    readonly traits: NativeLexicalTrait[] = [];
    readonly name: string;
    readonly qname: string;
    readonly scope: string;
    readonly provider: string;
    private owner: Node;
    readonly typedLocals: NativeTypedLocals;
    constructor(readonly source: string, root: Node, readonly module: string, metadata: any, typedLocals: boolean = false) {
        if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
            this.fail('explicit common lexical provider module required');
        const classes: Node[] = [];
        const walk = (n: Node): void => {if (!n) return; if (n.kind === K.CLASS) classes.push(n); n.children.forEach(walk);};
        walk(root);
        if (classes.length !== 1 || !metadata) this.fail('one authenticated source declaration required');
        this.owner = classes[0]; this.name = this.owner.findChild(K.NAME).text;
        const functionScope = (n: Node): void => {
            if (n.kind === K.LAMBDA || n.kind === K.FUNCTION && n.parent !== this.owner.findChild(K.CONTENT))
                this.fail('anonymous/nested function creation requires source script context');
            if ((n.kind === K.VAR_LIST || n.kind === K.CONST_LIST) && n.parent !== this.owner.findChild(K.CONTENT))
                n.findChildren(K.NAME_TYPE_INIT).forEach(value => {
                    const type=value.findChild(K.TYPE);
                    if(type&&type.text!=='*'&&!typedLocals)this.fail('typed local initialization/coercion held in lexical slice');
                });
            n.children.forEach(functionScope);
        };
        functionScope(this.owner);
        const pkg = root.findChild(K.PACKAGE), imports = pkg.findChild(K.CONTENT).findChildren(K.IMPORT).map(n => n.text);
        this.qname = pkg.findChild(K.NAME).text + '.' + this.name;
        const record = metadata.classes && metadata.classes[this.qname];
        if (!record || require('crypto').createHash('sha256').update(source).digest('hex') !== record.sourceSha256)
            this.fail('exact authenticated source bytes required');
        if (this.owner.findChild(K.EXTENDS) || this.owner.findChild(K.IMPLEMENTS_LIST)) this.fail('Object-root declaration required');
        if (typedLocals) this.typedLocals = new NativeTypedLocals(this.owner, this.qname, imports);
        this.scope = this.unique('scope'); this.provider = this.unique('provider');
        this.owner.findChild(K.CONTENT).children.forEach(member => {
            if ([K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(member.kind) < 0) return;
            const modifiers = this.modifiers(member);
            if (modifiers.some(m => ['public','private','protected','static','final'].indexOf(m) < 0)
                || !modifiers.some(m => ['public','private','protected'].indexOf(m) >= 0)) this.fail('internal/custom namespace/override declarations held');
            const lexical = modifiers.indexOf('private') >= 0 || modifiers.indexOf('protected') >= 0;
            if (member.kind === K.GET || member.kind === K.SET) this.fail('accessor entry and return semantics held');
            if (member.kind === K.CONST_LIST && lexical) this.fail('lexical const write protection held');
            const declarations = member.kind === K.VAR_LIST || member.kind === K.CONST_LIST ? member.findChildren(K.NAME_TYPE_INIT) : [member];
            declarations.forEach(declaration => {
                const name = declaration.findChild(K.NAME).text;
                if (member.kind === K.FUNCTION && name === this.name) return;
                let type: string, parameterCount: number;
                if (member.kind === K.FUNCTION) {
                    const returnType = declaration.findChild(K.TYPE);
                    if (returnType && returnType.text !== '*') this.fail('typed and void method returns held');
                    const parameters = declaration.findChild(K.PARAMETER_LIST).children;
                    parameters.forEach(parameter => {
                        const p = parameter.findChild(K.NAME_TYPE_INIT);
                        if (!p || parameter.findChild(K.REST)) this.fail('rest method parameters held');
                        const type = p.findChild(K.TYPE);
                        if (type && type.text !== '*') this.fail('typed method parameter entry held');
                        if (p.findChild(K.INIT)) this.fail('optional method defaults held');
                    });
                    parameterCount = parameters.length;
                } else type = nativeSourceTypeIdentity(declaration.findChild(K.TYPE), this.qname, imports);
                if (!lexical) return;
                if (member.kind !== K.VAR_LIST && member.kind !== K.FUNCTION) this.fail('unsupported lexical declaration kind');
                if (type && ['*','int','uint','Number','Boolean','String','Object','Function','Array'].indexOf(type) < 0)
                    this.fail('lexical foreign reference type held');
                const isStatic = modifiers.indexOf('static') >= 0;
                if (this.traits.some(t => t.name === name && t.static === isStatic)) this.fail('ambiguous lexical declaration');
                const index = this.traits.length;
                this.traits.push({name, visibility:modifiers.indexOf('private') >= 0 ? 'private' : 'protected',static:isStatic,
                    kind:member.kind === K.FUNCTION ? 'method' : 'variable',type,parameterCount,start:member.start,
                    key:this.unique('key'+index),access:this.unique('access'+index)});
            });
        });
        this.checkLocalMemberCollisions();
    }
    /** Hoisted JS locals cannot represent every original member/local lookup. */
    private checkLocalMemberCollisions(): void {
        const content = this.owner.findChild(K.CONTENT), names: string[] = [];
        content.children.forEach(member => {
            if ([K.VAR_LIST,K.CONST_LIST].indexOf(member.kind) >= 0)
                member.findChildren(K.NAME_TYPE_INIT).forEach(value => names.push(value.findChild(K.NAME).text));
            else if ([K.FUNCTION,K.GET,K.SET].indexOf(member.kind) >= 0)
                names.push(member.findChild(K.NAME).text);
        });
        content.findChildren(K.FUNCTION).forEach(method => {
            const body = method.findChild(K.BLOCK);
            if (!body) return;
            const locals: Node[] = [];
            const collect = (node: Node): void => {
                if ([K.VAR_LIST,K.CONST_LIST,K.VAR,K.CONST].indexOf(node.kind) >= 0)
                    node.findChildren(K.NAME_TYPE_INIT).forEach(value => {
                        if (names.indexOf(value.findChild(K.NAME).text) >= 0) locals.push(value);
                    });
                node.children.forEach(collect);
            };
            collect(body);
            locals.forEach(local => {
                const name = local.findChild(K.NAME).text;
                // Keep only an unconditional initialized declaration with no earlier
                // implicit lookup. Conditional execution and self-initializers need
                // their own source-proven scope lowering; reject the complete class.
                if (local.parent.kind !== K.VAR_LIST || local.parent.parent !== body || !local.findChild(K.INIT)
                    || locals.filter(value => value.findChild(K.NAME).text === name).length !== 1)
                    this.fail('member/local declaration-order lookup held');
                const check = (node: Node): void => {
                    if (node.start >= local.end) return;
                    if (node.kind === K.IDENTIFIER && node.text === name
                        && !(node.parent && node.parent.kind === K.DOT && node.parent.children[1] === node))
                        this.fail('member/local declaration-order lookup held');
                    node.children.forEach(check);
                };
                check(body);
            });
        });
    }
    fail(reason: string): never {throw new Error('AS3_LEXICAL_COMPILER_UNSUPPORTED: ' + reason);}
    private modifiers(node: Node): string[] {const mods=node.findChild(K.MOD_LIST);return mods ? mods.children.map(n=>n.text) : [];}
    private unique(label: string): string {let name='__as3_lexical_'+label;while(this.source.indexOf(name)>=0)name+='_';return name;}
    trait(name: string, isStatic: boolean): NativeLexicalTrait {return this.traits.find(t=>t.name===name&&t.static===isStatic);}
    proves(member: Node): boolean {return this.traits.some(t=>t.start===member.start);}
    /** Mark exact lexical references; generic operations consume these compiler-private keys. */
    emit(emitter: any, node: Node, visit: (emitter: any, node: Node)=>void): boolean {
        let receiver: Node, trait: NativeLexicalTrait;
        const nearestMethod=():Node=>{for(let n=node.parent;n;n=n.parent)if(n.parent===this.owner.findChild(K.CONTENT))return n;return null;};
        const staticContext=()=>{const m=nearestMethod();return m&&this.modifiers(m).indexOf('static')>=0;};
        if (node.kind===K.DOT) {
            const name=node.children[1].text;
            if(!this.traits.some(t=>t.name===name))return false;
            receiver=unwrapEncapsulatedExpression(node.children[0]);
            if(receiver.kind!==K.IDENTIFIER)return false;
            const binding=emitter.findDefInScope(receiver.text);
            if(receiver.text==='this') {
                if(staticContext())this.fail('this in static source method');
                trait=this.trait(name,false);
                if(!trait)this.fail('static lexical declaration through instance receiver');
            } else if(receiver.text===this.name&&(!binding||binding.bound||!Object.prototype.hasOwnProperty.call(binding,'as3Type'))) {
                trait=this.trait(name,true);
                if(!trait)this.fail('instance lexical declaration through Class receiver');
            }
            else if(binding&&(binding.type===this.name||binding.type===this.qname))trait=this.trait(name,false);
            else if(binding&&binding.type&&['any','Object','*'].indexOf(binding.type)<0)
                this.fail('typed foreign receiver requires exact source member authority');
            if(!trait)return false;
        } else if(node.kind===K.IDENTIFIER) {
            if(node.parent&&node.parent.kind===K.DOT&&node.parent.children[0]!==node)return false;
            const binding=emitter.findDefInScope(node.text);
            if(binding&&!binding.bound)return false;
            const instance=this.trait(node.text,false),statics=this.trait(node.text,true);
            if(instance&&statics)this.fail('ambiguous implicit static/instance lookup');
            trait=instance||statics;if(!trait)return false;
            if(!trait.static&&staticContext())this.fail('instance lexical member in static source method');
        } else return false;
        let reference:Node=node;
        while(reference.parent&&reference.parent.kind===K.ENCAPSULATED)reference=reference.parent;
        if(reference.parent&&[K.DELETE,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC].indexOf(reference.parent.kind)>=0)
            this.fail('lexical delete/update operation held');
        if(reference.parent&&reference.parent.kind===K.ASSIGN&&reference.parent.children[0]===reference) {
            if(trait.kind==='method')this.fail('source method assignment held');
            if(reference.parent.children[1].text!=='=')this.fail('lexical compound assignment held');
        }
        emitter.catchup(node.start);
        if(receiver){visit(emitter,node.children[0]);emitter.catchup(node.children[0].end);}
        else emitter.insert(trait.static ? emitter.classFactory.value : 'this');
        emitter.insert('['+trait.key+']');emitter.skipTo(node.end);return true;
    }
}
