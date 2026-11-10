# 01: Recording Fake Tone Test Harness (Prefactor)

**What to build:** A shared fake Tone module that lets any test suite observe the audio graph without an AudioContext: fake gain and synth nodes that record every connection and every value their gain receives (including ramped values), plus a graph-snapshot helper tests can assert against. Registered per suite, never globally in the test setup, so no suite accidentally stops using real Tone. Its own suite wires a small fake graph and asserts the snapshot — this ticket is verifiable by running the test suite green. No production code changes; this is the prefactor that makes the wiring fix testable.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] A recording fake exposes the Gain family and the Synth-family voices the audio layer uses, each recording connections made to it and gain values written to it
- [x] A graph-snapshot helper reports, for any fake node, which nodes it is connected to and its current gain value
- [x] The fake is registered per test suite with a module mock, and a harness self-test proves a fake graph of channel gains feeding a master feeding a destination records correctly
- [x] The shared global test setup remains untouched: suites that do not opt into the fake still get real Tone
- [x] Existing suites all still pass unchanged

## Answer

- `src/test/fakeTone.ts` is the harness: `FakeGainNode` (with `FakeGainParam` recording every write, including
  `rampTo`), `FakeSynthNode` plus `FakeMembraneSynth`/`FakeMetalSynth`/`FakeNoiseSynth`/`FakeSampler`/`FakeSynth`,
  `FakeToneBufferSource`, `FakeAudioContext`, `FakeTransport`, `FakeLFO`/`FakeFrequencyInput` for a custom sample
  chain, `fakeAudioBuffer`, `labelNode` and `asFakeNode`.
- `fakeToneRecorder` is the observable: `nodes`, `connections`, `destination`, `transport`, `context`, `startCalls`,
  plus the query helpers `connectedTo`, `feedsInto`, `routeTo`, `routeToDestination`, `gainWrites`, `gainValue`,
  `lastGainWrite`, `triggers`, `totalTriggers`, `snapshot`, `report`, `deferredDraw`, `flushDraw`, `reset` and
  `kinds`. `nodesByKind`/label lookup lives in the suites that need it.
- `src/test/__tests__/fakeTone.test.ts` wires a fake graph of channel gains feeding a master feeding the destination
  and asserts the snapshot: nodes, edges, routes, gain writes, triggers, transport advancement and draw flushing.
- Registration is per suite only (`vi.mock('tone', ...)` at the top of each suite that needs the graph).
  `src/test/setup.ts` is untouched and every other suite still constructs real Tone objects — which is why the
  suites that never opt in keep passing unchanged.

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Testing Decisions). This harness exists because jsdom has no AudioContext, and because today's suites pass by injecting the very nodes production forgot to build.
