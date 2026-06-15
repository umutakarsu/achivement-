"use strict";

// Smoke tests for the Achievement Graph app, run against the REAL
// index.html + app.js inside jsdom (see ./harness.js).
//
// IMPORTANT: these tests assert the CORRECT / intended behavior: the app must
// NOT throw uncaught errors and MUST render its nodes. Several of these cases
// are EXPECTED TO FAIL against the current buggy app.js -- that is intentional.
// They form a RED BASELINE proving known crash bugs exist. Do NOT "fix" them by
// weakening the assertions, and do NOT edit app.js here; the correctness pass
// will make app.js satisfy them.

const test = require("node:test");
const assert = require("node:assert/strict");
const { bootApp, bootAppInWorker } = require("./harness.js");

// A fully-populated node: every field app.js reads is present.
function fullNode(overrides = {}) {
  return {
    id: "n",
    parentId: null,
    title: "Reach the summit goal clearly",
    why: "It matters deeply to me for real reasons here",
    evidence: "I will know it is done when proof exists",
    blocker: "Time is genuinely short for this",
    action: "Take the first small visible step today",
    confidence: 70,
    friction: "Medium",
    done: false,
    ...overrides,
  };
}

// A valid 3-node graph: a top node and two children, all fields present.
function validGraph() {
  return [
    fullNode({ id: "top", parentId: null, title: "Reach the big summit goal" }),
    fullNode({ id: "c1", parentId: "top", title: "First supporting milestone done" }),
    fullNode({ id: "c2", parentId: "top", title: "Second supporting milestone done" }),
  ];
}

test("empty storage renders setup with no crash", () => {
  const app = bootApp({ storage: [] });
  assert.deepEqual(
    app.errors.map((e) => e.message),
    [],
    "empty storage should not produce any uncaught errors",
  );
  assert.ok(app.hasSetupPanel(), "the #setupPanel element should exist");
});

test("valid full graph renders nodes", () => {
  const app = bootApp({ storage: validGraph() });
  assert.deepEqual(
    app.errors.map((e) => e.message),
    [],
    "a valid graph should render without uncaught errors",
  );
  assert.equal(app.graphNodeCount(), 3, "all 3 nodes should render as .graph-node elements");
});

test("node missing text fields does not crash render", () => {
  // One child omits why/evidence/blocker/action/confidence; only id/parentId/
  // title/done are set. The intended behavior is that render survives missing
  // optional text and still draws every node.
  //
  // RED BASELINE: app.js calls node.why.trim() (etc.) unconditionally inside
  // getReadinessChecks(), so this currently throws and renders too few nodes.
  const storage = [
    fullNode({ id: "top", parentId: null, title: "Reach the big summit goal" }),
    { id: "bare", parentId: "top", title: "Bare node here", done: false },
  ];
  const app = bootApp({ storage });
  assert.deepEqual(
    app.errors.map((e) => e.message),
    [],
    "a node missing optional text fields must not throw during render",
  );
  assert.equal(app.graphNodeCount(), 2, "both nodes should still render");
});

test("node with undefined confidence does not produce NaN UI", () => {
  // Same idea as above, focused on confidence: a node with no `confidence`.
  // Text fields are present so we isolate the confidence path. The UI must not
  // surface "NaN" anywhere (e.g. avg confidence, confidence ring, low-confidence
  // styling math) and must not throw.
  const noConfidence = fullNode({ id: "top", parentId: null });
  delete noConfidence.confidence;
  const app = bootApp({ storage: [noConfidence] });

  assert.deepEqual(
    app.errors.map((e) => e.message),
    [],
    "undefined confidence must not throw during render",
  );
  assert.equal(app.graphNodeCount(), 1, "the node should still render");

  // No visible text in the document should read "NaN".
  const bodyText = app.document.body.textContent || "";
  assert.ok(!/NaN/.test(bodyText), `no UI text should contain "NaN" (got: ${JSON.stringify(bodyText.slice(0, 200))})`);
});

test("cyclic parent links do not hang or crash", async (t) => {
  // Two nodes pointing at each other: A.parentId = B and B.parentId = A.
  // Intended behavior: render terminates without an uncaught error.
  //
  // RED BASELINE: app.js's getDepth() walks parentId links with no cycle guard,
  // so cyclic data sends it into a SYNCHRONOUS infinite loop. A synchronous
  // infinite loop cannot be interrupted by a same-thread timer, so we boot in a
  // terminable Worker (bootAppInWorker) with a hard timeout. If it times out we
  // record that as the failing expectation rather than letting the test process
  // hang forever.
  const cyclic = [
    fullNode({ id: "A", parentId: "B", title: "Cyclic node A here" }),
    fullNode({ id: "B", parentId: "A", title: "Cyclic node B here" }),
  ];

  const result = await bootAppInWorker({ storage: cyclic, timeoutMs: 4000 });

  assert.equal(
    result.timedOut,
    false,
    "boot must complete quickly on cyclic data (no infinite loop) -- timing out means app.js hangs",
  );
  assert.deepEqual(
    result.errorMessages,
    [],
    "cyclic parent links must not produce an uncaught error",
  );
});

