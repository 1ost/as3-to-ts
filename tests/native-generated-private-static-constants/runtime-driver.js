// Observer only: all three complete subjects are emitted from retained AIR source.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Base=klass('PrivateConstants'),Child=klass('ChildConstants'),Spy=klass('ValueSpy');
const rows=[],row=(id,value)=>rows.push({id,value});
const base=new Base(),child=new Child();
row('early',Base.before);
row('direct',[base.read(),Base.readStatic()]);
row('child',[child.read(),child.readChild()]);
row('shadow',Base.shadow('argument'));
row('named',[Base.readName('MESSAGE'),child.readChildName('MESSAGE')]);
const spy=new Spy();
try{Base.writeName('MESSAGE',spy);row('write','accepted');}
catch(e){row('write',[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID'),spy.calls,Base.readStatic()]);}
row('delete',[Base.removeName('MESSAGE'),Base.readStatic()]);
const absent=api.as3GetProperty(Base,'MESSAGE');
row('external',[typeof absent,absent===undefined,absent===null]);
row('fresh',[new Base().read(),new Child().readChild()]);
globalThis.result=rows;
