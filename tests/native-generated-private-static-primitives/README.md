# Generated private static primitive variables

Build with npm run tsc, then run node tests/native-generated-private-static-primitives/run.cjs.
The runner authenticates the engine's generated-private-static-primitives AIR
packet, emits its complete Values source unchanged and compares six array-valued
observations on ES5/ES2015 in Node and Chromium with strict type checks.

Private finite Number, Boolean and String literal initializers use the existing
early lexical storage publication, before authored class initializer effects.
Those effects can mutate the fields; the source declarations must not later
reset them. Original numeric spelling preserves negative zero. Defaults and later
assignments retain the existing common coercion behavior.

Twelve guards retain computed/call initializers, nonfinite Number literals,
legacy octal, grouped Number expressions, uint and protected Number holds.
Three comparison controls reject modified observations. The existing protected
String and singleton guards now test computed private String/Boolean values
because their literal cases have independent positive coverage here.

This qualifies a compiler prerequisite. It does not prove complete generated
ClientProperties/Game behavior or extend application declaration registration.
