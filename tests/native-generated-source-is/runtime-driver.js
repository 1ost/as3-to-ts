// Separate observer: complete source methods and initializers are emitted intact.
const nc=load('nativeClass'),read=name=>nc.readNativeClass(load(name)[name]);
const Consumer=read('Consumer'),Tracker=read('Tracker'),c=new Consumer(),rows=[];
rows.push({id:'initial',value:Tracker.events.concat()});
rows.push({id:'null',value:[c.nullTest(),Tracker.events.concat()]});
rows.push({id:'undefined',value:[c.undefinedTest(),Tracker.events.concat()]});
rows.push({id:'wrong',value:[c.wrongTest(7),Tracker.events.concat()]});
rows.push({id:'target-null',value:[c.test(null),Tracker.events.concat()]});
const t=new (read('Target'))(),child=new (read('Child'))();
rows.push({id:'target',value:c.test(t)});
rows.push({id:'child',value:c.test(child)});
rows.push({id:'target-undefined',value:c.test(undefined)});
rows.push({id:'target-wrong-values',value:[c.test(7),c.test('text'),c.test([]),c.test({}),c.test(new (read('NullTarget'))())]});
let calls=0;const object={valueOf(){calls++;return t;},toString(){calls++;return t;}};
rows.push({id:'no-conversion-hooks',value:[c.test(object),calls]});
rows.push({id:'single-evaluation',value:Tracker.events.concat()});
rows.push({id:'own',value:[c.own(c),c.own(t),c.own(null)]});
globalThis.result=rows;
