// Observer only: six complete classes and one interface are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Holder=klass('Holder'),Peer=klass('Peer'),Child=klass('Child'),OtherChild=klass('OtherChild'),Outsider=klass('Outsider'),Input=klass('Input');
const rows=[],add=(id,value)=>rows.push({id,value});
const error=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const holder=new Holder(),peer=new Peer(),outside=new Outsider(),positive=new Input(2),negative=new Input(-3);
add('calls',[holder.own(positive),peer.read(holder,negative),holder.calls]);
peer.content(holder,positive);add('void',holder.calls);
const first=holder.ownClosure(),second=peer.closure(holder),dynamicFn=peer.readName(holder,'parse');
add('closure',[first===second,second===dynamicFn,api.as3GetProperty(first,'length'),first(positive),holder.calls]);
const child=new Child();add('override',[child.own(positive),peer.read(child,negative),child.calls]);
const childFn=peer.closure(child);add('override-closure',[childFn===child.ownClosure(),childFn===first,childFn(positive),child.calls]);
const other=new OtherChild(),otherFn=outside.readName(other,'parse');
add('separate-package',[other.own(positive),peer.read(other,negative),other.ownOther(negative),otherFn(positive),other.calls,other.otherCalls,peer.closure(other)===otherFn]);
add('dynamic-call',[peer.dynamicOrdered(child),child.calls,peer.effects]);
try{peer.ordered(null);add('null-typed','accepted');}catch(e){add('null-typed',[...error(e),peer.effects]);}
try{peer.dynamicOrdered(null);add('null-dynamic','accepted');}catch(e){add('null-dynamic',[...error(e),peer.effects]);}
try{outside.readName(holder,'parse');add('outside','accepted');}catch(e){add('outside',[...error(e),holder.calls]);}
try{peer.writeName(holder,'parse',null);add('method-write','accepted');}catch(e){add('method-write',[...error(e),holder.calls]);}
add('delete',[peer.removeName(holder,'parse'),peer.closure(holder)===first]);
try{first();add('arity','accepted');}catch(e){add('arity',[...error(e),holder.calls]);}
try{first({});add('reference','accepted');}catch(e){add('reference',[...error(e),holder.calls]);}
add('reflection',[api.describeRegisteredFlashType(Holder).factory.methods.filter(m=>m.name==='parse').length,api.describeRegisteredFlashType(Child).factory.methods.filter(m=>m.name==='parse').length]);
add('fresh',[peer.closure(new Holder())===first,peer.read(new Holder(),positive),holder.calls]);
globalThis.result=rows;
