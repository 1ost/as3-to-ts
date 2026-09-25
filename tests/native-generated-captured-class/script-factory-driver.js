// Native compiler/provider lifecycle checks, separate from the unchanged AIR rows.
// Injected provider failures are not evidence about source static initializer retry.
{
    let checks = 0;
    const check = (condition, message) => {
        if (!condition) throw Error('script factory: ' + message);
        checks++;
    };
    const failure = fn => { try { fn(); } catch (error) { return error; } throw Error('expected failure'); };
    function cohort(mode) {
        const attempts = [], sentinel = new Error('injected provider failure');
        let active, registered = 0, inject = mode;
        const overrides = new Map();
        overrides.set('AS3ScriptGlobal', {...api, instantiateAS3ScriptUnit(domain, declaration, factory) {
            return api.instantiateAS3ScriptUnit(domain, declaration, context => {
                active = {domain, global: context.global}; attempts.push(active);
                check(api.isAS3ScriptGlobal(active.global), 'global exists before Class factory');
                check(/not initialized/.test(failure(() => api.readAS3ScriptGlobalDeclaration(active.global, 'ClassCallbacks', 'cases')).message), 'Class is unpublished during creation');
                try { return factory(context); } finally { active = undefined; }
            });
        }});
        overrides.set('AS3GeneratedClass', {...api, registerAS3GeneratedClass(...args) {
            check(!!active && api.isAS3ScriptGlobal(active.global), 'registrar runs inside source unit');
            registered++;
            if (inject === 'before') { inject = undefined; throw sentinel; }
            const value = api.registerAS3GeneratedClass(...args);
            if (inject === 'after') { inject = undefined; throw sentinel; }
            if (inject === 'unload') api.unloadAS3ScriptDomain(active.domain);
            return value;
        }});
        const local = createDomainLoader(overrides), nativeClass = local('nativeClass');
        const handle = local('ClassCallbacks').ClassCallbacks;
        check(attempts.length === 0 && registered === 0, 'module import is lazy');
        const read = () => nativeClass.readNativeClass(handle, 'value');
        return {attempts, sentinel, read, local, registered: () => registered};
    }
    for (const mode of ['before', 'after']) {
        const test = cohort(mode);
        check(failure(test.read) === test.sentinel, 'original provider error survives');
        const failed = test.attempts[0].global;
        check(!api.isAS3ScriptGlobal(failed), 'failed global is invalidated');
        check(/not initialized/.test(failure(() => api.readAS3ScriptGlobalDeclaration(failed, 'ClassCallbacks', 'cases')).message), 'failed Class remains unpublished');
        const value = test.read(), ready = test.attempts[1].global;
        check(ready !== failed && api.isAS3ScriptGlobal(ready), 'provider failure retry creates a valid unit');
        check(api.readAS3ScriptGlobalDeclaration(ready, 'ClassCallbacks', 'cases').value === value, 'published Class is final lazy identity');
        check(test.read() === value && test.attempts.length === 2 && test.registered() === 2, 'successful Class is cached');
        const receiver = new value().receiver();
        const observed = api.as3CallProperty(receiver, 'call', () => [null]);
        check(observed[1] === ready, 'escaped callback captures creation global');
        let invoked = false;
        check(/already instantiated/.test(failure(() => test.local('declarationDomain').publishScript0(() => { invoked = true; return value; })).message), 'duplicate publication is rejected');
        check(!invoked, 'duplicate unit never runs Class factory');
    }
    const first = cohort(), second = cohort();
    check(first.read() !== second.read(), 'separate cohorts retain distinct Class identities');
    check(first.attempts[0].global !== second.attempts[0].global, 'separate cohorts retain distinct globals');
    const unloaded = cohort('unload');
    check(/unloaded during initialization/.test(failure(unloaded.read).message), 'unload during factory prevents publication');
    check(!api.isAS3ScriptGlobal(unloaded.attempts[0].global), 'unload failure invalidates global');
    check(/unknown or unloaded/.test(failure(unloaded.read).message), 'closed domain prevents retry');
    check(unloaded.attempts.length === 1 && unloaded.registered() === 1, 'closed domain rejects before Class creation');
    globalThis.scriptFactoryChecks = checks;
}
