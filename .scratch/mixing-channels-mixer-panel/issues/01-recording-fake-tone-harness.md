# 01: Recording Fake Tone Test Harness (Prefactor)

**What to build:** A shared fake Tone module that lets any test suite observe the audio graph without an AudioContext: fake gain and synth nodes that record every connection and every value their gain receives (including ramped values), plus a graph-snapshot helper tests can assert against. Registered per suite, never globally in the test setup, so no suite accidentally stops using real Tone. Its own suite wires a small fake graph and asserts the snapshot — this ticket is verifiable by running the test suite green. No production code changes; this is the prefactor that makes the wiring fix testable.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A recording fake exposes the Gain family and the Synth-family voices the audio layer uses, each recording connections made to it and gain values written to it
- [ ] A graph-snapshot helper reports, for any fake node, which nodes it is connected to and its current gain value
- [ ] The fake is registered per test suite with a module mock, and a harness self-test proves a fake graph of channel gains feeding a master feeding a destination records correctly
- [ ] The shared global test setup remains untouched: suites that do not opt into the fake still get real Tone
- [ ] Existing suites all still pass unchanged

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Testing Decisions). This harness exists because jsdom has no AudioContext, and because today's suites pass by injecting the very nodes production forgot to build.
