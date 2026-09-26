import {NativeTypedLocals, NestedLocalFunction} from './native-typed-locals';
import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs, nativeGeneratedConsumerResolver, nativeGeneratedDeclarationNode} from './native-generated-declarations';
import {NativeGeneratedClassTraits} from './native-generated-traits';

interface Trait {
    name: string; visibility: string; static: boolean; kind: 'variable' | 'constant' | 'method' | 'accessor';
    owner: string; node: Node; type: Node; key: string; access: string; parameterCount: number;
}
function inputPackageEnabled(plan:NativeGeneratedDeclarationPlan):boolean{return !!nativeGeneratedDeclarationInputs(plan,plan.scope).lexicalProviderModule;}
function fail(reason: string): never {throw new Error('AS3_GENERATED_LEXICAL_UNSUPPORTED: ' + reason);}
function packageOf(name:string):string {const split=name.lastIndexOf('.');return split<0?'':name.slice(0,split);}
function modifiers(node: Node): string[] {const mods=node.findChild(K.MOD_LIST);return mods ? mods.children.map(n=>n.text) : [];}

/** Resolve lexical declarations while AS3 scopes still exist; runtime dispatch
 * remains in the common AS3LexicalMembers provider. */
export class NativeGeneratedLexical {
    readonly traits: Trait[] = [];
    readonly own: Trait[] = [];
    readonly provider: string;
    readonly scope: string;
    readonly scriptGlobal: string;
    readonly ownClass: Node;
    readonly typedLocals: NativeTypedLocals;
    readonly nestedFunctions: NestedLocalFunction[] = [];
    readonly finallyMarkers: {start:number;end:number;name:string}[] = [];
    readonly anonymousFunctions: {start:number;end:number;methodStart:number;name:string;parameters:string[];returned?:string}[] = [];
    readonly resolveTypeName:(name:string)=>string;
    private readonly internalContents=new Map<string,Node>();
    private internalContent(owner:string):Node {
        if(!this.internalContents.has(owner)){
            this.internalContents.set(owner,nativeGeneratedDeclarationNode(this.plan,owner).findChild(K.CONTENT));
        }
        return this.internalContents.get(owner);
    }
    private internalMethod(owner:string,member:Node):boolean {
        if(member.kind!==K.FUNCTION||modifiers(member).indexOf('static')>=0)return false;
        const parameters=member.findChild(K.PARAMETER_LIST).children,returned=member.findChild(K.TYPE);
        if(!returned||['Boolean','void'].indexOf(returned.text)<0)return false;
        if(parameters.length===0)return returned.text==='void';
        if(parameters.length!==1)return false;
        const value=parameters[0].findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
        if(!type||value.findChild(K.INIT)||parameters[0].findChild(K.REST))return false;
        return this.plan.references.some(r=>r.owner===owner&&r.start===type.start&&r.end===type.end
            &&(r.kind==='interface'||r.kind==='native'&&this.plan.nativeBindings.some(b=>b.qname===r.identity&&b.nativeInterface)));
    }
    private readonly foreignPublicMembers = new Map<string, ReadonlyArray<{readonly name:string;readonly kind:string}>>();
    constructor(readonly plan: NativeGeneratedDeclarationPlan, readonly owner: string, source: string, typedLocals = false) {
        const input=nativeGeneratedDeclarationInputs(plan,plan.scope);
        this.resolveTypeName=nativeGeneratedConsumerResolver(plan,source).resolve;
        let serial=0;
        const fresh=(label:string):string=>{let value:string;do{value='__as3_generated_'+label+'_'+serial++;}while(source.indexOf(value)>=0);return value;};
        this.provider=fresh('lexicalProvider');this.scope=fresh('lexicalScope');
        this.scriptGlobal=fresh('scriptGlobal');
        const overridden = new Set<Trait>();
        const signature=(trait:Trait):string=>JSON.stringify(trait.node.findChild(K.PARAMETER_LIST).children.map(p=>{
            const value=p.findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
            const ref=type&&plan.references.find(r=>r.owner===trait.owner&&r.start===type.start&&r.end===type.end);
            return [ref?ref.identity:'*',!!(value&&value.findChild(K.INIT)),!!p.findChild(K.REST)];
        }));
        const collect=(name:string, inherited:boolean):void=>{
            const cls=nativeGeneratedDeclarationNode(plan,name);
            if(!inherited)(this as any).ownClass=cls;
            cls.findChild(K.CONTENT).children.forEach(member=>{
                if([K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(member.kind)<0)return;
                const mods=modifiers(member), visibility=mods.indexOf('public')>=0?'public':mods.indexOf('private')>=0?'private':mods.indexOf('protected')>=0?'protected':'internal';
                if(visibility==='public'||inherited&&visibility==='private')return;
                if(visibility==='internal'){
                    if(!input.lexicalProviderModule)fail('internal namespace storage authority');
                    if(mods.some(mod=>['internal','static'].indexOf(mod)<0 && !(mod==='override' && [K.GET,K.FUNCTION].indexOf(member.kind)>=0)))fail('custom namespace is not package-internal storage');
                    if(inherited&&packageOf(name)!==packageOf(owner))return;
                }
                const isStatic=mods.indexOf('static')>=0;
                const constant=member.kind===K.CONST_LIST&&(visibility==='protected'||visibility==='private'&&isStatic||visibility==='internal'&&isStatic);
                if(isStatic && member.kind!==K.VAR_LIST&&!constant&&(visibility!=='private'||member.kind!==K.FUNCTION))fail('static lexical initialization lowering required');
                if(inherited&&visibility==='internal'&&isStatic)return;
                const inheritedPrimitives=visibility==='protected'&&member.kind===K.VAR_LIST
                    &&member.findChildren(K.NAME_TYPE_INIT).every(node=>node.findChild(K.TYPE)&&['String','Boolean'].indexOf(node.findChild(K.TYPE).text)>=0);
                if(inherited&&isStatic&&(!constant&&!inheritedPrimitives||name!==plan.bindings.find(b=>b.qname===owner).base))fail('inherited static lexical ownership');
                const internalMethod=visibility==='internal'&&this.internalMethod(name,member);
                if(visibility==='internal'&&member.kind===K.FUNCTION&&!internalMethod)
                    fail('internal instance method requires zero parameters and void return or one authenticated interface parameter and Boolean/void return');
                const internalGetter=visibility==='internal'&&!isStatic&&member.kind===K.GET
                    &&member.findChild(K.TYPE)&&member.findChild(K.TYPE).text==='Boolean'
                    &&member.findChild(K.PARAMETER_LIST).children.length===0;
                if(member.kind!==K.VAR_LIST&&member.kind!==K.FUNCTION&&!constant&&!internalGetter)fail('lexical constant/accessor lowering required');
                const declarations=member.kind===K.VAR_LIST||constant?member.findChildren(K.NAME_TYPE_INIT):[member];
                declarations.forEach(node=>{
                    const local=node.findChild(K.NAME).text;
                    const previous=this.traits.find(t=>t.name===local&&t.static===isStatic);
                    if(previous) {
                        if(inherited&&previous.visibility==='internal'&&visibility==='internal'&&previous.kind==='accessor'&&internalGetter) {
                            if(modifiers(previous.node).indexOf('override')<0)fail('internal getter override requires source override');
                            overridden.add(previous);return;
                        }
                        if(inherited&&previous.visibility===visibility&&(visibility==='protected'||visibility==='internal'&&internalMethod)&&previous.kind==='method'&&member.kind===K.FUNCTION) {
                            const ancestor={owner:name,node} as Trait;
                            if(modifiers(previous.node).indexOf('override')<0 || mods.indexOf('final')>=0 || signature(previous)!==signature(ancestor)
                                ||visibility==='internal'&&previous.type.text!==member.findChild(K.TYPE).text)
                                fail('protected override requires matching source signature');
                            overridden.add(previous);return;
                        }
                        fail('ambiguous lexical declaration: '+local);
                    }
                    const vector=node.findChild(K.VECTOR);
                    if(vector&&(isStatic||['private','protected'].indexOf(visibility)<0||member.kind!==K.VAR_LIST
                        ||!plan.vectors.some(v=>v.owner===name&&v.start===vector.start&&v.end===vector.end)))
                        fail('lexical vector storage authority');
                    const trait:Trait={name:local,visibility,static:isStatic,kind:member.kind===K.VAR_LIST?'variable':constant?'constant':internalGetter?'accessor':'method',owner:name,node,
                        type:vector||node.findChild(K.TYPE),key:fresh('key'),access:fresh('access'),parameterCount:member.kind===K.FUNCTION?node.findChild(K.PARAMETER_LIST).children.filter(p=>!p.findChild(K.REST)).length:0};
                    if(visibility==='internal'&&!internalGetter&&!internalMethod&&!(trait.type&&trait.type.text==='uint'
                        &&(trait.kind==='variable'&&!isStatic||trait.kind==='constant'&&isStatic)))fail('internal uint field/static constant required');
                    if(visibility==='internal'&&trait.kind==='variable')this.earlyInstanceValue(trait);
                    if(constant)this.constantValue(trait);
                    this.traits.push(trait);if(!inherited)this.own.push(trait);
                });
            });
            const binding=plan.bindings.find(b=>b.qname===name);
            if(binding.base&&input.sources[binding.base])collect(binding.base,true);
        };
        collect(owner,false);
        this.own.forEach(trait=>{if(modifiers(trait.node).indexOf('override')>=0&&!overridden.has(trait))fail('protected override has no source ancestor');});
        const content=this.ownClass.findChild(K.CONTENT);
        const memberNames:string[]=[];
        content.children.forEach(member=>{
            if([K.VAR_LIST,K.CONST_LIST].indexOf(member.kind)>=0)member.findChildren(K.NAME_TYPE_INIT).forEach(v=>memberNames.push(v.findChild(K.NAME).text));
            else if(member.findChild(K.NAME))memberNames.push(member.findChild(K.NAME).text);
        });
        const forInTarget=(node:Node):void=>{
            if(node.kind!==K.FORIN)return;
            const target=node.children[0].children[0];
            if(!target||target.kind!==K.IDENTIFIER)fail('for-in requires an existing wildcard slot');
            for(let scope=node.parent;scope;scope=scope.parent){
                if(scope.kind===K.CATCH&&scope.findChild(K.NAME).text===target.text)fail('catch-shadow for-in target held');
                if([K.FUNCTION,K.LAMBDA,K.GET,K.SET].indexOf(scope.kind)<0)continue;
                const declarations:Node[]=[];
                scope.findChild(K.PARAMETER_LIST).children.forEach(p=>{const d=p.findChild(K.NAME_TYPE_INIT);if(d)declarations.push(d);});
                const collect=(n:Node):void=>{if([K.FUNCTION,K.LAMBDA,K.GET,K.SET].indexOf(n.kind)>=0)return;if([K.VAR_LIST,K.CONST_LIST,K.VAR,K.CONST].indexOf(n.kind)>=0)declarations.push(...n.findChildren(K.NAME_TYPE_INIT));n.children.forEach(collect);};collect(scope.findChild(K.BLOCK));
                const slot=declarations.find(d=>d.findChild(K.NAME).text===target.text);
                if(slot){if(slot.findChild(K.TYPE)&&['*','String','Object'].indexOf(slot.findChild(K.TYPE).text)<0)fail('typed for-in target held');return;}
            }
            fail('for-in target has no source local ownership');
        };
        const check=(node:Node):void=>{
            forInTarget(node);
            if(node.kind===K.FINALLY){const block=node.findChild(K.BLOCK);this.finallyMarkers.push({start:block.start,end:block.end,name:fresh("sourceFinally")});}
            if(node.kind===K.LAMBDA){
                if(node.findChild(K.VECTOR))fail('anonymous Vector return held');
                let method=node.parent;while(method&&method.parent!==content)method=method.parent;
                if(!typedLocals||!method||method.kind!==K.FUNCTION||!plan.bindings.find(b=>b.qname===owner).scriptGlobalExport)
                    fail('anonymous source callable requires source script global');
                for(let p=node.parent;p&&p!==method;p=p.parent)if([K.LAMBDA,K.FUNCTION,K.CATCH].indexOf(p.kind)>=0)fail('nested anonymous callable scope held');
                const parameters=node.findChild(K.PARAMETER_LIST).children.map(p=>{
                    const value=p.findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
                    if(!value||value.findChild(K.INIT)||value.findChild(K.VECTOR)||type&&type.text!=='*')fail('anonymous callable requires wildcard parameters');
                    return value.findChild(K.NAME).text;
                });
                const returned=node.findChild(K.TYPE),returnType=returned&&this.resolveTypeName(returned.text);
                if(returned&&['*','void','Object'].indexOf(returnType)<0)fail('anonymous typed return held');
                const outerNames:string[]=[];
                const outer=(n:Node):void=>{if(n.kind===K.LAMBDA||n.kind===K.FUNCTION&&n!==method)return;if(n.kind===K.NAME_TYPE_INIT)outerNames.push(n.findChild(K.NAME).text);n.children.forEach(outer);};outer(method);
                const inspect=(n:Node):void=>{
                    forInTarget(n);
                    if(returnType==='Object'&&n.kind===K.RETURN&&!n.children.length)fail('anonymous typed bare return held');
                    if(n.kind===K.DOT&&n.children[0].kind===K.IDENTIFIER&&n.children[0].text==='this')fail('anonymous receiver property access held');
                    if([K.LAMBDA,K.FUNCTION,K.TRY].indexOf(n.kind)>=0)fail('nested anonymous callable body held');
                    if(n.kind===K.IDENTIFIER&&['super','arguments'].concat(memberNames).indexOf(n.text)>=0)fail('anonymous callable receiver/member lookup held');
                    if([K.VAR_LIST,K.CONST_LIST].indexOf(n.kind)>=0)n.findChildren(K.NAME_TYPE_INIT).forEach(v=>{
                        if(outerNames.indexOf(v.findChild(K.NAME).text)>=0)fail('anonymous local shadows outer storage');
                        const t=v.findChild(K.TYPE);if(n.kind===K.CONST_LIST||v.findChild(K.VECTOR)||t&&t.text!=='*')fail('anonymous typed local held');
                    });
                    n.children.forEach(inspect);
                };inspect(node.findChild(K.BLOCK));
                this.anonymousFunctions.push({start:node.start,end:node.end,methodStart:method.start,name:fresh('anonymous'),parameters,returned:returnType});
                return;
            }
            if(node.kind===K.FUNCTION&&node.parent!==content){
                const method=node.parent&&node.parent.parent;
                const header=source.slice(node.start,node.findChild(K.PARAMETER_LIST).start);
                const name=/^function\s+([A-Za-z_$][\w$]*)\s*$/.exec(header);
                if(!typedLocals||!method||method.kind!==K.FUNCTION||method.parent!==content||!name)
                    fail('nested source callable context lowering required');
                const parameters=node.findChild(K.PARAMETER_LIST).children.map(p=>{
                    const value=p.findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
                    if(!value||value.findChild(K.INIT)||value.findChild(K.VECTOR)||type&&type.text!=='*')
                        fail('nested callable requires fixed wildcard parameters');
                    return value.findChild(K.NAME).text;
                });
                const returned=node.findChild(K.TYPE),ref=returned&&plan.references.find(r=>r.owner===owner&&r.start===returned.start&&r.end===returned.end);
                if(returned&&['*','void'].indexOf(returned.text)<0&&(!ref||ref.kind!=='interface'))
                    fail('nested callable return conversion requires authority');
                const bodyCheck=(value:Node):void=>{
                    if([K.FUNCTION,K.LAMBDA,K.VAR_LIST,K.CONST_LIST,K.VAR,K.CONST,K.TRY].indexOf(value.kind)>=0)
                        fail('nested callable declarations or exception regions held');
                    if(value.kind===K.IDENTIFIER&&(['this','super','arguments'].indexOf(value.text)>=0||memberNames.indexOf(value.text)>=0||this.traits.some(t=>t.name===value.text)))
                        fail('nested callable receiver/context access held');
                    value.children.forEach(bodyCheck);
                };bodyCheck(node.findChild(K.BLOCK));
                if(ref&&ref.kind==='interface'){
                    const body=node.findChild(K.BLOCK),last=body.children.filter(n=>[K.STMT_EMPTY,K.MULTI_LINE_COMMENT,K.AS_DOC].indexOf(n.kind)<0).pop();
                    if(!last||last.kind!==K.RETURN)fail('nested typed fallthrough completion held');
                }
                this.nestedFunctions.push({start:node.start,end:node.end,name:name[1],methodStart:method.start,parameters,returned:ref&&ref.kind==='interface'?ref.identity:undefined});
            }
            if(node.kind===K.FUNCTION&&node.findChild(K.VECTOR)
                || node.kind===K.PARAMETER&&node.findChild(K.NAME_TYPE_INIT)&&node.findChild(K.NAME_TYPE_INIT).findChild(K.VECTOR)){
                const vector=node.findChild(K.VECTOR)||node.findChild(K.NAME_TYPE_INIT).findChild(K.VECTOR);
                if(node.kind===K.PARAMETER&&node.parent&&node.parent.parent&&node.parent.parent.kind===K.FUNCTION
                    &&node.parent.parent.findChild(K.NAME).text===this.ownClass.findChild(K.NAME).text)
                    fail('Vector constructor parameter lowering requires separate qualification');
                if(!plan.vectors.some(v=>v.owner===owner&&v.start===vector.start&&v.end===vector.end))
                    fail('vector callable signature lowering required');
                if(node.kind===K.FUNCTION&&node.parent!==content)fail('nested Vector callable held');
            }
            if([K.VAR_LIST,K.CONST_LIST].indexOf(node.kind)>=0&&node.parent!==content)node.findChildren(K.NAME_TYPE_INIT).forEach(value=>{
                const type=value.findChild(K.VECTOR)||value.findChild(K.TYPE);
                let member=node;while(member.parent&&member.parent!==content)member=member.parent;
                if(type&&type.text!=='*'&&(!typedLocals||[K.FUNCTION,K.GET,K.SET].indexOf(member.kind)<0))fail('typed local initialization/coercion lowering required');
                if(typedLocals&&type&&type.text!=='*'){
                    const vector=type.kind===K.VECTOR&&plan.vectors.find(v=>v.owner===owner&&v.start===type.start&&v.end===type.end);
                    const ref=plan.references.find(r=>r.owner===owner&&r.start===type.start&&r.end===type.end);
                    if(!vector&&(!ref||(ref.kind!=='intrinsic'&&ref.kind!=='interface'&&ref.kind!=='declaration'&&ref.kind!=='native'&&ref.kind!=='pattern-local'&&ref.kind!=='tween-handle-local')))fail('typed local source reference lowering required');
                }
                if(this.traits.some(t=>t.name===value.findChild(K.NAME).text))fail('local/lexical declaration-order lookup required');
            });
            if(node.kind===K.IDENTIFIER&&node.text==='arguments'){
                let member=node;while(member.parent&&member.parent!==content)member=member.parent;
                if(!member.findChild(K.NAME)||member.findChild(K.NAME).text!==this.ownClass.findChild(K.NAME).text)
                    fail('method arguments source Array lowering required');
            }
            node.children.forEach(check);
        };
        check(content);
        this.nestedFunctions.forEach(fn=>{
            const method=content.findChildren(K.FUNCTION).find(m=>m.start===fn.methodStart);
            const duplicates=this.nestedFunctions.filter(f=>f.methodStart===fn.methodStart&&f.name===fn.name);
            if(duplicates.length!==1||fn.parameters.indexOf(fn.name)>=0)fail('nested callable name ownership');
            const uses=(node:Node):void=>{
                if(node.kind===K.NAME&&node.text===fn.name)fail('nested callable name shadows a declaration');
                if(node.kind===K.IDENTIFIER&&node.text===fn.name){
                    const parent=node.parent;
                    if(parent.kind!==K.CALL||parent.children[0]!==node||parent.parent&&parent.parent.kind===K.NEW||parent.children[1].children.length!==fn.parameters.length)
                        fail('nested callable requires direct exact-arity calls');
                }
                node.children.forEach(uses);
            };uses(method);
        });
        // This independently parsed tree is authenticated against the exact source.
        // Method spans join it to the emitter tree without weakening legacy identity.
        if(typedLocals)this.typedLocals=new NativeTypedLocals(this.ownClass,owner,[],node=>{
            const vector=node&&node.kind===K.VECTOR&&plan.vectors.find(v=>v.owner===owner&&v.start===node.start&&v.end===node.end);
            if(vector)return vector.identity;
            const ref=node&&plan.references.find(r=>r.owner===owner&&r.start===node.start&&r.end===node.end);
            return ref&&(ref.kind==='interface'||ref.kind==='declaration'||ref.kind==='native')?ref.identity:undefined;
        },true,this.nestedFunctions,this.anonymousFunctions,node=>plan.patternLocals.some(p=>p.owner===owner&&p.typeStart===node.start&&p.typeEnd===node.end),
            node=>plan.references.some(r=>r.owner===owner&&r.start===node.start&&r.end===node.end&&r.kind==='tween-handle-local'));
    }
    trait(name:string,isStatic:boolean):Trait{return this.own.find(t=>t.name===name&&t.static===isStatic);}
    constantValue(trait:Trait):string {
        const init=trait.node.findChild(K.INIT);
        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
        const end=(node:Node):number=>node.children.reduce((value,child)=>Math.max(value,end(child)),node.end);
        const value=init&&input.sources[trait.owner].source.slice(init.start,end(init)).trim();
        const type=trait.type&&trait.type.text;
        if(trait.visibility==='internal'&&trait.static&&type==='uint'&&value&&/^(?:0[xX][0-9a-fA-F]+|0|[1-9]\d*)$/.test(value)
            &&Number(value)<=4294967295)return String(Number(value));
        if(trait.kind==='constant'&&(trait.visibility==='protected'||trait.visibility==='private'&&trait.static&&(type==='String'||type==='int'))&&value
            &&(type==='String'&&/^(?:"(?:[^"\\\r\n]|\\[^\r\n])*"|'(?:[^'\\\r\n]|\\[^\r\n])*')$/.test(value)
                ||type==='int'&&(!trait.static||trait.visibility==='private')&&/^[+-]?(?:0|[1-9]\d*)$/.test(value)&&Number(value)>=-2147483648&&Number(value)<=2147483647))
            return type==='int'?String(Number(value)):value.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        return fail('protected String/instance int or private static String/int literal constant required');
    }
    earlyInstanceValue(trait:Trait):string|undefined {
        if(trait.visibility!=='internal'||trait.static||trait.kind!=='variable')return undefined;
        const init=trait.node.findChild(K.INIT);if(!init)return '0';
        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
        const end=(node:Node):number=>node.children.reduce((n,child)=>Math.max(n,end(child)),node.end);
        const value=input.sources[trait.owner].source.slice(init.start,end(init)).trim();
        if(/^(?:0[xX][0-9a-fA-F]+|0|[1-9]\d*)$/.test(value)&&Number(value)<=4294967295)return String(Number(value));
        return fail('internal uint field initializer requires qualified literal');
    }
    earlyStaticValue(trait:Trait):string|undefined {
        if(!trait.static||trait.kind!=='variable')return undefined;
        const init=trait.node.findChild(K.INIT);if(!init)return undefined;
        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
        const end=(node:Node):number=>node.children.reduce((value,child)=>Math.max(value,end(child)),node.end);
        const value=input.sources[trait.owner].source.slice(init.start,end(init)).trim();
        if(value==='null')return 'null';
        if(/^[+-]?\d+$/.test(value)&&trait.type&&trait.type.text==='int'&&Number(value)>=-2147483648&&Number(value)<=2147483647)return value;
        if(['protected','private'].indexOf(trait.visibility)>=0&&trait.type&&trait.type.text==='String'
            &&/^(?:"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(value))
            return value.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        if(trait.visibility==='private'&&trait.type){
            if(trait.type.text==='Boolean'&&/^(true|false)$/.test(value))return value;
            // Retain literal spelling (especially -0); reject legacy octal,
            // nonfinite literals and executable expressions until qualified.
            if(trait.type.text==='Number'&&/^(?:0[xX][0-9a-fA-F]+|[+-]?(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.test(value)
                &&isFinite(Number(value)))return value;
        }
        const expression=unwrapEncapsulatedExpression(init.children[0]);
        if(trait.visibility==='protected'&&trait.type&&trait.type.text==='Boolean'){
            if(/^(true|false)$/.test(value))return value;
            // Computed values execute in cinit after default storage publication;
            // literal Booleans above are trait values visible before cinit.
            if(expression&&[K.CALL,K.RELATION,K.EQUALITY,K.AND].indexOf(expression.kind)>=0)return undefined;
        }
        // A call initializer runs in cinit after default storage publication;
        // unlike an int literal it is not an early trait value.
        if(trait.visibility==='private'&&trait.type&&trait.type.text==='int'&&expression&&expression.kind===K.CALL)return undefined;
        if(trait.type&&['int','uint','Number','Boolean','String','*'].indexOf(trait.type.text)>=0)
            fail('static lexical primitive initializer requires qualification');
        if(!expression||[K.ARRAY,K.CALL,K.NEW,K.DOT,K.IDENTIFIER].indexOf(expression.kind)<0
            ||expression.kind===K.IDENTIFIER&&['true','false','undefined','NaN','Infinity'].indexOf(expression.text)>=0)
            fail('static lexical literal storage requires qualification');
        return undefined;
    }
    typeExpression(node:Node,owner:string,domain:string,array:string):string {
        if(!node)return '"*"';
        if(node.kind===K.VECTOR){
            const vector=this.plan.vectors.find(v=>v.owner===owner&&v.start===node.start&&v.end===node.end);
            if(!vector)fail('exact Vector specialization required');
            return '{name:'+JSON.stringify(vector.name)+',vector:'+domain+'.'+vector.specExport+'}';
        }
        const ref=this.plan.references.find(r=>r.owner===owner&&r.start===node.start&&r.end===node.end);
        if(!ref)fail('exact lexical type span');
        if(ref.kind==='intrinsic') {
            if(ref.identity==='Array')return '{name:"Array",reference:'+array+'}';
            if(['*','int','uint','Number','Boolean','String','Object','Function'].indexOf(ref.identity)<0)fail('unsupported lexical intrinsic '+ref.identity);
            return JSON.stringify(ref.identity);
        }
        const binding=ref.kind==='declaration'&&this.plan.bindings.find(b=>b.qname===ref.identity);
        const contract=ref.kind==='interface'&&this.plan.interfaces.find(b=>b.qname===ref.identity);
        const native=ref.kind==='native'&&this.plan.nativeBindings.find(b=>b.qname===ref.identity);
        if(!binding&&!contract&&!native)fail('unresolved lexical reference '+ref.sourceName);
        return '{name:'+JSON.stringify(ref.identity.replace(/\.([^.]*)$/,'::$1'))+',reference:'+domain+'.'+(binding?binding.tokenExport:contract?contract.tokenExport:native.referenceExport)+'}';
    }
    publication(name:string,base:string,domain:string,intrinsic:string):string {
        const own=this.plan.bindings.find(b=>b.qname===this.owner),parent=own.base&&this.plan.bindings.find(b=>b.qname===own.base);
        const native=own.base&&this.plan.nativeBindings.find(b=>b.qname===own.base&&!!b.nativeBaseExport);
        const traits=this.own.map(t=>'{name:'+JSON.stringify(t.name)+',visibility:'+JSON.stringify(t.visibility)+',static:'+t.static+',kind:'+JSON.stringify(t.kind)
            +(this.earlyInstanceValue(t)!==undefined?',initialValue:'+this.earlyInstanceValue(t):'')
            +(t.kind==='accessor'?',key:'+t.key+',getter:true,setter:false':'')
            +(t.kind!=='method'?',type:'+this.typeExpression(t.type,t.owner,domain,intrinsic+'.array')+(t.kind==='constant'?',value:'+this.constantValue(t):''):',key:'+t.key+',parameterCount:'+t.parameterCount)+'}');
        return 'const '+this.scope+'='+this.provider+'.registerAS3LexicalMembers('+name+','+(parent?(nativeGeneratedDeclarationInputs(this.plan,this.plan.scope).inheritScriptClasses?this.provider+'.getAS3InheritedLexicalBase('+base+')':domain+'.'+parent.lexicalExport+'.get('+base+')'):native?domain+'.'+native.nativeBaseExport+'.lexicalScope':'null')+',['+traits.join(',')+']);\n'
            +domain+'.'+own.lexicalExport+'.set('+name+','+this.scope+');\n'
            +this.traits.filter(t=>t.static&&t.owner!==this.owner).map(t=>'const '+t.key+'='+base+';\n').join('')
            +this.traits.map(t=>'const '+t.access+'='+this.provider+'.resolveAS3LexicalMember('+this.scope+','+JSON.stringify(t.name)+','+JSON.stringify(t.visibility)+','+t.static+');').join('\n')
            +'\n'+this.own.filter(t=>this.earlyStaticValue(t)!==undefined).map(t=>this.provider+'.as3SetLexicalMember('+name+','+t.access+','+this.earlyStaticValue(t)+');').join('\n');
    }
    emit(emitter:any,node:Node,visit:(emitter:any,node:Node)=>void):boolean {
        // Protected methods have lexical symbol storage, so a source super call
        // must use the selected parent scope rather than a public prototype key.
        const callee=node.kind===K.CALL&&node.children[0];
        if(callee&&callee.kind===K.DOT&&callee.children[0].text==='super') {
            const name=callee.children[1].text;
            let owner=this.plan.bindings.find(b=>b.qname===this.owner).base,member:Node;
            while(owner&&this.plan.bindings.some(b=>b.qname===owner)) {
                member=this.internalContent(owner).children.find(m=>m.findChild(K.NAME)&&m.findChild(K.NAME).text===name);
                if(member)break;
                owner=this.plan.bindings.find(b=>b.qname===owner).base;
            }
            if(member&&modifiers(member).indexOf('protected')>=0) {
                let method=node.parent;
                while(method&&method.kind!==K.FUNCTION)method=method.parent;
                if(!method||method.parent.kind!==K.CONTENT||modifiers(method).indexOf('static')>=0
                    ||method.findChild(K.NAME).text===this.owner.split('.').pop())
                    fail('protected super requires ordinary instance method');
                if(member.kind!==K.FUNCTION||modifiers(member).indexOf('static')>=0)
                    fail('protected super requires instance method target');
                const parameters=member.findChild(K.PARAMETER_LIST).children,args=node.findChild(K.ARGUMENTS);
                if(parameters.some(p=>!!p.findChild(K.REST)))fail('protected super rest signature held');
                const minimum=parameters.filter(p=>!p.findChild(K.NAME_TYPE_INIT).findChild(K.INIT)).length;
                if(!args||args.children.length<minimum||args.children.length>parameters.length)
                    fail('protected super source arity');
                emitter.catchup(node.start);
                emitter.insert('(<any>'+this.provider+'.as3CallLexicalMember(this,'+this.provider
                    +'.resolveAS3LexicalMember('+this.scope+','+JSON.stringify(name)+',"protected",false,true),()=>[');
                args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
        }
        const resolve=(value:Node):{trait:Trait;receiver:Node;nativeMethod?:string;publicName?:string;publicMethod?:boolean;internalOwner?:string;internalName?:string;internalMethod?:boolean}|null=>{
            value=unwrapEncapsulatedExpression(value);if(!value)return null;
            let name:string,receiver:Node;
            if(value.kind===K.IDENTIFIER)name=value.text;
            else if(value.kind===K.DOT&&value.children[1]){name=value.children[1].text;receiver=unwrapEncapsulatedExpression(value.children[0]);}
            else return null;
            const lexicalName=this.traits.some(t=>t.name===name);
            if(!lexicalName&&!receiver)return null;
            let method=node;while(method.parent&&method.parent.kind!==K.CONTENT)method=method.parent;
            const staticContext=modifiers(method).indexOf('static')>=0;
            if(receiver&&receiver.kind===K.IDENTIFIER&&receiver.text==='super'&&lexicalName) {
                if(staticContext||method.kind!==K.FUNCTION||method.findChild(K.NAME).text===this.owner.split('.').pop())
                    fail('protected super field requires ordinary instance method');
                for(let enclosing=node.parent;enclosing&&enclosing!==method;enclosing=enclosing.parent)
                    if(enclosing.kind===K.FUNCTION||enclosing.kind===K.LAMBDA)fail('nested protected super field access');
                const trait=this.traits.find(t=>t.name===name&&t.owner!==this.owner&&!t.static&&t.visibility==='protected');
                const ref=trait&&trait.type&&this.plan.references.find(r=>r.owner===trait.owner&&r.start===trait.type.start&&r.end===trait.type.end);
                if(!trait||trait.kind!=='variable'||!ref||ref.kind!=='intrinsic'||['Number','int','uint'].indexOf(ref.identity)<0)
                    fail('protected super field requires inherited numeric variable');
                // Use the original receiver with a capability resolved from the
                // selected ancestor. Returning no explicit receiver also keeps
                // super out of ordinary JS property/assignment evaluation.
                return {trait:Object.assign({},trait,{access:this.provider+'.resolveAS3LexicalMember('
                    +this.scope+','+JSON.stringify(name)+',"protected",false,true)'}),receiver:null};
            }
            const binding=emitter.findDefInScope(receiver?receiver.text:name);
            if(!receiver&&binding&&!binding.bound)return null;
            let isStatic=false;
            if(receiver) {
                // Public members on another authenticated source receiver use
                // common property dispatch, including source null errors.
                let references = this.plan.references.filter(r=>r.owner===this.owner&&(r.kind==='declaration'||r.kind==='native')
                    &&receiver.kind===K.IDENTIFIER&&binding&&r.sourceName===binding.as3Type);
                if(receiver.kind===K.DOT&&receiver.children[0].text==='this') {
                    const field=this.traits.find(t=>t.name===receiver.children[1].text&&!t.static&&t.kind==='variable');
                    references=field&&field.type?this.plan.references.filter(r=>r.owner===field.owner&&(r.kind==='declaration'||r.kind==='native')
                        &&r.start===field.type.start&&r.end===field.type.end):[];
                }
                if(receiver.kind===K.DOT&&receiver.children[0].kind===K.IDENTIFIER) {
                    const root=receiver.children[0],rootBinding=emitter.findDefInScope(root.text);
                    const owner=(!rootBinding||!Object.prototype.hasOwnProperty.call(rootBinding,'as3Type'))
                        &&this.plan.bindings.find(b=>b.qname===this.resolveTypeName(root.text));
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    if(owner&&input.sources[owner.qname]&&!input.sources[owner.qname].referenceOnly) {
                        const getter=this.internalContent(owner.qname).children.find(member=>member.kind===K.GET
                            &&modifiers(member).indexOf('public')>=0&&modifiers(member).indexOf('static')>=0
                            &&member.findChild(K.NAME).text===receiver.children[1].text
                            &&member.findChild(K.PARAMETER_LIST).children.length===0);
                        const type=getter&&getter.findChild(K.TYPE);
                        if(type)references=this.plan.references.filter(r=>r.owner===owner.qname&&r.kind==='declaration'
                            &&r.start===type.start&&r.end===type.end);
                    }
                    // The source getter's declared result establishes the public
                    // receiver type. Keep the complete expression for ordinary
                    // property dispatch: evaluate it once, before call arguments.
                }
                const identities=Array.from(new Set(references.map(r=>r.identity)));
                if(identities.length===1&&identities[0]==='flash.utils.ByteArray'
                    &&references.every(r=>r.kind==='native')&&['compress','uncompress','deflate','inflate'].indexOf(name)>=0) {
                    if(!emitter.options.nativeByteArrayReferenceModule)fail('native ByteArray method requires exact provider');
                    return {trait:null,receiver,nativeMethod:name};
                }
                if(identities.length===1&&identities[0]==='flash.text.TextLineMetrics'
                    &&references.every(r=>r.kind==='native')&&['x','width','height','ascent','descent','leading'].indexOf(name)>=0) {
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    const metrics=input.providers&&input.providers['flash.text.TextLineMetrics'];
                    if(!metrics||metrics.exportName!=='TextLineMetrics'||metrics.nativeBase||metrics.nativeInterface
                        ||!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan)
                        fail('TextLineMetrics fields require authenticated native reference plan');
                    // Typed native values use source variable dispatch: reads
                    // preserve null errors and writes coerce Number storage.
                    return {trait:null,receiver,publicName:name,publicMethod:false};
                }
                if(lexicalName&&identities.length===1&&identities[0]==='flash.display.Sprite'
                    &&references.every(r=>r.kind==='native')&&['startDrag','stopDrag'].indexOf(name)>=0) {
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    const sprite=input.providers&&input.providers['flash.display.Sprite'];
                    if(!sprite||sprite.nativeBase!=='Sprite'||sprite.exportName!=='Sprite'
                        ||!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan)
                        fail('native Sprite drag method requires authenticated native base/reference plan');
                    // A namesake in the caller cannot capture a typed Sprite's
                    // public native method. Reuse source property dispatch so
                    // arguments precede null failure and reads retain closures.
                    return {trait:null,receiver,publicName:name,publicMethod:true};
                }
                if(inputPackageEnabled(this.plan)) {
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    const knownClass=receiver.kind===K.IDENTIFIER&&(!binding||!Object.prototype.hasOwnProperty.call(binding,'as3Type'))
                        ? this.plan.bindings.filter(b=>b.qname===this.resolveTypeName(receiver.text)) : [];
                    const identity=identities.length===1?identities[0]:knownClass.length===1?knownClass[0].qname:undefined;
                    const statics=!!identity&&knownClass.some(b=>b.qname===identity);
                    // A private spelling in this class does not capture an
                    // explicitly qualified public static of another source class.
                    if(lexicalName&&statics&&identity!==this.owner){
                        const cacheKey='static:'+identity;
                        if(!this.foreignPublicMembers.has(cacheKey))this.foreignPublicMembers.set(cacheKey,
                            new NativeGeneratedClassTraits(this.plan,this.plan.scope,identity,input.sources[identity].source).staticTraits);
                        if(this.foreignPublicMembers.get(cacheKey).some(member=>member.name===name))return null;
                    }
                    let inaccessible=false;
                    for(let current=identity;current;current=this.plan.bindings.find(b=>b.qname===current).base){
                        if(!input.sources[current]||input.sources[current].referenceOnly)break;
                        const content=this.internalContent(current);
                        const field=content.children.filter(Boolean).find(m=>[K.VAR_LIST,K.CONST_LIST,K.GET,K.FUNCTION].indexOf(m.kind)>=0
                            &&modifiers(m).every(mod=>['public','private','protected'].indexOf(mod)<0)
                            &&(modifiers(m).indexOf('static')>=0)===statics&&([K.GET,K.FUNCTION].indexOf(m.kind)>=0?m.findChild(K.NAME).text===name:m.findChildren(K.NAME_TYPE_INIT).some(v=>v.findChild(K.NAME).text===name)));
                        if(!field)continue;
                        if(statics&&current!==identity)fail('inherited internal static lookup requires qualification');
                        if(packageOf(current)!==packageOf(this.owner)){inaccessible=true;continue;}
                        const value=[K.GET,K.FUNCTION].indexOf(field.kind)>=0?field:field.findChildren(K.NAME_TYPE_INIT).find(v=>v.findChild(K.NAME).text===name);
                        const getter=field.kind===K.GET&&!statics&&value.findChild(K.TYPE)&&value.findChild(K.TYPE).text==='Boolean'
                            &&value.findChild(K.PARAMETER_LIST).children.length===0;
                        const method=this.internalMethod(current,field);
                        if(!getter&&!method&&(!value.findChild(K.TYPE)||value.findChild(K.TYPE).text!=='uint'
                            ||statics&&field.kind!==K.CONST_LIST||!statics&&field.kind!==K.VAR_LIST))
                            fail('foreign internal uint field/static constant required');
                        if(current===this.owner&&receiver.text==='this')break;
                        return {trait:null,receiver,internalOwner:current,internalName:name,internalMethod:method};
                    }
                    if(inaccessible)fail('internal declaration belongs to another package');
                }
                if(identities.length===1&&identities[0]!==this.owner&&this.plan.bindings.some(b=>b.qname===identities[0])) {
                    const identity=identities[0];
                    if(!this.foreignPublicMembers.has(identity)) {
                        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                        this.foreignPublicMembers.set(identity,new NativeGeneratedClassTraits(this.plan,this.plan.scope,identity,input.sources[identity].source).instanceTraits
                            .filter(member=>member.kind==='variable'||member.kind==='accessor'||member.kind==='method'));
                    }
                    const member=this.foreignPublicMembers.get(identity).find(member=>member.name===name);
                    if(member)return {trait:null,receiver,publicName:name,publicMethod:member.kind==='method'};
                }
                if(!lexicalName)return null;
                // A rest parameter is an intrinsic Array. Its members remain
                // Array members even when the declaring class has a namesake.
                if(receiver.kind===K.IDENTIFIER&&binding&&!binding.bound&&binding.as3Type==='Array'
                    &&this.resolveTypeName('Array')==='Array')return null;
                if(receiver.kind!==K.IDENTIFIER)fail('lexical receiver requires exact source type');
                // Dynamic receivers use runtime namespace lookup, even when
                // this class declares an internal/private namesake.
                if(receiver.text!=='this'&&binding&&!binding.bound&&(binding.as3Type==='Object'
                    ||binding.as3Type==='*'&&inputPackageEnabled(this.plan)))return null;
                if(receiver.text===this.owner.split('.').pop()&&(!binding||!Object.prototype.hasOwnProperty.call(binding,'as3Type')))isStatic=true;
                else if(receiver.text!=='this'&&(!binding||[this.owner,this.owner.split('.').pop()].indexOf(binding.as3Type)<0))fail('lexical receiver requires exact source type');
            } else isStatic=staticContext||!this.traits.some(t=>t.name===name&&!t.static);
            const trait=this.traits.find(t=>t.name===name&&t.static===isStatic);
            if(!trait)fail('lexical static/instance ownership');
            if(!isStatic&&staticContext)fail('instance lexical access in static method');
            return {trait,receiver};
        };
        let target=node,operation='get',right:Node,args:Node;
        if(node.kind===K.ASSIGN){target=node.children[0];operation='set';right=node.children[2];}
        else if(node.kind===K.CALL){target=node.children[0];operation='call';args=node.children[1];}
        else if([K.PRE_INC,K.POST_INC,K.PRE_DEC,K.POST_DEC].indexOf(node.kind)>=0) {
            const found=resolve(node.children[0]);if(!found)return false;
            if(!found.trait||found.trait.kind!=='variable'||found.trait.static||['private','protected','internal'].indexOf(found.trait.visibility)<0
                ||!found.trait.type||['int','uint','Number'].indexOf(found.trait.type.text)<0)
                fail('lexical numeric update requires qualified instance numeric variable');
            const delta=node.kind===K.PRE_INC||node.kind===K.POST_INC?'+1':'-1';
            const prefix=node.kind===K.PRE_INC||node.kind===K.PRE_DEC;
            // Storage conversion happens in the provider; the prefix expression
            // returns the unwrapped Number result, including integer overflow.
            emitter.catchup(node.start);
            emitter.insert('(<any>((target:any)=>{const previous:number=<any>'+this.provider+'.as3GetLexicalMember(target,'+found.trait.access+');'
                +'const next=previous'+delta+';'+this.provider+'.as3SetLexicalMember(target,'+found.trait.access+',next);return '+(prefix?'next':'previous')+';})(');
            if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
            else emitter.insert('this');
            emitter.insert('))');emitter.skipTo(node.end);return true;
        }
        else if(node.kind===K.DELETE){if(resolve(node.children[0]))fail('lexical update/delete lowering required');return false;}
        if(node.kind===K.IDENTIFIER&&node.parent&&node.parent.kind===K.DOT&&node.parent.children[1]===node)return false;
        if(operation==='call'&&target.kind===K.DOT&&target.children[1].kind===K.LITERAL) {
            const inner=target.children[0],slot=resolve(inner);
            const ref=slot&&slot.trait&&slot.trait.type&&this.plan.references.find(r=>r.owner===slot.trait.owner
                &&r.start===slot.trait.type.start&&r.end===slot.trait.type.end);
            if(slot&&slot.trait&&slot.trait.kind==='variable'&&ref&&ref.kind==='intrinsic'&&ref.identity==='Object') {
                // Resolve the field through its authenticated lexical capability.
                // Source dot-call arguments precede the final method lookup;
                // host lookup would also lose the AS3 namespace methods.
                let helper='__as3_generated_callNamedProperty';while(emitter.source.indexOf(helper)>=0)helper+='_';
                emitter.ensureImportIdentifier('as3CallNamedProperty as '+helper,emitter.generated.propertyModule,false);
                emitter.nativeSourceHelpers.add(helper);
                emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
                emitter.skipTo(inner.start);visit(emitter,inner);emitter.catchup(inner.end);
                emitter.insert(','+JSON.stringify(target.children[1].text)+',()=>[');
                args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
        }
        if(target.kind===K.DOT&&target.children[1]&&['call','apply'].indexOf(target.children[1].text)>=0) {
            const inner=target.children[0],slot=resolve(inner);
            if(slot&&(slot.nativeMethod||slot.trait&&slot.trait.kind==='variable')) {
                const ref=slot.trait&&slot.trait.type&&this.plan.references.find(r=>r.owner===slot.trait.owner&&r.start===slot.trait.type.start&&r.end===slot.trait.type.end);
                if(operation!=='call'||!slot.nativeMethod&&(!ref||ref.kind!=='intrinsic'||ref.identity!=='Function'||slot.trait.static))
                    fail('lexical Function intrinsic requires direct instance call');
                let helper='__as3_generated_callProperty';while(emitter.source.indexOf(helper)>=0)helper+='_';
                emitter.ensureImportIdentifier('as3CallProperty as '+helper,emitter.generated.propertyModule,false);
                emitter.nativeSourceHelpers.add(helper);
                // Read the Function first, then evaluate all source arguments,
                // then resolve/invoke its intrinsic (including a null error).
                emitter.catchup(node.start);
                emitter.insert('(<any>(function(fn:any,values:any[]){return '+helper+'(fn,'+JSON.stringify(target.children[1].text)+',()=>values);})(');
                emitter.skipTo(inner.start);visit(emitter,inner);emitter.catchup(inner.end);
                emitter.insert(',[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
        }
        const found=resolve(target);if(!found)return false;
        if(found.nativeMethod) {
            if(operation!=='get'&&operation!=='call')fail('native ByteArray method assignment');
            let helper='__as3_bytearray_method';while(emitter.source.indexOf(helper)>=0)helper+='_';
            emitter.ensureImportIdentifier('as3GetByteArrayCompressionMethod as '+helper,emitter.options.nativeByteArrayReferenceModule,false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.catchup(node.start);
            if(operation==='call')emitter.insert('(<any>((target:any,values:any[])=>'+helper+'(target,'+JSON.stringify(found.nativeMethod)+').apply(null,values))(');
            else emitter.insert('(<any>'+helper+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            if(operation==='call'){
                // The typed receiver is retained before evaluating arguments;
                // null dispatch errors follow argument effects, as in AIR.
                emitter.insert(',[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']))');
            }else emitter.insert(','+JSON.stringify(found.nativeMethod)+'))');
            emitter.skipTo(node.end);return true;
        }
        if(found.internalName){
            if(operation==='call'&&!found.internalMethod||operation==='set'&&(found.internalMethod||node.children[1].text!=='='))fail('internal member operation requires qualified get/set/call');
            const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
            const members=this.internalContent(found.internalOwner).children;
            if(operation==='set'&&members.some(m=>m.kind===K.GET&&m.findChild(K.NAME).text===found.internalName))fail('internal readonly getter assignment');
            if(operation==='set'&&members.some(m=>m.kind===K.CONST_LIST&&m.findChildren(K.NAME_TYPE_INIT).some(v=>v.findChild(K.NAME).text===found.internalName)))fail('internal constant assignment');
            const binding=this.plan.bindings.find(b=>b.qname===found.internalOwner);
            let token='__as3_internalType_'+binding.tokenExport;while(emitter.source.indexOf(token)>=0)token+='_';
            emitter.ensureImportIdentifier(binding.tokenExport+' as '+token,emitter.generated.options.module,false);
            emitter.catchup(node.start);emitter.insert('(<any>'+this.provider+'.'+(operation==='get'?'as3GetInternalMember':operation==='call'?'as3CallInternalMember':'as3SetInternalMember')+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            emitter.insert(','+this.scope+','+token+','+JSON.stringify(found.internalName));
            if(operation==='set'){emitter.insert(',');emitter.skipTo(right.start);visit(emitter,right);emitter.catchup(right.end);}
            if(operation==='call'){emitter.insert(',()=>[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']');}
            emitter.insert('))');emitter.skipTo(node.end);return true;
        }
        if(found.publicName) {
            if(operation==='call'&&found.publicMethod) {
                let helper='__as3_generated_foreign_call';while(emitter.source.indexOf(helper)>=0)helper+='_';
                emitter.ensureImportIdentifier('as3CallProperty as '+helper,emitter.generated.propertyModule,false);
                emitter.nativeSourceHelpers.add(helper);
                // Statically resolved AS3 method calls evaluate receiver and
                // arguments before dispatch, even when the receiver is null.
                emitter.catchup(node.start);
                emitter.insert('(<any>((target:any,values:any[])=>'+helper+'(target,'+JSON.stringify(found.publicName)+',()=>values))(');
                emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
                emitter.insert(',[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
            if(operation==='call'||operation==='set'&&(found.publicMethod||node.children[1].text!=='='))fail('foreign public lexical collision operation');
            const member=operation==='set'?'as3SetProperty':'as3GetProperty';
            let helper='__as3_generated_foreign_'+member;while(emitter.source.indexOf(helper)>=0)helper+='_';
            emitter.ensureImportIdentifier(member+' as '+helper,emitter.generated.propertyModule,false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            emitter.insert(','+JSON.stringify(found.publicName));
            if(operation==='set'){emitter.insert(',');emitter.skipTo(right.start);visit(emitter,right);emitter.catchup(right.end);}
            emitter.insert('))');emitter.skipTo(node.end);return true;
        }
        if(operation==='set'&&node.children[1].text==='+=') {
            const ref=found.trait.type&&this.plan.references.find(r=>r.owner===found.trait.owner&&r.start===found.trait.type.start&&r.end===found.trait.type.end);
            if(found.trait.kind!=='variable'||found.trait.visibility!=='private'||!ref||ref.kind!=='intrinsic'||ref.identity!=='String')
                fail('lexical addition requires qualified private String variable');
            const module=emitter.options.nativeTypedLocalAdditionModule;
            if(typeof module!=='string'||!module.trim()||/[\x00-\x1f'"\\]/.test(module))fail('lexical addition provider required');
            const unique=(name:string)=>{while(emitter.source.indexOf(name)>=0)name+='_';return name;};
            const add=unique('__as3_lexical_add'),receiver=unique('__as3_lexical_target'),previous=unique('__as3_lexical_previous'),value=unique('__as3_lexical_value');
            emitter.ensureImportIdentifier('as3Add as '+add,module,false);emitter.nativeSourceHelpers.add(add);
            // Retain receiver and old value before RHS effects. Addition performs
            // AS3 primitive conversion; lexical storage coerces the field while
            // returning the unconverted expression result (null += 1 yields 1).
            emitter.catchup(node.start);emitter.insert('(<any>(()=>{const '+receiver+':any=');
            if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
            else emitter.insert(found.trait.static?(found.trait.owner===this.owner?emitter.classFactory.value:found.trait.key):'this');
            emitter.insert(';const '+previous+':any='+this.provider+'.as3GetLexicalMember('+receiver+','+found.trait.access+');const '+value+':any='+add+'('+previous+',');
            emitter.skipTo(right.start);visit(emitter,right);emitter.catchup(right.end);
            emitter.insert(');return '+this.provider+'.as3SetLexicalMember('+receiver+','+found.trait.access+','+value+');})())');
            emitter.skipTo(node.end);return true;
        }
        if(operation==='set'&&(node.children[1].text!=='='||found.trait.kind!=='variable'))fail('lexical assignment kind');
        if(operation==='call'&&found.trait.kind==='accessor')fail('internal getter invocation held');
        const fieldCall=operation==='call'&&found.trait.kind==='variable';
        if(fieldCall) {
            const ref=found.trait.type&&this.plan.references.find(r=>r.owner===found.trait.owner&&r.start===found.trait.type.start&&r.end===found.trait.type.end);
            if(!ref||ref.kind!=='intrinsic'||ref.identity!=='Function'||found.trait.static)fail('lexical value invocation authority');
            if(!found.receiver&&!this.plan.bindings.find(b=>b.qname===this.owner).scriptGlobalExport)fail('lexical Function call requires caller script global authority');
        }
        emitter.catchup(node.start);
        if(operation!=='set')emitter.insert('(<any>');
        emitter.insert(this.provider+'.'+(operation==='get'?'as3GetLexicalMember':operation==='set'?'as3SetLexicalMember':fieldCall?'as3CallLexicalFunction':'as3CallLexicalMember')+'(');
        if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
        else emitter.insert(found.trait.static?(found.trait.owner===this.owner?emitter.classFactory.value:found.trait.key):'this');
        emitter.insert(','+found.trait.access);
        if(operation==='set'){emitter.insert(',');emitter.skipTo(right.start);visit(emitter,right);emitter.catchup(right.end);}
        if(operation==='call'){
            emitter.insert(',()=>[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']');
            if(fieldCall&&!found.receiver)emitter.insert(','+this.scriptGlobal);
        }
        emitter.insert(operation==='set'?')':'))');emitter.skipTo(node.end);return true;
    }
}
