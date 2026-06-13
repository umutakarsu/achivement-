const STORAGE_KEY = "achievement-graph-v2";

const exampleNodes = [
  {
    id: "top",
    parentId: null,
    title: "Run my first marathon",
    why: "I want proof that I can keep a promise to myself across months, not days.",
    blocker: "Work gets busy and I skip training.",
    confidence: 75,
    friction: "High",
    evidence: "I finish a certified marathon and can explain the training system that got me there.",
    action: "Schedule three 30-minute runs this week.",
    done: false,
  },
  {
    id: "base-fitness",
    parentId: "top",
    title: "Build running base",
    why: "Repeated easy runs make the bigger goal feel normal instead of heroic.",
    blocker: "Starting too hard and getting sore.",
    confidence: 80,
    friction: "Medium",
    evidence: "Four weeks with at least three runs per week.",
    action: "Choose exact weekdays and times for each run.",
    done: true,
  },
  {
    id: "fuel-recovery",
    parentId: "top",
    title: "Learn fuel recovery",
    why: "The goal becomes safer when my body has a recovery system.",
    blocker: "Forgetting meals after long sessions.",
    confidence: 60,
    friction: "Medium",
    evidence: "A repeatable pre-run, post-run, and sleep routine.",
    action: "Write a simple post-run meal list.",
    done: false,
  },
  {
    id: "shoes",
    parentId: "base-fitness",
    title: "Choose fitted shoes",
    why: "Reducing pain makes the habit easier to repeat.",
    blocker: "Overthinking gear choices.",
    confidence: 90,
    friction: "Low",
    evidence: "I can run 8 km without foot pain.",
    action: "Visit a running store this Saturday.",
    done: true,
  },
  {
    id: "routes",
    parentId: "base-fitness",
    title: "Save run routes",
    why: "A default route removes decision fatigue.",
    blocker: "Weather and dark evenings.",
    confidence: 70,
    friction: "Low",
    evidence: "Short, medium, and long routes are saved.",
    action: "Save one 5 km route near home.",
    done: true,
  },
  {
    id: "sleep",
    parentId: "fuel-recovery",
    title: "Protect sleep",
    why: "Recovery is the hidden training session.",
    blocker: "Late screen time on Fridays.",
    confidence: 45,
    friction: "High",
    evidence: "At least 7 hours of sleep before three long runs.",
    action: "Set a Friday 10:15 PM wind-down alarm.",
    done: false,
  },
  {
    id: "race-fuel",
    parentId: "fuel-recovery",
    title: "Practice fueling",
    why: "Confidence grows when race day feels familiar.",
    blocker: "Trying new food too late.",
    confidence: 55,
    friction: "Medium",
    evidence: "Two long runs finished with the same fueling plan.",
    action: "Buy two fuel options to test.",
    done: false,
  },
];

let nodes = loadNodes();
let selectedId = null;
let setupOpen = nodes.length === 0;
let ritualCollapsed = false;

