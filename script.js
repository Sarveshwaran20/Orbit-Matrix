const GOOGLE_CLIENT_ID =
  "303731717202-l9fues9ul9c1t8v0n5r7idtugui7cska.apps.googleusercontent.com";
const DEVELOPER_KEY = "AIzaSyAbKvRR7LD7ToKy8KZjZYw9_296SEAB-uU";

const viewport = document.getElementById("viewport");
const container = document.getElementById("canvas-container");
const svgLayer = document.getElementById("svg-layer");
const audioTracker = document.getElementById("distance-tracker");
const historySlider = document.getElementById("history-slider");
const timeStatus = document.getElementById("time-status");

let accessToken = null;
let pickerApiLoaded = false;
let projectThreads = [];
let tokenClient = null;
let activeWorkspaceId = null;
let nodeIdCounter = 0;
let currentTargetType = "";
let stateHistory = [];
let isScrubbing = false;
let slideFiles = [];
let currentSlide = 0;
let slideInterval = null;
let slideIsPlaying = true;
let aiEngine = null;
let linkSourceNode = null;
let unlinkSourceNode = null;
let initialTouchDist = null;
const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// AI Mode & Guest Mode tracking
let useWebLLM = false;
let llmPreferenceSet = false;
let isGuestMode = false;

let pan = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let zoom = 0.85;
let isDragging = false;
let start = { x: 0, y: 0 };
pan.x -= 5000 * zoom;
pan.y -= 5050 * zoom;

function checkDeveloperKeyRequirement() {
  const modal = document.getElementById("key-setup-backdrop");
  if (modal) {
    modal.style.display = "none";
  }
}

function syncNodeIdCounter() {
  document.querySelectorAll(".orbit-node").forEach((n) => {
    const parts = n.id.split("-");
    if (parts.length > 1) {
      const num = parseInt(parts[1]);
      if (!isNaN(num) && num >= nodeIdCounter) {
        nodeIdCounter = num + 1;
      }
    }
  });
}

function updateTransform() {
  if (!container) return;
  container.style.transform = `matrix(${zoom}, 0, 0, ${zoom}, ${pan.x}, ${pan.y})`;
  const centerX = (-pan.x + window.innerWidth / 2) / zoom;
  const centerY = (-pan.y + window.innerHeight / 2) / zoom;
  const dist = Math.round(
    Math.sqrt(Math.pow(centerX - 5000, 2) + Math.pow(centerY - 5050, 2)),
  );
  if (audioTracker) {
    audioTracker.innerText = `Workspace Dist: ${dist}px | Scale: ${Math.round(zoom * 100)}%`;
  }
  updateMinimap();
}

function recenterCanvas() {
  closeAllMenus();
  zoom = 0.85;
  pan.x = window.innerWidth / 2 - 5000 * zoom;
  pan.y = window.innerHeight / 2 - 5050 * zoom;
  updateTransform();
}
window.recenterCanvas = recenterCanvas;

function updateMinimap() {
  const radar = document.getElementById("minimap-nodes");
  const vw = document.getElementById("minimap-viewport");
  if (!radar || !vw) return;
  const mapScale = 180 / 10000;
  vw.style.width = `${Math.min((window.innerWidth / zoom) * mapScale, 180)}px`;
  vw.style.height = `${Math.min((window.innerHeight / zoom) * mapScale, 120)}px`;
  vw.style.left = `${(-pan.x / zoom) * mapScale}px`;
  vw.style.top = `${(-pan.y / zoom) * mapScale}px`;
  radar.innerHTML = "";
  document.querySelectorAll(".orbit-node").forEach((n) => {
    radar.innerHTML += `<div class="minimap-blip" style="left:${parseInt(n.style.left) * mapScale}px; top:${parseInt(n.style.top) * mapScale}px;"></div>`;
  });
}

function toggleCreationMenu(e) {
  const evt = e || window.event;
  if (evt && evt.stopPropagation) evt.stopPropagation();
  const menu = document.getElementById("creation-popover");
  if (menu) {
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
  }
}
window.toggleCreationMenu = toggleCreationMenu;

document.addEventListener("click", (e) => {
  const menu = document.getElementById("creation-popover");
  if (menu && !e.target.closest("#canvas-creation-hub")) {
    menu.style.display = "none";
  }
  document.querySelectorAll(".dropdown-menu").forEach((m) => {
    m.style.display = "none";
  });
});

// --- GUEST MODE / TRY DEMO ENGINE ---
function enableGuestMode() {
  isGuestMode = true;
  closeAllMenus();

  const guestBtn = document.getElementById("guest-mode-btn");
  const signinBtn = document.getElementById("google-signin-btn");
  if (guestBtn) guestBtn.style.display = "none";
  if (signinBtn) {
    signinBtn.innerText = "Sign in to Sync Cloud";
    signinBtn.style.background = "#333";
    signinBtn.style.border = "1px solid #555";
  }

  createNewWorkspace();
  triggerToast(
    "🚀 Guest Demo Mode Active! Testing locally without Google Sign-In.",
  );
}
window.enableGuestMode = enableGuestMode;

