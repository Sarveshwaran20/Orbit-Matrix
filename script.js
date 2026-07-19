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
const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
let pan = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let zoom = 0.85;
let isDragging = false;
let start = { x: 0, y: 0 };
pan.x -= 5000 * zoom;
pan.y -= 5050 * zoom;
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
  e.stopPropagation();
  const menu = document.getElementById("creation-popover");
  if (menu) {
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
  }
}
document.addEventListener("click", (e) => {
  const menu = document.getElementById("creation-popover");
  if (menu && !e.target.closest("#canvas-creation-hub")) {
    menu.style.display = "none";
  }
});
function spawnBlankNode(type) {
  syncNodeIdCounter();
  const titleInput = document.getElementById("blank-asset-title");
  let title =
    titleInput && titleInput.value.trim()
      ? titleInput.value.trim()
      : `Untitled ${type.toUpperCase()}`;
  nodeIdCounter++;
  const node = document.createElement("div");
  node.className = `orbit-node ${type}-node`;
  node.id = `node-${nodeIdCounter}`;
  node.setAttribute("data-title", title);
  node.setAttribute("data-type", type);
  node.style.left = `${(-pan.x + window.innerWidth / 2) / zoom - 190}px`;
  node.style.top = `${(-pan.y + window.innerHeight / 2) / zoom - 140}px`;
  let txt =
    type === "sheet"
      ? "Empty data grid layout workspace. Connect a live cloud file schema matrix."
      : type === "slide"
        ? "Blank graphics slide frame template matrix."
        : "Click 'Edit' (✏️) to connect an enterprise cloud resource document asset.";
  node.innerHTML = `
        <div class="node-header">
            <span class="header-title">${title}</span>
            <div class="header-actions">
                <button class="action-btn link-trigger" onclick="event.stopPropagation(); toggleLinkMode('${node.id}')">🔗</button>
                <button class="action-btn" onclick="event.stopPropagation(); toggleFocusMode('${node.id}')">⛶</button>
                <button class="action-btn edit-action" onclick="event.stopPropagation(); openFilePicker('${type}')">✏️</button>
                <button class="action-btn delete-btn" onclick="event.stopPropagation(); window.deleteNode('${node.id}')">✕</button>
            </div>
        </div>
        <div class="node-body" style="position:relative;">
            <div class="link-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; display:none; cursor:crosshair;"></div>
            <p style="margin:0; font-size:13px; font-style:italic;">${txt}</p>
        </div>
    `;
  container.appendChild(node);
  makeElementDraggable(node);
  if (titleInput) titleInput.value = "";
  const pop = document.getElementById("creation-popover");
  if (pop) pop.style.display = "none";
  saveCurrentWorkspace("Created Blank Node");
}
function deleteNode(id) {
  const node = document.getElementById(id);
  if (node) node.remove();
  projectThreads = projectThreads.filter((t) => t.from !== id && t.to !== id);
  drawThreads();
  saveCurrentWorkspace("Deleted File");
}
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
function closeCommandPalette() {
  document.getElementById("palette-backdrop").style.display = "none";
  document.getElementById("command-palette").style.display = "none";
}
function filterPalette() {
  const q = document.getElementById("palette-input").value.toLowerCase();
  document.querySelectorAll("#palette-results .palette-item").forEach((i) => {
    i.style.display = i.innerText.toLowerCase().includes(q) ? "flex" : "none";
  });
}
let currentTutorialStep = 0;
const tutorialSteps = [
  {
    elementId: "tut-logo",
    title: "Central Hub",
    text: "Clicking the dynamic Orbit logo drops you out of the matrix canvas view and takes you back to your Dashboard home.",
    position: "bottom",
  },
  {
    elementId: "tut-sidebar",
    title: "App Ecosystem",
    text: "Access companion apps directly on your right panel.",
    position: "left",
  },
  {
    elementId: "tut-gemini",
    title: "Orbit AI",
    text: "Trigger the local app assistant to automatically extract and read text components from open documents.",
    position: "left",
  },
];
function launchTutorialSequence() {
  if (localStorage.getItem("orbit_tutorial_completed") === "true") return;
  document.getElementById("tutorial-overlay").style.display = "block";
  document.getElementById("tutorial-box").style.display = "flex";
  currentTutorialStep = 0;
  renderTutorialStep();
}
function renderTutorialStep() {
  document
    .querySelectorAll(".tut-highlight")
    .forEach((el) => el.classList.remove("tut-highlight"));
  const step = tutorialSteps[currentTutorialStep];
  const targetEl = document.getElementById(step.elementId);
  const boxEl = document.getElementById("tutorial-box");
  if (!targetEl) {
    boxEl.style.top = "50%";
    boxEl.style.left = "50%";
    boxEl.style.transform = "translate(-50%, -50%)";
    document.getElementById("tutorial-step-title").innerText = step.title;
    document.getElementById("tutorial-step-text").innerHTML = step.text;
    return;
  }
  targetEl.classList.add("tut-highlight");
  const rect = targetEl.getBoundingClientRect();
  document.getElementById("tutorial-step-title").innerText = step.title;
  document.getElementById("tutorial-step-text").innerHTML = step.text;
  if (step.position === "right") {
    boxEl.style.top = `${rect.top}px`;
    boxEl.style.left = `${rect.right + 20}px`;
    boxEl.style.transform = "none";
  } else if (step.position === "bottom") {
    boxEl.style.top = `${rect.bottom + 20}px`;
    boxEl.style.left = `${rect.left}px`;
    boxEl.style.transform = "none";
  } else {
    boxEl.style.top = `${rect.top}px`;
    boxEl.style.left = `${rect.left - 340}px`;
    boxEl.style.transform = "none";
  }
  document.getElementById("tutorial-next-btn").innerText =
    currentTutorialStep === tutorialSteps.length - 1 ? "Finish 🎉" : "Next →";
}
function nextTutorialStep() {
  if (currentTutorialStep < tutorialSteps.length - 1) {
    currentTutorialStep++;
    renderTutorialStep();
  } else {
    skipTutorial();
  }
}
function skipTutorial() {
  document
    .querySelectorAll(".tut-highlight")
    .forEach((el) => el.classList.remove("tut-highlight"));
  document.getElementById("tutorial-overlay").style.display = "none";
  document.getElementById("tutorial-box").style.display = "none";
  localStorage.setItem("orbit_tutorial_completed", "true");
  triggerToast("Welcome aboard!");
}
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
function openWorkspaceScreen() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("home-meta-area").style.display = "none";
  document.getElementById("workspace-screen").style.display = "block";
  document.getElementById("doc-meta-area").style.display = "flex";
  recenterCanvas();
}
function createNewWorkspace() {
  closeAllMenus();
  activeWorkspaceId = "ws_" + Date.now();
  document.querySelectorAll(".orbit-node").forEach((n) => n.remove());
  projectThreads = [];
  stateHistory = [];
  drawThreads();
  document.getElementById("workspace-title").value = "Untitled Workspace";
  const chatFeed = document.getElementById("gemini-chat");
  if (chatFeed) {
    chatFeed.innerHTML = `<div class="chat-message ai-message">Hello! I can analyze your canvas open documents locally using Llama.</div>`;
  }
  saveCurrentWorkspace("Blank Workspace Created");
  openWorkspaceScreen();
}
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
    const chatFeed = document.getElementById("gemini-chat");
    if (chatFeed) {
      if (ws.chatHistoryHTML) {
        chatFeed.innerHTML = ws.chatHistoryHTML;
      } else {
        chatFeed.innerHTML = `<div class="chat-message ai-message">Hello! I can analyze your canvas open documents locally using Llama.</div>`;
      }
    }
    if (historySlider) {
      historySlider.max = stateHistory.length > 0 ? stateHistory.length - 1 : 0;
      historySlider.value = historySlider.max;
    }
    openWorkspaceScreen();
  }
}
function switchHomeTab(tab) {
  document.getElementById("active-workspaces-view").style.display =
    tab === "workspaces" ? "block" : "none";
  document.getElementById("home-create-section").style.display =
    tab === "workspaces" ? "flex" : "none";
  document.getElementById("bin-view").style.display =
    tab === "bin" ? "block" : "none";
  renderHomeWorkspaces();
}
function trashWorkspace(e, id) {
  e.stopPropagation();
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  let w = ws.find((x) => x.id === id);
  if (w) w.isDeleted = true;
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Moved to Bin");
}
async function spawnBlankNodeDrive(type) {
  if (!accessToken) {
    triggerToast("Please Sign in with Google first.");
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
      body: JSON.stringify({ name: title, mimeType: mimeType }),
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
function restoreWorkspace(e, id) {
  e.stopPropagation();
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  let w = ws.find((x) => x.id === id);
  if (w) w.isDeleted = false;
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Workspace Restored");
}
function permDeleteWorkspace(e, id) {
  e.stopPropagation();
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  ws = ws.filter((x) => x.id !== id);
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Permanently Deleted");
}
function emptyBin() {
  let ws = JSON.parse(localStorage.getItem("orbit_workspaces") || "[]");
  ws = ws.filter((x) => !x.isDeleted);
  localStorage.setItem("orbit_workspaces", JSON.stringify(ws));
  renderHomeWorkspaces();
  triggerToast("Bin Emptied");
}
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
  const chatFeed = document.getElementById("gemini-chat");
  const currentChatHTML = chatFeed ? chatFeed.innerHTML : "";
  const wsIndex = workspaces.findIndex((w) => w.id === activeWorkspaceId);
  const wsData = {
    id: activeWorkspaceId,
    title: document.getElementById("workspace-title").value,
    nodes: nodes,
    threads: projectThreads,
    history: stateHistory,
    chatHistoryHTML: currentChatHTML,
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
function triggerRedo() {
  closeAllMenus();
  const v = parseInt(historySlider.value);
  if (v < parseInt(historySlider.max)) {
    historySlider.value = v + 1;
    historySlider.dispatchEvent(new Event("input"));
    triggerToast("Redo applied");
  }
}
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
      document.getElementById("workspace-title").value =
        "Shared External Workspace";
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
  initializeGoogleIdentity();
});
container.addEventListener("click", (e) => {
  const nodeElement = e.target.closest(".orbit-node");
  if (!nodeElement || e.target.closest(".action-btn")) return;
  if (linkSourceNode) {
    e.stopPropagation();
    completeThreading(nodeElement.id);
  }
});
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
    element.classList.add("active");
    const target = document.getElementById(menuId);
    if (target) target.style.display = "block";
  }
}
function closeAllMenus() {
  activeMenu = null;
  document
    .querySelectorAll(".dropdown-menu")
    .forEach((menu) => (menu.style.display = "none"));
  document
    .querySelectorAll(".menu-item")
    .forEach((item) => item.classList.remove("active"));
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".google-menu-bar")) {
    closeAllMenus();
  }
});
function triggerToast(message) {
  closeAllMenus();
  const toast = document.getElementById("toast-notification");
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}
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
function openShareModal() {
  closeAllMenus();
  document.getElementById("share-backdrop").style.display = "block";
  document.getElementById("share-modal").style.display = "block";
}
function closeShareModal() {
  document.getElementById("share-backdrop").style.display = "none";
  document.getElementById("share-modal").style.display = "none";
}
function copyShareLink() {
  mixLayoutSnapshot();
}
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
    const baseShareUrl = window.location.href.split("?")[0];
    navigator.clipboard.writeText(baseShareUrl + "?matrix=" + b64);
    triggerToast("Magic Link copied!");
    closeShareModal();
  } catch (err) {
    triggerToast("Error compressing link.");
  }
}
function openSidePanel(tabName) {
  document
    .querySelectorAll(".side-tab")
    .forEach((tab) => tab.classList.remove("active-tab"));
  event.currentTarget.classList.add("active-tab");
  document
    .querySelectorAll(".ep-content")
    .forEach((content) => (content.style.display = "none"));
  document.getElementById(`ep-${tabName}`).style.display = "block";
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
  document.getElementById("ep-title").innerText = title;
  document.getElementById("expanded-side-panel").classList.add("open");
}
function closeSidePanel() {
  document.getElementById("expanded-side-panel").classList.remove("open");
  document
    .querySelectorAll(".side-tab")
    .forEach((tab) => tab.classList.remove("active-tab"));
}
async function fetchCalendarEvents() {
  const feed = document.getElementById("calendar-feed");
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
  const feed = document.getElementById("home-recent-feed");
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
function closeSlideshow() {
  document.getElementById("slideshow-modal").style.display = "none";
  document.getElementById("slideshow-frame").src = "";
  clearInterval(slideInterval);
}
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
function prevSlide() {
  currentSlide--;
  showSlide();
}
function toggleSlidePlay() {
  slideIsPlaying = !slideIsPlaying;
  document.getElementById("slide-play-btn").innerText = slideIsPlaying
    ? "Play"
    : "Pause";
}
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
function toggleTask(index) {
  let tasks = JSON.parse(localStorage.getItem("orbit_tasks") || "[]");
  if (tasks[index]) {
    tasks[index].done = !tasks[index].done;
    localStorage.setItem("orbit_tasks", JSON.stringify(tasks));
    renderTasks();
  }
}
function removeTask(index) {
  let tasks = JSON.parse(localStorage.getItem("orbit_tasks") || "[]");
  tasks.splice(index, 1);
  localStorage.setItem("orbit_tasks", JSON.stringify(tasks));
  renderTasks();
}
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
function toggleLinkMode(nodeId) {
  if (!linkSourceNode) {
    linkSourceNode = nodeId;
    document.getElementById(nodeId).classList.add("linking-active");
    document.getElementById("linking-status").style.display = "block";
    document.querySelectorAll(".orbit-node .link-overlay").forEach((el) => {
      el.style.display = "block";
    });
  } else {
    if (linkSourceNode === nodeId) {
      document
        .getElementById(linkSourceNode)
        .classList.remove("linking-active");
      document.getElementById("linking-status").style.display = "none";
      linkSourceNode = null;
      document.querySelectorAll(".orbit-node .link-overlay").forEach((el) => {
        el.style.display = "none";
      });
    } else {
      completeThreading(nodeId);
    }
  }
}
function completeThreading(targetId) {
  if (linkSourceNode && linkSourceNode !== targetId) {
    projectThreads.push({ from: linkSourceNode, to: targetId });
    document.getElementById(linkSourceNode).classList.remove("linking-active");
    document.getElementById("linking-status").style.display = "none";
    linkSourceNode = null;
    document.querySelectorAll(".orbit-node .link-overlay").forEach((el) => {
      el.style.display = "none";
    });
    drawThreads();
    saveCurrentWorkspace("Linked Documents Matrix");
    triggerToast("Logic Thread Stitched!");
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
    document.getElementById("focus-backdrop").style.display = "block";
    node.classList.add("focused-node");
    container.style.pointerEvents = "none";
    node.style.pointerEvents = "auto";
  }
}
function closeAllFocus() {
  document.getElementById("focus-backdrop").style.display = "none";
  document
    .querySelectorAll(".focused-node")
    .forEach((n) => n.classList.remove("focused-node"));
  container.style.pointerEvents = "auto";
}
viewport.addEventListener("mousedown", (e) => {
  if (
    e.target.closest(".orbit-node") ||
    e.target.closest("#tutorial-box") ||
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
function makeElementDraggable(elmnt) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0,
    header = elmnt.querySelector(".node-header"),
    dragFrame = null;
  if (header) {
    header.onmousedown = (e) => {
      if (
        e.target.closest(".action-btn") ||
        elmnt.classList.contains("focused-node") ||
        linkSourceNode
      )
        return;
      document.body.classList.add("dragging-active");
      elmnt.classList.add("is-moving");
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    };
  }
  function elementDrag(e) {
    pos1 = (pos3 - e.clientX) / zoom;
    pos2 = (pos4 - e.clientY) / zoom;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = `${elmnt.offsetTop - pos2}px`;
    elmnt.style.left = `${elmnt.offsetLeft - pos1}px`;
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = requestAnimationFrame(() => {
      drawThreads();
    });
  }
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    document.body.classList.remove("dragging-active");
    elmnt.classList.remove("is-moving");
    saveCurrentWorkspace("Moved Document");
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
function closeEditModal() {
  document.getElementById("edit-frame").src = "";
  document.getElementById("edit-modal").style.display = "none";
  saveCurrentWorkspace("Finished Editing");
}
function openPresentation(fileId) {
  document.getElementById("presentation-frame").src =
    `https://docs.google.com/presentation/d/${fileId}/embed?start=true&loop=false&delayms=3000`;
  const modal = document.getElementById("presentation-modal");
  modal.style.display = "flex";
  if (modal.requestFullscreen) {
    modal.requestFullscreen().catch((err) => console.log(err));
  }
}
function closePresentation() {
  document.getElementById("presentation-frame").src = "";
  document.getElementById("presentation-modal").style.display = "none";
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen();
  }
}
window.deleteNode = function (id) {
  const node = document.getElementById(id);
  if (node) node.remove();
  projectThreads = projectThreads.filter((t) => t.from !== id && t.to !== id);
  drawThreads();
  saveCurrentWorkspace("Deleted Block");
};
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
                <button class="action-btn link-trigger" onclick="event.stopPropagation(); toggleLinkMode('${node.id}')">🔗</button> 
                <button class="action-btn" onclick="event.stopPropagation(); toggleFocusMode('${node.id}')">⛶</button> 
                ${presentBtn}
                <button class="action-btn edit-action" onclick="event.stopPropagation(); openEditModal('${editUrl}', '${fileName}')">✏️</button> 
                <button class="action-btn delete-btn" onclick="event.stopPropagation(); window.deleteNode('${node.id}')">✕</button>
            </div>
        </div>
        <div class="node-body" style="padding: 0; position:relative;">
            <div class="link-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; display:none; cursor:crosshair;"></div>
            <iframe class="portal-frame" src="${previewUrl}"></iframe>
        </div>`;
  container.appendChild(node);
  makeElementDraggable(node);
  saveCurrentWorkspace(`Imported ${fileName}`);
}
async function toggleGemini() {
  closeAllMenus();
  document.getElementById("gemini-panel").classList.toggle("open");
}
function handleGeminiEnter(e) {
  if (e.key === "Enter") askGemini();
}
async function askGemini() {
  const input = document.getElementById("gemini-input");
  const chat = document.getElementById("gemini-chat");
  const query = input.value.trim();
  if (!query) return;
  chat.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-message user-message">${query}</div>`,
  );
  input.value = "";
  chat.scrollTop = chat.scrollHeight;
  const loadingId = "msg-" + Date.now();
  chat.insertAdjacentHTML(
    "beforeend",
    `<div id="${loadingId}" class="chat-message ai-message"><div style="display:flex; align-items:center; gap:8px;"><div class="google-spinner" style="width:16px; height:16px;"><svg viewBox="25 25 50 50"><circle cx="50" cy="50" r="20" fill="none" stroke-width="4"></circle></svg></div><span id="ai-status-text">Initializing in-browser AI engine...</span></div></div>`,
  );
  chat.scrollTop = chat.scrollHeight;
  try {
    let workspaceContext =
      "You are the Orbit Spatial Assistant. Use this context to answer the user query accurately.\n\n";
    const nodes = document.querySelectorAll(".orbit-node");
    if (nodes.length > 0) {
      for (let node of nodes) {
        const title = node.getAttribute("data-title");
        const fileId = node.getAttribute("data-file-id");
        const type = node.getAttribute("data-type");
        if (
          fileId &&
          fileId !== "null" &&
          fileId !== "undefined" &&
          accessToken
        ) {
          try {
            let response = await gapi.client.drive.files.export({
              fileId: fileId,
              mimeType: type === "sheet" ? "text/csv" : "text/plain",
            });
            workspaceContext += `--- Document: ${title} ---\n${response.body.substring(0, 500)}\n\n`;
          } catch (err) {
            workspaceContext += `--- Document: ${title} ---\n[Content Protected]\n\n`;
          }
        }
      }
    }
    if (!aiEngine) {
      const statusLabel = document.getElementById("ai-status-text");
      statusLabel.innerText = "Downloading AI architecture dependencies...";
      const webllm = await import("https://esm.run/@mlc-ai/web-llm");
      aiEngine = await webllm.CreateMLCEngine(selectedModel, {
        initProgressCallback: (report) => {
          statusLabel.innerText = `Caching weights: ${Math.round(report.progress * 100)}%`;
        },
      });
    }
    document.getElementById("ai-status-text").innerText = "Thinking...";
    const messages = [
      { role: "system", content: workspaceContext },
      { role: "user", content: query },
    ];
    const reply = await aiEngine.chat.completions.create({ messages });
    const aiResponse = reply.choices[0].message.content;
    document.getElementById(loadingId).innerHTML = aiResponse
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    saveCurrentWorkspace("Updated AI Discussion Log");
  } catch (error) {
    console.error(error);
    document.getElementById(loadingId).innerHTML =
      `<div style="color:var(--google-red); line-height: 1.6;"><b>In-Browser AI Initialization Failed</b><br>Ensure your browser supports WebGPU (Chrome/Edge 113+) or check your console logs.</div>`;
  }
  chat.scrollTop = chat.scrollHeight;
}
function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      document.getElementById("google-signin-btn").style.display = "block";
      document.getElementById("google-signout-btn").style.display = "none";
      document.getElementById("profile-avatar").style.display = "none";
      document.getElementById("calendar-feed").innerHTML =
        '<div style="padding:20px; text-align:center;">Sign in to view upcoming events...</div>';
      const df = document.getElementById("drive-feed");
      if (df)
        df.innerHTML =
          '<div style="padding:20px; text-align:center;">Sign in to view files...</div>';
      triggerToast("Signed out safely.");
    });
  }
}
function initializeGoogleIdentity() {
  if (typeof google === "undefined" || typeof gapi === "undefined") {
    setTimeout(initializeGoogleIdentity, 100);
    return;
  }
  gapi.load("client", async () => {
    await gapi.client.init({
      apiKey: DEVELOPER_KEY,
      discoveryDocs: [
        "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
        "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
      ],
    });
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
          if (!activeWorkspaceId) {
            createNewWorkspace();
          } else {
            loadWorkspace(activeWorkspaceId);
          }
          
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
}
