import "dotenv/config";

import app from "./app.js";

const port = Number(process.env.PORT) || 8000;

const server = app.listen(port, () => {
  console.log(`Samarth AI backend listening on http://localhost:${port}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));