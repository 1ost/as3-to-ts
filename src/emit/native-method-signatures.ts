import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {nativeSourceTypeIdentity} from './native-source-type';

export type NativeMethodParameterType = '*' | 'Number' | 'Boolean';
export type NativeMethodReturnType = NativeMethodParameterType | 'void';
export interface NativeMethodSourceSpan { readonly start: number; readonly end: number; }
export interface NativeMethodDefault extends NativeMethodSourceSpan {
    readonly kind: 'number' | 'boolean' | 'string' | 'null' | 'undefined';
    /** Exact AS3 literal spelling; never evaluated as JavaScript by this planner. */
    readonly text: string;
}
export interface NativeMethodParameter extends NativeMethodSourceSpan {
    readonly name: string; readonly type: NativeMethodParameterType;
    readonly index: number; readonly optional: boolean; readonly defaultLiteral?: NativeMethodDefault;
}
export interface NativeMethodReturn extends NativeMethodSourceSpan {
    readonly expression: NativeMethodSourceSpan | null;
}
export interface NativeMethodSignature extends NativeMethodSourceSpan {
    readonly name: string; readonly isStatic: boolean; readonly visibility: 'public' | 'protected' | 'private';
    readonly body: NativeMethodSourceSpan; readonly parameters: ReadonlyArray<NativeMethodParameter>;
    readonly minimumArguments: number; readonly maximumArguments: number; readonly formalLength: number;
    readonly returnType: NativeMethodReturnType; readonly returns: ReadonlyArray<NativeMethodReturn>;
    readonly throws: ReadonlyArray<NativeMethodSourceSpan>;
    readonly fallthrough: 'undefined' | 'not-admitted';
}
/** Toolkit-authenticated complete documents, in addition to the exact original source digest. */
export interface NativeMethodSignatureEvidence {
    readonly sourceSha256: string;
    readonly classXML: string; readonly classXMLSha256: string;
    readonly instanceXML: string; readonly instanceXMLSha256: string;
}
interface XML {name: string; attributes: {[key: string]: string}; children: XML[];}
const fail = (reason: string): never => {throw new Error('AS3_METHOD_SIGNATURE_UNSUPPORTED: ' + reason);};
const hash = (text: string): string => require('crypto').createHash('sha256').update(text).digest('hex');
const children = (node: Node): Node[] => node.children.filter(Boolean);
const child = (node: Node, kind: K): Node => children(node).find(value => value.kind === kind);
const mods = (node: Node): string[] => {const value=child(node,K.MOD_LIST);return value ? children(value).map(x=>x.text) : [];};
const fingerprint = (node: Node): string => JSON.stringify([node.kind,node.start,node.end,node.text,node.qualifiedName,children(node).map(fingerprint)]);
function xml(text: string): XML {
    if (typeof text !== 'string' || !text.trim()) return fail('complete reflection XML required');
    const parser = require('sax').parser(true), stack: XML[] = [];let root: XML;
    parser.ondoctype = (): never => fail('reflection DTD held');
    parser.ontext = (value: string): void => {if (value.trim()) fail('unexpected reflection text');};
    parser.oncdata = (): never => fail('reflection CDATA held');
    parser.onopentag = (tag: any): void => {
        const next: XML = {name:tag.name,attributes:Object.assign({},tag.attributes),children:[]};
        if(stack.length)stack[stack.length-1].children.push(next);else {if(root)fail('multiple reflection roots');root=next;}
        stack.push(next);
    };
    parser.onclosetag = (): void => {stack.pop();};
    parser.onerror = (): never => fail('invalid reflection XML');
    parser.write(text).close();if(!root || stack.length)return fail('incomplete reflection XML');return root;
}
function canonical(node: XML): string {
    return JSON.stringify([node.name,Object.keys(node.attributes).sort().map(k=>[k,node.attributes[k]]),node.children.map(canonical).sort()]);
}
function attributes(node: XML, required: {[key:string]: string}, optional: {[key:string]:string} = {}): void {
    const wanted=Object.assign({},required);
    Object.keys(optional).forEach(key=>{if(node.attributes[key]!==undefined)wanted[key]=optional[key];});
    if(JSON.stringify(Object.keys(node.attributes).sort().map(k=>[k,node.attributes[k]]))
        !==JSON.stringify(Object.keys(wanted).sort().map(k=>[k,wanted[k]])))fail('reflection attributes '+node.name);
}

