# Wildcard public compound assignment

Qualifies +=/-= on authenticated source-class wildcard fields and read/write
accessors, using exact public read/write providers. Source interface admission
remains numeric. Other operators, method storage, missing accessors and String
storage remain held. Addition uses common AS3 property/addition semantics.
Subtraction reads the property, evaluates RHS, converts left then right, then
repeats the receiver path for storage. Expression results remain uncoerced.

Two AIR 51.3.4 captures at engine cfd979a3f57aaab4cf4e780a7e4243a139c1eadb
match all 44 observations in Node and strict-CSP Chromium for ES5/ES2015. Nine
compiler guards and four applied mutations cover evaluation/conversion order and
both addition/subtraction write receivers. There are zero generated/dependency
type errors. Source conversion methods exercise valueOf/toString fallback,
exceptions and receiver redirection from either operand.

Adjacent numeric interface and class compound suites each pass 24 observations
on both targets/runtimes. Interface checks include 12 guards and a receiver
mutation; the older class harness detects four applied Node mutations. Its
historical evidence is preserved. The interface admission mutation's symbol
tracks the renamed publicCompoundUpdate implementation flag.

Set LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE, then run this directory's
run.cjs. verify.cjs --check-current authenticates the retained evidence and inputs.
Baseline run-cIPMYC; passing run-ILhDM9; adjacent full-J4HgIN/run-6ywHGv.
Archive: 5397001 bytes, SHA-256 f06f78d567168db64ac3ebc0ae1ca90052c1703c65f40bca146ffe01ca41dfa7.
Whole OP2 factory/type/runtime and real H5 account acceptance remain open.
