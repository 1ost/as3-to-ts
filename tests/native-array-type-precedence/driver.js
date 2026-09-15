const common=modules.get('AS3MethodBinding');
const C=modules.get('nativeClass').readNativeClass(modules.get('Array').Array);
const a=new C(),b=new C(),rows=[];
function rec(id,fn){try{rows.push({id,value:fn()});}catch(e){rows.push({id,error:{name:e.name,errorID:e.errorID}});}}
rec('own-default',()=>common.as3GetProperty(a,'items')===null);
rec('own-self-identity',()=>{common.as3SetProperty(a,'items',b);return common.as3GetProperty(a,'items')===b;});
rec('own-static-identity',()=>{common.as3SetProperty(C,'cache',b);return common.as3GetProperty(C,'cache')===b;});
rec('own-builtin-array-reject',()=>{common.as3SetProperty(a,'items',common.as3CreateArrayLiteral([]));return false;});
const H=modules.get('nativeClass').readNativeClass(modules.get('Holder').Holder),h=new H();
rec('imported-default',()=>common.as3GetProperty(h,'items')===null);
rec('imported-source-array-identity',()=>{common.as3SetProperty(h,'items',b);return common.as3GetProperty(h,'items')===b;});
rec('imported-builtin-array-reject',()=>{common.as3SetProperty(h,'items',common.as3CreateArrayLiteral([]));return false;});
globalThis.result=rows;globalThis.boundaries=[common.as3Is(a,C),modules.get('callableClass').callableClassIntrinsics.array===Array];
