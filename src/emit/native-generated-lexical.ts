import {nativeUndefinedConstant} from './native-undefined-constant';
import {nativeGeneratedInterfaceBindings} from './native-generated-declarations';
import {generatedMemberUri} from './native-generated-namespaces';
import {NativeTypedLocals, NestedLocalFunction} from './native-typed-locals';
import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs, nativeGeneratedDeclarationResolver, nativeGeneratedDeclarationNode, NativeGeneratedClassDeclaration, nativeGeneratedClassDeclaration} from './native-generated-declarations';
import {NativeGeneratedClassTraits} from './native-generated-traits';

interface Trait {
    name: string; visibility: string; static: boolean; kind: 'variable' | 'constant' | 'method' | 'accessor';
    owner: string; node: Node; type: Node; key: string; access: string; parameterCount: number;
}
function inputPackageEnabled(plan:NativeGeneratedDeclarationPlan):boolean{return !!nativeGeneratedDeclarationInputs(plan,plan.scope).lexicalProviderModule;}
function fail(reason: string): never {throw new Error('AS3_GENERATED_LEXICAL_UNSUPPORTED: ' + reason);}
function packageOf(name:string):string {const split=name.lastIndexOf('.');return split<0?'':name.slice(0,split);}
// Legacy unary +/- nodes place the operator at end, before operand start.
// Rewritten argument and assignment boundaries must include that operator.
function expressionStart(node:Node):number {
    return (node.kind===K.MINUS||node.kind===K.PLUS)&&node.end<node.start?node.end:node.start;
}
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
    readonly anonymousFunctions: {start:number;end:number;methodStart:number;name:string;parameters:string[];restParameter?:boolean;returned?:string;typedSignature?:boolean;staticInitializer?:boolean;ownerReceiver?:string}[] = [];
    readonly resolveTypeName:(name:string)=>string;
    private readonly declarations: ReadonlyArray<NativeGeneratedClassDeclaration>;
    private classSource(identity: string): {source: string; sourceSha256: string; referenceOnly?: boolean} {
        const input = nativeGeneratedDeclarationInputs(this.plan, this.plan.scope);
        const binding = this.declarations.find(item => item.identity === identity);
        return input.sources[binding ? binding.sourceOwner : identity];
    }
    private packageOf(identity: string): string {
        return this.plan.privateBindings.some(item => item.identity === identity) ? '' : packageOf(identity);
    }
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
        // Value parameters retain the ordinary native signature coercion and
        // arity checks. Resolve exact type spans so a source Class named Object
        // cannot be mistaken for the intrinsic Object parameter contract.
        if(returned.text==='void'&&parameters.every(parameter=>{
            const value=parameter.findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
            return !!type&&!value.findChild(K.INIT)&&!parameter.findChild(K.REST)
                &&this.plan.references.some(r=>r.owner===owner&&r.start===type.start&&r.end===type.end
                    &&r.kind==='intrinsic'&&['Object','int'].indexOf(r.identity)>=0);
        }))return true;
        if(parameters.length!==1)return false;
        const value=parameters[0].findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
        if(!type||value.findChild(K.INIT)||parameters[0].findChild(K.REST))return false;
        return this.plan.references.some(r=>r.owner===owner&&r.start===type.start&&r.end===type.end
            &&(r.kind==='interface'||r.kind==='native'&&this.plan.nativeBindings.some(b=>b.qname===r.identity&&b.nativeInterface)));
    }
    private readonlyGetterType(owner:string,member:Node) {
        if(member.kind!==K.GET||modifiers(member).indexOf('static')>=0
            ||member.findChild(K.PARAMETER_LIST).children.length!==0)return null;
        const type=member.findChild(K.TYPE),mods=modifiers(member);
        const reference=type&&this.plan.references.find(r=>r.owner===owner&&r.start===type.start&&r.end===type.end);
        if(!reference)return null;
        if(reference.kind==='intrinsic'&&reference.identity==='Boolean')return reference;
        // Number/Object and source-class returns have been observed for private
        // and protected instance getters. Keep package-internal forms bounded.
        if(mods.indexOf('private')<0&&mods.indexOf('protected')<0)return null;
        return reference.kind==='intrinsic'&&['Number','Object'].indexOf(reference.identity)>=0
            ||reference.kind==='declaration'?reference:null;
    }
    private readonly foreignPublicMembers = new Map<string, ReadonlyArray<{readonly name:string;readonly kind:string;readonly type?:string|{readonly name:string};readonly access?:string}>>();
    constructor(readonly plan: NativeGeneratedDeclarationPlan, readonly owner: string, source: string, typedLocals = false) {
        const input=nativeGeneratedDeclarationInputs(plan,plan.scope);
        this.declarations=Object.freeze(plan.bindings.map(b=>b.qname).concat(plan.privateBindings.map(b=>b.identity)).map(identity=>nativeGeneratedClassDeclaration(plan,identity)));
        this.resolveTypeName=nativeGeneratedDeclarationResolver(plan,owner,source).resolve;
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
                if(generatedMemberUri(plan,name,member))return;
                const mods=modifiers(member), visibility=mods.indexOf('public')>=0?'public':mods.indexOf('private')>=0?'private':mods.indexOf('protected')>=0?'protected':'internal';
                if(visibility==='public'||inherited&&visibility==='private')return;
                if(visibility==='internal'){
                    if(!input.lexicalProviderModule)fail('internal namespace storage authority');
                    if(mods.some(mod=>['internal','static'].indexOf(mod)<0 && !(mod==='override' && [K.GET,K.FUNCTION].indexOf(member.kind)>=0)))fail('custom namespace is not package-internal storage');
                    if(inherited&&this.packageOf(name)!==this.packageOf(owner))return;
                }
                const isStatic=mods.indexOf('static')>=0;
                const constant=member.kind===K.CONST_LIST&&(visibility==='protected'||visibility==='private'&&isStatic||visibility==='internal'&&isStatic);
                if(isStatic && member.kind!==K.VAR_LIST&&!constant&&(visibility!=='private'||member.kind!==K.FUNCTION))fail('static lexical initialization lowering required');
                if(inherited&&visibility==='internal'&&isStatic)return;
                const inheritedPrimitives=visibility==='protected'&&member.kind===K.VAR_LIST
                    &&member.findChildren(K.NAME_TYPE_INIT).every(node=>node.findChild(K.TYPE)&&['String','Boolean'].indexOf(node.findChild(K.TYPE).text)>=0);
                const inheritedVectors=visibility==='protected'&&member.kind===K.VAR_LIST
                    &&member.findChildren(K.NAME_TYPE_INIT).every(node=>{
                        const vector=node.findChild(K.VECTOR);
                        return vector&&plan.vectors.some(v=>v.owner===name&&v.start===vector.start&&v.end===vector.end);
                    });
                const inheritedBooleans=inherited&&isStatic&&name!==this.declarations.find(b=>b.identity===owner).base
                    &&visibility==='protected'&&member.kind===K.VAR_LIST
                    &&member.findChildren(K.NAME_TYPE_INIT).every(node=>{
                        const type=node.findChild(K.TYPE);
                        return type&&type.text==='Boolean'&&plan.references.some(ref=>ref.owner===name&&ref.start===type.start&&ref.end===type.end
                            &&ref.kind==='intrinsic'&&ref.identity==='Boolean');
                    });
                // Protected int, Array and source-reference fields retain the declaring
                // constructor's storage at every selected inheritance depth.
                const inheritedStorage=inherited&&isStatic&&visibility==='protected'&&member.kind===K.VAR_LIST
                    &&member.findChildren(K.NAME_TYPE_INIT).every(node=>{
                        const type=node.findChild(K.TYPE);
                        return type&&plan.references.some(ref=>ref.owner===name&&ref.start===type.start&&ref.end===type.end
                            &&(ref.kind==='intrinsic'&&['int','Array'].indexOf(ref.identity)>=0
                                ||ref.kind==='declaration'||ref.kind==='private-declaration'));
                    });
                if(inherited&&isStatic&&(!constant&&!inheritedPrimitives&&!inheritedVectors&&!inheritedStorage
                    ||name!==this.declarations.find(b=>b.identity===owner).base&&!inheritedBooleans&&!inheritedStorage))fail('inherited static lexical ownership');
                const internalMethod=visibility==='internal'&&this.internalMethod(name,member);
                if(visibility==='internal'&&member.kind===K.FUNCTION&&!internalMethod)
                    fail('internal instance method requires required Object/int parameters and void return or one authenticated interface parameter and Boolean/void return');
                const readonlyGetter=!!this.readonlyGetterType(name,member);
                if(member.kind!==K.VAR_LIST&&member.kind!==K.FUNCTION&&!constant&&!readonlyGetter)fail('lexical constant/accessor lowering required');
                const declarations=member.kind===K.VAR_LIST||constant?member.findChildren(K.NAME_TYPE_INIT):[member];
                declarations.forEach(node=>{
                    const local=node.findChild(K.NAME).text;
                    const previous=this.traits.find(t=>t.name===local&&t.static===isStatic);
                    if(previous) {
                        if(inherited&&previous.visibility===visibility&&previous.kind==='accessor'&&readonlyGetter) {
                            const returned=this.readonlyGetterType(previous.owner,previous.node),ancestor=this.readonlyGetterType(name,member);
                            if(modifiers(previous.node).indexOf('override')<0||mods.indexOf('final')>=0
                                ||!returned||!ancestor||returned.kind!==ancestor.kind||returned.identity!==ancestor.identity)
                                fail('readonly getter override requires matching return type, nonfinal source ancestor and override');
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
                    // Private method returns use the same authenticated Vector signature
                    // lowering as public methods; they are not field storage.
                    const privateVectorReturn=visibility==='private'&&member.kind===K.FUNCTION;
                    if(vector&&(['private','protected'].indexOf(visibility)<0||member.kind!==K.VAR_LIST&&!privateVectorReturn&&!(visibility==='private'&&isStatic&&constant)
                        ||!plan.vectors.some(v=>v.owner===name&&v.start===vector.start&&v.end===vector.end)))
                        fail('lexical vector storage authority');
                    const trait:Trait={name:local,visibility,static:isStatic,kind:member.kind===K.VAR_LIST?'variable':constant?'constant':readonlyGetter?'accessor':'method',owner:name,node,
                        type:vector||node.findChild(K.TYPE),key:fresh('key'),access:fresh('access'),parameterCount:member.kind===K.FUNCTION?node.findChild(K.PARAMETER_LIST).children.filter(p=>!p.findChild(K.REST)).length:0};
                    if(visibility==='internal'&&!readonlyGetter&&!internalMethod&&!(trait.type&&trait.type.text==='uint'
                        &&(trait.kind==='variable'&&!isStatic||trait.kind==='constant'&&isStatic)))fail('internal uint field/static constant required');
                    if(visibility==='internal'&&trait.kind==='variable')this.earlyInstanceValue(trait);
                    if(constant)this.constantValue(trait);
                    this.traits.push(trait);if(!inherited)this.own.push(trait);
                });
            });
            const binding=this.declarations.find(b=>b.identity===name);
            if(binding.base&&this.classSource(binding.base))collect(binding.base,true);
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
            let target=node.children[0].children[0];
            if(target&&target.kind===K.VAR_LIST&&target.findChildren(K.NAME_TYPE_INIT).length===1) {
                const value=target.findChild(K.NAME_TYPE_INIT),type=value.findChild(K.TYPE);
                if(value.findChild(K.INIT)||!type||type.text!=='String')fail('inline for-in requires a String declaration');
                target=value.findChild(K.NAME);
            }
            if(!target||[K.IDENTIFIER,K.NAME].indexOf(target.kind)<0)fail('for-in requires an existing wildcard slot');
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
                const staticInitializer=!!method&&[K.VAR_LIST,K.CONST_LIST].indexOf(method.kind)>=0&&modifiers(method).indexOf('static')>=0;
                if(!typedLocals||!method||method.kind!==K.FUNCTION&&!staticInitializer||!this.declarations.find(b=>b.identity===owner).scriptGlobalExport)
                    fail('anonymous source callable requires source script global');
                for(let p=node.parent;p&&p!==method;p=p.parent)if([K.FUNCTION,K.CATCH].indexOf(p.kind)>=0)fail('nested anonymous callable scope held');
                // Required String arguments use common storage coercion; rest is
                // excluded from both the fixed arity and registered Function.length.
                let referenceParameters=false,stringParameters=false,restParameter=false;
                const parameters=node.findChild(K.PARAMETER_LIST).children.map(p=>{
                    const rest=p.findChild(K.REST);
                    if(rest){restParameter=true;return rest.text;}
                    const value=p.findChild(K.NAME_TYPE_INIT),type=value&&value.findChild(K.TYPE);
                    if(!value||value.findChild(K.INIT)||value.findChild(K.VECTOR))fail('anonymous callable requires wildcard parameters or required source Class references');
                    if(type&&this.resolveTypeName(type.text)==='String')stringParameters=true;
                    else if(type&&type.text!=='*'){
                        const ref=plan.references.find(r=>r.owner===owner&&r.start===type.start&&r.end===type.end);
                        if(!ref||['declaration','private-declaration'].indexOf(ref.kind)<0)fail('anonymous callable requires wildcard parameters or required source Class references');
                        referenceParameters=true;
                    }
                    return value.findChild(K.NAME).text;
                });
                const returned=node.findChild(K.TYPE),returnType=returned&&this.resolveTypeName(returned.text);
                if(returned&&['*','void','Object','String','int'].indexOf(returnType)<0)fail('anonymous typed return held');
                if(referenceParameters&&returnType!=='int')fail('anonymous source Class parameters require int return');
                // Each anonymous callable owns its locals, while capture lookup
                // includes every enclosing callable up to the source method.
                const outerNames:string[]=[];
                const outer=(scope:Node):void=>{const visit=(n:Node):void=>{if(n!==scope&&[K.LAMBDA,K.FUNCTION].indexOf(n.kind)>=0)return;if(n.kind===K.NAME_TYPE_INIT)outerNames.push(n.findChild(K.NAME).text);if(n.kind===K.REST)outerNames.push(n.text);n.children.forEach(visit);};visit(scope);};
                let enclosing=node.parent;while(enclosing&&enclosing!==method&&enclosing.kind!==K.LAMBDA)enclosing=enclosing.parent;
                for(let scope=enclosing;scope;){outer(scope);if(scope===method)break;scope=scope.parent;while(scope&&scope!==method&&scope.kind!==K.LAMBDA)scope=scope.parent;}
                const inspect=(n:Node):void=>{
                    forInTarget(n);
                    if(['Object','String','int'].indexOf(returnType)>=0&&n.kind===K.RETURN&&!n.children.length)fail('anonymous typed bare return held');
                    if(n.kind===K.DOT&&n.children[0].kind===K.IDENTIFIER&&n.children[0].text==='this')fail('anonymous receiver property access held');
                    // Initializer callbacks have no enclosing method-local lowering pass.
                    // Keep local storage and nested closures held until that pass is qualified.
                    if(staticInitializer&&[K.VAR_LIST,K.CONST_LIST,K.LAMBDA,K.TRY].indexOf(n.kind)>=0)fail('static initializer callable local scope requires separate authority');
                    if(staticInitializer&&[K.ASSIGN,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC].indexOf(n.kind)>=0
                        &&n.children.some(c=>c.kind===K.IDENTIFIER&&parameters.indexOf(c.text)>=0))fail('static initializer callable parameter writes require separate authority');
                    if(staticInitializer&&n.kind===K.IDENTIFIER&&n.text===owner.split('.').pop()&&n.parent.kind!==K.RETURN)fail('static initializer own-Class expression requires separate authority');
                    if(n.kind===K.LAMBDA){check(n);return;}
                    if(n.kind===K.FUNCTION)fail('nested anonymous callable body held');
                    if(n.kind===K.IDENTIFIER&&['super','arguments'].indexOf(n.text)>=0)fail('anonymous callable receiver/member lookup held');
                    if([K.VAR_LIST,K.CONST_LIST].indexOf(n.kind)>=0)n.findChildren(K.NAME_TYPE_INIT).forEach(v=>{
                        if(outerNames.indexOf(v.findChild(K.NAME).text)>=0)fail('anonymous local shadows outer storage');
                        if(n.kind===K.CONST_LIST||v.findChild(K.VECTOR))fail('anonymous typed local held');
                    });
                    n.children.forEach(inspect);
                };inspect(node.findChild(K.BLOCK));
                this.anonymousFunctions.push({start:node.start,end:node.end,methodStart:enclosing.start,name:fresh('anonymous'),parameters,restParameter,staticInitializer,returned:returnType,typedSignature:referenceParameters||stringParameters||returnType==='int',ownerReceiver:modifiers(method).indexOf('static')<0?fresh('anonymousOwner'):undefined});
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
                    if(!vector&&(!ref||(ref.kind!=='intrinsic'&&ref.kind!=='interface'&&ref.kind!=='declaration'&&ref.kind!=='private-declaration'&&ref.kind!=='native'&&ref.kind!=='pattern-local'&&ref.kind!=='tween-handle-local')))fail('typed local source reference lowering required');
                }
                const collisions=this.traits.filter(t=>t.name===value.findChild(K.NAME).text);
                if(collisions.length){
                    let method=node.parent;while(method&&[K.FUNCTION,K.GET,K.SET,K.LAMBDA].indexOf(method.kind)<0)method=method.parent;
                    // The typed-local pass hoists source storage/defaults. The
                    // lexical resolver already prefers local bindings, while
                    // explicit this/Class accesses retain their field capability.
                    if(!typedLocals||!type||type.text==='*'||node.kind!==K.VAR_LIST
                        ||!method||method.parent!==content
                        ||collisions.some(t=>t.owner!==owner||t.visibility!=='private'||t.kind!=='variable'))
                        fail('local/lexical declaration-order lookup required');
                }
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
            return ref&&(ref.kind==='interface'||ref.kind==='declaration'||ref.kind==='private-declaration'||ref.kind==='native')?ref.identity:undefined;
        },true,this.nestedFunctions,this.anonymousFunctions,node=>plan.patternLocals.some(p=>p.owner===owner&&p.typeStart===node.start&&p.typeEnd===node.end),
            node=>plan.references.some(r=>r.owner===owner&&r.start===node.start&&r.end===node.end&&r.kind==='tween-handle-local'));
    }
    trait(name:string,isStatic:boolean):Trait{return this.own.find(t=>t.name===name&&t.static===isStatic);}
    embeddedConstant(trait:Trait) {
        return trait&&trait.kind==='constant'&&trait.visibility==='private'&&trait.static
            &&this.plan.embeddedBinary.find(b=>b.owner===trait.owner&&b.field===trait.name&&b.start===trait.node.start&&b.end===trait.node.end);
    }
    deferredVectorConstant(trait:Trait):boolean {
        return !!trait&&trait.kind==='constant'&&trait.visibility==='private'&&trait.static
            &&!!trait.type&&trait.type.kind===K.VECTOR&&!!trait.node.findChild(K.INIT)
            &&this.plan.vectors.some(v=>v.owner===trait.owner&&v.start===trait.type.start&&v.end===trait.type.end);
    }
    deferredObjectConstant(trait:Trait):boolean {
        if(!trait||trait.kind!=='constant'||trait.visibility!=='private'||!trait.static||!trait.type||!trait.node.findChild(K.INIT))return false;
        return this.plan.references.some(ref=>ref.owner===trait.owner&&ref.start===trait.type.start&&ref.end===trait.type.end&&ref.kind==='intrinsic'&&ref.identity==='Object');
    }
    deferredRegExpConstant(trait:Trait):boolean {
        if(!trait||trait.kind!=='constant'||trait.visibility!=='private'||!trait.static||!trait.type||!trait.node.findChild(K.INIT))return false;
        return this.plan.references.some(ref=>ref.owner===trait.owner&&ref.start===trait.type.start&&ref.end===trait.type.end
            &&ref.kind==='native'&&ref.identity==='RegExp');
    }
    deferredStringConstant(trait:Trait):boolean {
        if(!trait||trait.kind!=='constant'||trait.visibility!=='private'||!trait.static||!trait.type)return false;
        const init=trait.node.findChild(K.INIT);
        if(!init||!this.plan.references.some(ref=>ref.owner===trait.owner&&ref.start===trait.type.start&&ref.end===trait.type.end
            &&ref.kind==='intrinsic'&&ref.identity==='String'))return false;
        if(this.earlyStringConstant(trait)!==undefined)return false;
        const expression=unwrapEncapsulatedExpression(init.children[0]);
        // Do not accidentally move an unqualified compile-time expression into
        // cinit. Calls are effectful; pure constant expressions need folding
        // authority before they can be admitted as early slot values.
        if(expression.kind!==K.CALL)return false;
        const callee=expression.children[0];
        if(callee.kind===K.IDENTIFIER&&callee.text==='String')return false;
        return true;
    }
    private earlyStringConstant(trait:Trait):string|undefined {
        if(!trait||!trait.type||trait.type.text!=='String')return undefined;
        if(!this.plan.references.some(ref=>ref.owner===trait.owner&&ref.start===trait.type.start&&ref.end===trait.type.end
            &&ref.kind==='intrinsic'&&ref.identity==='String'))return undefined;
        const init=trait.node.findChild(K.INIT);if(!init)return undefined;
        const stringLiteral=(input:Node):string|undefined=>{
            const node=unwrapEncapsulatedExpression(input);
            if(node.kind===K.LITERAL&&/^(?:"(?:[^"\\\r\n]|\\[^\r\n])*"|'(?:[^'\\\r\n]|\\[^\r\n])*')$/.test(node.text))return node.text;
            if(node.kind===K.ADD&&node.children.length>=3&&node.children.length%2===1){
                const values=node.children.map((child,index)=>index%2?child.text==='+'?'+':undefined:stringLiteral(child));
                if(values.every(value=>value!==undefined))return '('+values.join('')+')';
            }
            return undefined;
        };
        const expression=unwrapEncapsulatedExpression(init.children[0]),literal=stringLiteral(expression);
        if(literal!==undefined)return literal.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        if(expression.kind===K.CALL&&expression.children[0].kind===K.IDENTIFIER&&expression.children[0].text==='String'){
            const args=expression.findChild(K.ARGUMENTS);
            const resolver=nativeGeneratedDeclarationResolver(this.plan,trait.owner,this.classSource(trait.owner).source);
            let owner=trait.owner,shadowed=false;
            while(owner){
                const declaration=this.declarations.find(d=>d.identity===owner);if(!declaration){shadowed=true;break;}
                shadowed=nativeGeneratedDeclarationNode(this.plan,owner).findChild(K.CONTENT).children.some(member=>{
                    const name=member.findChild(K.NAME);return name&&name.text==='String'
                        ||member.findChildren(K.NAME_TYPE_INIT).some(field=>field.findChild(K.NAME).text==='String');
                });
                if(shadowed)break;owner=declaration.base;
            }
            if(args&&args.children.length===1&&args.children[0].text==='null'&&resolver.resolve('String')==='String'
                &&!shadowed)return '"null"';
        }
        return undefined;
    }
    constantValue(trait:Trait):string {
        if(this.embeddedConstant(trait)||this.deferredVectorConstant(trait)||this.deferredObjectConstant(trait)||this.deferredRegExpConstant(trait)||this.deferredStringConstant(trait))return 'null';
        const init=trait.node.findChild(K.INIT);
        const end=(node:Node):number=>node.children.reduce((value,child)=>Math.max(value,end(child)),node.end);
        const value=init&&this.classSource(trait.owner).source.slice(init.start,end(init)).trim();
        const type=trait.type&&trait.type.text;
        if(trait.visibility==='private'&&trait.static&&type==='String'){
            const folded=this.earlyStringConstant(trait);if(folded!==undefined)return folded;
        }
        if(nativeUndefinedConstant(trait.node,nativeGeneratedDeclarationNode(this.plan,trait.owner),this.classSource(trait.owner).source)
            &&nativeGeneratedDeclarationResolver(this.plan,trait.owner,this.classSource(trait.owner).source).resolve('undefined')==='undefined')return 'void 0';
        if(trait.visibility==='internal'&&trait.static&&type==='uint'&&value&&/^(?:0[xX][0-9a-fA-F]+|0|[1-9]\d*)$/.test(value)
            &&Number(value)<=4294967295)return String(Number(value));
        // Literal numeric constants execute no source code. Preserve AS3's
        // declared int/uint conversion and Number's signed zero, rather than
        // treating all nonpublic constants as unqualified computed initializers.
        if(trait.kind==='constant'&&trait.static&&(trait.visibility==='protected'||trait.visibility==='private')
            &&['int','uint','Number'].indexOf(type)>=0&&value
            &&/^[+-]?(?:0[xX][0-9a-fA-F]+|(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.test(value)) {
            const negative=value[0]==='-',unsigned=/^[+-]/.test(value)?value.slice(1):value;
            const numeric=Number(unsigned)*(negative?-1:1);
            if(type==='int')return String(numeric|0);
            if(type==='uint')return String(numeric>>>0);
            return numeric===0&&1/numeric<0?'-0':numeric===Infinity?'(1 / 0)':numeric===-Infinity?'(-1 / 0)':String(numeric);
        }
        if(trait.kind==='constant'&&(trait.visibility==='protected'||trait.visibility==='private'&&trait.static&&(type==='String'||type==='int'))&&value
            &&(type==='String'&&/^(?:"(?:[^"\\\r\n]|\\[^\r\n])*"|'(?:[^'\\\r\n]|\\[^\r\n])*')$/.test(value)
                ||type==='int'&&(!trait.static||trait.visibility==='private')&&/^[+-]?(?:0|[1-9]\d*)$/.test(value)&&Number(value)>=-2147483648&&Number(value)<=2147483647))
            return type==='int'?String(Number(value)):value.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        return fail('protected String/instance int or private static String/int literal constant required');
    }
    earlyInstanceValue(trait:Trait):string|undefined {
        if(trait.visibility!=='internal'||trait.static||trait.kind!=='variable')return undefined;
        const init=trait.node.findChild(K.INIT);if(!init)return '0';
        const end=(node:Node):number=>node.children.reduce((n,child)=>Math.max(n,end(child)),node.end);
        const value=this.classSource(trait.owner).source.slice(init.start,end(init)).trim();
        if(/^(?:0[xX][0-9a-fA-F]+|0|[1-9]\d*)$/.test(value)&&Number(value)<=4294967295)return String(Number(value));
        return fail('internal uint field initializer requires qualified literal');
    }
    earlyStaticValue(trait:Trait):string|undefined {
        if(!trait.static||trait.kind!=='variable')return undefined;
        const init=trait.node.findChild(K.INIT);if(!init)return undefined;
        const end=(node:Node):number=>node.children.reduce((value,child)=>Math.max(value,end(child)),node.end);
        const value=this.classSource(trait.owner).source.slice(init.start,end(init)).trim();
        if(value==='null')return 'null';
        if(/^[+-]?\d+$/.test(value)&&trait.type&&trait.type.text==='int'&&Number(value)>=-2147483648&&Number(value)<=2147483647)return value;
        if(['protected','private'].indexOf(trait.visibility)>=0&&trait.type&&trait.type.text==='String'
            &&/^(?:"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(value))
            return value.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        if(trait.visibility==='private'&&trait.type){
            // AIR publishes finite literal uint slots before cinit, after ToUint32.
            // Each Class retry receives fresh slots with these converted values.
            if(trait.type.text==='uint'&&/^(?:0[xX][0-9a-fA-F]+|[+-]?(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.test(value)
                &&isFinite(Number(value)))return String(Number(value)>>>0);
            if(trait.type.text==='Boolean'&&/^(true|false)$/.test(value))return value;
            // Retain literal spelling (especially -0); reject legacy octal,
            // nonfinite literals and executable expressions until qualified.
            if(trait.type.text==='Number'&&/^(?:0[xX][0-9a-fA-F]+|[+-]?(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.test(value)
                &&isFinite(Number(value)))return value;
        }
        const expression=unwrapEncapsulatedExpression(init.children[0]);
        if(trait.visibility==='private'&&trait.type&&trait.type.text==='Boolean'
            &&expression&&expression.kind===K.RELATION&&expression.children.length===3
            &&['<','>','<=','>='].indexOf(expression.children[1].text)>=0){
            const left=unwrapEncapsulatedExpression(expression.children[0]);
            const right=unwrapEncapsulatedExpression(expression.children[2]);
            // Calls execute during cinit, after default Boolean slot publication.
            if(left.kind===K.CALL||right.kind===K.CALL)return undefined;
            // AIR folds literal comparisons into the trait value. Publishing a
            // default false here would change reads/mutations by earlier cinit
            // statements, even if the eventual comparison result were correct.
            const literal=(node:Node):number|string|undefined=>{
                const text=this.classSource(trait.owner).source.slice(node.start,end(node)).trim();
                if(/^[+-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(text)&&isFinite(Number(text)))return Number(text);
                if(/^(?:"[^"\\\r\n]*"|'[^'\\\r\n]*')$/.test(text))return text.slice(1,-1);
                return undefined;
            };
            const a=literal(left),b=literal(right),op=expression.children[1].text;
            // Mixed literals, escaped strings and other constant expressions
            // retain the existing guard until their early values are qualified.
            if(a!==undefined&&b!==undefined&&typeof a===typeof b)
                return String(op==='<'?a<b:op==='>'?a>b:op==='<='?a<=b:a>=b);
        }
        if(trait.visibility==='protected'&&trait.type&&trait.type.text==='Boolean'){
            if(/^(true|false)$/.test(value))return value;
            // Computed values execute in cinit after default storage publication;
            // literal Booleans above are trait values visible before cinit.
            if(expression&&[K.CALL,K.RELATION,K.EQUALITY,K.AND].indexOf(expression.kind)>=0)return undefined;
        }
        // A call initializer runs in cinit after default storage publication;
        // unlike an int literal it is not an early trait value.
        if(trait.visibility==='private'&&trait.type&&['int','Boolean'].indexOf(trait.type.text)>=0&&expression&&expression.kind===K.CALL)return undefined;
        if(trait.type&&['int','uint','Number','Boolean','String','*'].indexOf(trait.type.text)>=0)
            fail('static lexical primitive initializer requires qualification');
        if(!expression||[K.ARRAY,K.OBJECT,K.CALL,K.NEW,K.DOT,K.IDENTIFIER].indexOf(expression.kind)<0
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
            if(['*','int','uint','Number','Boolean','String','Object','Function','Class'].indexOf(ref.identity)<0)fail('unsupported lexical intrinsic '+ref.identity);
            return JSON.stringify(ref.identity);
        }
        const binding=(ref.kind==='declaration'||ref.kind==='private-declaration')&&this.declarations.find(b=>b.identity===ref.identity);
        const contract=ref.kind==='interface'&&nativeGeneratedInterfaceBindings(this.plan).find(b=>b.qname===ref.identity);
        const native=ref.kind==='native'&&this.plan.nativeBindings.find(b=>b.qname===ref.identity);
        if(!binding&&!contract&&!native)fail('unresolved lexical reference '+ref.sourceName);
        return '{name:'+JSON.stringify(binding?binding.reflectedName:contract?contract.reflectedName:ref.identity.replace(/\.([^.]*)$/,'::$1'))+',reference:'+domain+'.'+(binding?binding.tokenExport:contract?contract.tokenExport:native.referenceExport)+'}';
    }
    publication(name:string,base:string,domain:string,intrinsic:string):string {
        const own=this.declarations.find(b=>b.identity===this.owner),parent=own.base&&this.declarations.find(b=>b.identity===own.base);
        const native=own.base&&this.plan.nativeBindings.find(b=>b.qname===own.base&&!!b.nativeBaseExport);
        // Follow the already selected constructor generation, not a new source
        // Class read: a retry or inherited script-domain selection can differ
        // from the latest generation published for the same declaration token.
        const staticOwner=(trait:Trait):string=>{
            let current=parent,expression=base;
            while(current&&current.identity!==trait.owner){
                current=this.declarations.find(binding=>binding.identity===current.base);
                expression=intrinsic+'.getPrototypeOf('+expression+')';
            }
            if(!current)fail('inherited static declaration is not a selected ancestor');
            return expression;
        };
        const traits=this.own.map(t=>'{name:'+JSON.stringify(t.name)+',visibility:'+JSON.stringify(t.visibility)+',static:'+t.static+',kind:'+JSON.stringify(t.kind)
            +(this.earlyInstanceValue(t)!==undefined?',initialValue:'+this.earlyInstanceValue(t):'')
            +(t.kind==='accessor'?',key:'+t.key+',getter:true,setter:false':'')
            +(t.kind!=='method'?',type:'+this.typeExpression(t.type,t.owner,domain,intrinsic+'.array')+(t.kind==='constant'&&!this.embeddedConstant(t)&&!this.deferredVectorConstant(t)&&!this.deferredObjectConstant(t)&&!this.deferredRegExpConstant(t)&&!this.deferredStringConstant(t)?',value:'+this.constantValue(t):''):',key:'+t.key+',parameterCount:'+t.parameterCount)+'}');
        return 'const '+this.scope+'='+this.provider+'.registerAS3LexicalMembers('+name+','+(parent?(nativeGeneratedDeclarationInputs(this.plan,this.plan.scope).inheritScriptClasses?this.provider+'.getAS3InheritedLexicalBase('+base+')':domain+'.'+parent.lexicalExport+'.get('+base+')'):native?domain+'.'+native.nativeBaseExport+'.lexicalScope':'null')+',['+traits.join(',')+']);\n'
            +domain+'.'+own.lexicalExport+'.set('+name+','+this.scope+');\n'
            +this.traits.filter(t=>t.static&&t.owner!==this.owner).map(t=>'const '+t.key+'='+staticOwner(t)+';\n').join('')
            +this.traits.map(t=>'const '+t.access+'='+this.provider+'.resolveAS3LexicalMember('+this.scope+','+JSON.stringify(t.name)+','+JSON.stringify(t.visibility)+','+t.static+');').join('\n')
            +'\n'+this.own.filter(t=>this.earlyStaticValue(t)!==undefined).map(t=>this.provider+'.as3SetLexicalMember('+name+','+t.access+','+this.earlyStaticValue(t)+');').join('\n');
    }
    implicitReceiver(node:Node):string {
        for(let current=node;current;current=current.parent){
            if(current.kind===K.LAMBDA){const fn=this.anonymousFunctions.find(f=>f.start===current.start&&f.end===current.end);return fn&&fn.ownerReceiver||'this';}
            if([K.FUNCTION,K.GET,K.SET].indexOf(current.kind)>=0)return 'this';
        }
        return 'this';
    }
    emit(emitter:any,node:Node,visit:(emitter:any,node:Node)=>void):boolean {
        const implicitReceiver=this.implicitReceiver(node);
        // Protected methods have lexical symbol storage, so a source super call
        // must use the selected parent scope rather than a public prototype key.
        const callee=node.kind===K.CALL&&node.children[0];
        if(callee&&callee.kind===K.DOT&&callee.children[0].text==='super') {
            const name=callee.children[1].text;
            let owner=this.declarations.find(b=>b.identity===this.owner).base,member:Node;
            while(owner&&this.declarations.some(b=>b.identity===owner)) {
                member=this.internalContent(owner).children.find(m=>m.findChild(K.NAME)&&m.findChild(K.NAME).text===name);
                if(member)break;
                owner=this.declarations.find(b=>b.identity===owner).base;
            }
            if(member&&modifiers(member).indexOf('protected')>=0) {
                let method=node.parent;
                while(method&&method.kind!==K.FUNCTION)method=method.parent;
                if(!method||method.parent.kind!==K.CONTENT||modifiers(method).indexOf('static')>=0
                    ||method.findChild(K.NAME).text===this.ownClass.findChild(K.NAME).text)
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
                args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
        }
        // Follow only authenticated public source storage/getter declarations.
        // Keep the expression intact for emission so getters run exactly once;
        // type discovery must never evaluate or duplicate a source receiver.
        const interfaceMember=(identity:string,name:string,kind:'get'|'set'|'method')=>{
            const bindings=nativeGeneratedInterfaceBindings(this.plan);
            if(!bindings.some(binding=>binding.qname===identity))return undefined;
            const owners=new Set<string>();
            const visit=(owner:string):void=>{
                if(owners.has(owner))return;
                const binding=bindings.find(value=>value.qname===owner);
                // Native interface inheritance keeps its separate qualification.
                if(!binding)return;
                owners.add(owner);binding.bases.forEach(visit);
            };
            visit(identity);
            return this.plan.interfaceContracts.members.find(member=>owners.has(member.owner)
                &&member.name===name&&member.kind===kind);
        };
        const chainedReferences=(expression:Node):NativeGeneratedDeclarationPlan['references']=>{
            expression=unwrapEncapsulatedExpression(expression);
            if(!expression)return [];
            let identity:string,memberName:string,lexicalRoot=false;
            if(expression.kind===K.IDENTIFIER){
                const binding=emitter.findDefInScope(expression.text);
                if(!binding&&!this.traits.some(t=>t.name===expression.text&&!t.static&&t.kind==='variable'
                    &&(t.visibility==='protected'||t.visibility==='private'&&t.owner===this.owner)))return [];
                if(binding&&!binding.bound)return this.plan.references.filter(r=>r.owner===this.owner&&r.sourceName===binding.as3Type
                    &&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='native'||r.kind==='interface'));
                // An unqualified inherited public getter is still a receiver
                // expression. Resolve its declaration span, not its spelling.
                let method=expression;
                while(method&&[K.FUNCTION,K.GET,K.SET,K.LAMBDA].indexOf(method.kind)<0)method=method.parent;
                if(!method||method.parent.kind!==K.CONTENT||modifiers(method).indexOf('static')>=0)return [];
                identity=this.owner;memberName=expression.text;lexicalRoot=true;
            }else{
                if(expression.kind!==K.DOT||expression.children[1].kind!==K.LITERAL)return [];
                memberName=expression.children[1].text;
                const root=unwrapEncapsulatedExpression(expression.children[0]);
                if(root.kind===K.IDENTIFIER&&root.text==='this'){
                    let method=expression;
                    while(method&&[K.FUNCTION,K.GET,K.SET,K.LAMBDA].indexOf(method.kind)<0)method=method.parent;
                    if(!method||method.parent.kind!==K.CONTENT||modifiers(method).indexOf('static')>=0)return [];
                    identity=this.owner;lexicalRoot=true;
                }else{
                    const refs=chainedReferences(root),identities=Array.from(new Set(refs.map(r=>r.identity)));
                    if(identities.length!==1)return [];
                    identity=identities[0];
                }
            }
            if(lexicalRoot) {
                // Only storage on this instance (or its unqualified equivalent)
                // can use the caller's private/protected declaration authority.
                // Foreign roots still follow public declarations only. Preserve
                // the original expression: ordinary lexical emission owns the
                // actual read and each following getter executes once.
                const field=this.traits.find(t=>t.name===memberName&&!t.static&&t.kind==='variable'
                    &&(t.visibility==='protected'||t.visibility==='private'&&t.owner===this.owner));
                if(field&&field.type)return this.plan.references.filter(r=>r.owner===field.owner
                    &&r.start===field.type.start&&r.end===field.type.end
                    &&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='native'||r.kind==='interface'));
            }
            const getter=interfaceMember(identity,memberName,'get');
            if(getter)return this.plan.references.filter(r=>r.owner===getter.owner&&r.identity===getter.returnType
                &&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='interface'));
            for(let current=identity;current;){
                const declaration=this.declarations.find(b=>b.identity===current);
                if(!declaration||!this.classSource(current)||this.classSource(current).referenceOnly)return [];
                for(const member of this.internalContent(current).children){
                    if(modifiers(member).indexOf('public')<0||modifiers(member).indexOf('static')>=0)continue;
                    const value=member.kind===K.GET&&member.findChild(K.NAME).text===memberName
                        ?member:member.kind===K.VAR_LIST?member.findChildren(K.NAME_TYPE_INIT).find(v=>v.findChild(K.NAME).text===memberName):null;
                    const type=value&&value.findChild(K.TYPE);
                    if(type)return this.plan.references.filter(r=>r.owner===current&&r.start===type.start&&r.end===type.end
                        &&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='native'||r.kind==='interface'));
                }
                current=declaration.base;
            }
            return [];
        };
        const resolve=(value:Node):{trait:Trait;receiver:Node;nativeMethod?:string;timerMethod?:boolean;textBlockMethod?:boolean;publicName?:string;publicMethod?:boolean;publicNumericUpdate?:boolean;dynamicRead?:boolean;interfaceRead?:boolean;interfaceWrite?:boolean;interfaceCall?:boolean;namespaceUri?:string;internalOwner?:string;internalName?:string;internalMethod?:boolean}|null=>{
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
                const getter=this.traits.find(t=>t.name===name&&!t.static&&t.visibility==='protected'&&t.kind==='accessor');
                if(getter) {
                    if(staticContext||[K.FUNCTION,K.GET].indexOf(method.kind)<0||method.findChild(K.NAME).text===this.ownClass.findChild(K.NAME).text)
                        fail('protected super getter requires instance method or getter');
                    for(let enclosing=node.parent;enclosing&&enclosing!==method;enclosing=enclosing.parent)
                        if([K.FUNCTION,K.LAMBDA,K.GET,K.SET].indexOf(enclosing.kind)>=0)fail('nested protected super getter access');
                    let ancestor=this.declarations.find(b=>b.identity===this.owner).base,selected:Node;
                    while(ancestor&&this.classSource(ancestor)) {
                        selected=nativeGeneratedDeclarationNode(this.plan,ancestor).findChild(K.CONTENT).children.find(member=>member.kind===K.GET
                            &&member.findChild(K.NAME).text===name&&modifiers(member).indexOf('protected')>=0&&modifiers(member).indexOf('static')<0);
                        if(selected)break;
                        ancestor=this.declarations.find(b=>b.identity===ancestor).base;
                    }
                    if(!selected||!this.readonlyGetterType(ancestor,selected))fail('protected super getter requires qualified source ancestor');
                    return {trait:Object.assign({},getter,{access:this.provider+'.resolveAS3LexicalMember('
                        +this.scope+','+JSON.stringify(name)+',"protected",false,true)'}),receiver:null};
                }
                if(staticContext||method.kind!==K.FUNCTION||method.findChild(K.NAME).text===this.ownClass.findChild(K.NAME).text)
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
                let references = this.plan.references.filter(r=>r.owner===this.owner&&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='native')
                    &&receiver.kind===K.IDENTIFIER&&binding&&r.sourceName===binding.as3Type);
                if(receiver.kind===K.DOT&&receiver.children[0].text==='this') {
                    const field=this.traits.find(t=>t.name===receiver.children[1].text&&!t.static&&t.kind==='variable');
                    references=field&&field.type?this.plan.references.filter(r=>r.owner===field.owner&&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='native')
                        &&r.start===field.type.start&&r.end===field.type.end):[];
                }
                if(receiver.kind===K.DOT&&receiver.children[0].kind===K.IDENTIFIER) {
                    const root=receiver.children[0],rootBinding=emitter.findDefInScope(root.text);
                    const resolveOwner=!rootBinding||!Object.prototype.hasOwnProperty.call(rootBinding,'as3Type');
                    // Resolve once per search, retaining the original lazy/empty-list behavior.
                    const ownerName=resolveOwner&&this.declarations.length?this.resolveTypeName(root.text):null;
                    const owner=resolveOwner&&this.declarations.find(b=>b.identity===ownerName);
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    if(owner&&this.classSource(owner.identity)&&!this.classSource(owner.identity).referenceOnly) {
                        // A class can reach its own instance through its private
                        // static storage. Authenticate the declared receiver type;
                        // emission still evaluates the storage before arguments.
                        if(owner.identity===this.owner&&(!rootBinding||!rootBinding.bound)) {
                            const field=this.own.find(trait=>trait.name===receiver.children[1].text
                                &&trait.static&&trait.kind==='variable'&&trait.visibility==='private');
                            if(field&&field.type)references=this.plan.references.filter(r=>r.owner===this.owner
                                &&r.start===field.type.start&&r.end===field.type.end
                                &&r.kind==='declaration'&&r.identity===this.owner);
                        }
                        const getter=this.internalContent(owner.identity).children.find(member=>member.kind===K.GET
                            &&modifiers(member).indexOf('public')>=0&&modifiers(member).indexOf('static')>=0
                            &&member.findChild(K.NAME).text===receiver.children[1].text
                            &&member.findChild(K.PARAMETER_LIST).children.length===0);
                        const type=getter&&getter.findChild(K.TYPE);
                        if(type)references=this.plan.references.filter(r=>r.owner===owner.identity&&(r.kind==='declaration'||r.kind==='private-declaration'||r.kind==='interface')
                            &&r.start===type.start&&r.end===type.end);
                    }
                    // The source getter's declared result establishes the public
                    // receiver type. Keep the complete expression for ordinary
                    // property dispatch: evaluate it once, before call arguments.
                }
                if(!references.length)references=chainedReferences(receiver).slice();
                const identities=Array.from(new Set(references.map(r=>r.identity)));
                if(identities.length===1&&references.every(r=>r.kind==='interface')) {
                    const getter=interfaceMember(identities[0],name,'get'),setter=interfaceMember(identities[0],name,'set');
                    if(getter||setter) {
                        if(!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan)
                            fail('interface accessor requires exact reference provider');
                        // Keep inherited public accessor authority separate from
                        // private/protected namesakes. Retain the whole receiver
                        // so assignment captures it once, before RHS evaluation.
                        const compound=node.kind===K.ASSIGN&&['+=','-='].indexOf(node.children[1].text)>=0;
                        const numeric=!!getter&&!!setter&&['int','uint','Number'].indexOf(getter.returnType)>=0;
                        if(compound&&numeric&&(emitter.options.nativeDynamicPropertyReadsModule!==emitter.generated.propertyModule
                            ||emitter.options.nativeDynamicPropertyWritesModule!==emitter.generated.propertyModule))
                            fail('interface compound assignment requires exact read and write property providers');
                        return {trait:null,receiver,publicName:name,publicMethod:false,interfaceRead:!!getter,interfaceWrite:!!setter,
                            publicNumericUpdate:compound&&numeric};
                    }
                }
                if(identities.length===1&&references.every(r=>r.kind==='interface')&&interfaceMember(identities[0],name,'method')) {
                    if(!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan
                        ||emitter.options.nativeDynamicPropertyReadsModule!==emitter.generated.propertyModule)
                        fail('interface method requires exact reference and property providers');
                    // Preserve the whole typed receiver and evaluate every
                    // argument before method dispatch, including null failures.
                    return {trait:null,receiver,publicName:name,publicMethod:true,interfaceCall:true};
                }
                if(lexicalName&&identities.length===1&&identities[0]==='flash.display.MovieClip'
                    &&references.every(r=>r.kind==='native')) {
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    const movie=input.providers&&input.providers['flash.display.MovieClip'];
                    if(!movie||movie.exportName!=='MovieClip'||movie.nativeBase!=='MovieClip'
                        ||emitter.options.nativeMovieClipReferenceModule!==movie.module
                        ||!emitter.options.importModules||emitter.options.importModules['flash.display.MovieClip']!==movie.module
                        ||!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan)
                        fail('dynamic MovieClip read requires authenticated native base/reference plan');
                    // MovieClip dynamic children do not select namesake private
                    // or protected capabilities belonging to the caller.
                    return {trait:null,receiver,publicName:name,publicMethod:false,dynamicRead:true};
                }
                if(identities.length===1&&identities[0]==='flash.utils.ByteArray'
                    &&references.every(r=>r.kind==='native')&&['compress','uncompress','deflate','inflate'].indexOf(name)>=0) {
                    if(!emitter.options.nativeByteArrayReferenceModule)fail('native ByteArray method requires exact provider');
                    return {trait:null,receiver,nativeMethod:name};
                }
                if(identities.length===1&&identities[0]==='flash.text.engine.TextBlock'
                    &&references.every(r=>r.kind==='native')
                    &&['findNextAtomBoundary','findPreviousAtomBoundary','findNextWordBoundary','findPreviousWordBoundary',
                        'getTextLineAtCharIndex','createTextLine','recreateTextLine','releaseLineCreationData','releaseLines','dump'].indexOf(name)>=0) {
                    // Public native methods cannot select a private/protected
                    // namesake in the caller. Canonical dispatch owns the bound
                    // closure, source arity, receiver checks and call ordering.
                    // The emitter authenticates the exact TextBlock module;
                    // require the same reference plan and property provider here.
                    if(!emitter.options.nativeTextBlockReferenceModule
                        ||!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan
                        ||emitter.options.nativeDynamicPropertyReadsModule!==emitter.generated.propertyModule)
                        fail('TextBlock methods require exact reference and property providers');
                    return {trait:null,receiver,publicName:name,publicMethod:true,textBlockMethod:true};
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
                if(lexicalName&&identities.length===1&&identities[0]==='flash.utils.Timer'
                    &&references.every(r=>r.kind==='native')&&['start','stop','reset'].indexOf(name)>=0) {
                    const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                    const timer=input.providers&&input.providers['flash.utils.Timer'];
                    if(!emitter.options.nativeTimerReferenceModule||!timer||timer.exportName!=='Timer'||timer.nativeBase||timer.nativeInterface
                        ||!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan
                        ||!emitter.options.importModules||emitter.options.importModules['flash.utils.Timer']!==timer.module)
                        fail('native Timer methods require authenticated reference/import plan');
                    // A caller's private namesake cannot capture the typed Timer
                    // method. Canonical dispatch preserves closures and null errors.
                    return {trait:null,receiver,nativeMethod:name,timerMethod:true};
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
                    const resolveClass=receiver.kind===K.IDENTIFIER&&(!binding||!Object.prototype.hasOwnProperty.call(binding,'as3Type'));
                    const className=resolveClass&&this.declarations.length?this.resolveTypeName(receiver.text):null;
                    const knownClass=resolveClass?this.declarations.filter(b=>b.identity===className):[];
                    const identity=identities.length===1?identities[0]:knownClass.length===1?knownClass[0].identity:undefined;
                    const statics=!!identity&&knownClass.some(b=>b.identity===identity);
                    // A private spelling in this class does not capture an
                    // explicitly qualified public static of another source class.
                    if(lexicalName&&statics&&identity!==this.owner){
                        const cacheKey='static:'+identity;
                        if(!this.foreignPublicMembers.has(cacheKey))this.foreignPublicMembers.set(cacheKey,
                            new NativeGeneratedClassTraits(this.plan,this.plan.scope,identity,this.classSource(identity).source).staticTraits.filter(member=>!member.uri));
                        if(this.foreignPublicMembers.get(cacheKey).some(member=>member.name===name))return null;
                    }
                    let inaccessible=false;
                    for(let current=identity;current&&this.declarations.some(b=>b.identity===current);current=this.declarations.find(b=>b.identity===current).base){
                        if(!this.classSource(current)||this.classSource(current).referenceOnly)break;
                        const content=this.internalContent(current);
                        const field=content.children.filter(Boolean).find(m=>[K.VAR_LIST,K.CONST_LIST,K.GET,K.FUNCTION].indexOf(m.kind)>=0
                            &&modifiers(m).every(mod=>['public','private','protected'].indexOf(mod)<0)
                            &&(modifiers(m).indexOf('static')>=0)===statics&&([K.GET,K.FUNCTION].indexOf(m.kind)>=0?m.findChild(K.NAME).text===name:m.findChildren(K.NAME_TYPE_INIT).some(v=>v.findChild(K.NAME).text===name))
                            // An authenticated custom namespace is not the
                            // package-internal namespace. Leave it to ordinary
                            // namespace resolution, including opened namespaces.
                            &&!generatedMemberUri(this.plan,current,m));
                        if(!field)continue;
                        if(statics&&current!==identity)fail('inherited internal static lookup requires qualification');
                        if(this.packageOf(current)!==this.packageOf(this.owner)){inaccessible=true;continue;}
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
                // A one-argument source Class cast establishes the public
                // receiver type without evaluating it. Keep the original cast
                // expression so coercion and receiver effects still precede
                // call arguments. This is not private/protected authority.
                let publicIdentity=identities.length===1?identities[0]:undefined;
                if(!publicIdentity&&receiver.kind===K.CALL
                    &&receiver.children[0].kind===K.IDENTIFIER
                    &&receiver.findChild(K.ARGUMENTS)&&receiver.findChild(K.ARGUMENTS).children.length===1
                    &&emitter.options.nativeReferenceCoercion&&emitter.options.nativeReferenceCoercion.plan===this.plan) {
                    const target=receiver.children[0],targetBinding=emitter.findDefInScope(target.text);
                    if(!targetBinding||!targetBinding.bound&&!Object.prototype.hasOwnProperty.call(targetBinding,'as3Type')) {
                        const identity=this.resolveTypeName(target.text),source=this.classSource(identity);
                        if(this.declarations.some(b=>b.identity===identity)&&source&&!source.referenceOnly)publicIdentity=identity;
                    }
                }
                if(publicIdentity&&publicIdentity!==this.owner&&this.declarations.some(b=>b.identity===publicIdentity)) {
                    const identity=publicIdentity;
                    // An opened source namespace on a typed foreign receiver
                    // must resolve before this caller's private/protected
                    // namesake. Reuse ordinary namespace lowering so URI,
                    // ambiguity, member and operation checks remain enforced.
                    if(lexicalName&&emitter.namespaces.lowerOpenedAccess(value,identity)) {
                        const access=emitter.namespaces.access(value);
                        for(let scope=emitter.scope;scope&&scope!==emitter.rootScope;scope=scope.parent)
                            if(!scope.className&&scope.declarations.some((declaration:{name:string;bound?:string})=>declaration.name===access.qualifier&&!declaration.bound))
                                fail('runtime namespace qualifier shadows source declaration');
                        emitter.namespaces.checkReceiver(value,identity);
                        const member=emitter.namespaces.accessMember(value,identity);
                        if(!member||member.static||member.declaration.kind!==K.FUNCTION||!access.uri)
                            fail('foreign namespace namesake requires an instance method');
                        if(!emitter.options.nativeReferenceCoercion||emitter.options.nativeReferenceCoercion.plan!==this.plan
                            ||emitter.options.nativeDynamicPropertyReadsModule!==emitter.generated.propertyModule)
                            fail('namespace method requires exact reference and property providers');
                        return {trait:null,receiver,publicName:name,publicMethod:true,namespaceUri:access.uri};
                    }
                    if(!this.foreignPublicMembers.has(identity)) {
                        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                        this.foreignPublicMembers.set(identity,new NativeGeneratedClassTraits(this.plan,this.plan.scope,identity,this.classSource(identity).source).instanceTraits
                            .filter(member=>!member.uri&&(member.kind==='variable'||member.kind==='accessor'||member.kind==='method')));
                    }
                    const member=this.foreignPublicMembers.get(identity).find(member=>member.name===name);
                    if(member)return {trait:null,receiver,publicName:name,publicMethod:member.kind==='method',
                        publicNumericUpdate:typeof member.type==='string'&&['int','uint','Number'].indexOf(member.type)>=0
                            &&(member.kind==='variable'||member.kind==='accessor'&&member.access==='readwrite')};
                    if(receiver.kind===K.DOT&&modifiers(nativeGeneratedDeclarationNode(this.plan,identity)).indexOf('dynamic')>=0)
                        return {trait:null,receiver,publicName:name,publicMethod:false,dynamicRead:true};
                }
                if(!lexicalName)return null;
                // A rest parameter is an intrinsic Array. Its members remain
                // Array members even when the declaring class has a namesake.
                if(receiver.kind===K.IDENTIFIER&&binding&&!binding.bound&&binding.as3Type==='Array'
                    &&this.resolveTypeName('Array')==='Array')return null;
                if(receiver.kind===K.DOT&&identities.length===1&&identities[0]===this.owner
                    &&references.every(r=>r.kind==='declaration'||r.kind==='private-declaration')) {
                    // The declaring class can address its own private field on
                    // an exactly typed instance path. Keep that path intact so
                    // compound storage can re-evaluate it after RHS effects.
                    const field=this.own.find(t=>t.name===name&&!t.static&&t.kind==='variable'&&t.visibility==='private');
                    if(field)return {trait:field,receiver};
                }
                if(receiver.kind!==K.IDENTIFIER)fail('lexical receiver requires exact source type');
                // Dynamic receivers use runtime namespace lookup, even when
                // this class declares an internal/private namesake.
                if(receiver.text!=='this'&&binding&&!binding.bound&&(binding.as3Type==='Object'
                    ||binding.as3Type==='*'&&inputPackageEnabled(this.plan)))return null;
                // The declaring class can select its own private capability on
                // a descendant-typed local. Authenticate the complete source
                // ancestry; a namesake private member in the child is distinct.
                let privateDescendant=false;
                if(binding&&!binding.bound&&identities.length===1
                    &&references.every(r=>r.kind==='declaration'||r.kind==='private-declaration')
                    &&this.own.some(t=>t.name===name&&!t.static&&t.visibility==='private')) {
                    const visited=new Set<string>();
                    for(let current=identities[0];current&&!visited.has(current);) {
                        visited.add(current);
                        const declaration=this.declarations.find(b=>b.identity===current);
                        if(!declaration||!this.classSource(current)||this.classSource(current).referenceOnly)break;
                        if(current===this.owner){privateDescendant=true;break;}
                        current=declaration.base;
                    }
                }
                if(receiver.text===this.ownClass.findChild(K.NAME).text&&(!binding||!Object.prototype.hasOwnProperty.call(binding,'as3Type')))isStatic=true;
                else if(receiver.text!=='this'&&!privateDescendant&&(!binding||[this.owner,this.ownClass.findChild(K.NAME).text].indexOf(binding.as3Type)<0))fail('lexical receiver requires exact source type');
            } else isStatic=staticContext||!this.traits.some(t=>t.name===name&&!t.static);
            const trait=this.traits.find(t=>t.name===name&&t.static===isStatic);
            if(!trait)fail('lexical static/instance ownership');
            // A static method may use an authenticated explicit instance.
            // Its lexical this and unqualified instance access remain invalid.
            if(!isStatic&&staticContext&&(!receiver||receiver.text==='this'))fail('instance lexical access in static method');
            return {trait,receiver};
        };
        if(node.kind===K.NEW&&node.children.length===1) {
            const call=node.children[0];
            if(call.kind!==K.CALL)return false;
            const found=resolve(call.children[0]);
            if(found&&(found.interfaceRead||found.interfaceWrite||found.interfaceCall||found.namespaceUri))fail('interface getter or namespace method construction requires separate authority');
            if(found&&found.textBlockMethod)fail('TextBlock method construction requires separate authority');
            if(!found||!found.trait||found.trait.kind==='constant')return false;
            const trait=found.trait,arguments_=call.findChild(K.ARGUMENTS);
            const ref=trait.type&&this.plan.references.find(r=>r.owner===trait.owner&&r.start===trait.type.start&&r.end===trait.type.end);
            if(trait.kind!=='variable'||!ref||ref.kind!=='intrinsic'||ref.identity!=='Class'||!arguments_)
                fail('lexical construction requires an authenticated Class variable');
            emitter.catchup(node.start);emitter.insert('(<any>'+this.provider+'.as3ConstructLexicalClass(');
            if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
            else emitter.insert(trait.static?(trait.owner===this.owner?emitter.classFactory.value:trait.key):implicitReceiver);
            emitter.insert(','+trait.access+',()=>[');
            arguments_.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});
            const global=this.declarations.find(b=>b.identity===this.owner).scriptGlobalExport?this.scriptGlobal:null;
            emitter.insert(']'+(global?','+global:'')+'))');emitter.skipTo(node.end);return true;
        }
        // Keep source type authority for paths rooted in lexical storage. A
        // private Array slot or an Object entry can be null/undefined; emitting
        // the following read as JS loses the AS3 1009/1010 error distinction.
        const storagePathType=(expression:Node):string=>{
            expression=unwrapEncapsulatedExpression(expression);if(!expression)return null;
            const field=expression.kind===K.IDENTIFIER||expression.kind===K.DOT
                &&expression.children[0].kind===K.IDENTIFIER
                &&['this',this.ownClass.findChild(K.NAME).text].indexOf(expression.children[0].text)>=0;
            if(field){
                const slot=resolve(expression),trait=slot&&slot.trait;
                const ref=trait&&trait.type&&this.plan.references.find(r=>r.owner===trait.owner
                    &&r.start===trait.type.start&&r.end===trait.type.end);
                if(trait&&trait.kind==='variable'&&ref&&ref.kind==='intrinsic'
                    &&['Array','Object'].indexOf(ref.identity)>=0)return ref.identity;
            }
            if([K.DOT,K.ARRAY_ACCESSOR].indexOf(expression.kind)<0||expression.children.length!==2)return null;
            const type=storagePathType(expression.children[0]);
            return type==='Object'||type==='*'||type==='Array'&&expression.kind===K.ARRAY_ACCESSOR?'*':null;
        };
        if([K.DOT,K.ARRAY_ACCESSOR].indexOf(node.kind)>=0&&node.children.length===2){
            const type=storagePathType(node.children[0]),key=node.children[1];
            if(type==='Object'||type==='*'||type==='Array'&&(node.kind===K.ARRAY_ACCESSOR||key.text==='length')){
                let outer=node;while(outer.parent&&outer.parent.kind===K.ENCAPSULATED)outer=outer.parent;
                const parent=outer.parent;
                const operation=parent&&parent.children[0]===outer&&[K.ASSIGN,K.CALL,K.NEW,K.DELETE,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC].indexOf(parent.kind)>=0;
                // Writes, calls and updates have distinct evaluation contracts.
                if(!operation){
                    let helper='__as3_generated_storageRead';while(emitter.source.indexOf(helper)>=0)helper+='_';
                    emitter.ensureImportIdentifier('as3GetProperty as '+helper,emitter.generated.propertyModule,false);
                    emitter.nativeSourceHelpers.add(helper);
                    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
                    visit(emitter,node.children[0]);emitter.catchup(node.children[0].end);emitter.insert(',');
                    if(node.kind===K.DOT)emitter.insert(JSON.stringify(key.text));
                    else {emitter.skipTo(expressionStart(key));visit(emitter,key);emitter.catchup(key.end);}
                    emitter.insert('))');emitter.skipTo(node.end);return true;
                }
            }
        }
        let target=node,operation='get',right:Node,args:Node;
        if(node.kind===K.ASSIGN){target=node.children[0];operation='set';right=node.children[2];}
        else if(node.kind===K.CALL){target=node.children[0];operation='call';args=node.children[1];}
        else if([K.PRE_INC,K.POST_INC,K.PRE_DEC,K.POST_DEC].indexOf(node.kind)>=0) {
            const found=resolve(node.children[0]);if(!found)return false;
            if(found.publicName&&found.publicNumericUpdate) {
                const unique=(name:string)=>{while(emitter.source.indexOf(name)>=0)name+='_';return name;};
                const get=unique('__as3_public_update_get'),set=unique('__as3_public_update_set');
                emitter.ensureImportIdentifier('as3GetProperty as '+get,emitter.generated.propertyModule,false);
                emitter.ensureImportIdentifier('as3SetProperty as '+set,emitter.generated.propertyModule,false);
                emitter.nativeSourceHelpers.add(get);emitter.nativeSourceHelpers.add(set);
                const delta=node.kind===K.PRE_INC||node.kind===K.POST_INC?'+1':'-1';
                const prefix=node.kind===K.PRE_INC||node.kind===K.PRE_DEC;
                // Capture the typed receiver once, then read, update and write
                // through common public dispatch. A setter receives its coerced
                // storage value; the prefix result retains Number overflow.
                emitter.catchup(node.start);
                emitter.insert('(<any>((target:any)=>{const previous:number=<any>'+get+'(target,'+JSON.stringify(found.publicName)+');'
                    +'const next=previous'+delta+';'+set+'(target,'+JSON.stringify(found.publicName)+',next);return '+(prefix?'next':'previous')+';})(');
                emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
                emitter.insert('))');emitter.skipTo(node.end);return true;
            }
            if(!found.trait||found.trait.kind!=='variable'||found.trait.static&&!(found.trait.type&&(found.trait.visibility==='private'&&found.trait.type.text==='uint'||found.trait.visibility==='protected'&&found.trait.type.text==='int'))||['private','protected','internal'].indexOf(found.trait.visibility)<0
                ||!found.trait.type||['int','uint','Number'].indexOf(found.trait.type.text)<0)
                fail('lexical numeric update requires qualified numeric variable');
            const delta=node.kind===K.PRE_INC||node.kind===K.POST_INC?'+1':'-1';
            const prefix=node.kind===K.PRE_INC||node.kind===K.PRE_DEC;
            // Storage conversion happens in the provider; the prefix expression
            // returns the unwrapped Number result, including integer overflow.
            emitter.catchup(node.start);
            emitter.insert('(<any>((target:any)=>{const previous:number=<any>'+this.provider+'.as3GetLexicalMember(target,'+found.trait.access+');'
                +'const next=previous'+delta+';'+this.provider+'.as3SetLexicalMember(target,'+found.trait.access+',next);return '+(prefix?'next':'previous')+';})(');
            if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
            else emitter.insert(found.trait.static?(found.trait.owner===this.owner?emitter.classFactory.value:found.trait.key):implicitReceiver);
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
                args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});
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
                emitter.insert(',[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
        }
        const found=resolve(target);if(!found)return false;
        if(found.nativeMethod) {
            if(operation!=='get'&&operation!=='call')fail(found.timerMethod?'native Timer method assignment':'native ByteArray method assignment');
            let helper=found.timerMethod?'__as3_timer_method':'__as3_bytearray_method';while(emitter.source.indexOf(helper)>=0)helper+='_';
            emitter.ensureImportIdentifier((found.timerMethod?'as3GetTimerMethod':'as3GetByteArrayCompressionMethod')+' as '+helper,found.timerMethod?emitter.options.nativeTimerReferenceModule:emitter.options.nativeByteArrayReferenceModule,false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.catchup(node.start);
            if(operation==='call')emitter.insert('(<any>((target:any,values:any[])=>'+helper+'(target,'+JSON.stringify(found.nativeMethod)+').apply(null,values))(');
            else emitter.insert('(<any>'+helper+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            if(operation==='call'){
                // The typed receiver is retained before evaluating arguments;
                // null dispatch errors follow argument effects, as in AIR.
                emitter.insert(',[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']))');
            }else emitter.insert(','+JSON.stringify(found.nativeMethod)+'))');
            emitter.skipTo(node.end);return true;
        }
        if(found.internalName){
            if(operation==='call'&&!found.internalMethod||operation==='set'&&(found.internalMethod||node.children[1].text!=='='))fail('internal member operation requires qualified get/set/call');
            const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
            const members=this.internalContent(found.internalOwner).children;
            if(operation==='set'&&members.some(m=>m.kind===K.GET&&m.findChild(K.NAME).text===found.internalName))fail('internal readonly getter assignment');
            if(operation==='set'&&members.some(m=>m.kind===K.CONST_LIST&&m.findChildren(K.NAME_TYPE_INIT).some(v=>v.findChild(K.NAME).text===found.internalName)))fail('internal constant assignment');
            const binding=this.declarations.find(b=>b.identity===found.internalOwner);
            let token='__as3_internalType_'+binding.tokenExport;while(emitter.source.indexOf(token)>=0)token+='_';
            emitter.ensureImportIdentifier(binding.tokenExport+' as '+token,emitter.generated.options.module,false);
            emitter.catchup(node.start);emitter.insert('(<any>'+this.provider+'.'+(operation==='get'?'as3GetInternalMember':operation==='call'?'as3CallInternalMember':'as3SetInternalMember')+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            emitter.insert(','+this.scope+','+token+','+JSON.stringify(found.internalName));
            if(operation==='set'){emitter.insert(',');emitter.skipTo(expressionStart(right));visit(emitter,right);emitter.catchup(right.end);}
            if(operation==='call'){emitter.insert(',()=>[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']');}
            emitter.insert('))');emitter.skipTo(node.end);return true;
        }
        if(found.namespaceUri) {
            if(operation!=='get'&&operation!=='call')fail('namespace method requires a read or call');
            const member=operation==='call'?'as3CallNamespaceProperty':'as3GetNamespaceProperty';
            let helper='__as3_generated_namespace_'+member;while(emitter.source.indexOf(helper)>=0)helper+='_';
            emitter.ensureImportIdentifier(member+' as '+helper,emitter.generated.propertyModule,false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            emitter.insert(','+JSON.stringify(found.namespaceUri)+','+JSON.stringify(found.publicName));
            if(operation==='call'){
                emitter.insert(',()=>[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']');
            }
            emitter.insert('))');emitter.skipTo(node.end);return true;
        }
        if(found.publicName) {
            // Interface method reads use the same authenticated public property bridge
            // as class method reads; it preserves bound closure identity.
            if(found.interfaceCall&&operation!=='call'&&operation!=='get')fail('interface method requires a read or call');
            if(found.interfaceRead||found.interfaceWrite) {
                if(operation==='get') {
                    if(!found.interfaceRead)fail('interface accessor has no getter');
                    if(emitter.options.nativeDynamicPropertyReadsModule!==emitter.generated.propertyModule)
                        fail('interface getter requires exact property provider');
                }else if(operation==='set'&&node.children[1].text==='=') {
                    if(!found.interfaceWrite)fail('interface accessor has no setter');
                    if(emitter.options.nativeDynamicPropertyWritesModule!==emitter.generated.propertyModule)
                        fail('interface setter requires exact property provider');
                }else if(!(operation==='set'&&found.publicNumericUpdate&&['+=','-='].indexOf(node.children[1].text)>=0))
                    fail('interface accessor requires qualified read or assignment');
            }
            if(found.dynamicRead&&operation!=='get')fail('chained dynamic receiver currently requires a property read');
            if(operation==='set'&&found.publicNumericUpdate&&['+=','-='].indexOf(node.children[1].text)>=0) {
                const addition=node.children[1].text==='+=',unique=(name:string)=>{while(emitter.source.indexOf(name)>=0)name+='_';return name;};
                const helper=unique('__as3_public_compound_add'),get=unique('__as3_public_compound_get'),set=unique('__as3_public_compound_set'),number=unique('__as3_public_compound_number');
                if(addition){emitter.ensureImportIdentifier('as3AddAssignProperty as '+helper,emitter.generated.propertyModule,false);emitter.nativeSourceHelpers.add(helper);}
                else {
                    const module=emitter.options.nativeCallableCoercionModule;
                    if(typeof module!=='string'||!module.trim()||/[\x00-\x1f'"\\]/.test(module))fail('public compound subtraction coercion provider required');
                    emitter.ensureImportIdentifier('as3GetProperty as '+get,emitter.generated.propertyModule,false);
                    emitter.ensureImportIdentifier('as3SetProperty as '+set,emitter.generated.propertyModule,false);
                    emitter.ensureImportIdentifier('as3CoerceNumber as '+number,module,false);
                    [get,set,number].forEach(name=>emitter.nativeSourceHelpers.add(name));
                }
                emitter.catchup(node.start);
                if(addition)emitter.insert('(<any>'+helper+'(');
                else emitter.insert('(<any>((readTarget:any,key:string,rhs:()=>any,writeTarget:()=>any)=>{const previous:number=<any>'+get+'(readTarget,key);const value=previous-'+number+'(rhs());return '+set+'(writeTarget(),key,value);})(');
                emitter.skipTo(found.receiver.start);const start=emitter.output.length;
                visit(emitter,found.receiver);emitter.catchup(found.receiver.end);const receiver=emitter.output.slice(start);
                emitter.insert(','+JSON.stringify(found.publicName)+',()=>(');
                emitter.skipTo(expressionStart(right));visit(emitter,right);emitter.catchup(right.end);
                // AS3 repeats the receiver path for storage after RHS evaluation
                // and conversion. Do not substitute JavaScript reference capture.
                emitter.insert('),()=>('+receiver+')))');emitter.skipTo(node.end);return true;
            }
            if(operation==='call'&&found.publicMethod) {
                let helper='__as3_generated_foreign_call';while(emitter.source.indexOf(helper)>=0)helper+='_';
                emitter.ensureImportIdentifier('as3CallProperty as '+helper,emitter.generated.propertyModule,false);
                emitter.nativeSourceHelpers.add(helper);
                // Statically resolved AS3 method calls evaluate receiver and
                // arguments before dispatch, even when the receiver is null.
                emitter.catchup(node.start);
                emitter.insert('(<any>((target:any,values:any[])=>'+helper+'(target,'+JSON.stringify(found.publicName)+',()=>values))(');
                emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
                emitter.insert(',[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});
                emitter.insert(']))');emitter.skipTo(node.end);return true;
            }
            if(operation==='set'&&(found.publicMethod||node.children[1].text!=='='))fail('foreign public lexical collision operation');
            // A source dot call retains its receiver, then evaluates arguments
            // before looking up the Function-valued public field or accessor.
            const member=operation==='call'?'as3CallNamedProperty':operation==='set'?'as3SetProperty':'as3GetProperty';
            let helper='__as3_generated_foreign_'+member;while(emitter.source.indexOf(helper)>=0)helper+='_';
            emitter.ensureImportIdentifier(member+' as '+helper,emitter.generated.propertyModule,false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
            emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);
            emitter.insert(','+JSON.stringify(found.publicName));
            if(operation==='set'){emitter.insert(',');emitter.skipTo(expressionStart(right));visit(emitter,right);emitter.catchup(right.end);}
            if(operation==='call'){emitter.insert(',()=>[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']');}
            emitter.insert('))');emitter.skipTo(node.end);return true;
        }
        if(operation==='set'&&node.children[1].text==='-=') {
            const ref=found.trait.type&&this.plan.references.find(r=>r.owner===found.trait.owner&&r.start===found.trait.type.start&&r.end===found.trait.type.end);
            if(found.trait.kind!=='variable'||['private','protected'].indexOf(found.trait.visibility)<0
                ||found.trait.static&&!(found.trait.visibility==='protected'&&ref&&ref.kind==='intrinsic'&&ref.identity==='int')
                ||!ref||ref.kind!=='intrinsic'||['Number','int','uint'].indexOf(ref.identity)<0)
                fail('lexical subtraction requires qualified private/protected numeric instance variable');
            const module=emitter.options.nativeCallableCoercionModule;
            if(typeof module!=='string'||!module.trim()||/[\x00-\x1f'"\\]/.test(module))fail('lexical subtraction coercion provider required');
            const unique=(name:string)=>{while(emitter.source.indexOf(name)>=0)name+='_';return name;};
            const number=unique('__as3_lexical_number'),receiver=unique('__as3_lexical_target'),previous=unique('__as3_lexical_previous'),value=unique('__as3_lexical_value');
            emitter.ensureImportIdentifier('as3CoerceNumber as '+number,module,false);emitter.nativeSourceHelpers.add(number);
            // Read the numeric field before RHS evaluation/conversion. Repeat the
            // receiver path for storage; lexical storage coerces int/uint values.
            emitter.catchup(node.start);emitter.insert('(<any>(()=>{const '+receiver+':any=');
            const receiverStart=emitter.output.length;
            if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
            else emitter.insert(found.trait.static?(found.trait.owner===this.owner?emitter.classFactory.value:found.trait.key):implicitReceiver);
            const writeReceiver=emitter.output.slice(receiverStart);
            emitter.insert(';const '+previous+':number='+this.provider+'.as3GetLexicalMember('+receiver+','+found.trait.access+') as number;const '+value+':number='+previous+'-'+number+'(');
            emitter.skipTo(expressionStart(right));visit(emitter,right);emitter.catchup(right.end);
            emitter.insert(');return '+this.provider+'.as3SetLexicalMember('+writeReceiver+','+found.trait.access+','+value+');})())');emitter.skipTo(node.end);return true;
        }
        if(operation==='set'&&node.children[1].text==='+=') {
            const ref=found.trait.type&&this.plan.references.find(r=>r.owner===found.trait.owner&&r.start===found.trait.type.start&&r.end===found.trait.type.end);
            if(found.trait.kind!=='variable'||!ref||ref.kind!=='intrinsic'
                ||!(found.trait.visibility==='private'&&['String','int'].indexOf(ref.identity)>=0
                    ||['private','protected'].indexOf(found.trait.visibility)>=0&&!found.trait.static&&['Number','int','uint'].indexOf(ref.identity)>=0))
                fail('lexical addition requires qualified private String/int or instance numeric variable');
            const module=emitter.options.nativeTypedLocalAdditionModule;
            if(typeof module!=='string'||!module.trim()||/[\x00-\x1f'"\\]/.test(module))fail('lexical addition provider required');
            const unique=(name:string)=>{while(emitter.source.indexOf(name)>=0)name+='_';return name;};
            const add=unique('__as3_lexical_add'),receiver=unique('__as3_lexical_target'),previous=unique('__as3_lexical_previous'),value=unique('__as3_lexical_value');
            emitter.ensureImportIdentifier('as3Add as '+add,module,false);emitter.nativeSourceHelpers.add(add);
            // Read the old value before RHS effects; repeat the receiver for storage.
            // Addition performs AS3 primitive conversion; lexical storage coerces the field while
            // returning the unconverted expression result (null += 1 yields 1).
            emitter.catchup(node.start);emitter.insert('(<any>(()=>{const '+receiver+':any=');
            const receiverStart=emitter.output.length;
            if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
            else emitter.insert(found.trait.static?(found.trait.owner===this.owner?emitter.classFactory.value:found.trait.key):implicitReceiver);
            const writeReceiver=emitter.output.slice(receiverStart);
            emitter.insert(';const '+previous+':any='+this.provider+'.as3GetLexicalMember('+receiver+','+found.trait.access+');const '+value+':any='+add+'('+previous+',');
            emitter.skipTo(expressionStart(right));visit(emitter,right);emitter.catchup(right.end);
            emitter.insert(');return '+this.provider+'.as3SetLexicalMember('+writeReceiver+','+found.trait.access+','+value+');})())');
            emitter.skipTo(node.end);return true;
        }
        if(operation==='set'&&(node.children[1].text!=='='||found.trait.kind!=='variable'))fail('lexical assignment kind');
        if(operation==='call'&&found.trait.kind==='accessor')fail('internal getter invocation held');
        const fieldCall=operation==='call'&&found.trait.kind==='variable';
        if(fieldCall) {
            const ref=found.trait.type&&this.plan.references.find(r=>r.owner===found.trait.owner&&r.start===found.trait.type.start&&r.end===found.trait.type.end);
            if(!ref||ref.kind!=='intrinsic'||ref.identity!=='Function'||found.trait.static)fail('lexical value invocation authority');
            if(!found.receiver&&!this.declarations.find(b=>b.identity===this.owner).scriptGlobalExport)fail('lexical Function call requires caller script global authority');
        }
        emitter.catchup(node.start);
        if(operation!=='set')emitter.insert('(<any>');
        emitter.insert(this.provider+'.'+(operation==='get'?'as3GetLexicalMember':operation==='set'?'as3SetLexicalMember':fieldCall?'as3CallLexicalFunction':'as3CallLexicalMember')+'(');
        if(found.receiver){emitter.skipTo(found.receiver.start);visit(emitter,found.receiver);emitter.catchup(found.receiver.end);}
        else emitter.insert(found.trait.static?(found.trait.owner===this.owner?emitter.classFactory.value:found.trait.key):implicitReceiver);
        emitter.insert(','+found.trait.access);
        if(operation==='set'){emitter.insert(',');emitter.skipTo(expressionStart(right));visit(emitter,right);emitter.catchup(right.end);}
        if(operation==='call'){
            emitter.insert(',()=>[');args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(expressionStart(arg));visit(emitter,arg);emitter.catchup(arg.end);});emitter.insert(']');
            if(fieldCall&&!found.receiver)emitter.insert(','+this.scriptGlobal);
        }
        emitter.insert(operation==='set'?')':'))');emitter.skipTo(node.end);return true;
    }
}