test("legacy example map is cleared", () => {
  // The legacy marathon demo map should be auto-cleared on load (isLegacyExampleMap),
  // dropping the user back into the setup panel with an empty graph.
  const legacyIds = ["top", "base-fitness", "fuel-recovery", "shoes", "routes", "sleep", "race-fuel"];
  const legacy = legacyIds.map((id) =>
    fullNode({
      id,
      parentId: id === "top" ? null : "top",
      title: id === "top" ? "Run my first marathon" : id,
    }),
  );

  const app = bootApp({ storage: legacy });
  assert.deepEqual(
    app.errors.map((e) => e.message),
    [],
    "clearing the legacy map should not produce uncaught errors",
  );
  assert.equal(app.graphNodeCount(), 0, "legacy map should be cleared, rendering no nodes");
  assert.ok(app.hasSetupPanel(), "setup panel should be present after clearing the legacy map");
});

// --- Regression tests added by the correctness pass --------------------------

test("non-legacy graph is never wiped from storage", () => {
  // A real user's graph must survive boot: loadNodes() must not destructively
  // remove the storage key. Boot a normal (non-legacy) graph and confirm both
  // that it renders AND that the stored data is still present afterwards.
  const STORAGE_KEY = "achievement-graph-v2";
  const app = bootApp({ storage: validGraph() });

  assert.deepEqual(app.errors.map((e) => e.message), [], "boot should not throw");
  assert.equal(app.graphNodeCount(), 3, "the user's graph should render");

  const stored = app.window.localStorage.getItem(STORAGE_KEY);
  assert.ok(stored, "the storage key must NOT be removed for a non-legacy graph");
  const parsed = JSON.parse(stored);
  assert.equal(parsed.length, 3, "stored graph should still contain all nodes");
});

test("legacy map path does not destructively remove the storage key", () => {
  // The legacy demo still boots into an empty setup graph, but loadNodes() must
  // NOT call localStorage.removeItem -- destroying matching user data is the
  // data-loss bug we fixed. The key may remain populated; what matters is it is
  // not wiped.
  const STORAGE_KEY = "achievement-graph-v2";
  const legacyIds = ["top", "base-fitness", "fuel-recovery", "shoes", "routes", "sleep", "race-fuel"];
  const legacy = legacyIds.map((id) =>
    fullNode({ id, parentId: id === "top" ? null : "top", title: id === "top" ? "Run my first marathon" : id }),
  );

  const app = bootApp({ storage: legacy });
  assert.deepEqual(app.errors.map((e) => e.message), [], "legacy boot should not throw");
  assert.equal(app.graphNodeCount(), 0, "legacy map renders no nodes (setup mode)");

  const stored = app.window.localStorage.getItem(STORAGE_KEY);
  assert.ok(stored, "legacy path must not removeItem the storage key (non-destructive)");
});

test("node with missing confidence never surfaces NaN (confidence ring)", () => {
  // normalizeNode must coerce a missing/invalid confidence to a finite default
  // (50), so the confidence ring text reads a real number, never "NaN" or
  // "undefined".
  const noConfidence = fullNode({ id: "top", parentId: null });
  delete noConfidence.confidence;
  const app = bootApp({ storage: [noConfidence] });

  assert.deepEqual(app.errors.map((e) => e.message), [], "missing confidence must not throw");

  const ringText = app.document.querySelector("#confidenceRingValue")?.textContent ?? "";
  assert.ok(ringText.length > 0, "confidence ring should show a value");
  assert.ok(!/NaN|undefined/.test(ringText), `confidence ring text must be a real number (got: ${JSON.stringify(ringText)})`);
  assert.ok(/^\d+$/.test(ringText.trim()), `confidence ring text should be a number string (got: ${JSON.stringify(ringText)})`);
});

