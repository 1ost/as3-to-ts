# Qualified native static-property reads

Build with `npm run tsc`, then run `node tests/native-generated-qualified-native-read/run.cjs`.
The complete unchanged AIR Subject goes through the generated module factory on
ES5/ES2015, strict provider typechecks, and Node/Chromium CSP execution. Six AIR
rows, six rejection guards, isolated-domain identity and an applied static-read
mutation are checked. Native provider behavior remains host-specific; generated
code never treats the `flash` package as a JavaScript global object.
Shadowed package roots remain explicit holds, not native reads. Writes, calls,
standalone Class values and lazy source-class receivers are not admitted here.
