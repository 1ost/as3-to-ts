# Generated lexical ApplicationDomain reads

Run `node tests/native-generated-application-domain/run.cjs`, optionally with
`--combined`, after `npm run tsc`. LAYA_ENGINE_REPOSITORY defaults to the sibling
LayaAir-op2 checkout. The runner authenticates the generated-lexical-domain AIR
packet and emits the complete, unchanged ParentCallbacks, ChildCallbacks,
ParentKnown and ChildKnown sources.

The declaration plan requires an explicit `scriptDomainProvider` with `module`
and `exportName`, alongside `scriptGlobalProviderModule`. The bootstrap/loader
supplies a genuine common-engine AS3ScriptDomain created with its ApplicationDomain
before loading generated modules. An omitted provider retains the existing
unbound domain behavior for other generated code, but cannot admit currentDomain.
There is no implicit root-domain selection.

Authenticated, unshadowed ApplicationDomain.currentDomain reads, including the
fully qualified spelling, lower to getAS3ScriptApplicationDomain with the defining
unit's captured global. The class-initialization validator permits that exact
qualified read only after this lowering's provider/domain checks pass. It does
not admit general qualified Class values. Mutations and invocation of the getter
value remain held. Source this and caller globals do not select a lexical domain.

Both ES5 and ES2015 compare all 14 AIR observations in Node and Chromium, in
default and combined reference/signature modes. Strict generated/provider type
checking must report zero diagnostics. Sixteen compiler rejection guards, two
shadowing checks, four runtime guards and three altered-comparison controls
cover missing/mismatched configuration, malformed exports, unsupported operations,
shadowed names, forged/closed script domains and explicitly unbound domains.

The host observer uses native publication APIs to associate the emitted Known
classes with their scopes; this does not qualify source Loader/Sprite behavior or
inherited Class collisions. Static-initializer retry, typed ApplicationDomain
signatures/anonymous returns, full dynamic ApplicationDomain dispatch, memory,
population, asset loading and authenticated game flows remain separate work.
