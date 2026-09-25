// Observer only: the captured AS3 class is emitted unchanged by the native compiler.
const Probe=load('nativeClass').readNativeClass(load('StringPatternLiteralProbe').StringPatternLiteralProbe);
const instance=new Probe();
globalThis.result=scenarioSteps.map(step=>{
    instance.exercise(...step.calls[0].args);
    return {id:step.id,result:instance.result};
});
