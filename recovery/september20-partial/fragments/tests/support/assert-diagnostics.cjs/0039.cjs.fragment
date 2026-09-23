// TypeScript diagnostics reference entire cyclic SourceFiles. Never hand the raw
// objects to assertion formatting: even a handful can exhaust the Node heap.
module.exports=function assertNoDiagnostics(ts,diagnostics,context='TypeScript emission') {
 if(!diagnostics.length)return;
 const rows=diagnostics.slice(0,20).map(d=>({code:d.code,start:d.start,length:d.length,
  file:d.file&&d.file.fileName,
  message:ts.flattenDiagnosticMessageText(d.messageText,' ').slice(0,2000)}));
 throw new Error(context+': '+diagnostics.length+' diagnostic(s)\n'+JSON.stringify(rows,null,2)
  +(diagnostics.length>20?'\nAdditional diagnostics omitted.':''));
};
