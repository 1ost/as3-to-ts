exports.lifecycle=function(get,common) {
    const Subject=get('Subject'),Probe=get('Probe'),Flow=get('FlowProbe'),rows=[];
    for(const name of ['bindNew','freshPrototype','aliasCoerce','transitiveCoerce','objectAllocate','arrayAllocate','callbackAllocate','objectCoerce','arrayCoerce']) {
        Subject.count=0;
        try {const value=(Probe[name]||Flow[name])();rows.push([name,'ok',value.n,value instanceof Subject,Subject.count]);}
        catch(error) {rows.push([name,'error',error.errorID===undefined?null:error.errorID,Subject.count]);}
    }
    const operation=get('OperationProbe').run();
    const Log=get('LifecycleLog');Log.rows=[];
    try {get('Lifecycle');}catch(error){Log.rows.push('thrown:'+(error===Log.failure));}
    const first=Log.first,next=get('Lifecycle');Log.rows.push('retry:'+(first!==next));
    const a=common.as3ConstructClass(next,[]),b=common.as3ConstructClass(first,[]);
    Log.rows.push('values:'+a.n+':'+b.n);
    Log.rows.push('tokens:'+first.token+':'+next.token);
    Log.rows.push('types:'+common.as3Is(a,first)+':'+common.as3Is(b,next));
    Log.rows.push('coercions:'+(common.as3CallClass(first,[a])===a)+':'+(common.as3CallClass(next,[b])===b));
    const exact=new Subject(),forged=Object.create(Subject.prototype);
    return {rows,operation,lifecycle:Log.rows,boundaries:{classIdentity:common.as3AsClass(Subject)!==null,
        prototypeWritable:Object.getOwnPropertyDescriptor(Subject,'prototype').writable,
        declaredInstance:common.as3Is(exact,Subject),forgedInstance:common.as3Is(forged,Subject),
        coercionIdentity:common.as3CallValue(Subject,()=>[exact])===exact,
        constructedInstance:common.as3Is(common.as3ConstructClass(Subject,[]),Subject)}};
};
exports.predicates=function(get) {
    const Subject=get('Subject'),value=new Subject(),fake=Object.create(Subject.prototype);
    return {rows:[['ordinary-is-Class',Subject.functionCheck()],['subject-is-Class',Subject.classCheck()],
        ['genuine-is',Subject.isSubject(value)],['object-is',Subject.isSubject({})],
        ['genuine-as',Subject.asSubject(value)===value],['object-as',Subject.asSubject({})===null],
        ['class-as',Subject.asClass(Subject)===Subject],['ordinary-as',Subject.asClass(function(){})===null],
        ['negative-int',Subject.isInt(-1)],['negative-uint',Subject.isUint(-1)],
        ['large-int',Subject.isInt(2147483648)],['large-uint',Subject.isUint(2147483648)]],
        boundaries:{forgedIs:Subject.isSubject(fake),forgedAsNull:Subject.asSubject(fake)===null}};
};
