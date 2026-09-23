// Separate host observer; source methods and initializers are emitted intact.
const nc=load('nativeClass'),read=name=>nc.readNativeClass(load(name)[name]);
const Consumer=read('Consumer'),Tracker=read('Tracker'),c=new Consumer(),rows=[];
rows.push({id:'initial',value:Tracker.events.concat()});
rows.push({id:'null',value:[c.nullCast()===null,Tracker.events.concat()]});
rows.push({id:'undefined',value:[c.undefinedCast()===null,Tracker.events.concat()]});
rows.push({id:'wrong',value:[c.wrongCast(7)===null,Tracker.events.concat()]});
rows.push({id:'target-null',value:[c.cast(null)===null,Tracker.events.concat()]});
const t=new (read('Target'))(),child=new (read('Child'))();
rows.push({id:'target-identity',value:c.cast(t)===t});
rows.push({id:'child-identity',value:c.cast(child)===child});
rows.push({id:'target-undefined',value:c.cast(undefined)===null});
rows.push({id:'target-wrong-values',value:[c.cast(7)===null,c.cast('text')===null,c.cast([])===null,c.cast({})===null,c.cast(new (read('NullTarget'))())===null]});
let calls=0;const object={valueOf(){calls++;return t;},toString(){calls++;return t;}};
rows.push({id:'no-conversion-hooks',value:[c.cast(object)===null,calls]});
rows.push({id:'single-evaluation',value:Tracker.events.concat()});
globalThis.result=rows;
