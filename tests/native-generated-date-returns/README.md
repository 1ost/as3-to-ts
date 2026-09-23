# Generated Date returns

Run npm run tsc, then node tests/native-generated-date-returns/run.cjs from the
compiler checkout. The sibling LayaAir-op2 packet generated-date-returns is
verified before emitting its complete authored DateReturns class unchanged.

All 25 AIR rows are compared in Node and Chromium on ES5 and ES2015 with strict
subject/provider type checking. They cover static/instance methods, getters,
optional Date parameters, arity, null/undefined, prototype identity and time,
invalid references, return coercion through catch/finally and numeric epochs.
Three compiler guards retain missing explicit Date binding, bare typed returns
and typed fallthrough holds. Seven runtime controls reject forged Date instances,
host/same-named provider constructors and mismatched trait labels. Three comparison
controls reject missing, reordered and modified AIR rows.

The generated return profile requires nativeGlobalModules.Date and uses the
existing declaration-domain reference and common coercion providers. This does
not publish full Date Class metadata or qualify other native return families.
The separate Event-return guard still rejects Date without its explicit binding.
Whole DateUtil and logging integration remain independent requirements.
