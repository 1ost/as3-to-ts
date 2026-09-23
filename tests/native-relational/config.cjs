const fs=require('fs'),path=require('path'),cp=require('child_process');const compiler=path.resolve(__dirname,'../..');
function config(name='retained76',capture='capture-c'){
 const evidence=path.join(__dirname,'fixtures',name,capture),source=fs.readFileSync(path.join(evidence,'sources/original/probe/RelationalReview.as'),'utf8'),metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true}));
 const options={customVisitors:[],definitionsByNamespace:{probe:['RelationalReview']},nativeClassInitialization:{classes:{'probe.RelationalReview':'lazy'}},nativeCallableClasses:{'probe.RelationalReview':source},nativeCallableMetadata:{module:'./AS3MethodBinding',classes:metadata.classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition',nativeRelationalModule:'./AS3Relational'};
 return {source,options};
}
module.exports={compiler,config};
