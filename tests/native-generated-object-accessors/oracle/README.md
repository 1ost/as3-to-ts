# Original Object accessor observations

This original AIR fixture addresses the maintained OP2 AlertChooseItemCell
setter-only override of DynamicCellRenderer.data:Object. Seven complete classes
exercise source getter/setter halves, direct-super access, a getter inherited
from a getter/setter parent, three inheritance levels, calls through a base type,
Object null/undefined and primitive/reference coercion, assignment results,
no valueOf/toString conversion, QName writes, readonly/writeonly errors and
reflection ownership. Two identical Harman AIR captures contain 28 observations.

Run node tests/nativeGeneratedObjectAccessors/verify.cjs to authenticate source,
compiler/runtime receipts, SWF and captures. Source classes in source/cases are
also retained unchanged under evidence/source/cases.

This is original Flash evidence only. Shared runtime/compiler support remains
unimplemented. No generated TypeScript or OP2 runtime qualification is claimed.
The full OP2 factory's earlier ordered failure is ModuleManager's anonymous
callback receiver/member lookup; this independent accessor evidence is preserved
for its subsequent shared fix. Font rendering is outside this work.
