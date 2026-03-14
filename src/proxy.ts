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
  SetLevelRequestSchema,
  LoggingMessageNotificationSchema,
  CompleteRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ResourceUpdatedNotificationSchema,
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  ListRootsRequestSchema,
  RootsListChangedNotificationSchema,
  ResourceTemplateSchema,
  McpError,
  ErrorCode,
  type Tool,
  type Resource,
  type Prompt,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { z } from "zod";

type ResourceTemplate = z.infer<typeof ResourceTemplateSchema>;
import { Filter } from "./filter.js";

export class ProxyServer {
  private server!: Server;
  private client: Client;
  private filter: Filter;
  private serverInfo: { name: string; version: string };

  constructor(serverInfo: { name: string; version: string }, filter: Filter) {
    this.filter = filter;
    this.serverInfo = serverInfo;

    // Create client with capabilities for reverse-direction request support.
    // These declare what the proxy-as-client can handle when the upstream
    // server sends sampling, elicitation, or roots requests.
    this.client = new Client(
      {
        name: `${serverInfo.name}-client`,
        version: serverInfo.version,
      },
      {
        capabilities: {
          sampling: {},
          elicitation: {},
          roots: { listChanged: true },
        },
      }
    );
  }

  /**
   * Connects to the upstream server, reads its capabilities, then creates
   * the downstream Server with mirrored capabilities and registers all handlers.
   *
   * Must be called before getServer().connect().
   */
  async connectToUpstream(clientTransport: Transport): Promise<void> {
    await this.client.connect(clientTransport);

    const upstreamCaps = this.client.getServerCapabilities() ?? {};

    // Create the Server with capabilities mirrored from upstream
    this.server = new Server(this.serverInfo, {
      capabilities: this.buildCapabilities(upstreamCaps),
    });

    this.setupHandlers(upstreamCaps);
  }

  /**
   * Builds server capabilities by mirroring upstream capabilities.
   * Only advertises capabilities the upstream actually supports.
   */
  private buildCapabilities(upstream: ServerCapabilities): ServerCapabilities {
    const caps: ServerCapabilities = {};

    if (upstream.tools) {
      caps.tools = { ...upstream.tools };
    }
    if (upstream.resources) {
      caps.resources = { ...upstream.resources };
    }
    if (upstream.prompts) {
      caps.prompts = { ...upstream.prompts };
    }

    // Mirror optional capabilities from upstream
    if (upstream.logging) {
      caps.logging = {};
    }
    if (upstream.completions) {
      caps.completions = {};
    }

    return caps;
  }

  /**
   * Fetches all pages of a paginated MCP list operation.
   * Prevents filter bypass where blocked items on page 2+ would leak through.
   * Caps at MAX_PAGES to prevent infinite loops from buggy upstream cursors.
   */
  private async fetchAllPages<T>(
    fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
  ): Promise<T[]> {
    const MAX_PAGES = 100;
    const allItems: T[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      const response = await fetchPage(cursor);
      allItems.push(...response.items);
      cursor = response.nextCursor;
      if (++pageCount >= MAX_PAGES) break;
    } while (cursor);

    return allItems;
  }

