# XML and XMLList constructor reference parameters

Run `npm run tsc`, then `node tests/native-generated-xml-constructors/run.cjs`.
`verify.cjs` authenticates the retained runtime receipt and original AIR captures.

Four complete source classes cover optional and required XML/XMLList parameters.
Both ES5 and ES2015 factories match 61 original AIR observations in Node and
Chromium with zero type or browser errors. This covers null/undefined, argument
counts, node/list identity, incompatible primitives and objects, prototypes,
constructor body entry order, and absence of implicit string conversion.

Six compiler guards cover missing reference/XML providers, malformed module
configuration, forged plans and non-null optional defaults. Eight runtime guards
reject forged XML/XMLList instances before executing constructor bodies.
The observer prepares XMLList inputs from canonical nodes; this fixture does not
claim source XMLList string-constructor support.

Constructor parameters reuse authenticated declaration-plan bindings and the
shared reference coercion path. The shared engine additionally registers the
XMLList reference name needed by generated typed fields. These changes do not
publish complete XML/XMLList Class metadata or qualify full game startup.
