# Recovered isolated compiler candidates

This branch preserves two independently frozen September 15 work packages on
top of the recovered compiler checkpoint: foreign typed locals and method
signature planning. Their delivery hashes and original handoff documents are
retained in the adjacent folders. Neither package is represented as the missing
September 20 compiler head.

The combined source builds with the locked TypeScript compiler. The signature
planner suite passes all 611 checks, authenticating 134 retained original rows
across seven repeated capture groups. Signature planning is not wired into method
emission and does not establish native runtime or game acceptance. The foreign
typed-local package retains its original review and integration qualifications.

Use `port/op2-flash-client` for the recovered historical base. Review this branch
before adopting its isolated development candidates.