const setupPanel = document.querySelector("#setupPanel");
const closeSetupButton = document.querySelector("#closeSetupButton");
const setupGoalInput = document.querySelector("#setupGoalInput");
const setupPrereqInput = document.querySelector("#setupPrereqInput");
const graphShell = document.querySelector(".graph-shell");
const graphCanvas = document.querySelector(".achievement-map");
const mapEl = document.querySelector("#achievementMap");
const linkLayer = document.querySelector("#linkLayer");
const template = document.querySelector("#nodeTemplate");
const graphHint = document.querySelector("#graphHint");
const modeLabel = document.querySelector("#modeLabel");
const zoomLabel = document.querySelector("#zoomLabel");
const readinessSummary = document.querySelector("#readinessSummary");
const completionToast = document.querySelector("#completionToast");
const completionTitle = document.querySelector("#completionTitle");
const completionCopy = document.querySelector("#completionCopy");
const completionNextButton = document.querySelector("#completionNextButton");
const focusTray = document.querySelector("#focusTray");
const focusProgressBar = document.querySelector("#focusProgressBar");
const focusProgressText = document.querySelector("#focusProgressText");
const focusNodeTitle = document.querySelector("#focusNodeTitle");
const focusNodeWhy = document.querySelector("#focusNodeWhy");
const focusNodeAction = document.querySelector("#focusNodeAction");
const focusOpenButton = document.querySelector("#focusOpenButton");
const exploreMapButton = document.querySelector("#exploreMapButton");
const ritualWish = document.querySelector("#ritualWish");
const ritualOutcome = document.querySelector("#ritualOutcome");
const ritualObstacle = document.querySelector("#ritualObstacle");
const ritualPlan = document.querySelector("#ritualPlan");
const nodeSearch = document.querySelector(".node-search");
const nodeSearchInput = document.querySelector("#nodeSearchInput");
const searchResults = document.querySelector("#searchResults");
const inspector = document.querySelector("#inspector");
const inspectorPath = document.querySelector("#inspectorPath");
const previewTitle = document.querySelector("#previewTitle");
const previewMeta = document.querySelector("#previewMeta");
const previewReadinessBar = document.querySelector("#previewReadinessBar");
const previewWhy = document.querySelector("#previewWhy");
const previewAction = document.querySelector("#previewAction");
const relationChips = document.querySelector("#relationChips");
const localDepthInput = document.querySelector("#localDepthInput");
const localDepthLabel = document.querySelector("#localDepthLabel");
const ifThenPreview = document.querySelector("#ifThenPreview");
const suggestionBox = document.querySelector("#suggestionBox");
const readinessList = document.querySelector("#readinessList");
const readinessCount = document.querySelector("#readinessCount");
const confidenceValue = document.querySelector("#confidenceValue");

const inputs = {
  title: document.querySelector("#titleInput"),
  why: document.querySelector("#whyInput"),
  evidence: document.querySelector("#evidenceInput"),
  blocker: document.querySelector("#blockerInput"),
  action: document.querySelector("#actionInput"),
  confidence: document.querySelector("#confidenceInput"),
  friction: document.querySelector("#frictionInput"),
};
const focusButton = document.querySelector("#focusButton");

const view = {
  scale: 1,
  x: 0,
  y: 0,
  focusMode: false,
  localDepth: 1,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  startX: 0,
  startY: 0,
  pinchStartDistance: 0,
  pinchStartScale: 1,
};

const activePointers = new Map();
let completionTimer = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadNodes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

function makeId(prefix = "node") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSelected() {
  return nodes.find((node) => node.id === selectedId) || null;
}

function childrenOf(parentId) {
  return nodes.filter((node) => node.parentId === parentId);
}

function getParent(node) {
  return nodes.find((candidate) => candidate.id === node.parentId) || null;
}

function getDepth(node) {
  let depth = 0;
  let current = node;

  while (current?.parentId) {
    current = getParent(current);
    depth += 1;
  }

  return depth;
}