  private setupHandlers(upstreamCaps: ServerCapabilities) {
    // ── Tools ──────────────────────────────────────────────────────────
    if (upstreamCaps.tools) {
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

      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (request, extra) => {
          if (this.filter.shouldExclude(request.params.name)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Tool '${request.params.name}' is excluded by filter`
            );
          }

          const options: RequestOptions = { signal: extra.signal };
          const progressToken = extra._meta?.progressToken;
          if (progressToken !== undefined) {
            options.onprogress = (progress) => {
              void extra.sendNotification({
                method: "notifications/progress" as const,
                params: { ...progress, progressToken },
              });
            };
          }

          return await this.client.callTool(
            request.params,
            undefined,
            options
          );
        }
      );
    }

    // ── Resources ─────────────────────────────────────────────────────
    if (upstreamCaps.resources) {
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
        async (request, extra) => {
          const options: RequestOptions = { signal: extra.signal };
          return await this.client.readResource(request.params, options);
        }
      );

      // ── Resource Subscriptions ────────────────────────────────────────
      if (upstreamCaps.resources.subscribe) {
        this.server.setRequestHandler(
          SubscribeRequestSchema,
          async (request, extra) => {
            const options: RequestOptions = { signal: extra.signal };
            return await this.client.subscribeResource(
              request.params,
              options
            );
          }
        );

        this.server.setRequestHandler(
          UnsubscribeRequestSchema,
          async (request, extra) => {
            const options: RequestOptions = { signal: extra.signal };
            return await this.client.unsubscribeResource(
              request.params,
              options
            );
          }
        );
      }
    }

    // ── Prompts ───────────────────────────────────────────────────────
    if (upstreamCaps.prompts) {
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

      this.server.setRequestHandler(
        GetPromptRequestSchema,
        async (request, extra) => {
          if (this.filter.shouldExclude(request.params.name)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Prompt '${request.params.name}' is excluded by filter`
            );
          }

          const options: RequestOptions = { signal: extra.signal };
          const progressToken = extra._meta?.progressToken;
          if (progressToken !== undefined) {
            options.onprogress = (progress) => {
              void extra.sendNotification({
                method: "notifications/progress" as const,
                params: { ...progress, progressToken },
              });
            };
          }

          return await this.client.getPrompt(request.params, options);
        }
      );
    }

    // ── Logging ───────────────────────────────────────────────────────
    if (upstreamCaps.logging) {
      this.server.setRequestHandler(
        SetLevelRequestSchema,
        async (request, extra) => {
          const options: RequestOptions = { signal: extra.signal };
          return await this.client.setLoggingLevel(
            request.params.level,
            options
          );
        }
      );
    }

    // ── Completions ───────────────────────────────────────────────────
    if (upstreamCaps.completions) {
      this.server.setRequestHandler(
        CompleteRequestSchema,
        async (request, extra) => {
          const ref = request.params.ref;
          // Block completions referencing filtered prompts
          if (
            ref.type === "ref/prompt" &&
            this.filter.shouldExclude(ref.name)
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Prompt '${ref.name}' is excluded by filter`
            );
          }
          // ref/resource completions forwarded without filtering (same rationale
          // as resources/read — the template won't appear in list if filtered)
          const options: RequestOptions = { signal: extra.signal };
          return await this.client.complete(request.params, options);
        }
      );
    }

    // ── Reverse-direction requests (upstream server → downstream client) ──
    // sampling/createMessage: upstream asks proxy to sample from the LLM
    this.client.setRequestHandler(
      CreateMessageRequestSchema,
      async (request) => {
        return await this.server.createMessage(request.params);
      }
    );

    // roots/list: upstream asks proxy for filesystem roots
    this.client.setRequestHandler(ListRootsRequestSchema, async (request) => {
      return await this.server.listRoots(request.params);
    });

    // elicitation/create: upstream asks proxy to elicit user input
    this.client.setRequestHandler(ElicitRequestSchema, async (request) => {
      return await this.server.elicitInput(request.params);
    });

    // ── Notification forwarding (upstream → downstream) ───────────────
    if (upstreamCaps.tools) {
      this.client.setNotificationHandler(
        ToolListChangedNotificationSchema,
        async () => {
          await this.server.sendToolListChanged();
        }
      );
    }

    if (upstreamCaps.resources) {
      this.client.setNotificationHandler(
        ResourceListChangedNotificationSchema,
        async () => {
          await this.server.sendResourceListChanged();
        }
      );

      this.client.setNotificationHandler(
        ResourceUpdatedNotificationSchema,
        async (notification) => {
          await this.server.sendResourceUpdated(notification.params);
        }
      );
    }

    if (upstreamCaps.prompts) {
      this.client.setNotificationHandler(
        PromptListChangedNotificationSchema,
        async () => {
          await this.server.sendPromptListChanged();
        }
      );
    }

    // Forward logging messages from upstream
    if (upstreamCaps.logging) {
      this.client.setNotificationHandler(
        LoggingMessageNotificationSchema,
        async (notification) => {
          await this.server.sendLoggingMessage(notification.params);
        }
      );
    }

    // ── Notification forwarding (downstream → upstream) ───────────────
    // Forward roots/list_changed from downstream client to upstream server
    this.server.setNotificationHandler(
      RootsListChangedNotificationSchema,
      async () => {
        await this.client.sendRootsListChanged();
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
