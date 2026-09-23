// Observer only: all five complete AS3 subjects are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Holder=klass('Holder'),Peer=klass('Peer'),Child=klass('Child'),OtherChild=klass('OtherChild'),Outsider=klass('Outsider');
const rows=[],add=(id,value)=>rows.push({id,value});
const error=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const value=new Holder(),peer=new Peer(),outside=new Outsider();
add('initial',[value.own(),peer.read(value),peer.readName(value,'hasDataDescriptor'),value.reads]);
value.setFlag(true);add('changed',[value.own(),peer.read(value),value.reads]);
const child=new Child();add('override',[child.own(),peer.read(child),peer.readName(child,'hasDataDescriptor'),child.reads]);
const other=new OtherChild();add('separate-package',[other.own(),peer.read(other),other.ownOther(),outside.readName(other,'hasDataDescriptor'),other.reads,other.otherReads]);
let conversions=0;const spy={valueOf(){conversions++;return 1;},toString(){conversions++;return 'yes';}};
try{peer.writeName(value,'hasDataDescriptor',spy);add('readonly','accepted');}catch(e){add('readonly',[...error(e),conversions,value.reads]);}
try{peer.ordered(child);add('readonly-override','accepted');}catch(e){add('readonly-override',[...error(e),peer.effects,child.reads]);}
add('delete',[peer.removeName(value,'hasDataDescriptor'),peer.removeName(child,'hasDataDescriptor'),value.reads,child.reads]);
try{outside.readName(value,'hasDataDescriptor');add('outside','accepted');}catch(e){add('outside',[...error(e),value.reads]);}
try{peer.read(null);add('null-typed','accepted');}catch(e){add('null-typed',error(e));}
try{peer.readName(null,'hasDataDescriptor');add('null-dynamic','accepted');}catch(e){add('null-dynamic',error(e));}
try{peer.ordered(null);add('null-write','accepted');}catch(e){add('null-write',[...error(e),peer.effects]);}
add('reflection',[api.describeRegisteredFlashType(Holder).factory.accessors.filter(a=>a.name==='hasDataDescriptor').length,api.describeRegisteredFlashType(Child).factory.accessors.filter(a=>a.name==='hasDataDescriptor').length]);
add('fresh',[new Holder().own(),new Child().own(),new OtherChild().own(),value.own(),value.reads]);
globalThis.result=rows;
