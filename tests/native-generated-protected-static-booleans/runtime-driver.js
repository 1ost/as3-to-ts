const Flags=load('nativeClass').readNativeClass(load('Flags').Flags);
const rows=[];
rows.push({id:'early',value:Flags.early});rows.push({id:'after',value:Flags.after});
rows.push({id:'order',value:Flags.log});rows.push({id:'read',value:Flags.read()});
const Child=load('nativeClass').readNativeClass(load('Child').Child);
rows.push({id:'inherited',value:Child.inherited()});rows.push({id:'changed',value:Flags.change(false)});
rows.push({id:'child-after',value:Child.inherited()});rows.push({id:'child-mutation',value:Child.mutate(true)});
rows.push({id:'base-after',value:Flags.read()});new Child();rows.push({id:'construction',value:Flags.read()});
globalThis.result=rows;
