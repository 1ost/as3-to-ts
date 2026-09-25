# Implicit derived source constructors

`node tests/native-generated-implicit-derived/run.cjs` builds all five complete
AS3 classes from the engine's authenticated `implicit-derived-constructor`
packet (source-v2) using production native source-class factories.

Ten AIR observations pass on ES5/ES2015 in Node and Chromium under CSP, with zero
type diagnostics. Coverage includes an explicit source constructor above native
EventDispatcher, two implicit descendant levels, listener/closure binding and
instance isolation, an optional parent parameter, and descendant arity errors.
Four checks cover domain isolation. A required-parent-parameter guard rejects
invalid zero-argument super entry. Removing the implicit base call from the
emitted factory must fail execution.

The change admits complete generated source parents callable with zero arguments;
it does not admit implicit construction directly above a native provider. A
descendant keeps its own zero-argument signature; parent optional parameters are
not forwarded to it.

The native-interface inheritance regression passes eleven runtime AIR rows and
five contract guards on both targets. The older generated-inherited-classes
runner fails an obsolete plan-rejection assertion before reaching emission;
the same failure was reproduced with the pre-change callable-class module.
That older runner is not claimed green.
