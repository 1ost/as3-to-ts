module.exports=function(get,common) {
    const Subject=get('Subject'),rows=[];
    for(const name of ['classType','functionType','primitives','getterType','effectType','commaType','missingDynamic','missingSealed','nullProperty','undefinedProperty','shadowClass','shadowUndefined','throwingType','readonlyWrite']) {
        Subject.ticks=0;Subject.external='sentinel';
        try {rows.push([name,'ok',Subject[name](),Subject.ticks]);}
        catch(error) {rows.push([name,'error',error && error.errorID!==undefined?error.errorID:error,Subject.ticks]);}
    }
    const one=new Subject(),two=new Subject();one.value=Subject;two.value=function(){};
    for(const [index,value] of [one,two].entries()) {
        Subject.ticks=0;Subject.order=[];Subject.external=value;
        rows.push(['receiver',index,Subject.receiverType(),Subject.ticks,Subject.order]);
    }
    // These are actual common XML values supplied to unchanged AS3 typeof code.
    // Their construction is a provider prerequisite, not emitted XML allocation.
    const values=[undefined,null,true,false,1,-1,1.5,'text','',[],{},Subject,new Subject(),function(){},
        new common.XML('<root><child/></root>'),new common.XMLList([new common.XML('<a/>'),new common.XML('<b/>')])];
    for(let index=0;index<values.length;index++) {Subject.external=values[index];rows.push(['supplied',index,Subject.suppliedType()]);}
    return rows;
};
