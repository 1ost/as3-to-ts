# Literal string constants in native script domains

Run `npm run tsc`, then `node tests/native-generated-literal-constants/run.cjs`.
The complete maintained CacheName source is authenticated against OP2's original
19-row configuration-proxy AIR packet. The source is unchanged, including all
189 public static String constants and its constructor/final modifier.

Public static String constants initialized from string literals use the existing
immutable early-storage lowering. No user initializer, reference lookup or
coercion hook runs. They can therefore enter native script domains without
requiring retry/global identity semantics for failing user initialization.
Static variables, computed/reference constants, nonpublic constants and class
body effects remain held by this admission check. Broader initialization support
is still required for the full application.

`run-NEiJ6O` passes on ES5/ES2015 in Node/Chromium: the observed CFG_NAME value
matches AIR, all 189 generated constant values match maintained source literals,
six domain/immutability checks, six compiler rejection cases, one applied wrong
constant mutation and zero type errors. Only CFG_NAME is compared with AIR;
the full constant census is a source comparison. The inherited module reuses the
parent Class and CSP forbids runtime compilation. Complete configuration-proxy
behavior remains a separate integration task.

Generated override regression `run-zNWvsN` still matches all ten AIR observations
on both targets/runtimes with five loading/lifetime checks, eight compiler
rejection cases, two runtime mutations and zero type diagnostics.
