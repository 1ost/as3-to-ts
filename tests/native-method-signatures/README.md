# Source-owned method signature plans (not emission)

Run the compiler's existing TypeScript build, then `node tests/native-method-signatures/run.cjs`.
This test authenticates retained capture files and repeated observations and checks plans made from complete original source plus complete Class and instance reflection. It does not execute emitted methods or claim native runtime admission.

The immutable fixture groups retain 62 new method/return/arity/storage observations, the prior 43 method-entry and 22 return observations, and seven additional original sign/default/throw observations. All have repeated captures. The complete original ReturnSubject and OverrideChild are rejected, not reduced to admitted methods. Prior reference/String/accessor/exception-return observations remain evidence only.

Four complete Object-root controls produce plans: EntrySubject, ParameterStorage, PlainSubject and PlanSubject. Private/protected signatures derive from exact source; public signatures and fields are reconciled against complete reflection. A hash is an integrity check, not an independent trust root: integration must obtain both XML documents and exact original source from its authenticated toolkit receipt. The existing count-only nativeCallableMetadata projection is insufficient by itself.

## Integration API and order

`NativeMethodSignatures(qname, originalSource, evidence)` requires sourceSha256, classXML/classXMLSha256 and instanceXML/instanceXMLSha256. Construct it before modifying AST nodes. Its readonly methods are in source order. `forMethod(originalNode)` and `forReturn(originalMethod, originalReturnNode)` compare complete structural fingerprints and original offsets. The planner exports only from its internal module; no compiler public API or options have been added.

Each method provides fixed minimumArguments/maximumArguments/formalLength, ordered parameters with exact optional literal source slices, return type, body bounds, owned return expressions, and separate throw spans. The legacy parser models throw as RETURN and has reversed unary-sign bounds; this planner checks original keywords and recovers only exact adjacent signed literal spelling using original INIT/operand offsets. It never evaluates a default as JavaScript.

Future integration must independently implement and verify: original argument evaluation; shared arity checking before formal conversion; omitted-default selection using supplied argument length (explicit undefined is supplied); formal-order Number/Boolean conversion and supplied arguments updates; initialized parameter storage retaining each declared type for every later assignment; and normal return/fallthrough conversion without converting throws. Plans alone do none of these. Literal defaults are not proof of correctly emitted entry behavior. ParameterStorage's wildcard-return catch is planned without asserting typed exception-return lowering.

Typed try/catch/finally return regions, derived overrides, accessors, arguments/rest, nested functions, unsupported namespaces/signatures/defaults, interfaces and extra declarations remain whole-declaration holds. Number/Boolean fallthrough requires a terminal syntactic return/throw; broader control flow remains held. Host/foreign values and source Class identity are not admitted by this module. Constructors are reflected for complete-source reconciliation but are not ordinary method plans. Field semantics and method-body operation readiness still require their own compiler protocols.

The parent owns wiring in emitter/native-callable-classes/native-lexical-members/native-typed-locals and package/public options, after independent review and any demonstrated game need. The user subsequently selected modern GSAP; this isolated planner does not extend or integrate legacy GreenSock prerequisites.
