const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));

let workspaceDB = {
  stateHistory: [],
  threads: [],
  tasks: [],
  keepNotes: [],
};

app.get("/api/workspace", (req, res) => {
  console.log("Frontend requested workspace data.");
  res.json(workspaceDB);
});

app.post("/api/workspace", (req, res) => {
  const newData = req.body;

  if (newData.stateHistory) workspaceDB.stateHistory = newData.stateHistory;
  if (newData.threads) workspaceDB.threads = newData.threads;
  if (newData.tasks) workspaceDB.tasks = newData.tasks;
  if (newData.keepNotes) workspaceDB.keepNotes = newData.keepNotes;

  console.log("Workspace matrix saved securely to server.");
  res.json({ success: true, message: "Cloud sync complete." });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Orbit Backend running on http://localhost:${PORT}`);
  console.log(`Ensure your frontend is running on http://127.0.0.1:5500`);
});
