# Shared Laya Date profile

Run `TZ=Europe/Rome node --test tests/hardened-cli/date-shared-profile.test.cjs`
with HARDENED_FIXTURE_AIR_SDK, HARDENED_FIXTURE_LAYA, HARDENED_FIXTURE_FFDEC and
LAYA_PLAYWRIGHT_MODULE pointing to installed tools.

`--shared-date` requires the exact SDK Date proof and a separately authenticated
common provider closure. The generated Date import and runtime type predicate
both use Laya's AS3Date; profiles without this proof retain their existing route.
The optional AP manifest field `dateProvider: true` selects the same producer and
includes its input closure in the AP cache identity. It does not repin a release.

The shared profile adds getHours and hours/seconds reads to the existing
zero/one/six-component construction, minutes/time access, setTime and three-Number
setHours surface. Eighteen retained AIR observations run through the generated
application entry in Node and Chromium; generated dependencies receive strict
type checking. Tests reject missing provider proof and a forged source closure.
Nullable String addition and compound assignment use the existing shared AS3
addition and typed-storage conversion; native rows include null+Number,
Number+null, null+null and String+null. Original AP sources are not rewritten. Full Date and full AP startup remain open.
