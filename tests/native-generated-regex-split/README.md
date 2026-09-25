# Generated literal RegExp String.split

Run `npm run tsc`, then `node tests/native-generated-regex-split/run.cjs`.
The complete unchanged Subject uses the production source factory on ES5 and
ES2015. All 30 AIR observations match in Node/Chromium under CSP, with zero
generated/provider type errors, two domain checks and two rejection guards.
An applied substitution of match for split must alter the observations.

Exact String locals/parameters with a literal regex delimiter now use the shared
source pattern compiler and splitter. Empty fields, Unicode behavior and source
null TypeError #1009 are preserved. The pattern provider must match the plan.
Limits remain held by this entrypoint. Ordinary delimiters and nonliteral regex
receiver families retain their separate paths; this does not qualify all String
methods or the whole game.
