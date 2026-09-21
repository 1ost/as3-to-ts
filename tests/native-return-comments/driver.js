const P=modules.get('AS3MethodBinding'),C=modules.get('nativeClass').readNativeClass(modules.get('CommentReturn').CommentReturn),x=P.as3ConstructValue(C,()=>[]),rows=[];
function tag(value){return {kind:typeof value,value:value===undefined?'undefined':value};}
for(const id of ['compact','block','doc','multiple','multiline','lineComment','newline','afterComment','noValue','number','identifier','object','throwArray','throwDoc']){
 try{rows.push({id,result:tag(P.as3CallProperty(x,id,()=>id==='identifier'?['identity']:[]))});}
 catch(error){rows.push({id,thrown:tag(error)});}
}
globalThis.result=rows;