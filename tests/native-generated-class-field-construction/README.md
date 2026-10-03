# Generated Class field construction

Run `npm run tsc`, then `node tests/native-generated-class-field-construction/run.cjs`.
The default engine is `../LayaAir-op2-class-field-construction-review`; override
with LAYA_ENGINE_REPOSITORY when explicitly qualifying another provider.

Complete maintained oracle sources generate factories for ES5 and ES2015.
Each target matches twelve AIR rows in Node and Chromium with zero generated
source type diagnostics and nineteen native checks. Four compiler guards reject
forged plans and non-Class fields. Native checks cover argument order, null
receivers and Classes, forged/non-Class capabilities, caller-global authority,
constructor arity, and separate domain identities. A deliberate early field-read
mutation must differ from AIR, specifically on argument-driven replacement.

Construction reads the private Class slot after arguments, including implicit
and static forms. Function-valued invocation keeps its separate existing rules.
The source plan authenticates the Class type; this does not permit arbitrary
dynamic constructors or direct Class-valued calls. Full OP2 startup, assets and
account-flow acceptance remain outside this focused proof.
