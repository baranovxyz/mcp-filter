export interface FilterPattern {
  type: "include" | "exclude";
  pattern: string;
}

export type TransportType = "stdio" | "http" | "sse";

export interface StdioConfig {
  type: "stdio";
  command: string[];
  env?: Record<string, string>;
}

export interface HttpConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export interface SseConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export type TransportConfig = StdioConfig | HttpConfig | SseConfig;

export interface FilterConfig {
  patterns: FilterPattern[];
  transportConfig: TransportConfig;
}
