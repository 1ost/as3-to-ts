const Values=load('nativeClass').readNativeClass(load('Values').Values);
const rows=[];
rows.push({id:'early',value:Values.early});
rows.push({id:'after-early',value:Values.read()});
rows.push({id:'defaults',value:Values.defaults()});
rows.push({id:'changed',value:Values.change(-3.75,true,'changed')});
rows.push({id:'changed-null',value:Values.change(0,false,null)});
new Values();rows.push({id:'after-construction',value:Values.read()});
globalThis.result=rows;