function getRelatedIds() {
  const related = new Set();
  const selected = getSelected();
  if (!selected) return related;

  const queue = [{ id: selected.id, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (related.has(current.id) || current.depth > view.localDepth) continue;
    related.add(current.id);

    const node = nodes.find((candidate) => candidate.id === current.id);
    if (!node) continue;
    if (node.parentId) queue.push({ id: node.parentId, depth: current.depth + 1 });
    childrenOf(node.id).forEach((child) => queue.push({ id: child.id, depth: current.depth + 1 }));
  }

  return related;
}

function getVisibleIds() {
  if (!view.focusMode) return new Set(nodes.map((node) => node.id));
  return getRelatedIds();
}

function getReadinessChecks(node) {
  return [
    {
      label: "Specific achievement",
      met: node.title.trim().split(/\s+/).length >= 3,
    },
    {
      label: "Self-endorsed why",
      met: node.why.trim().length >= 24,
    },
    {
      label: "Proof of completion",
      met: node.evidence.trim().length >= 8,
    },
    {
      label: "Named blocker",
      met: node.blocker.trim().length >= 5,
    },
    {
      label: "Small next action",
      met: node.action.trim().split(/\s+/).length >= 4,
    },
    {
      label: "Believable enough",
      met: Number(node.confidence) >= 65,
    },
  ];
}

function isReady(node) {
  return getReadinessChecks(node).every((check) => check.met);
}

function getNextUnclearNode() {
  const openNodes = nodes.filter((node) => !node.done);
  if (!openNodes.length) return nodes[0] || null;

  return [...openNodes].sort((a, b) => {
    const aChecks = getReadinessChecks(a).filter((check) => check.met).length;
    const bChecks = getReadinessChecks(b).filter((check) => check.met).length;
    if (aChecks !== bChecks) return aChecks - bChecks;
    return Number(a.confidence) - Number(b.confidence);
  })[0];
}

function getGraphLayout() {
  const groups = new Map();
  nodes.forEach((node) => {
    const depth = getDepth(node);
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth).push(node);
  });

  const positions = new Map();
  const maxDepth = Math.max(1, ...groups.keys());

  [...groups.entries()].forEach(([depth, group]) => {
    const y = depth === 0 ? 16 : 28 + depth * (60 / maxDepth);

    group.forEach((node, index) => {
      const parent = getParent(node);
      const siblings = parent ? childrenOf(parent.id) : group;
      const siblingIndex = siblings.findIndex((candidate) => candidate.id === node.id);
      const parentX = parent && positions.has(parent.id) ? positions.get(parent.id).x : 50;
      const offset = siblingIndex - (siblings.length - 1) / 2;
      let x = parentX + offset * Math.max(14, 44 / Math.max(1, siblings.length - 1 || 1));

      if (depth >= 2) {
        x = group.length === 1 ? 50 : 16 + index * (68 / (group.length - 1));
      }

      positions.set(node.id, {
        depth,
        x: depth === 0 ? 50 : Math.max(10, Math.min(90, x)),
        y: Math.max(12, Math.min(88, y)),
      });
    });
  });

  return positions;
}

function renderGraph() {
  mapEl.innerHTML = "";
  linkLayer.innerHTML = "";

  const positions = getGraphLayout();
  const relatedIds = getRelatedIds();
  const visibleIds = getVisibleIds();
  const hasSelection = Boolean(selectedId);

  nodes.forEach((node) => {
    if (!node.parentId) return;
    const start = positions.get(node.parentId);
    const end = positions.get(node.id);
    if (!start || !end) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
    line.classList.add("graph-link");
    line.style.display = visibleIds.has(node.id) && visibleIds.has(node.parentId) ? "" : "none";
    line.classList.toggle("is-related", relatedIds.has(node.id) && relatedIds.has(node.parentId));
    linkLayer.append(line);
  });

  nodes.forEach((node) => {
    const position = positions.get(node.id);
    const button = template.content.firstElementChild.cloneNode(true);
    button.dataset.id = node.id;
    button.dataset.depth = String(position.depth);
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.classList.toggle("is-selected", node.id === selectedId);
    button.classList.toggle("is-done", node.done);
    button.classList.toggle("is-ready", isReady(node));
    button.classList.toggle("is-low-confidence", Number(node.confidence) < 65);
    button.classList.toggle("is-dimmed", hasSelection && !relatedIds.has(node.id));
    button.hidden = !visibleIds.has(node.id);
    button.querySelector(".node-label").textContent = node.title || "Untitled achievement";
    button.addEventListener("click", () => selectNode(node.id));
    mapEl.append(button);
  });

  renderHint();
  applyViewTransform();
}

function renderHint() {
  if (!nodes.length) {
    graphHint.textContent = "";
    readinessSummary.textContent = "0 clear";
    renderFocusTray();
    return;
  }

  const done = nodes.filter((node) => node.done).length;
  const ready = nodes.filter(isReady).length;
  const next = getNextUnclearNode();
  const avgConfidence = Math.round(
    nodes.reduce((total, node) => total + Number(node.confidence || 0), 0) / nodes.length,
  );
  const mode = view.focusMode ? "Local focus" : "Global graph";
  modeLabel.textContent = mode;
  readinessSummary.textContent = `${ready}/${nodes.length} clear`;
  graphHint.textContent = `${mode}. ${done}/${nodes.length} complete. ${ready}/${nodes.length} clear enough to act on. Average confidence ${avgConfidence}%. Next review: ${next?.title || "none"}. Press / to find, scroll to zoom, drag empty space to pan.`;
  renderFocusTray();
}

