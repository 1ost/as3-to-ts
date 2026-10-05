# Class-body initialization and retry

Explicitly selected Class scripts can now contain class-body statements and
reference constants. Selection uses the exact declaration identity, so selecting
a containing source file does not implicitly authorize its private Classes.
Unselected scripts and unsupported lexical bindings remain rejected.

AIR evaluates static fields in declaration order before class-body statements,
even when statements precede or appear between fields in source. The existing
factory field and statement queues preserve those phases. This change qualifies
those queues for Class-script retry; it does not change their ordering.

The three unchanged AIR Classes and namespace compare 13 observations on
ES5/ES2015 in Node and strict-CSP Chromium. Two failures allocate fresh Classes,
static callbacks and reference constants, while the initialized parent remains
stable. Escaped failed Classes remain constructible and retain their storage.
The successful Class initializes once, preserves type identity and rejects
writes to the namespace constant with ReferenceError 1074.

Six checks retain missing-selection and lexical-binding guards and restore the
old compiler rejection as a mutation. Runtime mutations remove the last body
statement and move a body statement before field initialization; both are
detected in both realms. Strict checks have zero diagnostics. Adjacent root
Class-script retry (13 rows) and four reference-constant subjects (22 rows) pass
both targets and realms. The root retry guard now omits the subject from the
Class-script selection, preserving the intended unselected-script boundary.

Run `npm run tsc`, then `node tests/native-generated-class-body-retry/run.cjs`.
Set LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE for the engine and browser
package paths. `verify.cjs --check-current` checks live inputs against the
retained archive; omit the flag for portable evidence. The archive retains
baseline rejection at 940e10fe015683256b823c7f888193f4f7249aca, AIR captures,
source/compiler/type/bundle inputs, generated output, mutations and adjacent
results. No engine runtime changes are needed.

The broader legacy Signal harness with `--signal --combined` stops at its
missing explicit common Class-module binding before execution. Its success is
not claimed here. Complete TLF factory/type checks and H5/account acceptance
remain separate requirements.
