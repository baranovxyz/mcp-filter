import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Filter } from './filter.js';

export class ProxyServer {
  private server: Server;
  private client: Client;
  private filter: Filter;

  constructor(
    serverInfo: { name: string; version: string },
    filter: Filter
  ) {
    this.filter = filter;
    this.client = new Client(
      {
        name: `${serverInfo.name}-client`,
        version: serverInfo.version,
      },
      {
        capabilities: {},
      }
    );

    this.server = new Server(
      serverInfo,
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const response = await this.client.listTools();

      return {
        tools: this.filter.filterList(response.tools),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (this.filter.shouldDisable(request.params.name)) {
        throw new Error(`Tool '${request.params.name}' is disabled by filter`);
      }

      return await this.client.callTool(request.params);
    });

    // Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const response = await this.client.listResources();

      return {
        resources: this.filter.filterList(response.resources),
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      // Resources are identified by URI, not name, so we can't easily filter calls
      // We'll allow reads but they won't be in the list if filtered
      return await this.client.readResource(request.params);
    });

    // Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const response = await this.client.listPrompts();

      return {
        prompts: this.filter.filterList(response.prompts),
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (this.filter.shouldDisable(request.params.name)) {
        throw new Error(`Prompt '${request.params.name}' is disabled by filter`);
      }

      return await this.client.getPrompt(request.params);
    });
  }

  getClient(): Client {
    return this.client;
  }

  getServer(): Server {
    return this.server;
  }
}