function renderFocusTray() {
  focusTray.classList.toggle("is-hidden", !nodes.length || setupOpen);
  graphShell.classList.toggle("is-ritual-open", Boolean(nodes.length && !setupOpen && !ritualCollapsed));
  focusTray.classList.toggle("is-collapsed", ritualCollapsed);
  if (!nodes.length) return;

  const done = nodes.filter((node) => node.done).length;
  const next = getNextUnclearNode();
  const top = nodes.find((node) => !node.parentId) || nodes[0];
  const progress = Math.round((done / nodes.length) * 100);

  focusProgressBar.style.width = `${progress}%`;
  focusProgressText.textContent = `${progress}% complete`;
  focusNodeTitle.textContent = next?.title || "Map complete";
  focusNodeWhy.textContent = shorten(next?.why, "This is the smallest move that makes the larger path easier.");
  focusNodeAction.textContent = next?.action?.trim() || "Define the smallest visible action.";
  ritualWish.textContent = shorten(top?.title, "Make the peak real", 48);
  ritualOutcome.textContent = shorten(next?.evidence, "Know what done looks like", 48);
  ritualObstacle.textContent = shorten(next?.blocker, "The likely blocker", 48);
  ritualPlan.textContent = shorten(buildIfThen(next || top), "If the blocker appears, take the next move.", 68);
  focusOpenButton.disabled = !next;
  focusOpenButton.textContent = next?.done ? "Review" : "Start move";
}

function showCompletion(node) {
  const done = nodes.filter((candidate) => candidate.done).length;
  const progress = Math.round((done / nodes.length) * 100);
  const next = getNextUnclearNode();

  clearTimeout(completionTimer);
  completionTitle.textContent = `${node.title} is done.`;
  completionCopy.textContent = next
    ? `${progress}% of the path is complete. Next: ${next.title}.`
    : "Every visible move is complete. Take a second to notice the promise you kept.";
  completionNextButton.hidden = !next || next.id === node.id;
  completionToast.classList.add("is-visible");
  graphShell.classList.add("is-celebrating");

  completionTimer = setTimeout(() => {
    completionToast.classList.remove("is-visible");
    graphShell.classList.remove("is-celebrating");
  }, 4200);
}

function renderSetup() {
  setupPanel.classList.toggle("is-hidden", !setupOpen);
  setupPanel.classList.toggle("can-close", nodes.length > 0);
}

function renderInspector() {
  const node = getSelected();
  if (!node) {
    inspector.classList.remove("is-open");
    inspector.classList.remove("is-editing");
    return;
  }

  renderPreview(node);
  inputs.title.value = node.title;
  inputs.why.value = node.why;
  inputs.evidence.value = node.evidence;
  inputs.blocker.value = node.blocker;
  inputs.action.value = node.action;
  inputs.confidence.value = node.confidence;
  inputs.friction.value = node.friction;
  confidenceValue.textContent = `${node.confidence}%`;
  ifThenPreview.textContent = buildIfThen(node);
  renderReadiness(node);
  renderSuggestion(node);
}