// --- INTERACTIVE OFFLINE CARD GENERATOR ---
function spawnBlankNode(
  type,
  customTitle = null,
  customText = null,
  offsetX = -190,
  offsetY = -140,
) {
  syncNodeIdCounter();
  const titleInput = document.getElementById("blank-asset-title");
  let title =
    customTitle ||
    (titleInput && titleInput.value.trim()
      ? titleInput.value.trim()
      : `Untitled ${type.toUpperCase()}`);
  nodeIdCounter++;
  const node = document.createElement("div");
  node.className = `orbit-node ${type}-node`;
  node.id = `node-${nodeIdCounter}`;
  node.setAttribute("data-title", title);
  node.setAttribute("data-type", type);
  node.style.left = `${(-pan.x + window.innerWidth / 2) / zoom + offsetX}px`;
  node.style.top = `${(-pan.y + window.innerHeight / 2) / zoom + offsetY}px`;

  // Generate real interactive offline editors inside card body
  let editorContent = "";
  if (customText) {
    editorContent = `<div style="padding: 12px; font-size: 13px; line-height: 1.5; color: var(--text-primary, #fff);">${customText}</div>`;
  } else if (type === "sheet") {
    editorContent = `
      <div style="padding: 8px; overflow: auto; max-height: 220px; background: #111;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #fff;">
          <thead>
            <tr style="background: #222; text-align: left;">
              <th style="border: 1px solid #333; padding: 4px 8px;">A</th>
              <th style="border: 1px solid #333; padding: 4px 8px;">B</th>
              <th style="border: 1px solid #333; padding: 4px 8px;">C</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">Item 1</td>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">100</td>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">Active</td>
            </tr>
            <tr>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">Item 2</td>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">250</td>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">Pending</td>
            </tr>
            <tr>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">Item 3</td>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">400</td>
              <td contenteditable="true" style="border: 1px solid #333; padding: 6px;">Done</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  } else if (type === "slide") {
    editorContent = `
      <div style="padding: 16px; min-height: 180px; background: #1a1a1a; display: flex; flex-direction: column; justify-content: center; border-radius: 4px;">
        <div contenteditable="true" style="font-size: 16px; font-weight: bold; color: #fff; margin-bottom: 8px; border-bottom: 1px dashed #333; padding-bottom: 4px;">Slide Title: ${title}</div>
        <ul contenteditable="true" style="margin: 0; padding-left: 20px; font-size: 13px; color: #ccc; line-height: 1.6;">
          <li>Key point or objective 1</li>
          <li>Supporting data and analysis</li>
          <li>Summary and next steps</li>
        </ul>
      </div>`;
  } else {
    // Standard DOC card
    editorContent = `
      <div contenteditable="true" style="padding: 14px; min-height: 180px; font-size: 13px; line-height: 1.6; color: #e0e0e0; outline: none; background: #161616;" placeholder="Type your document content here...">
        <b>Offline Document Editor</b><br>
        Start typing here to draft notes, ideas, or specifications. Click ✏️ in the header whenever you are ready to link a live Google Doc.
      </div>`;
  }

  node.innerHTML = `
        <div class="node-header">
            <span class="header-title">${title}</span>
            <div class="header-actions">
                <button class="action-btn link-trigger" onclick="event.stopPropagation(); toggleLinkMode('${node.id}')" title="Connect Thread">🔗</button>
                <button class="action-btn unlink-trigger" onclick="event.stopPropagation(); toggleUnlinkMode('${node.id}')" title="Cut Thread">✂️</button>
                <button class="action-btn" onclick="event.stopPropagation(); toggleFocusMode('${node.id}')" title="Focus">⛶</button>
                <button class="action-btn edit-action" onclick="event.stopPropagation(); openFilePicker('${type}')" title="Edit">✏️</button>
                <button class="action-btn delete-btn" onclick="event.stopPropagation(); window.deleteNode('${node.id}')" title="Delete">✕</button>
            </div>
        </div>
        <div class="node-body" style="padding: 0;">${editorContent}</div>
    `;

  container.appendChild(node);
  makeElementDraggable(node);

  if (titleInput) titleInput.value = "";
  const pop = document.getElementById("creation-popover");
  if (pop) pop.style.display = "none";
  saveCurrentWorkspace("Created Blank Node");
}
window.spawnBlankNode = spawnBlankNode;

function spawnOnboardingCards() {
  spawnBlankNode(
    "doc",
    "1. Welcome & Navigation",
    "• Pan Canvas: Click & drag anywhere on background.<br>• Zoom: Use mouse wheel or pinch gesture.<br>• Center View: Click 'Recenter Canvas' on top bar.",
    -400,
    -150,
  );
  spawnBlankNode(
    "sheet",
    "2. Adding Assets",
    "• Click (+ Create) at bottom right to add Doc, Sheet, or Slide cards.<br>• Click ✏️ on card header to open Google Drive picker.",
    0,
    -150,
  );
  spawnBlankNode(
    "slide",
    "3. Connecting & Cutting Threads",
    "• Link Cards: Click 🔗 on Card A, then click Card B.<br>• Cut Links: Click ✂️ on Card A, then click Card B to disconnect.",
    400,
    -150,
  );
}
window.spawnOnboardingCards = spawnOnboardingCards;

function deleteNode(id) {
  const node = document.getElementById(id);
  if (node) node.remove();
  projectThreads = projectThreads.filter((t) => t.from !== id && t.to !== id);
  drawThreads();
  saveCurrentWorkspace("Deleted File");
}
window.deleteNode = deleteNode;

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    openCommandPalette();
  }
  if (e.key === "Escape") closeCommandPalette();
});

function openCommandPalette() {
  closeAllMenus();
  document.getElementById("palette-backdrop").style.display = "block";
  document.getElementById("command-palette").style.display = "flex";
  document.getElementById("palette-input").value = "";
  document.getElementById("palette-input").focus();
  filterPalette();
}
window.openCommandPalette = openCommandPalette;

function closeCommandPalette() {
  const backdrop = document.getElementById("palette-backdrop");
  const palette = document.getElementById("command-palette");
  if (backdrop) backdrop.style.display = "none";
  if (palette) palette.style.display = "none";
}
window.closeCommandPalette = closeCommandPalette;

function filterPalette() {
  const q = document.getElementById("palette-input").value.toLowerCase();
  document.querySelectorAll("#palette-results .palette-item").forEach((i) => {
    i.style.display = i.innerText.toLowerCase().includes(q) ? "flex" : "none";
  });
}
window.filterPalette = filterPalette;

function goToHome() {
  closeAllMenus();
  saveCurrentWorkspace("Navigating Home");
  document.getElementById("workspace-screen").style.display = "none";
  document.getElementById("doc-meta-area").style.display = "none";
  document.getElementById("home-screen").style.display = "block";
  document.getElementById("home-meta-area").style.display = "block";
  renderHomeWorkspaces();
  if (accessToken) {
    fetchHomeDriveFiles();
  }
}
window.goToHome = goToHome;

function openWorkspaceScreen() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("home-meta-area").style.display = "none";
  document.getElementById("workspace-screen").style.display = "block";
  document.getElementById("doc-meta-area").style.display = "flex";
  recenterCanvas();
}
window.openWorkspaceScreen = openWorkspaceScreen;

function createNewWorkspace() {
  closeAllMenus();
  activeWorkspaceId = "ws_" + Date.now();
  document.querySelectorAll(".orbit-node").forEach((n) => n.remove());
  projectThreads = [];
  stateHistory = [];
  drawThreads();
  const titleEl = document.getElementById("workspace-title");
  if (titleEl) titleEl.value = "Untitled Workspace";
  spawnOnboardingCards();
  saveCurrentWorkspace("Blank Workspace Created");
  openWorkspaceScreen();
}
window.createNewWorkspace = createNewWorkspace;

function loadWorkspace(id) {
  let workspaces = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  let ws = workspaces.find((w) => w.id === id);
  if (ws) {
    activeWorkspaceId = ws.id;
    document.getElementById("workspace-title").value = ws.title;
    document.querySelectorAll(".orbit-node").forEach((n) => n.remove());

    ws.nodes.forEach((nodeData) => {
      container.insertAdjacentHTML("beforeend", nodeData.html);
      const n = document.getElementById(nodeData.id);
      if (n) {
        n.style.left = nodeData.left;
        n.style.top = nodeData.top;
        makeElementDraggable(n);
      }
    });

    projectThreads = ws.threads || [];
    stateHistory = ws.history || [];
    drawThreads();
    if (historySlider) {
      historySlider.max = stateHistory.length > 0 ? stateHistory.length - 1 : 0;
      historySlider.value = historySlider.max;
    }
    openWorkspaceScreen();
  }
}
window.loadWorkspace = loadWorkspace;

function switchHomeTab(tab) {
  document.getElementById("active-workspaces-view").style.display =
    tab === "workspaces" ? "block" : "none";
  document.getElementById("home-create-section").style.display =
    tab === "workspaces" ? "flex" : "none";
  document.getElementById("bin-view").style.display =
    tab === "bin" ? "block" : "none";
  renderHomeWorkspaces();
}
window.switchHomeTab = switchHomeTab;

function trashWorkspace(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  let w = ws.find((x) => x.id === id);
  if (w) w.isDeleted = true;
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Moved to Bin");
}
window.trashWorkspace = trashWorkspace;

async function spawnBlankNodeDrive(type) {
  // Graceful Guest Mode fallback: create local editable card without Google Drive auth
  if (!accessToken || isGuestMode) {
    spawnBlankNode(type);
    triggerToast(`Guest Mode: Created editable ${type.toUpperCase()} card!`);
    return;
  }
  syncNodeIdCounter();
  const titleInput = document.getElementById("blank-asset-title");
  let title =
    titleInput && titleInput.value.trim()
      ? titleInput.value.trim()
      : `Untitled ${type.toUpperCase()}`;
  triggerToast("Creating asset container matrix architecture...");

  let mimeType = "";
  if (type === "doc") mimeType = "application/vnd.google-apps.document";
  else if (type === "sheet")
    mimeType = "application/vnd.google-apps.spreadsheet";
  else if (type === "slide")
    mimeType = "application/vnd.google-apps.presentation";

  try {
    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: title,
        mimeType: mimeType,
      }),
    });
    if (!response.ok) throw new Error("API Error");
    const file = await response.json();

    if (titleInput) titleInput.value = "";
    const pop = document.getElementById("creation-popover");
    if (pop) pop.style.display = "none";

    spawnCloudNode(type, file.id, title);
    triggerToast(`${title} created successfully!`);
  } catch (error) {
    console.error(error);
    triggerToast("Failed to create file. Check console.");
  }
}
window.spawnBlankNodeDrive = spawnBlankNodeDrive;

function restoreWorkspace(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  let w = ws.find((x) => x.id === id);
  if (w) w.isDeleted = false;
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Workspace Restored");
}
window.restoreWorkspace = restoreWorkspace;

function permDeleteWorkspace(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  ws = ws.filter((x) => x.id !== id);
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Permanently Deleted");
}
window.permDeleteWorkspace = permDeleteWorkspace;

function emptyBin() {
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  ws = ws.filter((x) => !x.isDeleted);
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Bin Emptied");
}
window.emptyBin = emptyBin;

function renderHomeWorkspaces() {
  const activeFeed = document.getElementById("local-workspaces-feed");
  const binFeed = document.getElementById("bin-feed");
  if (!activeFeed || !binFeed) return;

  let workspaces = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  let activeWs = workspaces
    .filter((w) => !w.isDeleted)
    .sort((a, b) => b.lastModified - a.lastModified);
  let binWs = workspaces
    .filter((w) => w.isDeleted)
    .sort((a, b) => b.lastModified - a.lastModified);

  if (activeWs.length === 0) {
    activeFeed.innerHTML =
      '<div style="padding:20px;color:var(--text-secondary);">No saved workspaces yet. Click Blank Matrix to start!</div>';
  } else {
    activeFeed.innerHTML = "";
    activeWs.forEach((ws) => {
      activeFeed.innerHTML += `
            <div class="recent-card" onclick="loadWorkspace('${ws.id}')">
                <span style="font-size:24px;color:var(--google-blue);">🌌</span>
                <div style="flex-grow:1;overflow:hidden;">
                    <div style="font-weight:500;font-size:14px;white-space:nowrap;text-overflow:ellipsis;">${ws.title}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${new Date(ws.lastModified).toLocaleString()}</div>
                </div>
                <button onclick="trashWorkspace(event, '${ws.id}')" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px;">🗑️</button>
            </div>`;
    });
  }

  if (binWs.length === 0) {
    binFeed.innerHTML =
      '<div style="padding:20px;color:var(--text-secondary);">Bin is empty.</div>';
  } else {
    binFeed.innerHTML = "";
    binWs.forEach((ws) => {
      binFeed.innerHTML += `
            <div class="recent-card" style="opacity:0.7;">
                <span style="font-size:24px;color:var(--text-secondary);">🌌</span>
                <div style="flex-grow:1;overflow:hidden;">
                    <div style="font-weight:500;font-size:14px;white-space:nowrap;text-overflow:ellipsis;text-decoration:line-through;">${ws.title}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${new Date(ws.lastModified).toLocaleString()}</div>
                </div>
                <button onclick="restoreWorkspace(event, '${ws.id}')" style="background:none;border:none;color:var(--google-green);cursor:pointer;font-size:14px;margin-right:8px;">Restore</button>
                <button onclick="permDeleteWorkspace(event, '${ws.id}')" style="background:none;border:none;color:var(--google-red);cursor:pointer;font-size:16px;">✕</button>
            </div>`;
    });
  }
}

function saveCurrentWorkspace(actionName = "Workspace Updated") {
  if (!activeWorkspaceId || isScrubbing) return;
  drawThreads();
  let workspaces = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  const nodes = Array.from(document.querySelectorAll(".orbit-node")).map(
    (node) => ({
      id: node.id,
      html: node.outerHTML,
      left: node.style.left,
      top: node.style.top,
    }),
  );
  stateHistory.push({
    label: actionName,
    nodes: nodes,
    threads: [...projectThreads],
  });
  if (historySlider) {
    historySlider.max = stateHistory.length > 0 ? stateHistory.length - 1 : 0;
    historySlider.value = historySlider.max;
  }
  if (timeStatus) {
    timeStatus.innerText = actionName;
    timeStatus.style.color = "var(--google-green)";
  }
  const wsIndex = workspaces.findIndex((w) => w.id === activeWorkspaceId);
  const titleEl = document.getElementById("workspace-title");
  const wsData = {
    id: activeWorkspaceId,
    title: titleEl ? titleEl.value : "Untitled Workspace",
    nodes: nodes,
    threads: projectThreads,
    history: stateHistory,
    lastModified: Date.now(),
    isDeleted: false,
  };
  if (wsIndex > -1) {
    workspaces[wsIndex] = wsData;
  } else {
    workspaces.push(wsData);
  }
  localStorage.setItem("orbit_workspaces", JSON.stringify(workspaces));
  updateMinimap();
}
window.saveCurrentWorkspace = saveCurrentWorkspace;

if (historySlider) {
  historySlider.addEventListener("input", (e) => {
    isScrubbing = true;
    const index = parseInt(e.target.value);
    const state = stateHistory[index];
    if (!state) return;
    timeStatus.innerText =
      state.label + (index === stateHistory.length - 1 ? " (Live)" : " (Past)");
    timeStatus.style.color =
      index === stateHistory.length - 1
        ? "var(--google-green)"
        : "var(--google-blue)";
    projectThreads = [...state.threads];
    document.querySelectorAll(".orbit-node").forEach((n) => n.remove());
    state.nodes.forEach((nodeData) => {
      container.insertAdjacentHTML("beforeend", nodeData.html);
      const n = document.getElementById(nodeData.id);
      if (n) {
        n.style.left = nodeData.left;
        n.style.top = nodeData.top;
        makeElementDraggable(n);
      }
    });
    drawThreads();
    updateMinimap();
  });
  historySlider.addEventListener("change", () => {
    isScrubbing = false;
  });
}

function triggerUndo() {
  closeAllMenus();
  const v = parseInt(historySlider.value);
  if (v > 0) {
    historySlider.value = v - 1;
    historySlider.dispatchEvent(new Event("input"));
    triggerToast("Undo applied");
  }
}
window.triggerUndo = triggerUndo;

function triggerRedo() {
  closeAllMenus();
  const v = parseInt(historySlider.value);
  if (v < parseInt(historySlider.max)) {
    historySlider.value = v + 1;
    historySlider.dispatchEvent(new Event("input"));
    triggerToast("Redo applied");
  }
}
window.triggerRedo = triggerRedo;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const loader = document.getElementById("global-loader");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => {
        loader.style.display = "none";
      }, 500);
    }
  }, 1500);

  try {
    updateTransform();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("matrix")) {
      const dataState = JSON.parse(
        decodeURIComponent(atob(urlParams.get("matrix"))),
      );
      activeWorkspaceId = "shared_" + Date.now();
      const titleEl = document.getElementById("workspace-title");
      if (titleEl) titleEl.value = "Shared External Workspace";
      projectThreads = dataState.threads || [];
      document.querySelectorAll(".orbit-node").forEach((n) => n.remove());
      dataState.nodes.forEach((nodeData) => {
        container.insertAdjacentHTML("beforeend", nodeData.html);
        const n = document.getElementById(nodeData.id);
        if (n) {
          n.style.left = nodeData.left;
          n.style.top = nodeData.top;
          makeElementDraggable(n);
        }
      });
      drawThreads();
      triggerToast("Magic Link layout restored!");
      window.history.replaceState({}, document.title, window.location.pathname);
      openWorkspaceScreen();
      saveCurrentWorkspace("Loaded Shared Link");
    } else {
      goToHome();
    }
  } catch (error) {
    console.error(error);
    triggerToast("Corrupt data cleared.");
  }
  syncNodeIdCounter();
  checkDeveloperKeyRequirement();

  function safeInit() {
    if (typeof google !== "undefined" && typeof gapi !== "undefined") {
      initializeGoogleIdentity();
    } else {
      setTimeout(safeInit, 100);
    }
  }
  if (DEVELOPER_KEY) safeInit();
});

// Canvas Click Event handling for Threading & Unlinking
if (container) {
  container.addEventListener("click", (e) => {
    const nodeElement = e.target.closest(".orbit-node");

    if (!nodeElement && (linkSourceNode || unlinkSourceNode)) {
      if (linkSourceNode) {
        document
          .getElementById(linkSourceNode)
          ?.classList.remove("linking-active");
        linkSourceNode = null;
      }
      if (unlinkSourceNode) {
        document
          .getElementById(unlinkSourceNode)
          ?.classList.remove("unlinking-active");
        unlinkSourceNode = null;
      }
      const statusEl = document.getElementById("linking-status");
      if (statusEl) statusEl.style.display = "none";
      document.querySelectorAll(".portal-frame").forEach((iframe) => {
        iframe.style.pointerEvents = "auto";
      });
      triggerToast("Action cancelled");
      return;
    }

    if (!nodeElement || e.target.closest(".action-btn")) return;

    if (linkSourceNode) {
      e.stopPropagation();
      completeThreading(nodeElement.id);
    } else if (unlinkSourceNode) {
      e.stopPropagation();
      completeUnlinking(nodeElement.id);
    }
  });
}

let activeMenu = null;
document.querySelectorAll(".google-menu-bar .menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    const menuId = item.getAttribute("data-menu");
    if (activeMenu === menuId) {
      closeAllMenus();
    } else {
      openMenu(menuId, item);
    }
  });
  item.addEventListener("mouseenter", (e) => {
    if (activeMenu && activeMenu !== item.getAttribute("data-menu")) {
      openMenu(item.getAttribute("data-menu"), item);
    }
  });
});

function openMenu(menuId, element) {
  closeAllMenus();
  if (menuId) {
    activeMenu = menuId;
    if (element) element.classList.add("active");
    const target = document.getElementById(menuId);
    if (target) target.style.display = "block";
  }
}
window.openMenu = openMenu;

function closeAllMenus() {
  activeMenu = null;
  document
    .querySelectorAll(".dropdown-menu")
    .forEach((menu) => (menu.style.display = "none"));
  document
    .querySelectorAll(".menu-item")
    .forEach((item) => item.classList.remove("active"));
}
window.closeAllMenus = closeAllMenus;

document.addEventListener("click", (e) => {
  if (!e.target.closest(".google-menu-bar")) {
    closeAllMenus();
  }
});

function triggerToast(message) {
  closeAllMenus();
  const toast =
    document.getElementById("toast-notification") ||
    document.getElementById("orbit-toast");
  if (!toast) {
    const newToast = document.createElement("div");
    newToast.id = "orbit-toast";
    newToast.style.cssText =
      "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:10px 20px; border-radius:8px; z-index:99999; font-size:14px; opacity:0; transition:opacity 0.3s;";
    document.body.appendChild(newToast);
    newToast.innerText = message;
    newToast.style.opacity = "1";
    setTimeout(() => {
      newToast.style.opacity = "0";
    }, 3000);
    return;
  }
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}
window.triggerToast = triggerToast;

function toggleFullscreen() {
  closeAllMenus();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      triggerToast(`Error: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}
window.toggleFullscreen = toggleFullscreen;

function openShareModal(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  closeAllMenus();
  const backdrop = document.getElementById("share-backdrop");
  const modal = document.getElementById("share-modal");
  if (backdrop) backdrop.style.display = "block";
  if (modal) modal.style.display = "block";
}
window.openShareModal = openShareModal;

function closeShareModal(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const backdrop = document.getElementById("share-backdrop");
  const modal = document.getElementById("share-modal");
  if (backdrop) backdrop.style.display = "none";
  if (modal) modal.style.display = "none";
}
window.closeShareModal = closeShareModal;

function copyShareLink() {
  mixLayoutSnapshot();
}
window.copyShareLink = copyShareLink;

function mixLayoutSnapshot() {
  try {
    const activeNodesSnapshot = Array.from(
      document.querySelectorAll(".orbit-node"),
    ).map((node) => ({
      id: node.id,
      html: node.outerHTML,
      left: node.style.left,
      top: node.style.top,
    }));
    const b64 = btoa(
      encodeURIComponent(
        JSON.stringify({ nodes: activeNodesSnapshot, threads: projectThreads }),
      ),
    );
    navigator.clipboard.writeText(
      window.location.origin + window.location.pathname + "?matrix=" + b64,
    );
    triggerToast("Magic Link copied!");
    closeShareModal();
  } catch (err) {
    triggerToast("Error compressing link.");
  }
}
window.mixLayoutSnapshot = mixLayoutSnapshot;

function openSidePanel(tabName, event) {
  const e = event || window.event;
  if (e && e.stopPropagation) e.stopPropagation();

  document
    .querySelectorAll(".side-tab, .sidebar-icon-btn")
    .forEach((tab) => tab.classList.remove("active-tab", "active"));
  if (e && e.currentTarget) {
    e.currentTarget.classList.add("active-tab", "active");
  }

  document
    .querySelectorAll(".ep-content, .side-panel-view")
    .forEach((content) => (content.style.display = "none"));

  const epTarget = document.getElementById(`ep-${tabName}`);
  const viewTarget = document.getElementById(`${tabName}-view`);
  if (epTarget) epTarget.style.display = "block";
  if (viewTarget) viewTarget.style.display = "block";

  let title = "Google Apps";
  if (tabName === "calendar") {
    title = "Calendar";
    if (accessToken) fetchCalendarEvents();
  }
  if (tabName === "keep") {
    title = "Keep";
    renderKeepNotes();
  }
  if (tabName === "tasks") {
    title = "Tasks";
    renderTasks();
  }
  if (tabName === "drive") {
    title = "Drive";
    if (accessToken) fetchDriveFiles();
  }
  const titleEl = document.getElementById("ep-title");
  if (titleEl) titleEl.innerText = title;

  const panel = document.getElementById("expanded-side-panel");
  if (panel) {
    panel.classList.add("open");
    panel.style.display = "flex";
  }
}
window.openSidePanel = openSidePanel;

function closeSidePanel(event) {
  const e = event || window.event;
  if (e && e.stopPropagation) e.stopPropagation();
  const panel = document.getElementById("expanded-side-panel");
  if (panel) {
    panel.classList.remove("open");
    panel.style.display = "none";
  }
  document
    .querySelectorAll(".side-tab, .sidebar-icon-btn")
    .forEach((tab) => tab.classList.remove("active-tab", "active"));
}
window.closeSidePanel = closeSidePanel;

async function fetchCalendarEvents() {
  const feed = document.getElementById("calendar-feed");
  if (!feed) return;
  feed.innerHTML =
    '<div style="text-align:center; padding:10px; font-weight:500;">Upcoming Events</div>';
  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      maxResults: 5,
      orderBy: "startTime",
    });
    if (!response.result.items || response.result.items.length === 0) {
      feed.innerHTML += '<div class="ep-item">No upcoming events found.</div>';
      return;
    }
    response.result.items.forEach((event) => {
      const dateStr = event.start.dateTime || event.start.date;
      feed.innerHTML += `<div class="ep-item"><strong>${new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong> ${event.summary || "Busy"}</div>`;
    });
  } catch (err) {
    feed.innerHTML += `<div class="ep-item" style="color:var(--google-red);">Error loading Calendar.</div>`;
  }
}

