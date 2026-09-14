import { bindDeclaredInstanceMethods } from './bound';

/**
 * Construct native classes through [[Construct]], preserving new.target,
 * prototype identity, static descriptors, and inherited method closures.
 * The apply path retains ES5-transpiled base constructor calls.
 */
export function classBound(target: any): any {
    return new Proxy(target, {
        construct(original: any, args: any[], newTarget: any): object {
            const instance = Reflect.construct(original, args, newTarget);
            bindDeclaredInstanceMethods(instance);
            return instance;
        },
        apply(original: any, receiver: any, args: any[]): any {
            const result = Reflect.apply(original, receiver, args);
            bindDeclaredInstanceMethods(result !== null
                && (typeof result === 'object' || typeof result === 'function') ? result : receiver);
            return result;
        }
    });
}
