import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {nativeSourceTypeIdentity} from './native-source-type';

interface Local {name: string; type: string;}
interface OuterCapture {name: string; reference: string; read: string; write: string;}
interface Method {node: Node; name: string; static: boolean; locals: Local[]; wildcards: string[]; outerCaptures: OuterCapture[];}
/** Bounded local storage plan, resolved against original AS3 declarations. */
export class NativeTypedLocals {
    private methods: Method[] = [];
    private memberNames: string[] = [];
    constructor(owner: Node, qname: string, imports: string[]) {
        owner.findChild(K.CONTENT).children.forEach(member=>{
            if([K.VAR_LIST,K.CONST_LIST].indexOf(member.kind)>=0)
                member.findChildren(K.NAME_TYPE_INIT).forEach(d=>this.memberNames.push(d.findChild(K.NAME).text));
            else if([K.FUNCTION,K.GET,K.SET].indexOf(member.kind)>=0)this.memberNames.push(member.findChild(K.NAME).text);
        });
        owner.findChild(K.CONTENT).findChildren(K.FUNCTION).forEach(node => {
            const locals: Local[] = [], declared: Local[] = [], wildcards: string[] = [], parameters = node.findChild(K.PARAMETER_LIST).children.map(p => {
                const value=p.findChild(K.NAME_TYPE_INIT);return value && value.findChild(K.NAME).text;
            });
            node.findChild(K.PARAMETER_LIST).children.forEach(p => {
                const value = p.findChild(K.NAME_TYPE_INIT);
                if (value && nativeSourceTypeIdentity(value.findChild(K.TYPE), qname, imports) === '*')
                    wildcards.push(value.findChild(K.NAME).text);
            });
            const collect=(value: Node): void => {
                if (value.kind===K.FORIN||value.kind===K.FOREACH)this.fail('source enumeration targets held');
                if (value.kind===K.ASSIGN&&[K.ARRAY,K.OBJECT].indexOf(unwrapEncapsulatedExpression(value.children[0]).kind)>=0)
                    this.fail('source destructuring targets held');
                if ([K.VAR_LIST,K.CONST_LIST,K.VAR,K.CONST].indexOf(value.kind)>=0) value.findChildren(K.NAME_TYPE_INIT).forEach(decl=>{
                    const type=nativeSourceTypeIdentity(decl.findChild(K.TYPE),qname,imports),name=decl.findChild(K.NAME).text;
                    const other=declared.find(local=>local.name===name);
                    if(other&&other.type!==type&&(type!=='*'||other.type!=='*'))this.fail('conflicting local declaration types');
                    if(!other)declared.push({name,type});
                    if(type==='*') {
                        for(let parent=value.parent;parent&&parent!==node;parent=parent.parent)
                            if(parent.kind===K.CATCH&&parent.findChild(K.NAME).text===name)this.fail('wildcard local/catch redeclaration held');
                        if (value.kind===K.VAR_LIST || value.kind===K.VAR) wildcards.push(name);
                        return;
                    }
                    if(value.kind===K.CONST_LIST||value.kind===K.CONST)this.fail('typed local const held');
                    if(['Number','int','uint','Boolean','String','Object','Array'].indexOf(type)<0)this.fail('foreign local reference identity held');
                    if(parameters.indexOf(name)>=0)this.fail('typed local/parameter redeclaration held');
                    const previous=locals.find(local=>local.name===name);
                    if(previous&&previous.type!==type)this.fail('conflicting local declaration types');
                    for(let parent=value.parent;parent&&parent!==node;parent=parent.parent)
                        if(parent.kind===K.CATCH&&parent.findChild(K.NAME).text===name)this.fail('typed local/catch redeclaration held');
                    if(!previous)locals.push({name,type});
                });
                value.children.forEach(collect);
            };
            const body=node.findChild(K.BLOCK);if(body)collect(body);
            const catchWrites=(value:Node):void=>{
                if([K.ASSIGN,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC].indexOf(value.kind)>=0){
                    const target=unwrapEncapsulatedExpression(value.children[0]);
                    if(target&&target.kind===K.IDENTIFIER&&locals.some(l=>l.name===target.text))
                        for(let p=value.parent;p&&p!==node;p=p.parent)
                            if(p.kind===K.CATCH&&p.findChild(K.NAME).text===target.text)this.fail('typed-local catch-shadow writes held');
                    let matchingCatches=0;
                    if(target&&target.kind===K.IDENTIFIER) for(let p=value.parent;p&&p!==node;p=p.parent) {
                        if(p.kind!==K.CATCH||p.findChild(K.NAME).text!==target.text)continue;
                        if(++matchingCatches>1)this.fail('nested catch write ownership held');
                        if(this.memberNames.indexOf(target.text)>=0&&wildcards.indexOf(target.text)<0)this.fail('catch-shadow field write held');
                        if((parameters.indexOf(target.text)>=0||declared.some(d=>d.name===target.text))&&wildcards.indexOf(target.text)<0)
                            this.fail('non-wildcard outer catch write held');
                        if(value.kind!==K.ASSIGN||['=','+='].indexOf(value.children[1].text)<0)
                            this.fail('catch write operator held');
                    }
                }
                value.children.forEach(catchWrites);
            };
            if(body)catchWrites(body);
            const mods=node.findChild(K.MOD_LIST);
            this.methods.push({node,name:node.findChild(K.NAME).text,static:!!mods&&mods.children.some(m=>m.text==='static'),locals,wildcards,outerCaptures:[]});
        });
    }
    private fail(reason: string): never {throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: '+reason);}
    /** Exact mutable wildcard local/parameter/catch ownership; never infer a field. */
    wildcardReference(node: Node, emitter: any): {reference: string; read?: string; write?: string} {
        node=unwrapEncapsulatedExpression(node);
        if(node.kind!==K.IDENTIFIER)return null;
        let method: Node=node;while(method&&method.kind!==K.FUNCTION)method=method.parent;
        const plan=this.methods.find(m=>m.node===method);if(!plan)return null;
        const binding=emitter.findDefInScope(node.text);
        if(!binding||binding.bound||(binding.as3Type!=null&&binding.as3Type!=='*'))return null;
        const reference=emitter.getIdentifierRemap(node.text)||node.text;
        const catches: Node[]=[];
        for(let scope=node.parent;scope&&scope!==method;scope=scope.parent) {
            if(scope.kind===K.CATCH&&scope.findChild(K.NAME).text===node.text) {
                const type=scope.findChild(K.TYPE);
                if(type&&type.text!=='*')return null;
                catches.push(scope);
            }
        }
        if(catches.length>1)this.fail('nested catch write ownership held');
        if(catches.length&&plan.wildcards.indexOf(node.text)>=0) {
            let capture=plan.outerCaptures.find(c=>c.name===node.text);
            if(!capture) {
                let key='__as3_outer_wildcard_'+plan.outerCaptures.length;
                while(emitter.source.indexOf(key)>=0)key+='_';
                capture={name:node.text,reference,read:key+'_read',write:key+'_write'};
                plan.outerCaptures.push(capture);
            }
            emitter.nativeSourceHelpers.add(capture.read);emitter.nativeSourceHelpers.add(capture.write);
            return capture;
        }
        if(catches.length&&this.memberNames.indexOf(node.text)>=0)this.fail('catch-shadow field write held');
        return catches.length||plan.wildcards.indexOf(node.text)>=0?{reference}:null;
    }
    /** Prevent the older integer assignment pass from pre-coercing local RHS values. */
    owns(node: Node, emitter: any): boolean {
        node=unwrapEncapsulatedExpression(node);
        let method: Node=node;while(method&&method.kind!==K.FUNCTION)method=method.parent;
        const plan=this.methods.find(m=>m.node===method);if(!plan)return false;
        const name=node.kind===K.NAME_TYPE_INIT?node.findChild(K.NAME).text:node.kind===K.IDENTIFIER?node.text:null;
        const local=plan.locals.find(l=>l.name===name);if(!local)return false;
        if(node.kind===K.NAME_TYPE_INIT)return true;
        const binding=emitter.findDefInScope(name);
        return !!binding&&!binding.bound&&binding.as3Type!=='*';
    }
    lower(source: string, methodName: string, isStatic: boolean, provider: string, coercionProvider: string, stringProvider: string, additionProvider: string, array: string, unique: (name:string)=>string): string {
        const method=this.methods.find(m=>m.name===methodName&&m.static===isStatic);
        if(!method||!method.locals.length&&!method.outerCaptures.length)return source;
        const ts=require('typescript'),S=ts.SyntaxKind,file=ts.createSourceFile('TypedLocals.ts',source,ts.ScriptTarget.Latest,true);
        if(file.parseDiagnostics.length)this.fail('intermediate local syntax');
        const raw=(node:any):string=>source.slice(node.getStart(file),node.end);
        const unwrap=(node:any):any=>node.kind===S.ParenthesizedExpression?unwrap(node.expression):node;
        const resolve=(node:any):Local=>{
            node=unwrap(node);if(node.kind!==S.Identifier)return null;
            for(let p=node.parent;p;p=p.parent)if(p.kind===S.CatchClause&&p.variableDeclaration&&p.variableDeclaration.name.text===node.text)return null;
            return method.locals.find(l=>l.name===node.text);
        };
        const coerce=(local:Local,value:string):string=>local.type==='Boolean'?'!!('+value+')':local.type==='String'?stringProvider+'.as3CoerceString('+value+')'
            :local.type==='Array'?provider+'.as3CoerceReference('+value+','+array+')'
            :coercionProvider+'.as3Coerce'+(local.type==='int'?'Int':local.type==='uint'?'Uint':local.type)+'('+value+')';
        const write=(local:Local,value:string):string=>{const rhs=unique('typedRaw');return '(()=>{const '+rhs+': any='+value+';'+local.name+'='+coerce(local,rhs)+';return '+rhs+';})()';};
        const render=(node:any):string=>{
            if(node.kind===S.VariableDeclaration&&node.parent.kind!==S.CatchClause&&node.name.kind===S.Identifier){const local=method.locals.find(l=>l.name===node.name.text);if(local)return local.name+': any'+(node.initializer?' = '+coerce(local,render(node.initializer)):'');}
            if(node.kind===S.BinaryExpression){const local=resolve(node.left),op=node.operatorToken.kind;
                if(local&&op===S.EqualsToken)return write(local,render(node.right));
                if(local&&op>=S.FirstCompoundAssignment&&op<=S.LastCompoundAssignment){
                    const operator=raw(node.operatorToken).slice(0,-1),old=unique('typedOld'),rhs=unique('typedRhs'),value=unique('typedValue');
                    if(operator==='&&'||operator==='||')this.fail('typed logical assignment held');
                    const arithmetic=operator==='+'?additionProvider+'.as3Add('+old+','+rhs+')':coercionProvider+'.as3CoerceNumber('+old+')'+operator+coercionProvider+'.as3CoerceNumber('+rhs+')';
                    return '(()=>{const '+old+': any='+local.name+';const '+rhs+': any='+render(node.right)+';const '+value+': any='+arithmetic+';'+local.name+'='+coerce(local,value)+';return '+value+';})()';
                }
            }
            if(node.kind===S.PrefixUnaryExpression||node.kind===S.PostfixUnaryExpression){const local=resolve(node.operand);
                if(local&&(node.operator===S.PlusPlusToken||node.operator===S.MinusMinusToken)){
                    if(['Number','int','uint'].indexOf(local.type)<0)this.fail('nonnumeric local update held');
                    const old=unique('typedOld'),next=unique('typedNext');
                    return '(()=>{const '+old+'='+coercionProvider+'.as3CoerceNumber('+local.name+');const '+next+'='+old+(node.operator===S.PlusPlusToken?'+1':'-1')+';'+local.name+'='+coerce(local,next)+';return '+(node.kind===S.PostfixUnaryExpression?old:local.type==='int'?local.name:next)+';})()';
                }
            }
            const edits:{start:number;end:number;value:string}[]=[];
            ts.forEachChild(node,(child:any)=>{const value=render(child);if(value!==raw(child))edits.push({start:child.getStart(file),end:child.end,value});});
            let result=raw(node),start=node.getStart(file);edits.sort((a,b)=>b.start-a.start).forEach(e=>result=result.slice(0,e.start-start)+e.value+result.slice(e.end-start));return result;
        };
        // Generated closures capture function storage before a catch parameter can
        // shadow its spelling. Source reads still resolve to the catch parameter;
        // proven simple writes and += target the original function slot.
        const captures=method.outerCaptures.map(c=>'const '+c.read+'=()=>'+c.reference+';const '+c.write+'=('+c.write+'_value:any)=>('+c.reference+'='+c.write+'_value);').join('\n');
        return method.locals.map(l=>'var '+l.name+': any = '+(l.type==='Number'?'(0/0)':l.type==='int'||l.type==='uint'?'0':l.type==='Boolean'?'false':'null')+';').join('\n')+'\n'+captures+'\n'+render(file);
    }
}
