# Orbit Matrix Map

Orbit is a spatial, infinite-canvas productivity workspace designed to map cloud resources out of traditional, nested folder structures and into interactive visual nodes. By pulling your Google Docs, Sheets, and Slides onto a unified coordinate playground, Orbit lets you connect data threads mathematically, visualize asset dependencies, and orchestrate complex projects in real-time.



https://github.com/user-attachments/assets/fa6257c4-b386-484b-8210-7dd7501015d2



---

## Key Architectural Features

### The Infinite Spatial Canvas
* **Dynamic Node Playground:** Render individual cloud files into modular workspace assets scattered across an expansive 10,000px layout frame.
* **Mathematical Logic Threads:** Connect data elements together using responsive, mathematically computed SVG vector paths to map workflows cleanly.
* **Viewport Focus Engine:** Seamlessly toggle localized overlays to isolate and zoom into an individual document instance for targeted deep work.

### Privacy-First Local AI Context Layer
* **Deep Sidebar Context Tracking:** An embedded assistant designed to read, compile, and summarize text variables explicitly across active document nodes.
* **In-Browser WebLLM Engine:** Direct browser execution utilizing WebGPU architectures via the MLC framework to support local model weights without structural data transmissions.
* **Absolute Data Isolation:** Your private workspace data strings, synchronized cloud resources, and credentials reside entirely inside your browser's localized memory sandbox. No data is ever uploaded to external application servers, and neither the developer nor any third party can access, read, or track your workspace content.

### Linear Temporal Timeline Scrubber
* **State Synchronization Array:** Tracks and maps changes incrementally across code cycles. Bounded historical arrays allow you to scrub back or skip forward linearly through layout configurations without content corruption.

### Embedded Media & Presentation Frames
* **Google Slides Embedding:** Instantly transforms imported slide nodes into full-screen presentation mode wrappers.
* **Home Dashboard Carousel:** Features a live, automated gallery reel loop right on your landing hub page.

---

## Built With

* **Core Web Tech:** Vanilla HTML5 semantic syntax, CSS3 variable definitions, and raw modern ECMAScript logic without bloated client frameworks.
* **Cloud Interfaces:** Google Identity Services (OAuth 2.0 Client-Side Flow), Google Picker API, Google Drive Core Frameworks.
* **Local Intelligence:** WebLLM In-Browser Inference Framework using the Llama-3.2-1B-Instruct model architecture.

---

## Local Setup & Infrastructure Deployment

### Prerequisites
* A modern web browser with native WebGPU support enabled (such as updated Google Chrome or Microsoft Edge configurations).
* A local web serving execution port (such as the VS Code Live Server extension).

### Quick-Start Execution Sequence

1. **Clone the Source Tree**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/Orbit-Matrix.git](https://github.com/YOUR_USERNAME/Orbit-Matrix.git)
   cd Orbit-Matrix

   Technical Updates and Release Notes
The application has been systematically optimized to resolve critical initialization bottlenecks that were previously causing loading stalls, dark backdrops, or blurry viewport overlays. Below is an itemized breakdown of what has been fixed and newly added in this build:

1. Complete Removal of the Tutorial Subsystem
Issue Resolved: The application frequently froze under a dark backdrop and a blurry filter overlay due to the guide framework failing to properly evaluate target element coordinates across different aspect ratios and isolated container configurations.

Implementation Details: The markup structures for the tutorial elements (#tutorial-overlay and #tutorial-box), along with all associated positioning routines, array indices, and event listeners, have been completely stripped out of the core application. The workspace now bypasses all introductory blockages and boots instantly into a clean, ready-to-use workspace canvas dashboard.

2. Resolution of the In-Browser AI Initialization Crash
Issue Resolved: An uncaught promise rejection occurred inside the data compilation handler because the application attempted to sweep and export content from Google Drive assets via the API before checking if an authenticated user session was active. This error caused early JavaScript execution threads to drop dead.

Implementation Details: The background context assembly layer was updated with condition guard blocks. It now explicitly validates the presence of an active user access token and initialized global Google API clients before attempting to fetch node data. Empty templates or unauthenticated states are handled gracefully without breaking the runtime lifecycle of the canvas.

3. Cross-Origin Policy (COOP) and Sandbox Fallback Triggers
Issue Resolved: Restrictive sandbox hosts—such as internal preview container frames inside Git management tools—strictly block cross-origin popups by design, causing default token handlers to crash page loads.

Implementation Details: Robust try-catch validation blocks have been wrapped around the identity client initializers. If a cross-origin opener block or frame environmental boundary error is caught, the application suppresses the failure logs and runs an absolute fallback execution route. This guarantees that the offline canvas layout engine and local storage maps initialize perfectly across all hosting platforms regardless of context limitations.

Security Configuration Notes
Decentralized Credentials: To avoid token leakage, this app operates entirely serverless. It leverages client-side storage structures to parse and cache credentials strictly within your own browser engine sandbox.

Strict User Privacy: Because this application runs purely client-side without a database backend, zero telemetry, text variables, or document data properties are collected or uploaded to external hosting servers. Your digital assets are entirely invisible to the developer(ME) and external systems.

Origin Locking: Keep your active credentials locked specifically down to your unique address path via your console provider settings.
