// Observer only: all five complete subjects are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Entry=klass('Entry'),Peer=klass('Peer'),Child=klass('Child'),OtherChild=klass('OtherChild'),Outsider=klass('Outsider');
const rows=[],add=(id,value)=>rows.push({id,value});
const error=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const entry=new Entry(),peer=new Peer(),outside=new Outsider();
add('initial',[entry.before,entry.read(),peer.read(entry)]);
add('constants',peer.constants());
add('assignment',[entry.assign(-1.5),entry.read(),peer.write(entry,4294967298.75),peer.read(entry)]);
add('peer-dynamic',[peer.readName(entry,'_crc32'),peer.readName(entry,'_sizeCompressed')]);
add('peer-dynamic-write',[peer.writeName(entry,'_sizeUncompressed',-3.5),entry.read()]);
add('peer-delete',[peer.removeName(entry,'_crc32'),entry.readName('_crc32')]);
const child=new Child();add('child',[child.before,child.inherited(),peer.read(child)]);
const other=new OtherChild();add('cross-package-child',[other.read(),other.own(),peer.read(other),other.ownName('_crc32')]);
add('cross-package-peer',[peer.writeName(other,'_crc32',17),other.read(),outside.readName(other,'_crc32'),other.own()]);
try{outside.readName(entry,'_crc32');add('outside-read','accepted');}catch(e){add('outside-read',error(e));}
try{outside.writeName(entry,'_crc32',8);add('outside-write','accepted');}catch(e){add('outside-write',[...error(e),entry.read()]);}
try{peer.ordered(null);add('null-write','accepted');}catch(e){add('null-write',[...error(e),peer.effects]);}
try{peer.read(null);add('null-read','accepted');}catch(e){add('null-read',error(e));}
add('static-dynamic',[peer.staticName('HEADER'),peer.staticName('MAXIMUM')]);
let conversions=0;const spy={valueOf(){conversions++;return 5;}};
try{peer.writeStatic('HEADER',spy);add('constant-write','accepted');}catch(e){add('constant-write',[...error(e),conversions,peer.constants()]);}
add('constant-delete',[peer.removeStatic('HEADER'),peer.constants()]);
const absent=outside.readName(Entry,'HEADER');add('outside-static',[typeof absent,absent===undefined,absent===null]);
add('reflection',[api.describeRegisteredFlashType(Entry).factory.variables.filter(x=>x.name==='_crc32').length,api.describeRegisteredFlashType(Entry).constants.filter(x=>x.name==='HEADER').length]);
add('fresh',[new Entry().read(),new OtherChild().own(),entry.read()]);
globalThis.result=rows;