async function fetchDriveFiles() {
  const feed = document.getElementById("drive-feed");
  if (!feed) return;
  feed.innerHTML =
    '<div style="text-align:center; padding:10px; font-weight:500;">Recent Files</div>';
  try {
    const response = await gapi.client.drive.files.list({
      pageSize: 6,
      fields: "files(id, name, mimeType)",
      orderBy: "viewedByMeTime desc",
    });
    response.result.files.forEach((file) => {
      let icon = "📄",
        type = "doc";
      if (file.mimeType.includes("spreadsheet")) {
        icon = "📊";
        type = "sheet";
      }
      if (file.mimeType.includes("presentation")) {
        icon = "🖼️";
        type = "slide";
      }
      feed.innerHTML += `<div class="ep-item" style="cursor:pointer;" onclick="spawnCloudNode('${type}', '${file.id}', '${file.name.replace(/'/g, "\\'")}')"><strong>${icon} Click to drop</strong> ${file.name}</div>`;
    });
  } catch (err) {
    feed.innerHTML += `<div class="ep-item" style="color:var(--google-red);">Error loading Drive files.</div>`;
  }
}

async function fetchHomeDriveFiles() {
  const feed =
    document.getElementById("home-recent-feed") ||
    document.getElementById("drive-feed");
  if (!feed) return;
  feed.innerHTML =
    '<div class="google-spinner" style="margin:40px auto;"><svg viewBox="25 25 50 50"><circle cx="50" cy="50" r="20" fill="none" stroke-width="4"></circle></svg></div>';
  try {
    const response = await gapi.client.drive.files.list({
      pageSize: 16,
      fields: "files(id, name, mimeType)",
      orderBy: "viewedByMeTime desc",
    });
    feed.innerHTML = "";
    if (!response.result.files || response.result.files.length === 0) {
      feed.innerHTML =
        '<div style="padding:20px; color:var(--text-secondary);">No recent files found.</div>';
      return;
    }
    slideFiles = response.result.files.filter(
      (f) =>
        f.mimeType.includes("presentation") || f.mimeType.startsWith("image/"),
    );
    response.result.files.slice(0, 12).forEach((file) => {
      let icon = "📄",
        type = "doc",
        color = "var(--google-blue)";
      if (file.mimeType.includes("spreadsheet")) {
        icon = "📊";
        type = "sheet";
        color = "var(--google-green)";
      }
      if (file.mimeType.includes("presentation")) {
        icon = "🖼️";
        type = "slide";
        color = "var(--google-yellow)";
      } else if (file.mimeType.startsWith("image/")) {
        icon = "🖼️";
        type = "slide";
        color = "var(--google-yellow)";
      }
      feed.innerHTML += `
            <div class="recent-card" onclick="openWorkspaceScreen(); spawnCloudNode('${type}', '${file.id}', '${file.name.replace(/'/g, "\\'")}')">
                <span style="font-size:24px; color:${color};">${icon}</span>
                <div style="overflow:hidden;"><div style="font-weight:500;font-size:14px;white-space:nowrap;text-overflow:ellipsis;">${file.name}</div></div>
            </div>`;
    });
  } catch (err) {
    feed.innerHTML = `<div style="padding:20px; color:var(--google-red);">Error loading Drive files.</div>`;
  }
}
window.fetchHomeDriveFiles = fetchHomeDriveFiles;

