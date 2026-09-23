const Flags=load('nativeClass').readNativeClass(load('Flags').Flags);
const rows=[];rows.push({id:'early',value:Flags.early});rows.push({id:'read',value:Flags.read()});rows.push({id:'members',value:[Flags.DEBUG,Flags.INFO,Flags.WARN,Flags.ERROR,Flags.FATAL,Flags.ALL]});Flags.level=0;rows.push({id:'mutable',value:Flags.read()});globalThis.result=rows;