function renderPreview(node) {
  const checks = getReadinessChecks(node);
  const met = checks.filter((check) => check.met).length;
  const children = childrenOf(node.id);
  const parent = getParent(node);
  const visibleIds = getVisibleIds();
  const relatedIds = getRelatedIds();
  const contextCount = view.focusMode ? `${visibleIds.size} visible` : `${relatedIds.size} linked`;

  previewTitle.textContent = node.title || "Untitled achievement";
  previewMeta.textContent = `${node.done ? "Done" : "Open"} - ${node.confidence}% belief - ${met}/${checks.length} ready`;
  previewReadinessBar.style.width = `${Math.round((met / checks.length) * 100)}%`;
  previewWhy.textContent = node.why.trim() || "Add why this achievement matters so the node has emotional pull.";
  previewAction.textContent = node.action.trim() || "Define the smallest visible action.";

  relationChips.innerHTML = "";
  if (parent) {
    relationChips.append(createRelationChip(`Parent: ${parent.title}`, parent.id));
  } else {
    const chip = document.createElement("span");
    chip.className = "relation-chip is-static";
    chip.textContent = "Top achievement";
    relationChips.append(chip);
  }

  children.slice(0, 4).forEach((child) => {
    relationChips.append(createRelationChip(`Child: ${child.title}`, child.id));
  });

  if (!children.length) {
    const chip = document.createElement("span");
    chip.className = "relation-chip is-static";
    chip.textContent = "No supporting nodes yet";
    relationChips.append(chip);
  }

  localDepthInput.value = String(view.localDepth);
  localDepthLabel.textContent = `${view.localDepth} ${view.localDepth === 1 ? "step" : "steps"}`;
  document.querySelector("#previewDoneButton").textContent = node.done ? "Mark open" : "Mark done";
  document.querySelector("#globalViewButton").textContent = view.focusMode ? "Global view" : "Focus local";
  inspectorPath.textContent =
    getDepth(node) === 0
      ? `Top achievement - ${contextCount}`
      : `Supporting achievement - ${contextCount}`;
}

function createRelationChip(label, id) {
  const chip = document.createElement("button");
  chip.className = "relation-chip";
  chip.type = "button";
  chip.textContent = label;
  chip.addEventListener("click", () => selectNode(id));
  return chip;
}

function buildIfThen(node) {
  const blocker = (node.blocker.trim() || "the likely blocker appears").replace(/[.!?]+$/, "");
  const action = (node.action.trim() || "take the smallest next action").replace(/[.!?]+$/, "");
  const sentenceBlocker = blocker.charAt(0).toLowerCase() + blocker.slice(1);
  const sentenceAction = action.charAt(0).toLowerCase() + action.slice(1);
  return `If ${sentenceBlocker}, then I will ${sentenceAction}.`;
}

function shorten(value, fallback, limit = 74) {
  const text = value?.trim() || fallback;
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

function renderSuggestion(node) {
  if (Number(node.confidence) >= 65) {
    suggestionBox.classList.add("is-hidden");
    suggestionBox.textContent = "";
    return;
  }

  suggestionBox.classList.remove("is-hidden");
  suggestionBox.textContent =
    "Confidence is low. Make this smaller: reduce the node until it feels at least 65% believable, or add a supporting achievement that removes the blocker.";
}

function renderReadiness(node) {
  readinessList.innerHTML = "";
  const checks = getReadinessChecks(node);
  const met = checks.filter((check) => check.met).length;
  readinessCount.textContent = `${met}/${checks.length}`;
  checks.forEach((check) => {
    const item = document.createElement("div");
    item.className = `readiness-item ${check.met ? "is-met" : ""}`;
    item.innerHTML = `<span>${check.label}</span><span class="readiness-mark">${check.met ? "OK" : "..."}</span>`;
    readinessList.append(item);
  });
}

function selectNode(id, options = {}) {
  selectedId = id;
  ritualCollapsed = true;
  if (options.focus) view.focusMode = true;
  inspector.classList.add("is-open");
  inspector.classList.toggle("is-editing", Boolean(options.editing));
  render();
}

function selectNodeFromSearch(id) {
  nodeSearchInput.value = "";
  nodeSearch.classList.remove("is-open");
  searchResults.innerHTML = "";
  selectNode(id);
  centerNode(id);
}

function clampScale(scale) {
  return Math.max(0.45, Math.min(2.8, scale));
}

function applyViewTransform() {
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  mapEl.style.transform = transform;
  linkLayer.style.transform = transform;
  zoomLabel.textContent = `${Math.round(view.scale * 100)}%`;
  focusButton.classList.toggle("is-active", view.focusMode);
  graphShell.classList.toggle("is-zoomed-out", view.scale < 0.72);
  graphShell.classList.toggle("is-focus-mode", view.focusMode);
}

function zoomAt(clientX, clientY, nextScale) {
  const rect = graphCanvas.getBoundingClientRect();
  const pointX = clientX - rect.left;
  const pointY = clientY - rect.top;
  const scale = clampScale(nextScale);
  const ratio = scale / view.scale;

  view.x = pointX - (pointX - view.x) * ratio;
  view.y = pointY - (pointY - view.y) * ratio;
  view.scale = scale;
  applyViewTransform();
}

function zoomBy(multiplier) {
  const rect = graphCanvas.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.scale * multiplier);
}

