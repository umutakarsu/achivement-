# Test harness

Automated smoke tests for the Achievement Graph app. They load the **real**
`index.html` + `app.js` into a [jsdom](https://github.com/jsdom/jsdom) DOM,
seed `localStorage`, run the app, and assert on the rendered DOM.

## Running

```sh
npm install   # installs jsdom (devDependency)
npm test      # runs `node --test`
```

Requires Node 18+ (uses the built-in `node:test` runner, `node:assert`, and
`worker_threads`). Developed against Node 22.

## Files

- `harness.js` — `bootApp({ storage })` builds a jsdom window from
  `index.html` (with the `<script src="app.js">` tag stripped), seeds
  `localStorage["achievement-graph-v2"]` with `JSON.stringify(storage)` BEFORE
  the app runs, polyfills the browser APIs jsdom lacks but `app.js` uses
  (`matchMedia`, `navigator.vibrate`, pointer-capture methods,
  `getBoundingClientRect`, `requestAnimationFrame`), injects `app.js` as a
  `<script>`, and captures uncaught errors. Returns
  `{ window, document, errors, graphNodeCount(), hasSetupPanel() }`.
  It also exports `bootAppInWorker({ storage, timeoutMs })`, which runs the
  same boot inside a terminable Worker thread for data that can hang the app
  (see the cyclic-data note below).
- `smoke.test.js` — the test cases.

## RED BASELINE — this is intentional

These tests assert the **correct/intended** behavior: the app must not throw
uncaught errors and must render its nodes. **Some tests are EXPECTED TO FAIL
against the current `app.js`.** They encode known crash bugs so the upcoming
correctness pass has a regression target. Do not "fix" them by weakening the
assertions, and do not edit `app.js` to make them pass as part of writing
tests — the correctness pass owns `app.js`.

Current baseline (5 pass / 2 fail):

| Test | Status | Bug it encodes |
| --- | --- | --- |
| empty storage renders setup with no crash | PASS | — |
| valid full graph renders nodes | PASS | — |
| node missing text fields does not crash render | **FAIL (red)** | `getReadinessChecks()` calls `node.why.trim()` etc. unconditionally → `TypeError: Cannot read properties of undefined (reading 'trim')` when optional text fields are absent. |
| node with undefined confidence does not produce NaN UI | PASS | (Currently safe: `renderHint` uses `Number(node.confidence \|\| 0)`. Kept as a guard so a future regression that surfaces `NaN` is caught.) |
| cyclic parent links do not hang or crash | **FAIL (red)** | `getDepth()` walks `parentId` links with no cycle guard → synchronous infinite loop on cyclic data. |
| legacy example map is cleared | PASS | — |

## Notes / caveats for the next agent

- **jsdom has no layout engine.** `getBoundingClientRect()` returns a zeroed
  rect and there is no real rendering, so anything depending on real geometry
  (pan/zoom math, node placement from pointer coordinates) is not exercised
  here. These tests cover load + render + data handling, not visual layout.
- **Synchronous infinite loops cannot be interrupted by a same-thread timer.**
  The cyclic-parent case hangs `app.js` in a true infinite loop, so the cyclic
  test boots inside a Worker (`bootAppInWorker`) that is `.terminate()`'d after
  a 4s timeout; a timeout is reported as the failing expectation rather than
  hanging the test process.
- `node --test` also discovers `harness.js` as a test file (it matches the
  default test glob) and reports it as an empty passing subtest. That is
  harmless — `harness.js` contains no tests.
- Errors are captured via `window.onerror`, an `error` event listener, the
  jsdom `VirtualConsole` `jsdomError` event, and a try/catch around the script
  injection, then exposed on `app.errors`. A single thrown error can appear as
  more than one entry (e.g. both the jsdom report and the `onerror` callback).