function startSlideshow() {
  if (slideFiles.length === 0) {
    triggerToast("No visual files found for slideshow.");
    return;
  }
  document.getElementById("slideshow-modal").style.display = "flex";
  currentSlide = 0;
  slideIsPlaying = true;
  document.getElementById("slide-play-btn").innerText = "Pause";
  showSlide();
  slideInterval = setInterval(() => {
    if (slideIsPlaying) nextSlide();
  }, 4000);
}
window.startSlideshow = startSlideshow;

function closeSlideshow() {
  document.getElementById("slideshow-modal").style.display = "none";
  document.getElementById("slideshow-frame").src = "";
  clearInterval(slideInterval);
}
window.closeSlideshow = closeSlideshow;

function showSlide() {
  if (currentSlide >= slideFiles.length) currentSlide = 0;
  if (currentSlide < 0) currentSlide = slideFiles.length - 1;
  document.getElementById("slideshow-frame").src =
    `https://drive.google.com/file/d/${slideFiles[currentSlide].id}/preview`;
}

function nextSlide() {
  currentSlide++;
  showSlide();
}
window.nextSlide = nextSlide;

function prevSlide() {
  currentSlide--;
  showSlide();
}
window.prevSlide = prevSlide;

function toggleSlidePlay() {
  slideIsPlaying = !slideIsPlaying;
  document.getElementById("slide-play-btn").innerText = slideIsPlaying
    ? "Play"
    : "Pause";
}
window.toggleSlidePlay = toggleSlidePlay;

