# Typed static-getter receiver dispatch

Run `node tests/native-generated-static-getter-receiver/run.cjs` after building
the compiler. Five complete source classes are taken from the shared engine's
authenticated `tests/nativeFlashOracle/static-getter-receiver` packet.

The caller's private `init` must not capture `Factory.inst.init` when a public
static getter declares an exact source Target result. The compiler resolves that
result from the declaration plan and uses existing common public property/call
dispatch. It retains the entire getter expression, so it executes once before
arguments. Runtime return coercion remains the getter's responsibility.

Thirteen repeated Flash observations match complete ES5/ES2015 factories in Node
and Chromium under CSP: getter/argument/call ordering, stored values, method
closure capture, private calls, virtual overrides, null read/call behavior and
throwing getters. Both targets have zero type errors. Seven guards retain holds
for shadowed roots, computed/deeper chains, untyped results and nonpublic or
instance getters. This addition covers a direct public static getter on a
source Class with a declared source-class result; it grants no arbitrary dynamic
receiver, native getter, or inherited static-getter authority.

The original compiler rejected this complete fixture with `lexical receiver
requires exact source type`. On 2026-09-26, run `run-45YIKV` passed the comparison
and guards. Getter and method regressions also pass (13/16 rows, 22/19 guards).
OP2's motivating expression is `LayoutManager.inst.init(...)` in Game, whose own
private `init` previously caused the receiver-resolution hold.
