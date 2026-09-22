# Explicit decorator modules

Programmatic emitters may pass `decoratorModules: {bound, classBound}` with the
module specifiers for the distributed TypeScript helpers. This bypasses the
legacy mutable CLI scan table's package-root calculation. It does not change
class scanning, source bindings, decorator implementations or runtime behavior.
Omitting the option preserves the legacy CLI behavior.

`npm run test:decorator-modules` resolves generated imports against actual
helper files and executes detached callbacks with the unmodified helpers in
scan mode and normal two-pass emission, targeting ES5 and ES2015. Nine malformed
configurations reject. The test includes nested output and paths with spaces.