function saveKeepNote() {
  const input = document.getElementById("keep-input");
  const text = input.value.trim();
  if (!text) return;
  let notes = JSON.parse(localStorage.getItem("orbit_notes") || "[]");
  notes.unshift(text);
  localStorage.setItem("orbit_notes", JSON.stringify(notes));
  input.value = "";
  renderKeepNotes();
}
window.saveKeepNote = saveKeepNote;

function renderKeepNotes() {
  const feed = document.getElementById("keep-feed");
  if (!feed) return;
  let notes = JSON.parse(localStorage.getItem("orbit_notes") || "[]");
  feed.innerHTML = "";
  if (notes.length === 0)
    feed.innerHTML = '<div class="ep-item">No notes saved.</div>';
  notes.forEach((note, i) => {
    feed.innerHTML += `<div class="ep-item" style="position:relative; padding-right:24px;">${note}<button style="position:absolute; right:4px; top:4px; border:none; background:none; cursor:pointer; color:var(--google-red);" onclick="deleteKeepNote(${i})">✕</button></div>`;
  });
}

function deleteKeepNote(index) {
  let notes = JSON.parse(localStorage.getItem("orbit_notes") || "[]");
  notes.splice(index, 1);
  localStorage.setItem("orbit_notes", JSON.stringify(notes));
  renderKeepNotes();
}
window.deleteKeepNote = deleteKeepNote;

function saveTask() {
  const input = document.getElementById("task-input");
  const text = input.value.trim();
  if (!text) return;
  let tasks = JSON.parse(localStorage.getItem("orbit_tasks") || "[]");
  tasks.unshift({ text: text, done: false });
  localStorage.setItem("orbit_tasks", JSON.stringify(tasks));
  input.value = "";
  renderTasks();
}
window.saveTask = saveTask;

function toggleTask(index) {
  let tasks = JSON.parse(localStorage.getItem("orbit_tasks") || "[]");
  if (tasks[index]) {
    tasks[index].done = !tasks[index].done;
    localStorage.setItem("orbit_tasks", JSON.stringify(tasks));
    renderTasks();
  }
}
window.toggleTask = toggleTask;

function removeTask(index) {
  let tasks = JSON.parse(localStorage.getItem("orbit_tasks") || "[]");
  tasks.splice(index, 1);
  localStorage.setItem("orbit_tasks", JSON.stringify(tasks));
  renderTasks();
}
window.removeTask = removeTask;

function renderTasks() {
  const feed = document.getElementById("tasks-feed");
  if (!feed) return;
  let tasks = JSON.parse(localStorage.getItem("orbit_tasks") || "[]");
  feed.innerHTML = "";
  if (tasks.length === 0)
    feed.innerHTML =
      '<div class="task-item" style="text-align:center; padding:20px;">No tasks yet</div>';
  tasks.forEach((task, i) => {
    const textStyle = task.done
      ? "text-decoration:line-through; color:var(--text-secondary);"
      : "";
    feed.innerHTML += `<div class="task-item"><input type="checkbox" onchange="toggleTask(${i})" ${task.done ? "checked" : ""}><span style="flex-grow:1; font-size:14px; ${textStyle}">${task.text}</span><button class="task-delete" onclick="removeTask(${i})">✕</button></div>`;
  });
}

// LINKING / THREADING FUNCTIONS
function toggleLinkMode(nodeId) {
  if (unlinkSourceNode) {
    document
      .getElementById(unlinkSourceNode)
      ?.classList.remove("unlinking-active");
    unlinkSourceNode = null;
  }
  if (!linkSourceNode) {
    linkSourceNode = nodeId;
    document.getElementById(nodeId)?.classList.add("linking-active");
    const statusEl = document.getElementById("linking-status");
    if (statusEl) {
      statusEl.innerText = "Click another node to connect line...";
      statusEl.style.display = "block";
    }
    document.querySelectorAll(".portal-frame").forEach((iframe) => {
      iframe.style.pointerEvents = "none";
    });
  } else {
    if (linkSourceNode === nodeId) {
      document
        .getElementById(linkSourceNode)
        ?.classList.remove("linking-active");
      const statusEl = document.getElementById("linking-status");
      if (statusEl) statusEl.style.display = "none";
      linkSourceNode = null;
      document.querySelectorAll(".portal-frame").forEach((iframe) => {
        iframe.style.pointerEvents = "auto";
      });
    }
  }
}
window.toggleLinkMode = toggleLinkMode;

function completeThreading(targetId) {
  if (linkSourceNode && linkSourceNode !== targetId) {
    const exists = projectThreads.some(
      (t) =>
        (t.from === linkSourceNode && t.to === targetId) ||
        (t.from === targetId && t.to === linkSourceNode),
    );
    if (!exists) {
      projectThreads.push({ from: linkSourceNode, to: targetId });
    }
    document.getElementById(linkSourceNode)?.classList.remove("linking-active");
    const statusEl = document.getElementById("linking-status");
    if (statusEl) statusEl.style.display = "none";
    linkSourceNode = null;
    document.querySelectorAll(".portal-frame").forEach((iframe) => {
      iframe.style.pointerEvents = "auto";
    });
    drawThreads();
    saveCurrentWorkspace("Linked Documents Matrix");
    triggerToast("Logic Thread Stitched!");
  }
}

// UNLINKING / SCISSORS FUNCTIONS
function toggleUnlinkMode(nodeId) {
  if (linkSourceNode) {
    document.getElementById(linkSourceNode)?.classList.remove("linking-active");
    linkSourceNode = null;
  }
  if (!unlinkSourceNode) {
    unlinkSourceNode = nodeId;
    document.getElementById(nodeId)?.classList.add("unlinking-active");
    const statusEl = document.getElementById("linking-status");
    if (statusEl) {
      statusEl.innerText = "Click connected node to cut thread...";
      statusEl.style.display = "block";
    }
    document.querySelectorAll(".portal-frame").forEach((iframe) => {
      iframe.style.pointerEvents = "none";
    });
  } else {
    if (unlinkSourceNode === nodeId) {
      document
        .getElementById(unlinkSourceNode)
        ?.classList.remove("unlinking-active");
      const statusEl = document.getElementById("linking-status");
      if (statusEl) statusEl.style.display = "none";
      unlinkSourceNode = null;
      document.querySelectorAll(".portal-frame").forEach((iframe) => {
        iframe.style.pointerEvents = "auto";
      });
    }
  }
}
window.toggleUnlinkMode = toggleUnlinkMode;

