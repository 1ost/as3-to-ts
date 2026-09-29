# Parser hardening gate

This suite is parser-only. It builds and invokes `lib/parse`; it never loads the
legacy emitter.

Run it with:

```text
npm run build
node tests/parser/parser-hardening.test.js
```

Malformed fixtures and every checked-in simple/compound AS3 corpus file run in
child processes with a 1.5 second watchdog. Parser
failures are `AS3ParseError` instances with closed fields `code`, `path`,
`index`, `line`, `column`, `found`, `expected`, and `context`. Codes are stable
and prefixed `AS3_PARSE_`; messages use normalized slash paths, 1-based
positions, escaped line breaks, and one logical output line.
