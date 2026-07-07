# Orbit Matrix Map 🌌

Orbit is a spatial, infinite-canvas productivity workspace designed to map cloud resources out of traditional, nested folder structures and into interactive visual nodes. By pulling your Google Docs, Sheets, and Slides onto a unified coordinate playground, Orbit lets you connect data threads mathematically, visualize asset dependencies, and orchestrate complex projects in real-time.

---

## ✨ Key Architectural Features

### 🌌 The Infinite Spatial Canvas
- **Dynamic Node Playground:** Say goodbye to endless browser tabs. Render individual cloud files into modular workspace assets scattered across an expansive 10,000px layout frame.
- **Mathematical Logic Threads:** Connect data elements together using responsive, mathematically computed SVG vector paths to map workflows cleanly.
- **Viewport Focus Engine:** Seamlessly toggle localized overlays to isolate and zoom into an individual document instance for targeted deep work.

### 🧠 Privacy-First Local AI Context Layer
- **Deep Sidebar Context Tracking:** An embedded assistant designed to read, compile, and summarize text variables explicitly across active document nodes.
- **Ollama Loopback Interface:** Directly queries local inference ports running `llama3` locally on your machine.
- **Zero-Cloud Isolation Safeguard:** Your private enterprise data strings reside entirely inside browser memory limits during context mapping—no data ever leaks out onto external cloud infrastructure.

### ⏳ Linear Temporal Timeline Scrubber
- **State Synchronization Array:** Tracks and maps changes incrementally across code cycles. Bounded historical arrays allow you to scrub back or skip forward linearly through layout configurations without content corruption.

### 📽️ Embedded Media & Presentation Frames
- **Google Slides Embedding:** Instantly transforms imported slide nodes into full-screen presentation mode wrappers.
- **Home Dashboard Carousel:** Features a live, automated gallery reel loop right on your landing hub page.

---

## 🛠️ Built With

- **Core Web Tech:** Vanilla HTML5 semantic syntax, CSS3 variable definitions, and raw modern ECMAScript logic (No bloated client frameworks).
- **Cloud Interfaces:** Google Identity Services (OAuth 2.0 Client-Side Flow), Google Picker API, Google Drive Core Frameworks.
- **Local Intelligence:** Ollama Local Inference Engine (`llama3`).

---

## 📦 Local Setup & Infrastructure Deployment

### Prerequisites
- A modern web browser (Brave, Chrome, or Edge recommended).
- A local web serving execution port (e.g., **VS Code Live Server** extension).
- [Ollama](https://ollama.com/) running locally on your hardware.

### Quick-Start Execution Sequence

1. **Clone the Source Tree**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/Orbit-Matrix.git](https://github.com/YOUR_USERNAME/Orbit-Matrix.git)
   cd Orbit-Matrix
Spin Up the Local Inference Layer
Ensure your local machine AI runtime server is alive by running:

Bash
ollama run llama3
Serve the Application Matrix
Launch your web development server of choice. The workspace dashboard defaults onto your standard local deployment origin:


🤖 AI Co-Pilot Credits
This codebase underwent strict optimization, state management refactoring, and logical troubleshooting with the assistance of Gemini 3.1 Pro. The model served as a core debugging partner, successfully guiding the transition to sandboxed secure UI modal setups, mapping missing event scopes across multi-layered drag physics, and engineering loopbacks to handle public production domains interacting with native local infrastructure ports.

🔒 Security Configuration Notes
Decentralized Credentials: To avoid token leakage, this app operates entirely serverless. It leverages client-side storage structures to parse and cache encrypted token scopes strictly within your own browser engine sandbox.

Origin Locking: Keep your active credentials locked specifically down to your unique GitHub Pages address path via your console provider settings.

🐛 Known Bugs & Future Fixes
1. Browser Mixed Content & CORS Blocking (Local AI Panel)
Issue: When running the application over production domains (https://), modern web browsers enforce strict Mixed Content Restrictions. This causes the browser to block background requests sent to an unencrypted local endpoint (http://127.0.0.1:11434).

Current Workaround: 1. Set the environment variable OLLAMA_ORIGINS="*" on your machine to allow cross-origin requests.
2. Click the lock/settings icon next to the URL bar on the hosted site, open Site Settings, and change Insecure Content to Allow.

Planned Fix: Implement a lightweight secure websocket relay or proxy middleware layer to upgrade local HTTP transport payloads safely to encrypted protocols without manual browser exceptions.