function completeUnlinking(targetId) {
  if (unlinkSourceNode && unlinkSourceNode !== targetId) {
    const prevCount = projectThreads.length;
    projectThreads = projectThreads.filter(
      (t) =>
        !(
          (t.from === unlinkSourceNode && t.to === targetId) ||
          (t.from === targetId && t.to === unlinkSourceNode)
        ),
    );
    document
      .getElementById(unlinkSourceNode)
      ?.classList.remove("unlinking-active");
    const statusEl = document.getElementById("linking-status");
    if (statusEl) statusEl.style.display = "none";
    unlinkSourceNode = null;
    document.querySelectorAll(".portal-frame").forEach((iframe) => {
      iframe.style.pointerEvents = "auto";
    });
    drawThreads();
    if (projectThreads.length < prevCount) {
      saveCurrentWorkspace("Cut Thread Connection");
      triggerToast("Logic Thread Cut ✂️");
    } else {
      triggerToast("No existing thread between these cards.");
    }
  }
}

function drawThreads() {
  if (!svgLayer) return;
  while (svgLayer.children.length > projectThreads.length) {
    svgLayer.removeChild(svgLayer.lastChild);
  }
  while (svgLayer.children.length < projectThreads.length) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke", "#1a73e8");
    path.setAttribute("stroke-width", "4");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-dasharray", "8 6");
    svgLayer.appendChild(path);
  }
  projectThreads.forEach((thread, index) => {
    const nodeA = document.getElementById(thread.from);
    const nodeB = document.getElementById(thread.to);
    const path = svgLayer.children[index];
    if (nodeA && nodeB && path) {
      const x1 = nodeA.offsetLeft + nodeA.offsetWidth / 2;
      const y1 = nodeA.offsetTop + nodeA.offsetHeight / 2;
      const x2 = nodeB.offsetLeft + nodeB.offsetWidth / 2;
      const y2 = nodeB.offsetTop + nodeB.offsetHeight / 2;
      path.setAttribute(
        "d",
        `M ${x1} ${y1} C ${x1 + Math.abs(x2 - x1) * 0.4} ${y1}, ${x2 - Math.abs(x2 - x1) * 0.4} ${y2}, ${x2} ${y2}`,
      );
      path.style.display = "block";
    } else if (path) {
      path.style.display = "none";
    }
  });
}

function toggleFocusMode(nodeId) {
  const node = document.getElementById(nodeId);
  if (!node) return;
  const isFocused = node.classList.contains("focused-node");
  closeAllFocus();
  if (!isFocused) {
    const backdrop = document.getElementById("focus-backdrop");
    if (backdrop) backdrop.style.display = "block";
    node.classList.add("focused-node");
    if (container) container.style.pointerEvents = "none";
    node.style.pointerEvents = "auto";
  }
}
window.toggleFocusMode = toggleFocusMode;

function closeAllFocus() {
  const backdrop = document.getElementById("focus-backdrop");
  if (backdrop) backdrop.style.display = "none";
  document
    .querySelectorAll(".focused-node")
    .forEach((n) => n.classList.remove("focused-node"));
  if (container) container.style.pointerEvents = "auto";
}

if (viewport) {
  viewport.addEventListener("mousedown", (e) => {
    if (
      e.target.closest(".orbit-node") ||
      e.target.closest("#canvas-creation-hub") ||
      e.target.closest("#temporal-scrubber") ||
      e.target.tagName === "BUTTON" ||
      document.querySelector(".focused-node") ||
      e.target.closest("#expanded-side-panel") ||
      e.target.closest(".google-menu-bar")
    )
      return;
    isDragging = true;
    start = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  });

  viewport.addEventListener(
    "wheel",
    (e) => {
      if (
        e.target.closest(".orbit-node") ||
        document.querySelector(".focused-node") ||
        e.target.closest("#expanded-side-panel") ||
        e.target.closest("#command-palette") ||
        e.target.closest("#canvas-creation-hub") ||
        e.target.closest("#temporal-scrubber")
      )
        return;
      e.preventDefault();
      const sf = e.deltaY < 0 ? 1.05 : 0.95;
      const nz = Math.min(Math.max(zoom * sf, 0.15), 2.5);
      pan.x = e.clientX - (e.clientX - pan.x) * (nz / zoom);
      pan.y = e.clientY - (e.clientY - pan.y) * (nz / zoom);
      zoom = nz;
      updateTransform();
    },
    { passive: false },
  );

  // Touch event pan and zoom handling
  viewport.addEventListener("touchstart", (e) => {
    if (
      e.target.closest(".orbit-node") ||
      e.target.closest("#canvas-creation-hub") ||
      e.target.closest("#temporal-scrubber") ||
      e.target.tagName === "BUTTON" ||
      document.querySelector(".focused-node") ||
      e.target.closest("#expanded-side-panel") ||
      e.target.closest(".google-menu-bar")
    )
      return;
    if (e.touches.length === 1) {
      isDragging = true;
      start = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  });

  viewport.addEventListener("touchmove", (e) => {
    if (isDragging && e.touches.length === 1) {
      pan.x = e.touches[0].clientX - start.x;
      pan.y = e.touches[0].clientY - start.y;
      updateTransform();
    } else if (e.touches.length === 2 && initialTouchDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const sf = dist / initialTouchDist;
      initialTouchDist = dist;
      const nz = Math.min(Math.max(zoom * sf, 0.15), 2.5);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pan.x = midX - (midX - pan.x) * (nz / zoom);
      pan.y = midY - (midY - pan.y) * (nz / zoom);
      zoom = nz;
      updateTransform();
    }
  });

  viewport.addEventListener("touchend", () => {
    isDragging = false;
    initialTouchDist = null;
  });
}

window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    pan.x = e.clientX - start.x;
    pan.y = e.clientY - start.y;
    updateTransform();
  }
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

// DRAGGABLE CARDS FUNCTIONALITY (Mouse + Touch)
function makeElementDraggable(elmnt) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0,
    header = elmnt.querySelector(".node-header"),
    dragFrame = null;

  if (header) {
    header.style.cursor = "move";

    const startDrag = (clientX, clientY) => {
      if (
        elmnt.classList.contains("focused-node") ||
        linkSourceNode ||
        unlinkSourceNode
      )
        return false;

      document.body.classList.add("dragging-active");
      elmnt.classList.add("is-moving");
      pos3 = clientX;
      pos4 = clientY;
      return true;
    };

    const doDrag = (clientX, clientY) => {
      pos1 = (pos3 - clientX) / zoom;
      pos2 = (pos4 - clientY) / zoom;
      pos3 = clientX;
      pos4 = clientY;
      elmnt.style.top = `${elmnt.offsetTop - pos2}px`;
      elmnt.style.left = `${elmnt.offsetLeft - pos1}px`;
      if (dragFrame) cancelAnimationFrame(dragFrame);
      dragFrame = requestAnimationFrame(() => {
        drawThreads();
      });
    };

    const stopDrag = () => {
      document.body.classList.remove("dragging-active");
      elmnt.classList.remove("is-moving");
      saveCurrentWorkspace("Moved Document");
    };

    // Mouse Dragging
    header.onmousedown = (e) => {
      if (e.target.closest(".action-btn")) return;
      if (startDrag(e.clientX, e.clientY)) {
        document.onmousemove = (ev) => doDrag(ev.clientX, ev.clientY);
        document.onmouseup = () => {
          document.onmousemove = null;
          document.onmouseup = null;
          stopDrag();
        };
      }
    };

    // Touch Dragging
    header.ontouchstart = (e) => {
      if (e.target.closest(".action-btn")) return;
      if (e.touches.length === 1) {
        if (startDrag(e.touches[0].clientX, e.touches[0].clientY)) {
          const handleTouchMove = (ev) => {
            if (ev.touches.length === 1) {
              doDrag(ev.touches[0].clientX, ev.touches[0].clientY);
            }
          };
          const handleTouchEnd = () => {
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
            stopDrag();
          };
          document.addEventListener("touchmove", handleTouchMove, {
            passive: true,
          });
          document.addEventListener("touchend", handleTouchEnd);
        }
      }
    };
  }
}

function openFilePicker(type) {
  closeAllMenus();
  if (!accessToken) {
    triggerToast("Please Sign in with Google first.");
    return;
  }
  currentTargetType = type;
  if (pickerApiLoaded && google.picker) {
    createPickerInstance();
  } else {
    gapi.load("picker", {
      callback: () => {
        pickerApiLoaded = true;
        createPickerInstance();
      },
    });
  }
}
window.openFilePicker = openFilePicker;

