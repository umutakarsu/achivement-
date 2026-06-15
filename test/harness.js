"use strict";

// Test harness for the Achievement Graph app.
//
// Loads the REAL index.html + app.js into a jsdom DOM, seeds localStorage
// before app.js runs, polyfills the browser APIs jsdom lacks but app.js uses,
// and returns { window, document, errors } plus a few DOM query helpers.
//
// NOTE ON HANGS: app.js currently has code paths (e.g. getDepth walking
// parentId links) that can spin forever on cyclic data. A synchronous infinite
// loop cannot be interrupted by a timer on the same thread, so the cyclic test
// uses bootAppInWorker() (below) which runs the whole boot inside a Worker that
// can be terminated after a timeout. The plain bootApp() is for the non-hanging
// cases.

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { Worker } = require("node:worker_threads");

const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "achievement-graph-v2";

function readSource() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  return { html, appJs };
}

// Strip the <script src="app.js..."> tag out of the HTML so jsdom does not try
// to fetch/run it on its own. We inject app.js text ourselves so we control
// timing (after seeding localStorage + polyfills) and can capture errors.
function stripAppScript(html) {
  return html.replace(/<script\b[^>]*\bsrc=["'][^"']*app\.js[^"']*["'][^>]*>\s*<\/script>/i, "");
}

function makeZeroRect() {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON() {
      return this;
    },
  };
}

function applyPolyfills(window) {
  const { Element } = window;

  // matchMedia: app.js reads .matches and (potentially) (un)registers listeners.
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = function matchMedia() {
      return {
        matches: false,
        media: "",
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      };
    };
  }

  // navigator.vibrate: no-op returning true.
  try {
    if (typeof window.navigator.vibrate !== "function") {
      Object.defineProperty(window.navigator, "vibrate", {
        configurable: true,
        writable: true,
        value: function vibrate() {
          return true;
        },
      });
    }
  } catch {
    // Some environments make navigator props non-configurable; ignore.
  }

  // Pointer capture APIs jsdom does not implement.
  if (typeof Element.prototype.setPointerCapture !== "function") {
    Element.prototype.setPointerCapture = function setPointerCapture() {};
  }
  if (typeof Element.prototype.releasePointerCapture !== "function") {
    Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  }
  if (typeof Element.prototype.hasPointerCapture !== "function") {
    Element.prototype.hasPointerCapture = function hasPointerCapture() {
      return false;
    };
  }

  // getBoundingClientRect: jsdom returns a zeroed rect already, but guarantee it.
  if (typeof Element.prototype.getBoundingClientRect !== "function") {
    Element.prototype.getBoundingClientRect = makeZeroRect;
  }

  // requestAnimationFrame: pretendToBeVisual provides it, but guard anyway.
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = function requestAnimationFrame(cb) {
      return window.setTimeout(() => cb(Date.now()), 0);
    };
  }
  if (typeof window.cancelAnimationFrame !== "function") {
    window.cancelAnimationFrame = function cancelAnimationFrame(id) {
      window.clearTimeout(id);
    };
  }
}

/**
 * Boot the app in a jsdom window.
 *
 * @param {{ storage?: any }} opts - storage is JSON.stringify'd under the
 *   app's localStorage key BEFORE app.js runs. Omit to leave storage empty.
 * @returns {{
 *   window: import('jsdom').DOMWindow,
 *   document: Document,
 *   errors: Error[],
 *   graphNodeCount: () => number,
 *   hasSetupPanel: () => boolean,
 *   dom: JSDOM,
 * }}
 */
function bootApp({ storage } = {}) {
  const { html, appJs } = readSource();
  const markup = stripAppScript(html);

  const errors = [];
  const virtualConsole = new VirtualConsole();
  // Surface jsdom-internal "uncaught exception" reports as captured errors too.
  virtualConsole.on("jsdomError", (err) => {
    errors.push(err);
  });

  const dom = new JSDOM(markup, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://achievement-graph.test/",
    virtualConsole,
  });

  const { window } = dom;

  // Seed localStorage BEFORE app.js runs.
  if (typeof storage !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  }

  applyPolyfills(window);

  // Capture runtime errors thrown asynchronously / via window.onerror.
  window.onerror = function onerror(message, source, lineno, colno, error) {
    errors.push(error instanceof Error ? error : new Error(String(message)));
    return false;
  };
  window.addEventListener("error", (event) => {
    if (event.error instanceof Error) errors.push(event.error);
    else if (event.message) errors.push(new Error(String(event.message)));
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    errors.push(reason instanceof Error ? reason : new Error(String(reason)));
  });

  // Inject app.js as a <script> so it executes in this window. Wrap eval in a
  // try/catch so a synchronous throw during execution is captured rather than
  // crashing the test process.
  const scriptEl = window.document.createElement("script");
  scriptEl.textContent = appJs;
  try {
    window.document.body.appendChild(scriptEl);
  } catch (err) {
    errors.push(err instanceof Error ? err : new Error(String(err)));
  }

  const { document } = window;

  return {
    window,
    document,
    dom,
    errors,
    graphNodeCount: () => document.querySelectorAll(".graph-node").length,
    hasSetupPanel: () => Boolean(document.querySelector("#setupPanel")),
  };
}

// Worker entrypoint: when harness.js is loaded as a Worker, boot the app with
// the storage passed via workerData and report back a serializable summary.
// This is how we boot POTENTIALLY-HANGING data (e.g. cyclic parentId links)
// without risking the main test process: the Worker can be .terminate()'d.
if (!require("node:worker_threads").isMainThread) {
  const { workerData, parentPort } = require("node:worker_threads");
  try {
    const result = bootApp({ storage: workerData.storage });
    parentPort.postMessage({
      ok: true,
      errorCount: result.errors.length,
      errorMessages: result.errors.map((e) => (e && e.message) || String(e)),
      graphNodeCount: result.graphNodeCount(),
      hasSetupPanel: result.hasSetupPanel(),
    });
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      errorCount: 1,
      errorMessages: [(err && err.message) || String(err)],
      graphNodeCount: 0,
      hasSetupPanel: false,
    });
  }
}

/**
 * Boot the app inside a Worker thread with a hard timeout, so data that sends
 * app.js into a synchronous infinite loop cannot hang the test process. A
 * synchronous infinite loop cannot be interrupted by a same-thread timer, so a
 * separate, terminable thread is the only safe way to assert the expectation.
 *
 * @param {{ storage?: any, timeoutMs?: number }} opts
 * @returns {Promise<{
 *   timedOut: boolean,
 *   ok: boolean,
 *   errorCount: number,
 *   errorMessages: string[],
 *   graphNodeCount: number,
 *   hasSetupPanel: boolean,
 * }>}
 */
function bootAppInWorker({ storage, timeoutMs = 4000 } = {}) {
  return new Promise((resolve) => {
    const worker = new Worker(__filename, { workerData: { storage } });
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish({
        timedOut: true,
        ok: false,
        errorCount: 0,
        errorMessages: [],
        graphNodeCount: 0,
        hasSetupPanel: false,
      });
    }, timeoutMs);

    worker.on("message", (msg) => {
      clearTimeout(timer);
      finish({ timedOut: false, ...msg });
    });
    worker.on("error", (err) => {
      clearTimeout(timer);
      finish({
        timedOut: false,
        ok: false,
        errorCount: 1,
        errorMessages: [(err && err.message) || String(err)],
        graphNodeCount: 0,
        hasSetupPanel: false,
      });
    });
  });
}

module.exports = { bootApp, bootAppInWorker, STORAGE_KEY, readSource, stripAppScript };
