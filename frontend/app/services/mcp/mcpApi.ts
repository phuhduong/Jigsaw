import { API_CONFIG } from "./config";
import { mockQuery, mockContinue } from "./mockImplementations";

export interface MCPQueryRequest {
  query: string;
}

export interface MCPQueryResponse {
  type: "response" | "context_request";
  queryId?: string;
  requestId?: string;
  message: string;
  response?: string;
}

export interface MCPContinueRequest {
  context: string;
  queryId: string;
}

export interface MCPContinueResponse {
  type: "response" | "context_request";
  queryId?: string;
  requestId?: string;
  message: string;
  response?: string;
}

export interface MCPApiConfig {
  baseUrl: string;
  queryEndpoint: string;
  continueEndpoint: string;
  timeout?: number;
}

const defaultConfig: MCPApiConfig = {
  baseUrl: "http://localhost:3001",
  queryEndpoint: "/mcp/query",
  continueEndpoint: "/mcp/continue",
  timeout: 30000,
};

async function realQuery(
  request: MCPQueryRequest,
  config: MCPApiConfig,
  signal?: AbortSignal
): Promise<MCPQueryResponse> {
  const controller = signal ? undefined : new AbortController();
  const abortSignal = signal || controller?.signal;
  const timeoutId = config.timeout ? setTimeout(() => controller?.abort(), config.timeout) : null;

  try {
    const response = await fetch(`${config.baseUrl}${config.queryEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: abortSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    return await response.json();
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error.name === "AbortError") throw new Error("Request timeout or cancelled");
    if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
      throw new Error(
        `Failed to connect to backend at ${config.baseUrl}. Make sure the backend is running.`
      );
    }
    throw error;
  }
}

async function realContinue(
  request: MCPContinueRequest,
  config: MCPApiConfig,
  signal?: AbortSignal
): Promise<MCPContinueResponse> {
  const controller = signal ? undefined : new AbortController();
  const abortSignal = signal || controller?.signal;
  const timeoutId = config.timeout ? setTimeout(() => controller?.abort(), config.timeout) : null;

  try {
    const response = await fetch(`${config.baseUrl}${config.continueEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: abortSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    return await response.json();
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error.name === "AbortError") throw new Error("Request timeout or cancelled");
    if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
      throw new Error(
        `Failed to connect to backend at ${config.baseUrl}. Make sure the backend is running.`
      );
    }
    throw error;
  }
}

class MCPApiService {
  private config: MCPApiConfig;
  private useMock: boolean;

  constructor(config?: Partial<MCPApiConfig>, useMock: boolean = false) {
    this.config = { ...defaultConfig, ...config };
    this.useMock = useMock;
  }

  async sendQuery(query: string, signal?: AbortSignal): Promise<MCPQueryResponse> {
    const request: MCPQueryRequest = { query };
    return this.useMock ? mockQuery(request, this.config) : realQuery(request, this.config, signal);
  }

  async sendContext(
    context: string,
    queryId: string,
    signal?: AbortSignal
  ): Promise<MCPContinueResponse> {
    const request: MCPContinueRequest = { context, queryId };
    return this.useMock
      ? mockContinue(request, this.config)
      : realContinue(request, this.config, signal);
  }

  updateConfig(config: Partial<MCPApiConfig>) {
    this.config = { ...this.config, ...config };
  }

  setUseMock(useMock: boolean) {
    this.useMock = useMock;
  }
}

export const mcpApi = new MCPApiService(
  { baseUrl: API_CONFIG.baseUrl },
  API_CONFIG.useMock
);

export { MCPApiService };