function resetView() {
  view.scale = 1;
  view.x = 0;
  view.y = 0;
  applyViewTransform();
}

function toggleFocusMode() {
  if (!selectedId) {
    selectedId = nodes[0]?.id || null;
  }
  if (!selectedId) return;
  view.focusMode = !view.focusMode;
  inspector.classList.add("is-open");
  render();
}

function centerNode(id) {
  const position = getGraphLayout().get(id);
  if (!position) return;

  const rect = graphCanvas.getBoundingClientRect();
  view.x = rect.width / 2 - (position.x / 100) * rect.width * view.scale;
  view.y = rect.height / 2 - (position.y / 100) * rect.height * view.scale;
  applyViewTransform();
}

function clearSelection() {
  selectedId = null;
  view.focusMode = false;
  inspector.classList.remove("is-open");
  inspector.classList.remove("is-editing");
  render();
}

function getPointerMetrics() {
  const points = [...activePointers.values()];
  if (points.length < 2) return null;

  const [a, b] = points;
  return {
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    centerX: (a.x + b.x) / 2,
    centerY: (a.y + b.y) / 2,
  };
}

function selectNextUnclearNode() {
  const next = getNextUnclearNode();
  if (!next) return;
  selectNode(next.id);
  centerNode(next.id);
}

function renderSearchResults() {
  const query = nodeSearchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  nodeSearch.classList.toggle("is-open", Boolean(query));
  if (!query) return;

  const matches = nodes
    .filter((node) =>
      [node.title, node.why, node.action, node.blocker].some((value) => value.toLowerCase().includes(query)),
    )
    .slice(0, 8);

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-result";
    empty.innerHTML = "<span>No matching nodes</span><span>Try a goal, blocker, or next action</span>";
    searchResults.append(empty);
    return;
  }

  matches.forEach((node) => {
    const result = document.createElement("button");
    result.className = "search-result";
    result.type = "button";
    result.innerHTML = `<span>${node.title}</span><span>${getDepth(node) === 0 ? "Top achievement" : "Supporting achievement"} - ${node.confidence}% belief</span>`;
    result.addEventListener("click", () => selectNodeFromSearch(node.id));
    searchResults.append(result);
  });
}

function updateSelected(key, value) {
  const node = getSelected();
  if (!node) return;

  node[key] = value;
  save();
  renderGraph();
  renderInspector();
}

function createInitialMap() {
  const title = setupGoalInput.value.trim();
  if (!title) {
    setupGoalInput.focus();
    return;
  }

  const topId = makeId("top");
  const prereqs = setupPrereqInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  nodes = [
    {
      id: topId,
      parentId: null,
      title,
      why: "",
      blocker: "",
      confidence: 65,
      friction: "Medium",
      evidence: "",
      action: "",
      done: false,
    },
    ...prereqs.map((prereq) => ({
      id: makeId("support"),
      parentId: topId,
      title: prereq,
      why: "",
      blocker: "",
      confidence: 55,
      friction: "Medium",
      evidence: "",
      action: "",
      done: false,
    })),
  ];

  selectedId = topId;
  setupOpen = false;
  ritualCollapsed = false;
  inspector.classList.add("is-open");
  inspector.classList.remove("is-editing");
  view.focusMode = false;
  save();
  render();
}

