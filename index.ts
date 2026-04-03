import { createServer } from "./src/server.js";

const server = createServer();
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

console.log(`Echo MCP server running on port ${port}`);
server.listen(port);
