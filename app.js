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
    title: "Build a running base",
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
    title: "Learn fuel and recovery",
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
    title: "Choose shoes that fit",
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
    title: "Save default routes",
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
    title: "Practice race fuel",
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
let selectedId = nodes[0]?.id || null;

const setupPanel = document.querySelector("#setupPanel");
const setupGoalInput = document.querySelector("#setupGoalInput");
const setupPrereqInput = document.querySelector("#setupPrereqInput");
const mapEl = document.querySelector("#achievementMap");
const linkLayer = document.querySelector("#linkLayer");
const template = document.querySelector("#nodeTemplate");
const graphHint = document.querySelector("#graphHint");
const inspector = document.querySelector("#inspector");
const inspectorPath = document.querySelector("#inspectorPath");
const ifThenPreview = document.querySelector("#ifThenPreview");
const suggestionBox = document.querySelector("#suggestionBox");
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
  return nodes.find((node) => node.id === selectedId) || nodes[0] || null;
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

  related.add(selected.id);
  let current = selected;
  while (current.parentId) {
    related.add(current.parentId);
    current = getParent(current);
    if (!current) break;
  }

  childrenOf(selected.id).forEach((child) => related.add(child.id));
  return related;
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
    button.classList.toggle("is-dimmed", hasSelection && !relatedIds.has(node.id));
    button.querySelector(".node-label").textContent = node.title || "Untitled achievement";
    button.addEventListener("click", () => selectNode(node.id));
    mapEl.append(button);
  });

  renderHint();
}

function renderHint() {
  if (!nodes.length) {
    graphHint.textContent = "";
    return;
  }

  const done = nodes.filter((node) => node.done).length;
  const avgConfidence = Math.round(
    nodes.reduce((total, node) => total + Number(node.confidence || 0), 0) / nodes.length,
  );
  graphHint.textContent = `${done}/${nodes.length} complete. Average confidence ${avgConfidence}%. Click a node to edit its motivation, proof, blocker, and next action.`;
}

function renderSetup() {
  setupPanel.classList.toggle("is-hidden", nodes.length > 0);
}

function renderInspector() {
  const node = getSelected();
  if (!node) {
    inspector.classList.remove("is-open");
    return;
  }

  inputs.title.value = node.title;
  inputs.why.value = node.why;
  inputs.evidence.value = node.evidence;
  inputs.blocker.value = node.blocker;
  inputs.action.value = node.action;
  inputs.confidence.value = node.confidence;
  inputs.friction.value = node.friction;
  confidenceValue.textContent = `${node.confidence}%`;
  inspectorPath.textContent = getDepth(node) === 0 ? "Top achievement" : "Supporting achievement";
  ifThenPreview.textContent = buildIfThen(node);
  renderSuggestion(node);
}

function buildIfThen(node) {
  const blocker = node.blocker.trim() || "the likely blocker appears";
  const action = node.action.trim() || "take the smallest next action";
  return `If ${blocker.toLowerCase()}, then I will ${action.replace(/\.$/, "").toLowerCase()}.`;
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

function selectNode(id) {
  selectedId = id;
  inspector.classList.add("is-open");
  render();
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
  inspector.classList.add("is-open");
  save();
  render();
}

function useExample() {
  nodes = clone(exampleNodes);
  selectedId = nodes[0].id;
  inspector.classList.remove("is-open");
  save();
  render();
}

function createNewMap() {
  nodes = [];
  selectedId = null;
  localStorage.removeItem(STORAGE_KEY);
  inspector.classList.remove("is-open");
  setupGoalInput.value = "";
  setupPrereqInput.value = "";
  render();
  setupGoalInput.focus();
}

function addSupportingAchievement() {
  const parent = getSelected() || nodes[0];
  if (!parent) {
    createNewMap();
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
document.querySelector("#newMapButton").addEventListener("click", createNewMap);
document.querySelector("#resetButton").addEventListener("click", useExample);
document.querySelector("#inspectorToggle").addEventListener("click", () => {
  if (!nodes.length) return;
  inspector.classList.toggle("is-open");
});
document.querySelector("#closeInspectorButton").addEventListener("click", () => {
  inspector.classList.remove("is-open");
});
document.querySelector("#addChildButton").addEventListener("click", addSupportingAchievement);
document.querySelector("#completeButton").addEventListener("click", () => {
  const node = getSelected();
  if (!node) return;
  node.done = !node.done;
  save();
  render();
});
document.querySelector("#deleteButton").addEventListener("click", deleteSelected);

function render() {
  renderSetup();
  renderGraph();
  renderInspector();
}

render();
