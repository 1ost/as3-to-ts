const klass=name=>load("nativeClass").readNativeClass(load(name)[name]);
const Child=klass("Child"),Grandchild=klass("Grandchild"),rows=[],row=(id,value)=>rows.push({id,value});
 const c=new Child(),g=new Grandchild();
 row('initial',c.read());row('chain',[c.chain(4.75),c.read(),c.readBase()]);
 row('int',[c.setCount(3.75),c.read()]);row('uint',[c.setFlags(-1),c.read()]);
 row('null',[c.chain(null),c.read()]);
 c.setCount(2147483647);row('prefix',[c.prefix(),c.read()]);
 c.setCount(2147483647);row('postfix',[c.postfix(),c.read()]);
 c.setFlags(0);row('decrement',[c.decrement(),c.read()]);
 c.setFlags(0);row('postdecrement',[c.postdecrement(),c.read()]);
 g.setWidth(9.5);row('grandchild',[g.inherited(),g.read(),g.readBase(),c.read()]);
 const read=c.read;row('bound',read.call(g));row('fresh',new Child().read());

globalThis.result=rows;