test("node title with HTML/script characters renders as inert text", () => {
  // User-provided titles must be treated as text, never markup. A title that
  // looks like a <script> tag must render via textContent: no injected element,
  // and the node label text must equal the literal title.
  const evilTitle = "<script>alert(1)</script> & <img> goal";
  const app = bootApp({ storage: [fullNode({ id: "top", parentId: null, title: evilTitle })] });

  assert.deepEqual(app.errors.map((e) => e.message), [], "boot should not throw on hostile title");

  // The node label must carry the literal title as text, with no injected
  // <script>/<img> elements created from it.
  const label = app.document.querySelector(".graph-node .node-label");
  assert.ok(label, "the node should render with a label");
  assert.equal(label.textContent, evilTitle, "node label must equal the literal title text");

  const map = app.document.querySelector("#achievementMap");
  assert.equal(map.querySelectorAll("script").length, 0, "no <script> element should be injected");
  assert.equal(map.querySelectorAll("img").length, 0, "no <img> element should be injected");

  // Drive the search path too: querying the title must produce a result whose
  // text equals the title (textContent-based), never injected markup.
  const searchInput = app.document.querySelector("#nodeSearchInput");
  searchInput.value = "goal";
  searchInput.dispatchEvent(new app.window.Event("input", { bubbles: true }));

  const results = app.document.querySelector("#searchResults");
  assert.equal(results.querySelectorAll("script").length, 0, "search results must not inject <script>");
  assert.equal(results.querySelectorAll("img").length, 0, "search results must not inject <img>");
  const firstSpan = results.querySelector(".search-result span");
  assert.ok(firstSpan, "a search result should appear");
  assert.equal(firstSpan.textContent, evilTitle, "search result title span must be literal text");
});

// --- Accessibility / UX pass tests --------------------------------------------

test("setup dialog exposes modal dialog semantics", () => {
  const app = bootApp({ storage: [] });
  assert.deepEqual(app.errors.map((e) => e.message), [], "boot should not throw");

  const panel = app.document.querySelector("#setupPanel");
  assert.equal(panel.getAttribute("role"), "dialog", "setup panel should be role=dialog");
  assert.equal(panel.getAttribute("aria-modal"), "true", "setup panel should be aria-modal=true");
  const labelledby = panel.getAttribute("aria-labelledby");
  assert.ok(labelledby, "setup panel should have aria-labelledby");
  const heading = app.document.getElementById(labelledby);
  assert.ok(heading, "aria-labelledby must point to a real element");
  assert.equal(heading.tagName, "H2", "aria-labelledby should point to the dialog <h2>");
});

test("first-run boot moves focus to the setup goal input", () => {
  const app = bootApp({ storage: [] });
  assert.deepEqual(app.errors.map((e) => e.message), [], "boot should not throw");
  const goalInput = app.document.querySelector("#setupGoalInput");
  assert.equal(
    app.document.activeElement,
    goalInput,
    "on first run, focus should land on #setupGoalInput",
  );
});

test("setup close button is hidden/disabled with no graph, enabled with a graph", () => {
  const empty = bootApp({ storage: [] });
  const closeEmpty = empty.document.querySelector("#closeSetupButton");
  assert.equal(closeEmpty.disabled, true, "close button must be disabled when no graph exists");
  assert.equal(closeEmpty.hidden, true, "close button must be hidden when no graph exists");

  const withGraph = bootApp({ storage: validGraph() });
  const closeWithGraph = withGraph.document.querySelector("#closeSetupButton");
  assert.equal(closeWithGraph.disabled, false, "close button must be enabled once a graph exists");
  assert.equal(closeWithGraph.hidden, false, "close button must be visible once a graph exists");
});

test("dead history controls are removed from the DOM", () => {
  const app = bootApp({ storage: validGraph() });
  assert.equal(
    app.document.querySelector(".history-controls"),
    null,
    "the decorative .history-controls should no longer exist",
  );
});

test("inspector is a region, not a modal", () => {
  const app = bootApp({ storage: validGraph() });
  const inspector = app.document.querySelector("#inspector");
  assert.equal(inspector.getAttribute("role"), "region", "inspector should be role=region");
  assert.equal(inspector.getAttribute("aria-modal"), null, "inspector must NOT be aria-modal");
  assert.ok(inspector.getAttribute("aria-label"), "inspector should have an aria-label");
});

test("placement mode shows a visible Cancel control and toggles off", () => {
  const app = bootApp({ storage: validGraph() });
  const addButton = app.document.querySelector("#addChildButton");
  const modeCancel = app.document.querySelector("#modeCancel");

  assert.equal(modeCancel.hidden, true, "Cancel chip should be hidden initially");

  // Enter placement mode.
  addButton.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));
  assert.equal(modeCancel.hidden, false, "Cancel chip should appear in placement mode");
  assert.ok(
    app.document.querySelector(".graph-shell").classList.contains("is-placing"),
    "shell should be in placing state",
  );

  // Re-clicking the originating button toggles placement mode off.
  addButton.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));
  assert.equal(
    app.document.querySelector(".graph-shell").classList.contains("is-placing"),
    false,
    "re-clicking #addChildButton should toggle placement mode off",
  );
  assert.equal(modeCancel.hidden, true, "Cancel chip should hide once placement mode is off");
});

