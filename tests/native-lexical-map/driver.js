const P=modules.get('AS3MethodBinding'),read=modules.get('nativeClass').readNativeClass;
const Left=read(modules.get('Left').Left),Right=read(modules.get('Right').Right);
const l=P.as3ConstructValue(Left,()=>['init-L']),r=P.as3ConstructValue(Right,()=>['init-R']);
const call=(receiver,key,...args)=>P.as3CallProperty(receiver,key,()=>args),invoke=(fn,...args)=>P.as3CallValue(fn,()=>args);
const rows=[];function rec(id,value){rows.push({id,value});}
rec('left-read',call(l,'read'));rec('right-read',call(r,'read'));
rec('left-write',call(l,'write','changed-L'));rec('right-write',call(r,'write','changed-R'));
rec('left-private-call',call(l,'invoke','arg-L'));rec('right-private-call',call(r,'invoke','arg-R'));
rec('left-protected',call(l,'protectedRead'));rec('right-protected',call(r,'protectedRead'));
rec('left-static',call(Left,'readStatic'));rec('right-static',call(Right,'readStatic'));
rec('left-peer',call(l,'peer',r));rec('right-peer',call(r,'peer',l));
rec('left-cross-static',call(l,'crossStatic'));rec('right-cross-static',call(r,'crossStatic'));
rec('left-made',call(call(l,'make','made-R'),'read'));rec('right-made',call(call(r,'make','made-L'),'read'));
rec('left-closure-stable',call(l,'closure')===call(l,'closure'));rec('right-closure-stable',call(r,'closure')===call(r,'closure'));
rec('distinct-closures',call(l,'closure')!==call(r,'closure'));
rec('left-closure-call',invoke(call(l,'closure'),'closure-L'));rec('right-closure-call',invoke(call(r,'closure'),'closure-R'));
globalThis.result=rows;
globalThis.storageGuards=[[Left,l],[Right,r]].map(([C,x])=>({ownNames:Object.getOwnPropertyNames(x),prototypeNames:Object.getOwnPropertyNames(C.prototype),staticNames:Object.getOwnPropertyNames(C),entered:P.getAS3EnteredSourceConstructors(x).length}));