function createPickerInstance() {
  let viewMode = google.picker.ViewId.DOCS;
  if (currentTargetType === "sheet")
    viewMode = google.picker.ViewId.SPREADSHEETS;
  if (currentTargetType === "slide")
    viewMode = google.picker.ViewId.PRESENTATIONS;
  const picker = new google.picker.PickerBuilder()
    .addView(viewMode)
    .addView(new google.picker.DocsUploadView())
    .setOAuthToken(accessToken)
    .setDeveloperKey(DEVELOPER_KEY)
    .setCallback(pickerCallback)
    .build();
  picker.setVisible(true);
}

function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    spawnCloudNode(currentTargetType, data.docs[0].id, data.docs[0].name);
    triggerToast(`Mounted ${data.docs[0].name}`);
  }
}

function openEditModal(url, title) {
  if (!url || url.includes("undefined")) {
    triggerToast("Save file to cloud first before full editing");
    return;
  }
  document.getElementById("modal-title").innerText = `Editing: ${title}`;
  document.getElementById("edit-frame").src = url;
  document.getElementById("edit-modal").style.display = "flex";
}
window.openEditModal = openEditModal;

function closeEditModal() {
  document.getElementById("edit-frame").src = "";
  document.getElementById("edit-modal").style.display = "none";
  saveCurrentWorkspace("Finished Editing");
}
window.closeEditModal = closeEditModal;

function openPresentation(fileId) {
  document.getElementById("presentation-frame").src =
    `https://docs.google.com/presentation/d/${fileId}/embed?start=true&loop=false&delayms=3000`;
  const modal = document.getElementById("presentation-modal");
  modal.style.display = "flex";
  if (modal.requestFullscreen) {
    modal.requestFullscreen().catch((err) => console.log(err));
  }
}
window.openPresentation = openPresentation;

function closePresentation() {
  document.getElementById("presentation-frame").src = "";
  document.getElementById("presentation-modal").style.display = "none";
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen();
  }
}
window.closePresentation = closePresentation;

function spawnCloudNode(type, fileId, fileName) {
  syncNodeIdCounter();
  if (document.getElementById("workspace-screen").style.display === "none") {
    openWorkspaceScreen();
  }
  nodeIdCounter++;
  const node = document.createElement("div");
  node.className = `orbit-node ${type}-node`;
  node.id = `node-${nodeIdCounter}`;
  node.setAttribute("data-title", fileName);
  node.setAttribute("data-file-id", fileId);
  node.setAttribute("data-type", type);
  node.style.left = `${(-pan.x + window.innerWidth / 2) / zoom - 190}px`;
  node.style.top = `${(-pan.y + window.innerHeight / 2) / zoom - 140}px`;

  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  let editUrl = `https://docs.google.com/document/d/${fileId}/edit`;
  if (type === "sheet")
    editUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  if (type === "slide")
    editUrl = `https://docs.google.com/presentation/d/${fileId}/edit`;

  const presentBtn =
    type === "slide"
      ? `<button class="action-btn" onclick="event.stopPropagation(); openPresentation('${fileId}')" title="Present Mode">📽️</button>`
      : "";

  node.innerHTML = `
        <div class="node-header">
            <span class="header-title">${fileName}</span>
            <div class="header-actions">
                <button class="action-btn link-trigger" onclick="event.stopPropagation(); toggleLinkMode('${node.id}')" title="Connect Thread">🔗</button> 
                <button class="action-btn unlink-trigger" onclick="event.stopPropagation(); toggleUnlinkMode('${node.id}')" title="Cut Thread">✂️</button>
                <button class="action-btn" onclick="event.stopPropagation(); toggleFocusMode('${node.id}')" title="Focus">⛶</button> 
                ${presentBtn}
                <button class="action-btn edit-action" onclick="event.stopPropagation(); openEditModal('${editUrl}', '${fileName}')" title="Edit">✏️</button> 
                <button class="action-btn delete-btn" onclick="event.stopPropagation(); window.deleteNode('${node.id}')" title="Delete">✕</button>
            </div>
        </div>
        <div class="node-body" style="padding: 0;"><iframe class="portal-frame" src="${previewUrl}"></iframe></div>`;

  container.appendChild(node);
  makeElementDraggable(node);
  saveCurrentWorkspace(`Imported ${fileName}`);
}
window.spawnCloudNode = spawnCloudNode;

// AI ASSISTANT (WEBLLM + SMART COMMAND ENGINE)
async function toggleGemini() {
  closeAllMenus();
  const panel = document.getElementById("gemini-panel");
  if (!panel) return;
  panel.classList.toggle("open");

  const chat = document.getElementById("gemini-chat");
  if (chat && (!llmPreferenceSet || chat.children.length <= 1)) {
    chat.innerHTML = `
      <div class="chat-message ai-message" id="llm-selector-card" style="background: #1e1e1e; border: 1px solid #333; padding: 12px; border-radius: 8px;">
        <b>🤖 Select AI Assistant Mode:</b><br>
        <p style="margin: 8px 0; font-size: 13px; color: #aaa;">
          Choose how Orbit AI should process your requests:
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
          <button onclick="setLLMPreference(true)" style="padding: 8px 12px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; text-align: left; font-size: 12px;">
            🚀 <b>WebLLM Engine</b> (In-Browser WebGPU AI)
          </button>
          <button onclick="setLLMPreference(false)" style="padding: 8px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 6px; cursor: pointer; text-align: left; font-size: 12px;">
            ⚡ <b>Workspace Command Engine</b> (Fast local canvas commands)
          </button>
        </div>
      </div>
    `;
    chat.scrollTop = chat.scrollHeight;
  }
}
window.toggleGemini = toggleGemini;

function setLLMPreference(enableWebLLM) {
  useWebLLM = enableWebLLM;
  llmPreferenceSet = true;

  const chat = document.getElementById("gemini-chat");
  const selector = document.getElementById("llm-selector-card");
  if (selector) selector.remove();

  if (useWebLLM) {
    chat.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-message ai-message" style="background:var(--google-blue); color:#fff;">
          <b>WebLLM Active:</b><br>
          In-browser WebGPU model initialized. Ask questions or type workspace commands below.
       </div>`,
    );
  } else {
    chat.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-message ai-message" style="background:#222; border: 1px solid #444; color:#fff;">
          <b>Command Engine Active:</b><br>
          Available commands:<br>
          • <code>tutorial</code> / <code>help</code><br>
          • <code>analyze page</code><br>
          • <code>add doc [Name]</code><br>
          • <code>add sheet [Name]</code><br>
          • <code>add slide [Name]</code><br>
          • <code>remove files</code>
       </div>`,
    );
  }
  chat.scrollTop = chat.scrollHeight;
}
window.setLLMPreference = setLLMPreference;

function handleGeminiEnter(e) {
  if (e.key === "Enter") askGemini();
}
window.handleGeminiEnter = handleGeminiEnter;

