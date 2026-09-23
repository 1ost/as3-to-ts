import {NativeTypedLocals, NestedLocalFunction} from './native-typed-locals';
import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs} from './native-generated-declarations';
import {NativeGeneratedClassTraits} from './native-generated-traits';

interface Trait {
    name: string; visibility: string; static: boolean; kind: 'variable' | 'constant' | 'method';
    owner: string; node: Node; type: Node; key: string; access: string; parameterCount: number;
}
function fail(reason: string): never {throw new Error('AS3_GENERATED_LEXICAL_UNSUPPORTED: ' + reason);}
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
    readonly anonymousFunctions: {start:number;end:number;methodStart:number;name:string;parameters:string[]}[] = [];
    private readonly foreignPublicMembers = new Map<string, ReadonlyArray<{readonly name:string}>>();
    constructor(readonly plan: NativeGeneratedDeclarationPlan, readonly owner: string, source: string, typedLocals = false) {
        const input=nativeGeneratedDeclarationInputs(plan,plan.scope);
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
            const root=parse(name+'.as',input.sources[name].source);
            const clean=(node:Node):void=>{node.children=node.children.filter(Boolean);node.children.forEach(child=>{child.parent=node;clean(child);});};clean(root);
            const cls=root.findChild(K.PACKAGE).findChild(K.CONTENT).findChild(K.CLASS);
            if(!inherited)(this as any).ownClass=cls;
            cls.findChild(K.CONTENT).children.forEach(member=>{
                if([K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(member.kind)<0)return;
                const mods=modifiers(member), visibility=mods.indexOf('public')>=0?'public':mods.indexOf('private')>=0?'private':mods.indexOf('protected')>=0?'protected':'internal';
                if(visibility==='public'||inherited&&visibility==='private')return;
                if(visibility==='internal')fail('internal namespace storage authority');
                const isStatic=mods.indexOf('static')>=0;
                const constant=member.kind===K.CONST_LIST&&(visibility==='protected'||visibility==='private'&&isStatic);
                if(isStatic && member.kind!==K.VAR_LIST&&!constant&&(visibility!=='private'||member.kind!==K.FUNCTION))fail('static lexical initialization lowering required');
                if(inherited&&isStatic&&(!constant||name!==plan.bindings.find(b=>b.qname===owner).base))fail('inherited static lexical ownership');
                if(member.kind!==K.VAR_LIST&&member.kind!==K.FUNCTION&&!constant)fail('lexical constant/accessor lowering required');
                const declarations=member.kind===K.VAR_LIST||constant?member.findChildren(K.NAME_TYPE_INIT):[member];
                declarations.forEach(node=>{
                    const local=node.findChild(K.NAME).text;
                    const previous=this.traits.find(t=>t.name===local&&t.static===isStatic);
                    if(previous) {
                        if(inherited&&previous.visibility==='protected'&&visibility==='protected'&&previous.kind==='method'&&member.kind===K.FUNCTION) {
                            const ancestor={owner:name,node} as Trait;
                            if(modifiers(previous.node).indexOf('override')<0 || mods.indexOf('final')>=0 || signature(previous)!==signature(ancestor))
                                fail('protected override requires matching source signature');
                            overridden.add(previous);return;
                        }
                        fail('ambiguous lexical declaration: '+local);
                    }
                    const vector=node.findChild(K.VECTOR);
                    if(vector&&(isStatic||visibility!=='private'||member.kind!==K.VAR_LIST
                        ||!plan.vectors.some(v=>v.owner===name&&v.start===vector.start&&v.end===vector.end)))
                        fail('lexical vector storage authority');
                    const trait:Trait={name:local,visibility,static:isStatic,kind:member.kind===K.VAR_LIST?'variable':constant?'constant':'method',owner:name,node,
                        type:vector||node.findChild(K.TYPE),key:fresh('key'),access:fresh('access'),parameterCount:member.kind===K.FUNCTION?node.findChild(K.PARAMETER_LIST).children.filter(p=>!p.findChild(K.REST)).length:0};
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
                if(scope.kind!==K.FUNCTION&&scope.kind!==K.LAMBDA)continue;
                const declarations:Node[]=[];
                scope.findChild(K.PARAMETER_LIST).children.forEach(p=>{const d=p.findChild(K.NAME_TYPE_INIT);if(d)declarations.push(d);});
                const collect=(n:Node):void=>{if(n.kind===K.FUNCTION||n.kind===K.LAMBDA)return;if([K.VAR_LIST,K.CONST_LIST,K.VAR,K.CONST].indexOf(n.kind)>=0)declarations.push(...n.findChildren(K.NAME_TYPE_INIT));n.children.forEach(collect);};collect(scope.findChild(K.BLOCK));
                const slot=declarations.find(d=>d.findChild(K.NAME).text===target.text);
                if(slot){if(slot.findChild(K.TYPE)&&['*','String'].indexOf(slot.findChild(K.TYPE).text)<0)fail('typed for-in target held');return;}
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
                const returned=node.findChild(K.TYPE);if(returned&&['*','void'].indexOf(returned.text)<0)fail('anonymous typed return held');
                const outerNames:string[]=[];
                const outer=(n:Node):void=>{if(n.kind===K.LAMBDA||n.kind===K.FUNCTION&&n!==method)return;if(n.kind===K.NAME_TYPE_INIT)outerNames.push(n.findChild(K.NAME).text);n.children.forEach(outer);};outer(method);
                const inspect=(n:Node):void=>{
                    forInTarget(n);
                    if(n.kind===K.DOT&&n.children[0].kind===K.IDENTIFIER&&n.children[0].text==='this')fail('anonymous receiver property access held');
                    if([K.LAMBDA,K.FUNCTION,K.TRY].indexOf(n.kind)>=0)fail('nested anonymous callable body held');
                    if(n.kind===K.IDENTIFIER&&['super','arguments'].concat(memberNames).indexOf(n.text)>=0)fail('anonymous callable receiver/member lookup held');
                    if([K.VAR_LIST,K.CONST_LIST].indexOf(n.kind)>=0)n.findChildren(K.NAME_TYPE_INIT).forEach(v=>{
                        if(outerNames.indexOf(v.findChild(K.NAME).text)>=0)fail('anonymous local shadows outer storage');
                        const t=v.findChild(K.TYPE);if(n.kind===K.CONST_LIST||v.findChild(K.VECTOR)||t&&t.text!=='*')fail('anonymous typed local held');
                    });
                    n.children.forEach(inspect);
                };inspect(node.findChild(K.BLOCK));
                this.anonymousFunctions.push({start:node.start,end:node.end,methodStart:method.start,name:fresh('anonymous'),parameters});
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
                    if(!vector&&(!ref||(ref.kind!=='intrinsic'&&ref.kind!=='interface'&&ref.kind!=='declaration'&&ref.kind!=='native')))fail('typed local source reference lowering required');
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
        },true,this.nestedFunctions,this.anonymousFunctions);
    }
    trait(name:string,isStatic:boolean):Trait{return this.own.find(t=>t.name===name&&t.static===isStatic);}
    constantValue(trait:Trait):string {
        const init=trait.node.findChild(K.INIT);
        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
        const end=(node:Node):number=>node.children.reduce((value,child)=>Math.max(value,end(child)),node.end);
        const value=init&&input.sources[trait.owner].source.slice(init.start,end(init)).trim();
        const type=trait.type&&trait.type.text;
        if(trait.kind==='constant'&&(trait.visibility==='protected'||trait.visibility==='private'&&trait.static&&type==='String')&&value
            &&(type==='String'&&/^(?:"(?:[^"\\\r\n]|\\[^\r\n])*"|'(?:[^'\\\r\n]|\\[^\r\n])*')$/.test(value)
                ||type==='int'&&!trait.static&&/^[+-]?(?:0|[1-9]\d*)$/.test(value)&&Number(value)>=-2147483648&&Number(value)<=2147483647))
            return type==='int'?String(Number(value)):value.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        return fail('protected String/instance int or private static String literal constant required');
    }
    earlyStaticValue(trait:Trait):string|undefined {
        if(!trait.static||trait.kind!=='variable')return undefined;
        const init=trait.node.findChild(K.INIT);if(!init)return undefined;
        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
        const end=(node:Node):number=>node.children.reduce((value,child)=>Math.max(value,end(child)),node.end);
        const value=input.sources[trait.owner].source.slice(init.start,end(init)).trim();
        if(value==='null')return 'null';
        if(/^[+-]?\d+$/.test(value)&&trait.type&&trait.type.text==='int'&&Number(value)>=-2147483648&&Number(value)<=2147483647)return value;
        if(trait.type&&['int','uint','Number','Boolean','String','*'].indexOf(trait.type.text)>=0)
            fail('static lexical primitive initializer requires qualification');
        const expression=unwrapEncapsulatedExpression(init.children[0]);
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
            +(t.kind!=='method'?',type:'+this.typeExpression(t.type,t.owner,domain,intrinsic+'.array')+(t.kind==='constant'?',value:'+this.constantValue(t):''):',key:'+t.key+',parameterCount:'+t.parameterCount)+'}');
        return 'const '+this.scope+'='+this.provider+'.registerAS3LexicalMembers('+name+','+(parent?domain+'.'+parent.lexicalExport+'.get('+base+')':native?domain+'.'+native.nativeBaseExport+'.lexicalScope':'null')+',['+traits.join(',')+']);\n'
            +domain+'.'+own.lexicalExport+'.set('+name+','+this.scope+');\n'
            +this.traits.filter(t=>t.static&&t.owner!==this.owner).map(t=>'const '+t.key+'='+base+';\n').join('')
            +this.traits.map(t=>'const '+t.access+'='+this.provider+'.resolveAS3LexicalMember('+this.scope+','+JSON.stringify(t.name)+','+JSON.stringify(t.visibility)+','+t.static+');').join('\n')
            +'\n'+this.own.filter(t=>this.earlyStaticValue(t)!==undefined).map(t=>this.provider+'.as3SetLexicalMember('+name+','+t.access+','+this.earlyStaticValue(t)+');').join('\n');
    }
    emit(emitter:any,node:Node,visit:(emitter:any,node:Node)=>void):boolean {
        const resolve=(value:Node):{trait:Trait;receiver:Node;publicName?:string}|null=>{
            value=unwrapEncapsulatedExpression(value);if(!value)return null;
            let name:string,receiver:Node;
            if(value.kind===K.IDENTIFIER)name=value.text;
            else if(value.kind===K.DOT&&value.children[1]){name=value.children[1].text;receiver=unwrapEncapsulatedExpression(value.children[0]);}
            else return null;
            const lexicalName=this.traits.some(t=>t.name===name);
            if(!lexicalName&&!receiver)return null;
            let method=node;while(method.parent&&method.parent.kind!==K.CONTENT)method=method.parent;
            const staticContext=modifiers(method).indexOf('static')>=0;
            const binding=emitter.findDefInScope(receiver?receiver.text:name);
            if(!receiver&&binding&&!binding.bound)return null;
            let isStatic=false;
            if(receiver) {
                // Public members on another authenticated source receiver use
                // common property dispatch, including source null errors.
                let references = this.plan.references.filter(r=>r.owner===this.owner&&r.kind==='declaration'
                    &&receiver.kind===K.IDENTIFIER&&binding&&r.sourceName===binding.as3Type);
                if(receiver.kind===K.DOT&&receiver.children[0].text==='this') {
                    const field=this.traits.find(t=>t.name===receiver.children[1].text&&!t.static&&t.kind==='variable');
                    references=field&&field.type?this.plan.references.filter(r=>r.owner===field.owner&&r.kind==='declaration'
                        &&r.start===field.type.start&&r.end===field.type.end):[];
                }
                const identities=Array.from(new Set(references.map(r=>r.identity)));
                if(identities.length===1&&identities[0]!==this.owner&&this.plan.bindings.some(b=>b.qname===identities[0])) {
                    const identity=identities[0];
                    if(!this.foreignPublicMembers.has(identity)) {
                        const input=nativeGeneratedDeclarationInputs(this.plan,this.plan.scope);
                        this.foreignPublicMembers.set(identity,new NativeGeneratedClassTraits(this.plan,this.plan.scope,identity,input.sources[identity].source).instanceTraits
                            .filter(member=>member.kind==='variable'||member.kind==='accessor'));
                    }
                    if(this.foreignPublicMembers.get(identity).some(member=>member.name===name))return {trait:null,receiver,publicName:name};
                }
                if(!lexicalName)return null;
                if(receiver.kind!==K.IDENTIFIER)fail('lexical receiver requires exact source type');
                // Object-typed locals address the public property, even when the
                // current class has a private member with the same spelling.
                if(receiver.text!=='this'&&binding&&!binding.bound&&binding.as3Type==='Object')return null;
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
            if(!found.trait||found.trait.kind!=='variable'||found.trait.static||found.trait.visibility!=='private'
                ||!found.trait.type||['int','uint','Number'].indexOf(found.trait.type.text)<0)
                fail('lexical numeric update requires private instance numeric variable');
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
        if(target.kind===K.DOT&&target.children[1]&&['call','apply'].indexOf(target.children[1].text)>=0) {
            const inner=target.children[0],slot=resolve(inner);
            if(slot&&slot.trait&&slot.trait.kind==='variable') {
                const ref=slot.trait.type&&this.plan.references.find(r=>r.owner===slot.trait.owner&&r.start===slot.trait.type.start&&r.end===slot.trait.type.end);
                if(operation!=='call'||!ref||ref.kind!=='intrinsic'||ref.identity!=='Function'||slot.trait.static)
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
        if(found.publicName) {
            if(operation==='call'||operation==='set'&&node.children[1].text!=='=')fail('foreign public lexical collision operation');
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
        if(operation==='set'&&(node.children[1].text!=='='||found.trait.kind!=='variable'))fail('lexical assignment kind');
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