/** A source-owned plan only. It performs no emission, invocation or runtime publication. */
export class NativeMethodSignatures {
    readonly sourceSha256: string;
    readonly methods: ReadonlyArray<NativeMethodSignature>;
    private readonly origins = new Map<number, {fingerprint: string; method: NativeMethodSignature; returns: Map<number,string>}>();
    constructor(readonly qname: string, readonly source: string, evidence: NativeMethodSignatureEvidence) {
        if(!evidence || typeof source!=='string' || typeof evidence.classXML!=='string' || typeof evidence.instanceXML!=='string' || hash(source)!==evidence.sourceSha256
            || hash(evidence.classXML)!==evidence.classXMLSha256 || hash(evidence.instanceXML)!==evidence.instanceXMLSha256)
            fail('exact source and complete reflection digests required');
        this.sourceSha256=evidence.sourceSha256;
        const tree=parse(qname+'.as',source), classes:Node[]=[];
        const walk=(node:Node,visit:(n:Node)=>void):void=>{visit(node);children(node).forEach(n=>walk(n,visit));};
        walk(tree,n=>{if(n.kind===K.CLASS)classes.push(n);if(n.kind===K.INTERFACE||n.kind===K.INCLUDE||n.kind===K.USE||n.kind===K.NAMESPACE_DECLARATION)fail('source declaration context held');});
        if(classes.length!==1)fail('one complete source declaration required');
        const owner=classes[0],pkg=child(tree,K.PACKAGE),name=child(owner,K.NAME).text;
        if(!pkg || child(pkg,K.NAME).text+'.'+name!==qname)fail('source declaration identity');
        if(mods(owner).indexOf('public')<0 || mods(owner).some(v=>['public','dynamic','final'].indexOf(v)<0))fail('class declaration flags held');
        children(child(pkg,K.CONTENT)).forEach(n=>{if(n!==owner&&[K.IMPORT,K.MULTI_LINE_COMMENT,K.AS_DOC,K.STMT_EMPTY].indexOf(n.kind)<0)fail('additional package declarations held');});
        children(tree).filter(n=>n!==pkg).forEach(n=>{if(n.kind!==K.CONTENT||children(n).some(c=>[K.MULTI_LINE_COMMENT,K.AS_DOC,K.STMT_EMPTY].indexOf(c.kind)<0))fail('additional compilation-unit declarations held');});
        if(child(owner,K.EXTENDS)||child(owner,K.IMPLEMENTS_LIST))fail('Object-root declaration required');
        const imports=children(child(pkg,K.CONTENT)).filter(n=>n.kind===K.IMPORT).map(n=>n.text);
        const identity=(type:Node):string=>nativeSourceTypeIdentity(type,qname,imports);
        const reflectedType=(type:Node):string=>identity(type).replace(/\.([^.]*)$/,'::$1');
        const xmlName=qname.replace(/\.([^.]*)$/,'::$1'),content=child(owner,K.CONTENT),members=children(content);
        const plans:NativeMethodSignature[]=[],methodOrigins:{node:Node;plan:NativeMethodSignature;returnNodes:Node[]}[]=[];
        const occupied = new Set<string>();
        const span=(node:Node):NativeMethodSourceSpan=>{
            if(!node || node.start<0 || node.end<node.start || node.end>source.length)fail('invalid original source span');
            return Object.freeze({start:node.start,end:node.end});
        };
        const literal=(node:Node,type:NativeMethodParameterType,init:Node):NativeMethodDefault=>{
            // The legacy parser's unary node has reversed bounds. Recover only
            // a literal sign from INIT's original offset and its scalar child.
            const signed=(node.kind===K.PLUS||node.kind===K.MINUS)&&children(node).length===1&&children(node)[0].kind===K.LITERAL;
            const bounds=signed?{start:init.start,end:span(children(node)[0]).end}:span(node);
            if(signed && source.slice(bounds.start,children(node)[0].start)!==(node.kind===K.MINUS?'-':'+'))fail('signed default source ownership');
            let kind:NativeMethodDefault['kind'];const text=source.slice(bounds.start,bounds.end);
            const scalar=node.kind===K.LITERAL || (node.kind===K.PLUS||node.kind===K.MINUS)&&children(node).length===1&&children(node)[0].kind===K.LITERAL;
            if(scalar && /^[+-]?(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.test(text)
                && !/^[+-]?0\d/.test(text) && isFinite(Number(text)))kind='number';
            else if(node.kind===K.IDENTIFIER && (text==='true'||text==='false'))kind='boolean';
            else if(node.kind===K.IDENTIFIER && (text==='null'||text==='undefined'))kind=text;
            else if(node.kind===K.LITERAL && /^(?:"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*')$/.test(text))kind='string';
            else return fail('optional source literal held');
            if(type==='Number'&&kind!=='number'||type==='Boolean'&&kind!=='boolean')fail('default literal/type mismatch');
            return Object.freeze({start:bounds.start,end:bounds.end,text,kind});
        };
        const parameterNodes=(node:Node):Node[]=>children(child(node,K.PARAMETER_LIST));
        const parameterPlan=(node:Node,index:number):NativeMethodParameter=>{
            const value=child(node,K.NAME_TYPE_INIT);if(!value||child(node,K.REST))return fail('rest method parameters held');
            const type=identity(child(value,K.TYPE));if(['*','Number','Boolean'].indexOf(type)<0)fail('foreign or unsupported method parameter type');
            const init=child(value,K.INIT),defaultLiteral=init?literal(children(init)[0],type as NativeMethodParameterType,init):undefined;
            return Object.freeze({start:span(value).start,end:defaultLiteral?Math.max(value.end,defaultLiteral.end):value.end,name:child(value,K.NAME).text,type:type as NativeMethodParameterType,index,optional:!!init,defaultLiteral});
        };
        members.forEach(member=>{
            if([K.MULTI_LINE_COMMENT,K.AS_DOC,K.STMT_EMPTY].indexOf(member.kind)>=0)return;
            if(member.kind===K.GET||member.kind===K.SET)fail('accessors held');
            if([K.FUNCTION,K.VAR_LIST,K.CONST_LIST].indexOf(member.kind)<0)fail('unsupported complete class member');
            const flags=mods(member),visibility=flags.filter(v=>['public','protected','private'].indexOf(v)>=0);
            if(visibility.length!==1||flags.some(v=>['public','protected','private','static','final'].indexOf(v)<0))fail('member namespace or override held');
            walk(member,n=>{if(n!==member&&(n.kind===K.FUNCTION||n.kind===K.LAMBDA))fail('nested source functions held');
                if(n.kind===K.IDENTIFIER&&n.text==='arguments')fail('source arguments held');});
            if(member.kind!==K.FUNCTION)return;
            const methodName=child(member,K.NAME).text;if(methodName===name){if(flags.length!==1||flags[0]!=='public')fail('constructor declaration flags held');return;}
            const key=(flags.indexOf('static')>=0?'static:':'instance:')+methodName;if(occupied.has(key))fail('ambiguous ordinary method name');occupied.add(key);
            const parameters=parameterNodes(member).map(parameterPlan),parameterNames=new Set<string>();let optional=false;
            parameters.forEach(p=>{if(parameterNames.has(p.name))fail('duplicate method parameter');parameterNames.add(p.name);if(optional&&!p.optional)fail('required parameter after default');optional=optional||p.optional;});
            const returnType=identity(child(member,K.TYPE)) as NativeMethodReturnType;
            if(['*','Number','Boolean','void'].indexOf(returnType)<0)fail('foreign or unsupported method return type');
            const body=child(member,K.BLOCK);if(!body)fail('ordinary method body required');
            const returns:NativeMethodReturn[]=[],throws:NativeMethodSourceSpan[]=[],returnNodes:Node[]=[];
            walk(body,n=>{
                if(returnType!=='*' && [K.TRY,K.CATCH,K.FINALLY].indexOf(n.kind)>=0)fail('typed exception-return regions held');
                if(n.kind!==K.RETURN)return;
                // The legacy parser represents throw with RETURN as well.
                if(/^throw\b/.test(source.slice(n.start))){throws.push(span(n));return;}
                if(!/^return\b/.test(source.slice(n.start)))fail('original return keyword ownership');
                const expressions=children(n);if(expressions.length>1)fail('return expression shape');
                if(returnType==='void'&&expressions.length || returnType!=='void'&&returnType!=='*'&&!expressions.length)fail('return value/type mismatch');
                returns.push(Object.freeze({start:span(n).start,end:n.end,expression:expressions.length?span(expressions[0]):null}));returnNodes.push(n);
            });
            const statements=children(body).filter(n=>[K.STMT_EMPTY,K.MULTI_LINE_COMMENT,K.AS_DOC].indexOf(n.kind)<0);
            if(returnType!=='*'&&returnType!=='void'&&(!statements.length||statements[statements.length-1].kind!==K.RETURN))fail('typed fallthrough completion held');
            const plan:NativeMethodSignature=Object.freeze({start:span(member).start,end:member.end,name:methodName,isStatic:flags.indexOf('static')>=0,
                visibility:visibility[0] as NativeMethodSignature['visibility'],body:span(body),parameters:Object.freeze(parameters),
                minimumArguments:parameters.filter(p=>!p.optional).length,maximumArguments:parameters.length,formalLength:parameters.length,
                returnType,returns:Object.freeze(returns),throws:Object.freeze(throws),fallthrough:(returnType==='*'||returnType==='void'?'undefined':'not-admitted') as NativeMethodSignature['fallthrough']});
            plans.push(plan);methodOrigins.push({node:member,plan,returnNodes});
        });
        const cls=xml(evidence.classXML),instance=xml(evidence.instanceXML);
        attributes(cls,{name:xmlName,base:'Class',isDynamic:'true',isFinal:'true',isStatic:'true'});
        attributes(instance,{name:xmlName,base:'Object',isDynamic:String(mods(owner).indexOf('dynamic')>=0),isFinal:String(mods(owner).indexOf('final')>=0),isStatic:'false'});
        if(cls.name!=='type'||instance.name!=='type')fail('reflection root kind');
        const factories=cls.children.filter(n=>n.name==='factory');if(factories.length!==1)fail('one complete factory required');
        attributes(factories[0],{type:xmlName});
        if(JSON.stringify(factories[0].children.map(canonical).sort())!==JSON.stringify(instance.children.map(canonical).sort()))fail('complete factory/instance disagreement');
        const checkParameters=(record:XML,method:Node):void=>{
            const parameters=parameterNodes(method);if(record.children.length!==parameters.length)fail('reflected parameter count');
            record.children.forEach((p,index)=>{const value=child(parameters[index],K.NAME_TYPE_INIT);if(!value||child(parameters[index],K.REST))fail('reflected rest signature held');
                if(p.name!=='parameter'||p.children.length)fail('reflected parameter shape');attributes(p,{index:String(index+1),type:reflectedType(child(value,K.TYPE)),optional:String(!!child(value,K.INIT))});});
        };
        const checkSurface=(records:XML[],isStatic:boolean):void=>{
            const wanted:{name:string;kind:string;node:Node}[]=[];
            members.forEach(m=>{if(mods(m).indexOf('public')<0 || (mods(m).indexOf('static')>=0)!==isStatic)return;
                if(m.kind===K.FUNCTION){if(child(m,K.NAME).text!==name)wanted.push({name:child(m,K.NAME).text,kind:'method',node:m});}
                else if(m.kind===K.VAR_LIST||m.kind===K.CONST_LIST)children(m).filter(n=>n.kind===K.NAME_TYPE_INIT).forEach(n=>wanted.push({name:child(n,K.NAME).text,kind:m.kind===K.VAR_LIST?'variable':'constant',node:n}));});
            const seen=new Set<string>();let constructors=0;const bases:string[]=[];let prototypeCount=0;
            records.forEach(r=>{
                if(r.name==='extendsClass'){attributes(r,{type:r.attributes.type});if(r.children.length)fail('reflection ancestry children');bases.push(r.attributes.type);return;}
                if(isStatic&&r.name==='accessor'&&r.attributes.name==='prototype'){attributes(r,{name:'prototype',access:'readonly',type:'*',declaredBy:'Class'});if(r.children.length||++prototypeCount>1)fail('Class prototype reflection');return;}
                if(!isStatic&&r.name==='constructor'){
                    const ctor=members.find(m=>m.kind===K.FUNCTION&&child(m,K.NAME).text===name);attributes(r,{});if(++constructors>1||!ctor)fail('unowned reflected constructor');checkParameters(r,ctor);return;
                }
                const key=r.name+':'+r.attributes.name,match=wanted.find(w=>w.kind===r.name&&w.name===r.attributes.name);
                if(!match||seen.has(key))fail('complete reflected source surface');seen.add(key);
                if(r.name==='method'){attributes(r,{name:match.name,declaredBy:xmlName,returnType:reflectedType(child(match.node,K.TYPE))});checkParameters(r,match.node);}
                else {attributes(r,{name:match.name,type:reflectedType(child(match.node,K.TYPE))},{declaredBy:xmlName});if(r.children.length)fail('reflected field children');}
            });
            if(wanted.length!==seen.size)fail('missing reflected source member');
            if(JSON.stringify(bases.slice().sort())!==JSON.stringify((isStatic?['Class','Object']:['Object']).sort())||isStatic&&prototypeCount!==1)fail('complete reflection ancestry');
            const ctor=members.find(m=>m.kind===K.FUNCTION&&child(m,K.NAME).text===name);
            if(!isStatic&&ctor&&parameterNodes(ctor).length&&constructors!==1)fail('missing constructor signature');
        };
        checkSurface(cls.children.filter(n=>n.name!=='factory'),true);checkSurface(instance.children,false);
        this.methods=Object.freeze(plans);
        methodOrigins.forEach(origin=>this.origins.set(origin.node.start,{fingerprint:fingerprint(origin.node),method:origin.plan,returns:new Map(origin.returnNodes.map(n=>[n.start,fingerprint(n)] as [number,string]))}));
    }
    /** Call only with an unmodified original AS3 method node, before emitter transformations. */
    forMethod(node: Node): NativeMethodSignature {
        const origin=node&&this.origins.get(node.start);
        if(!origin||origin.fingerprint!==fingerprint(node))return fail('unowned or changed original method');return origin.method;
    }
    forReturn(method: Node, node: Node): NativeMethodReturn {
        const plan=this.forMethod(method),origin=this.origins.get(method.start);
        if(!node||origin.returns.get(node.start)!==fingerprint(node))return fail('unowned original return');
        return plan.returns.find(value=>value.start===node.start);
    }
}
