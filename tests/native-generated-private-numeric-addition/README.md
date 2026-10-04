# Private numeric compound addition

BaseCompose adds a getter result to its private Number _curLineLeading. The
previous compiler admitted private String/int and protected numeric fields but
rejected this Number operation. This change admits private instance Number and
uint fields through the same shared addition and lexical-storage helpers.

The focused AIR source also exposed rejection of this.target.n: an exactly typed
instance path selecting the declaring class's own private variable. This path
now retains authenticated declaration identity and private capability, preserving
the complete expression for repeated storage evaluation. Foreign class identity,
static paths and private static Number/uint additions remain rejected.

Run npm run tsc, then node tests/native-generated-private-numeric-addition/run.cjs.
The default engine is ../LayaAir-op2-private-numeric-addition-review, overridable
with LAYA_ENGINE_REPOSITORY. No shared runtime changes or local application
substitutes are used. Unchanged Subject/Leading source is compiled by the source
class factory and compared with two identical AIR 51.3.4 non-debugger captures.

All 48 observations pass for ES5/ES2015 in Node and strict-CSP Chromium with zero
strict type errors. Cases include Number/uint storage, fractions, overflow,
String/null/undefined/Boolean operands, NaN/infinities/negative zero, private
unqualified fields, getters, RHS exceptions, old-value capture, receiver
replacement and null failures before RHS effects. Storage coerces to its declared
type; the compound expression returns the sum before storage conversion.
Eight compiler guards exercise unsupported static/nonnumeric/constant paths,
other operators, wrong receiver identity and missing addition authority.
Three applied mutations per target break concatenation, unconverted expression
results and the actual emitted write receiver. The latter rewrites both routed
sites and must change the retained routed storage observation.

verify.cjs --check-current authenticates original AIR inputs, compiler/provider
sources, generated artifacts and positive/negative comparisons. verify-adjacent.cjs
retains fresh lexical-chain, protected numeric and lexical-property addition
regressions against these exact inputs. Full BaseCompose/factory/H5 acceptance
remain separate; diagnostic errors compare class and ID rather than full strings.
