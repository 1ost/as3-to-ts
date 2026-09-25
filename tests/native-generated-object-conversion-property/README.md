# Intrinsic Object receiver property lowering

`node tests/native-generated-object-conversion-property/run.cjs` compiles the
complete, unchanged `ObjectAccess.as` from the engine's authenticated
`tests/nativeFlashOracle/object-conversion-property` packet using production
native source-class factories. Both ES5 and ES2015 execute in Node and Chromium
under a CSP without eval.

All 17 AIR observations pass with zero type diagnostics. Six binding/arity
guards include a lexical Function named Object; two checks cover domain
isolation. An applied factory mutation removes Object conversions and must
diverge from the captured null/undefined behavior.

The observer creates ordinary source objects through the shared Object factory;
host objects do not gain write authority from their JavaScript shape. Public
dispatch still requires each native class's registered source property surface.
LoaderContext currently lacks that surface, so this compiler qualification does
not admit the complete ResourceLoader runtime or game flow.