function useExample() {
  nodes = clone(exampleNodes);
  selectedId = null;
  setupOpen = false;
  ritualCollapsed = false;
  inspector.classList.remove("is-open");
  inspector.classList.remove("is-editing");
  view.focusMode = false;
  save();
  render();
}

function openNewMap() {
  setupOpen = true;
  ritualCollapsed = true;
  selectedId = null;
  inspector.classList.remove("is-open");
  inspector.classList.remove("is-editing");
  view.focusMode = false;
  setupGoalInput.value = "";
  setupPrereqInput.value = "";
  render();
  setupGoalInput.focus();
}

function closeSetup() {
  if (!nodes.length) return;
  setupOpen = false;
  ritualCollapsed = false;
  setupGoalInput.value = "";
  setupPrereqInput.value = "";
  render();
}

function addSupportingAchievement() {
  const parent = getSelected() || nodes[0];
  if (!parent) {
    openNewMap();
    return;
  }

  const id = makeId("support");
  nodes.push({
    id,
    parentId: parent.id,
    title: "New supporting achievement",
    why: "",
    blocker: "",
    confidence: 50,
    friction: "Medium",
    evidence: "",
    action: "",
    done: false,
  });
  selectedId = id;
  inspector.classList.add("is-open");
  inspector.classList.add("is-editing");
  save();
  render();
}

function makeSelectedSmaller() {
  const node = getSelected();
  if (!node) return;

  const blocker = node.blocker.trim();
  const title = blocker ? `Remove blocker: ${blocker}` : `Make "${node.title}" easier`;
  const id = makeId("support");
  nodes.push({
    id,
    parentId: node.id,
    title,
    why: `This makes "${node.title}" more believable.`,
    blocker: "",
    confidence: 70,
    friction: "Low",
    evidence: "",
    action: "Define the smallest version I can do next.",
    done: false,
  });
  node.confidence = Math.max(Number(node.confidence), 65);
  selectedId = id;
  inspector.classList.add("is-open");
  inspector.classList.remove("is-editing");
  save();
  render();
}

function deleteSelected() {
  const node = getSelected();
  if (!node || !node.parentId) return;

  const toDelete = new Set([node.id]);
  let changed = true;

  while (changed) {
    changed = false;
    nodes.forEach((candidate) => {
      if (candidate.parentId && toDelete.has(candidate.parentId) && !toDelete.has(candidate.id)) {
        toDelete.add(candidate.id);
        changed = true;
      }
    });
  }

  nodes = nodes.filter((candidate) => !toDelete.has(candidate.id));
  selectedId = node.parentId;
  save();
  render();
}

Object.entries(inputs).forEach(([key, input]) => {
  input.addEventListener("input", () => {
    const value = key === "confidence" ? Number(input.value) : input.value;
    updateSelected(key, value);
  });
});

