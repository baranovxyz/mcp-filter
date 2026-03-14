import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ToolListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  PromptListChangedNotificationSchema,
  ResourceTemplateSchema,
  type Tool,
  type Resource,
  type Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

type ResourceTemplate = z.infer<typeof ResourceTemplateSchema>;
import { Filter } from "./filter.js";

export class ProxyServer {
  private server: Server;
  private client: Client;
  private filter: Filter;

  constructor(serverInfo: { name: string; version: string }, filter: Filter) {
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

    this.server = new Server(serverInfo, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    });

    this.setupHandlers();
  }

  /**
   * Fetches all pages of a paginated MCP list operation.
   * Prevents filter bypass where blocked items on page 2+ would leak through.
   */
  private async fetchAllPages<T>(
    fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
  ): Promise<T[]> {
    const allItems: T[] = [];
    let cursor: string | undefined;

    do {
      const response = await fetchPage(cursor);
      allItems.push(...response.items);
      cursor = response.nextCursor;
    } while (cursor);

    return allItems;
  }

  private setupHandlers() {
    // Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.fetchAllPages<Tool>(async (cursor) => {
        const response = await this.client.listTools(
          cursor ? { cursor } : undefined
        );
        return { items: response.tools, nextCursor: response.nextCursor };
      });

      return {
        tools: this.filter.filterList(tools),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (this.filter.shouldExclude(request.params.name)) {
        throw new Error(`Tool '${request.params.name}' is excluded by filter`);
      }

      return await this.client.callTool(request.params);
    });

    // Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.fetchAllPages<Resource>(async (cursor) => {
        const response = await this.client.listResources(
          cursor ? { cursor } : undefined
        );
        return {
          items: response.resources,
          nextCursor: response.nextCursor,
        };
      });

      return {
        resources: this.filter.filterList(resources),
      };
    });

    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => {
        const templates = await this.fetchAllPages<ResourceTemplate>(
          async (cursor) => {
            const response = await this.client.listResourceTemplates(
              cursor ? { cursor } : undefined
            );
            return {
              items: response.resourceTemplates,
              nextCursor: response.nextCursor,
            };
          }
        );

        return {
          resourceTemplates: this.filter.filterList(templates),
        };
      }
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        // Resources are identified by URI, not name, so we can't easily filter calls.
        // Reads are forwarded but the resource won't appear in listResources if filtered.
        return await this.client.readResource(request.params);
      }
    );

    // Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = await this.fetchAllPages<Prompt>(async (cursor) => {
        const response = await this.client.listPrompts(
          cursor ? { cursor } : undefined
        );
        return { items: response.prompts, nextCursor: response.nextCursor };
      });

      return {
        prompts: this.filter.filterList(prompts),
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (this.filter.shouldExclude(request.params.name)) {
        throw new Error(
          `Prompt '${request.params.name}' is excluded by filter`
        );
      }

      return await this.client.getPrompt(request.params);
    });

    // Forward list-changed notifications from upstream to downstream
    this.client.setNotificationHandler(
      ToolListChangedNotificationSchema,
      async () => {
        await this.server.sendToolListChanged();
      }
    );

    this.client.setNotificationHandler(
      ResourceListChangedNotificationSchema,
      async () => {
        await this.server.sendResourceListChanged();
      }
    );

    this.client.setNotificationHandler(
      PromptListChangedNotificationSchema,
      async () => {
        await this.server.sendPromptListChanged();
      }
    );
  }

  getClient(): Client {
    return this.client;
  }

  getServer(): Server {
    return this.server;
  }
}