test("Cancel control clears an active placement mode", () => {
  const app = bootApp({ storage: validGraph() });
  const addButton = app.document.querySelector("#addChildButton");
  const cancelButton = app.document.querySelector("#modeCancelButton");

  addButton.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));
  assert.ok(
    app.document.querySelector(".graph-shell").classList.contains("is-placing"),
    "placement mode should be active",
  );

  cancelButton.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));
  assert.equal(
    app.document.querySelector(".graph-shell").classList.contains("is-placing"),
    false,
    "Cancel control should clear placement mode",
  );
  assert.equal(
    app.document.querySelector("#modeCancel").hidden,
    true,
    "Cancel chip should hide after cancelling",
  );
});

test("focus toggle buttons expose aria-pressed reflecting focus mode", () => {
  const app = bootApp({ storage: validGraph() });
  const focusButton = app.document.querySelector("#focusButton");
  const globalViewButton = app.document.querySelector("#globalViewButton");

  assert.equal(focusButton.getAttribute("aria-pressed"), "false", "focusButton starts unpressed");
  assert.equal(
    globalViewButton.getAttribute("aria-pressed"),
    "false",
    "globalViewButton starts unpressed",
  );

  // Toggle focus mode on via the right-rail button.
  focusButton.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));
  assert.equal(
    focusButton.getAttribute("aria-pressed"),
    "true",
    "focusButton should reflect focus mode on",
  );
  assert.equal(
    globalViewButton.getAttribute("aria-pressed"),
    "true",
    "globalViewButton should reflect focus mode on",
  );
});

test("range inputs expose aria-valuetext", () => {
  const app = bootApp({ storage: validGraph() });

  // Select a node so the inspector renders its confidence/depth sliders.
  const node = app.document.querySelector(".graph-node");
  node.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));

  const confidence = app.document.querySelector("#confidenceInput");
  const depth = app.document.querySelector("#localDepthInput");

  assert.ok(
    /percent$/.test(confidence.getAttribute("aria-valuetext") || ""),
    `confidence slider should expose a "N percent" aria-valuetext (got ${JSON.stringify(confidence.getAttribute("aria-valuetext"))})`,
  );
  assert.ok(
    /\bstep(s)?$/.test(depth.getAttribute("aria-valuetext") || ""),
    `local depth slider should expose a "N step(s)" aria-valuetext (got ${JSON.stringify(depth.getAttribute("aria-valuetext"))})`,
  );
});

test("progressbars expose role=progressbar with numeric aria-valuenow", () => {
  const app = bootApp({ storage: validGraph() });

  const focusBar = app.document.querySelector("#focusProgressBar");
  assert.equal(focusBar.getAttribute("role"), "progressbar", "focus progress bar should be a progressbar");
  assert.ok(/^\d+$/.test(focusBar.getAttribute("aria-valuenow") || ""), "focus bar aria-valuenow should be numeric");

  // Select a node so the preview readiness bar renders.
  const node = app.document.querySelector(".graph-node");
  node.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));

  const readinessBar = app.document.querySelector("#previewReadinessBar");
  assert.equal(
    readinessBar.getAttribute("role"),
    "progressbar",
    "preview readiness bar should be a progressbar",
  );
  assert.ok(
    /^\d+$/.test(readinessBar.getAttribute("aria-valuenow") || ""),
    "readiness bar aria-valuenow should be numeric",
  );

  const ring = app.document.querySelector("#confidenceRing");
  assert.ok(
    /\d/.test(ring.getAttribute("aria-label") || ""),
    "confidence ring accessible name should include the numeric value",
  );
});

test("keyboard shortcuts are ignored when focus is on a button", () => {
  const app = bootApp({ storage: validGraph() });
  // Focus the New button (a real interactive control) and press a single-key
  // shortcut; it must NOT hijack the keypress (the search input must not focus).
  const newButton = app.document.querySelector("#newMapButton");
  newButton.focus();

  const event = new app.window.KeyboardEvent("keydown", { key: "/", bubbles: true });
  newButton.dispatchEvent(event);

  const searchInput = app.document.querySelector("#nodeSearchInput");
  assert.notEqual(
    app.document.activeElement,
    searchInput,
    "the / shortcut must not steal focus while a button is focused",
  );
});
