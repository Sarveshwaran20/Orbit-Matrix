# Orbit Matrix Workspace

Orbit is a spatial, infinite-canvas productivity workspace designed to map cloud resources out of traditional, nested folder structures and into interactive visual nodes. By pulling your Google Docs, Sheets, and Slides onto a unified coordinate playground, Orbit lets you connect data threads mathematically, visualize asset dependencies, and orchestrate complex projects in real-time.

## Core Features

### Spatial Canvas Engine
*   **Infinite Viewport:** Render individual cloud files into modular workspace assets scattered across an expansive 10,000px layout frame . Supports custom panning, zooming, and automated recentering .
*   **Visual Logic Threads:** Connect data elements together using responsive, mathematically computed SVG vector paths to map workflows cleanly .
*   **Device Scaling:** Adaptive matrix scaling and viewport logic optimized for Desktop, Tablet, and Mobile browser environments.
*   **Radar Minimap:** A real-time HUD element tracking node coordinates across the macro-layout.

### Presentation & Hierarchy Walkthrough
*   **Cinematic Fullscreen:** Instantly transforms the canvas into a full-screen presentation mode. 
*   **Smart Sequencing:** Select custom hierarchy paths (e.g., Slides First, Docs First, Sheets First) to automatically step through nodes in a logical presentation sequence using keyboard navigation.
*   **Viewport Focus Engine:** Seamlessly toggle localized overlays to isolate and zoom into an individual document instance for targeted deep work .

### Orbit AI Integration
*   **Generative Placeholders:** Built-in semantic parser that intercepts user prompts to auto-generate fully formatted HTML placeholder cards.
*   **Public API Synthesis:** Replaced heavy local LLM dependencies with lightweight fetch logic utilizing Wikipedia and Dictionary APIs to instantly generate multi-slide research decks, data sheets, and executive briefs.
*   **Canvas Orchestration:** Issue natural language commands to automatically align node grids, clear the canvas, or execute layout recalculations.

### State & Temporal Management
*   **State Synchronization Array:** Tracks and maps changes incrementally across code cycles .
*   **Timeline Scrubber:** Bounded historical arrays allow you to scrub back or skip forward linearly through layout configurations via a UI slider without content corruption .
*   **Magic Link Sharing:** Compresses local spatial coordinates and node data into a base64-encoded URL string for stateless layout sharing.

### Google Workspace Integration & Authentication
*   **Google Identity Services:** Client-side OAuth 2.0 flow for secure Google account authentication .
*   **Drive Picker API:** Mount existing Google Docs, Sheets, and Slides directly onto the canvas via iframe portals.
*   **Side Panel Utilities:** Access synced Google Calendar events, Google Keep notes, and Workspace Tasks without leaving the matrix.
*   **Trial Mode:** Fallback guest authentication allowing unauthenticated users to evaluate the canvas engine with a strict 5-card memory limit.

## Tech Stack

*   **Frontend Core:** Vanilla HTML5, CSS3, and modern ECMAScript (Vanilla JS) . Built entirely without client-side frameworks to maintain absolute layout control and maximum rendering performance .
*   **APIs:** Google Drive API, Google Calendar API, Google Picker API .
*   **State Management:** Native browser localStorage acting as a localized, zero-latency database.

## Local Setup & Deployment

Because Orbit operates as a strict client-side application, deployment is straightforward.

### Prerequisites
*   A modern web browser .
*   A local web server (e.g., VS Code Live Server extension or Python http.server) .
*   A valid Google Cloud Client ID and Developer API Key configured for Drive and Calendar API access.

### Execution
1. Clone the repository to your local machine .
2. Serve the directory using your local web server.
3. Access the application via http://127.0.0.1:5500/index.html (or your corresponding localhost port).
4. Enter your Google API Key into the initialization modal to unlock cloud sync.

## Security Architecture

*   **Zero-Backend Infrastructure:** To avoid token leakage, this app operates entirely serverless . It leverages client-side storage structures to parse and cache encrypted token scopes strictly within your own browser engine sandbox . No user data is transmitted to custom databases.
*   **Developer Sandbox Override:** Includes a hidden DOM wipe functionality to immediately purge all localStorage workspace arrays during testing or deployment teardowns.

## Development Credits

This codebase underwent strict optimization, state management refactoring, and logical troubleshooting with the assistance of Gemini . The model served as a core debugging partner, successfully guiding the transition to sandboxed secure UI modal setups, mapping missing event scopes across multi-layered drag physics, and engineering complex logic threads .