async function askGemini() {
  const input = document.getElementById("gemini-input");
  const chat = document.getElementById("gemini-chat");
  if (!input || !chat) return;
  const rawQuery = input.value.trim();
  if (!rawQuery) return;

  chat.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-message user-message">${rawQuery}</div>`,
  );
  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  const loadingId = "msg-" + Date.now();
  chat.insertAdjacentHTML(
    "beforeend",
    `
        <div id="${loadingId}" class="chat-message ai-message">
            <div style="display:flex; align-items:center; gap:8px;">
                <div class="google-spinner" style="width:16px; height:16px;">
                    <svg viewBox="25 25 50 50"><circle cx="50" cy="50" r="20" fill="none" stroke-width="4"></circle></svg>
                </div><span id="ai-status-text">Processing...</span>
            </div>
        </div>`,
  );
  chat.scrollTop = chat.scrollHeight;

  const query = rawQuery.toLowerCase();
  let responseMessage = "";

  try {
    if (useWebLLM) {
      if (!aiEngine) {
        const statusLabel = document.getElementById("ai-status-text");
        if (statusLabel)
          statusLabel.innerText = "Downloading AI architecture dependencies...";
        const webllm = await import("https://esm.run/@mlc-ai/web-llm");
        aiEngine = await webllm.CreateMLCEngine(selectedModel, {
          initProgressCallback: (report) => {
            if (statusLabel)
              statusLabel.innerText = `Caching weights: ${Math.round(report.progress * 100)}%`;
          },
        });
      }
      let workspaceContext =
        "You are the Orbit Spatial Assistant. Use this context to answer accurately.\n\n";
      const messages = [
        { role: "system", content: workspaceContext },
        { role: "user", content: rawQuery },
      ];
      const reply = await aiEngine.chat.completions.create({ messages });
      responseMessage = reply.choices[0].message.content;
    } else {
      if (
        query.includes("tutorial") ||
        query.includes("help") ||
        query.includes("onboarding")
      ) {
        spawnOnboardingCards();
        responseMessage = `🎓 <b>Tutorial Cards Spawned!</b><br>I have placed the 3 onboarding guide cards onto your canvas matrix.`;
      } else if (
        query.includes("analyze page") ||
        query.includes("analyze canvas")
      ) {
        const nodes = document.querySelectorAll(".orbit-node");
        let summaries = [];
        nodes.forEach((n) => {
          const title = n.getAttribute("data-title") || "Untitled Card";
          const type = n.getAttribute("data-type") || "doc";
          summaries.push(`• [${type.toUpperCase()}] <b>${title}</b>`);
        });

        responseMessage = `
          <b>📊 Page & Canvas Analysis Report:</b><br>
          - Total Active Cards: <b>${nodes.length}</b><br>
          - Active Threads/Connections: <b>${projectThreads.length}</b><br><br>
          <b>Canvas Elements:</b><br>${summaries.join("<br>") || "No cards currently on workspace."}
        `;
      } else if (
        query.includes("analyze files") ||
        query.includes("analyze docs")
      ) {
        const nodes = document.querySelectorAll(".orbit-node");
        let cloudFiles = 0;
        nodes.forEach((n) => {
          if (n.getAttribute("data-file-id")) cloudFiles++;
        });

        responseMessage = `
          <b>📁 File Schema Inspection:</b><br>
          - Total Workspace Nodes: ${nodes.length}<br>
          - Linked Google Drive Cloud Assets: ${cloudFiles}<br>
          <i>All document schemas are synchronized with local workspace storage.</i>
        `;
      } else if (query.includes("add sheet") || query.includes("spawn sheet")) {
        const titleMatch = rawQuery
          .replace(/add sheet|spawn sheet/i, "")
          .trim();
        const fileName = titleMatch || "New Spreadsheet Matrix";
        spawnBlankNode("sheet", fileName, "Data grid layout workspace.", 0, 0);
        responseMessage = `📊 Successfully created and added new <b>Spreadsheet</b> card: <b>"${fileName}"</b>!`;
      } else if (query.includes("add slide") || query.includes("spawn slide")) {
        const titleMatch = rawQuery
          .replace(/add slide|spawn slide/i, "")
          .trim();
        const fileName = titleMatch || "New Presentation Deck";
        spawnBlankNode(
          "slide",
          fileName,
          "Graphics slide frame template matrix.",
          0,
          0,
        );
        responseMessage = `📽️ Successfully created and added new <b>Slide</b> card: <b>"${fileName}"</b>!`;
      } else if (
        query.includes("add doc") ||
        query.includes("add file") ||
        query.includes("add new file") ||
        query.includes("spawn file")
      ) {
        const titleMatch = rawQuery
          .replace(/add doc|add file|add new file|spawn file/i, "")
          .trim();
        const fileName = titleMatch || "New Document Asset";

        spawnBlankNode(
          "doc",
          fileName,
          "Instantly compiled document workspace.",
          0,
          0,
        );
        responseMessage = `📄 Successfully created and added new <b>Document</b> card: <b>"${fileName}"</b>!`;
      } else if (
        query.includes("remove files") ||
        query.includes("delete files") ||
        query.includes("clear canvas")
      ) {
        const nodes = document.querySelectorAll(".orbit-node");
        const count = nodes.length;
        nodes.forEach((n) => n.remove());
        projectThreads = [];
        drawThreads();
        saveCurrentWorkspace("Cleared Canvas via Command");

        responseMessage = `🗑️ Successfully scrubbed and removed <b>${count}</b> resource files and layout threads from your canvas matrix.`;
      } else {
        responseMessage = `
          <b>🤖 Orbit Command Matrix Active</b><br>
          Try these commands:<br>
          • <code>tutorial</code> / <code>help</code><br>
          • <code>analyze page</code><br>
          • <code>add doc [Name]</code><br>
          • <code>add sheet [Name]</code><br>
          • <code>add slide [Name]</code><br>
          • <code>remove files</code>
        `;
      }
    }
  } catch (err) {
    console.error(err);
    responseMessage = `⚠️ Error executing command: ${err.message}`;
  }

  setTimeout(() => {
    const loaderMsg = document.getElementById(loadingId);
    if (loaderMsg) loaderMsg.innerHTML = responseMessage;
    chat.scrollTop = chat.scrollHeight;
  }, 300);
}
window.askGemini = askGemini;

function signOut() {
  accessToken = null;
  document.getElementById("google-signin-btn").style.display = "block";
  document.getElementById("google-signout-btn").style.display = "none";
  document.getElementById("profile-avatar").style.display = "none";
  document.getElementById("calendar-feed").innerHTML =
    '<div style="padding:20px; text-align:center;">Sign in to view upcoming events...</div>';
  document.getElementById("drive-feed").innerHTML =
    '<div style="padding:20px; text-align:center;">Sign in to view recent files...</div>';
  triggerToast("Signed out safely.");
}
window.signOut = signOut;

function handleCredentialResponse(response) {
  if (response && response.credential) {
    accessToken = response.credential;
    document.getElementById("google-signin-btn").style.display = "none";
    document.getElementById("google-signout-btn").style.display = "block";
    document.getElementById("profile-avatar").style.display = "flex";

    setTimeout(() => {
      if (activeWorkspaceId) saveCurrentWorkspace("Saved Before New Session");
      createNewWorkspace();
    }, 1000);

    triggerToast("Signed in successfully!");
  }
}
window.handleCredentialResponse = handleCredentialResponse;

function initializeGoogleIdentity() {
  if (!DEVELOPER_KEY) return;
  if (typeof google === "undefined" || typeof gapi === "undefined") {
    setTimeout(initializeGoogleIdentity, 100);
    return;
  }
  gapi.load("client", async () => {
    try {
      await gapi.client.init({
        apiKey: DEVELOPER_KEY,
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
        ],
      });
    } catch (e) {
      console.warn(
        "Google API Client failed initialization inside container structure.",
        e,
      );
    }
  });
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope:
      "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly",
    prompt: "consent",
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        gapi.client.setToken({ access_token: accessToken });
        document.getElementById("google-signin-btn").style.display = "none";
        document.getElementById("google-signout-btn").style.display = "block";
        document.getElementById("profile-avatar").style.display = "flex";
        fetchCalendarEvents();
        if (document.getElementById("home-screen").style.display === "block") {
          fetchHomeDriveFiles();
        }
        triggerToast("Signed in successfully!");
        setTimeout(() => {
          if (activeWorkspaceId)
            saveCurrentWorkspace("Saved Before New Session");
          createNewWorkspace();
        }, 1000);
      }
    },
  });
  const loginTarget = document.getElementById("google-signin-btn");
  if (loginTarget) {
    loginTarget.onclick = (e) => {
      e.preventDefault();
      if (!tokenClient) {
        triggerToast("Google Auth blocked: Check your Client ID and API Keys.");
        return;
      }
      tokenClient.requestAccessToken();
    };
  }

  try {
    setTimeout(() => {
      if (!accessToken) {
        console.log("Canvas initialization bypass forced cleanly.");
        createNewWorkspace();
      }
    }, 800);
  } catch (err) {
    console.warn(err);
  }
}

let currentDeviceMode = "desktop";

function selectDeviceMode(mode) {
  currentDeviceMode = mode;
  const backdrop = document.getElementById("device-mode-backdrop");
  if (backdrop) backdrop.style.display = "none";

  // Clean up existing mode classes
  document.body.classList.remove("mode-mobile", "mode-tablet", "mode-desktop");
  document.body.classList.add(`mode-${mode}`);

  // Automatically calibrate initial zoom scale for the device screen
  if (mode === "mobile") {
    zoom = 0.48; // Compact scale so cards fit phone viewports comfortably
  } else if (mode === "tablet") {
    zoom = 0.68;
  } else {
    zoom = 0.85; // Standard desktop scale
  }

  // Recenter the virtual canvas around the new zoom scale
  pan.x = window.innerWidth / 2 - 5000 * zoom;
  pan.y = window.innerHeight / 2 - 5050 * zoom;
  updateTransform();

  triggerToast(`Optimized for ${mode.toUpperCase()} display!`);
}
window.selectDeviceMode = selectDeviceMode;
