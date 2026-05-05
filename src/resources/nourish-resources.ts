import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { buildAgentManifest } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildPrivacyAudit } from "../services/privacy-audit.js";

export function registerNourishResources(server: McpServer): void {
  registerJsonResource(
    server,
    "nourish-agent-manifest",
    "nourish://agent-manifest",
    "Nourish agent manifest",
    "Agent-facing install, safety, tool, and resource manifest.",
    buildAgentManifest("generic"),
  );

  registerJsonResource(
    server,
    "nourish-capabilities",
    "nourish://capabilities",
    "Nourish capabilities",
    "Supported nutrition providers and workflows.",
    buildCapabilities(),
  );

  registerJsonResource(
    server,
    "nourish-privacy-audit",
    "nourish://privacy-audit",
    "Nourish privacy audit",
    "Local storage, secret handling, safety, and source license boundaries.",
    buildPrivacyAudit(),
  );
}

function registerJsonResource(
  server: McpServer,
  name: string,
  uri: string,
  title: string,
  description: string,
  value: unknown,
): void {
  server.registerResource(
    name,
    uri,
    {
      title,
      description,
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(value),
        },
      ],
    }),
  );
}