document.querySelector("#createMapButton").addEventListener("click", createInitialMap);
document.querySelector("#useExampleButton").addEventListener("click", useExample);
document.querySelector("#newMapButton").addEventListener("click", openNewMap);
closeSetupButton.addEventListener("click", closeSetup);
document.querySelector("#resetButton").addEventListener("click", useExample);
document.querySelector("#inspectorToggle").addEventListener("click", () => {
  if (!nodes.length) return;
  inspector.classList.add("is-open");
  inspector.classList.toggle("is-editing");
});
document.querySelector("#closeInspectorButton").addEventListener("click", () => {
  clearSelection();
});
document.querySelector("#addChildButton").addEventListener("click", addSupportingAchievement);
document.querySelector("#nextNodeButton").addEventListener("click", selectNextUnclearNode);
focusOpenButton.addEventListener("click", () => {
  ritualCollapsed = true;
  selectNextUnclearNode();
});
exploreMapButton.addEventListener("click", () => {
  ritualCollapsed = true;
  clearSelection();
});
document.querySelector("#zoomInButton").addEventListener("click", () => zoomBy(1.18));
document.querySelector("#zoomOutButton").addEventListener("click", () => zoomBy(0.85));
document.querySelector("#fitButton").addEventListener("click", resetView);
document.querySelector("#focusButton").addEventListener("click", toggleFocusMode);
localDepthInput.addEventListener("input", () => {
  view.localDepth = Number(localDepthInput.value);
  renderGraph();
  renderInspector();
});
document.querySelector("#editDetailsButton").addEventListener("click", () => {
  inspector.classList.add("is-editing");
  inputs.title.focus();
});
document.querySelector("#previewAddButton").addEventListener("click", addSupportingAchievement);
document.querySelector("#globalViewButton").addEventListener("click", () => {
  view.focusMode = !view.focusMode;
  render();
});
document.querySelector("#previewDoneButton").addEventListener("click", () => {
  const node = getSelected();
  if (!node) return;
  const wasDone = node.done;
  node.done = !node.done;
  save();
  render();
  if (!wasDone && node.done) showCompletion(node);
});
completionNextButton.addEventListener("click", () => {
  completionToast.classList.remove("is-visible");
  graphShell.classList.remove("is-celebrating");
  ritualCollapsed = true;
  selectNextUnclearNode();
});
document.querySelector("#shrinkButton").addEventListener("click", makeSelectedSmaller);
document.querySelector("#deleteButton").addEventListener("click", deleteSelected);
nodeSearchInput.addEventListener("input", renderSearchResults);
nodeSearchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const firstResult = searchResults.querySelector(".search-result");
  if (firstResult?.tagName === "BUTTON") firstResult.click();
});

graphCanvas.addEventListener(
  "wheel",
  (event) => {
    if (!nodes.length || !setupPanel.classList.contains("is-hidden")) return;
    event.preventDefault();
    const multiplier = event.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(event.clientX, event.clientY, view.scale * multiplier);
  },
  { passive: false },
);

graphCanvas.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".graph-node") || event.target.closest(".right-rail")) return;
  if (event.button !== 0 && event.button !== 1) return;

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  graphCanvas.classList.add("is-panning");
  graphCanvas.setPointerCapture(event.pointerId);

  if (activePointers.size >= 2) {
    const metrics = getPointerMetrics();
    view.isPanning = false;
    view.pinchStartDistance = metrics.distance;
    view.pinchStartScale = view.scale;
    return;
  }

  view.isPanning = true;
  view.panStartX = event.clientX;
  view.panStartY = event.clientY;
  view.startX = view.x;
  view.startY = view.y;
});

graphCanvas.addEventListener("pointermove", (event) => {
  if (activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  if (activePointers.size >= 2) {
    const metrics = getPointerMetrics();
    if (!metrics || !view.pinchStartDistance) return;
    zoomAt(metrics.centerX, metrics.centerY, view.pinchStartScale * (metrics.distance / view.pinchStartDistance));
    return;
  }

  if (!view.isPanning) return;
  view.x = view.startX + event.clientX - view.panStartX;
  view.y = view.startY + event.clientY - view.panStartY;
  applyViewTransform();
});

graphCanvas.addEventListener("pointerup", (event) => {
  activePointers.delete(event.pointerId);
  view.isPanning = false;
  graphCanvas.classList.remove("is-panning");
  graphCanvas.releasePointerCapture(event.pointerId);
});

graphCanvas.addEventListener("pointercancel", () => {
  activePointers.clear();
  view.isPanning = false;
  graphCanvas.classList.remove("is-panning");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (setupOpen && nodes.length) {
      closeSetup();
      return;
    }
    nodeSearchInput.value = "";
    nodeSearch.classList.remove("is-open");
    searchResults.innerHTML = "";
    clearSelection();
    return;
  }
  if (event.target.matches("input, textarea, select")) return;
  if (event.key === "/") {
    event.preventDefault();
    nodeSearchInput.focus();
  }
  if (event.key === "+" || event.key === "=") zoomBy(1.18);
  if (event.key === "-") zoomBy(0.85);
  if (event.key === "0") resetView();
  if (event.key.toLowerCase() === "f") toggleFocusMode();
});

function render() {
  renderSetup();
  renderGraph();
  renderInspector();
}

render();
