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

let mockQueryIdCounter = 0;
const mockActiveQueries = new Map<
  string,
  { query: string; timestamp: number }
>();

async function mockQuery(
  request: MCPQueryRequest,
  config: MCPApiConfig
): Promise<MCPQueryResponse> {
  await new Promise((resolve) =>
    setTimeout(resolve, 9000 + Math.random() * 11000)
  );

  const queryId = `query_${++mockQueryIdCounter}_${Date.now()}`;
  mockActiveQueries.set(queryId, {
    query: request.query,
    timestamp: Date.now(),
  });

  const shouldRequestContext = Math.random() > 0.5;

  if (shouldRequestContext) {
    return {
      type: "context_request",
      queryId,
      message: `I need more information to process your query: "${request.query}". Please provide additional context about your requirements.`,
    };
  } else {
    mockActiveQueries.delete(queryId);
    return {
      type: "response",
      message: `Response to: "${request.query}" failed. We are out of credits for one of our spec sheet provides. We are waiting to hear back to extend limits`,
    };
  }
}

async function mockContinue(
  request: MCPContinueRequest,
  config: MCPApiConfig
): Promise<MCPContinueResponse> {
  await new Promise((resolve) =>
    setTimeout(resolve, 9000 + Math.random() * 11000)
  );

  const queryData = mockActiveQueries.get(request.queryId);
  if (!queryData) {
    throw new Error("Query ID not found. It may have expired.");
  }

  const shouldRequestMoreContext = Math.random() > 0.7;

  if (shouldRequestMoreContext) {
    return {
      type: "context_request",
      queryId: request.queryId,
      message: `Thank you for the context. I need one more piece of information: What is your preferred budget range?`,
    };
  } else {
    mockActiveQueries.delete(request.queryId);
    return {
      type: "response",
      message: `Thank you for providing the context. Based on your query "${queryData.query}" and the context you provided, here is the final response.`,
    };
  }
}

async function realQuery(
  request: MCPQueryRequest,
  config: MCPApiConfig,
  signal?: AbortSignal
): Promise<MCPQueryResponse> {
  const controller = signal ? undefined : new AbortController();
  const abortSignal = signal || controller?.signal;

  const timeoutId = config.timeout
    ? setTimeout(() => controller?.abort(), config.timeout)
    : null;

  try {
    const url = `${config.baseUrl}${config.queryEndpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: abortSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data: MCPQueryResponse = await response.json();
    return data;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timeout or cancelled");
    }
    if (
      error.message?.includes("Failed to fetch") ||
      error.name === "TypeError"
    ) {
      const isConnectionRefused =
        error.message?.includes("ERR_CONNECTION_REFUSED") ||
        error.message?.includes("Connection refused");

      if (isConnectionRefused) {
        throw new Error(
          `Backend server at ${config.baseUrl} is not running. Please start your MCP backend server.`
        );
      } else {
        throw new Error(
          `Failed to connect to MCP server at ${config.baseUrl}. Make sure the backend is running and CORS is configured.`
        );
      }
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

  const timeoutId = config.timeout
    ? setTimeout(() => controller?.abort(), config.timeout)
    : null;

  try {
    const url = `${config.baseUrl}${config.continueEndpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: abortSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data: MCPContinueResponse = await response.json();
    return data;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timeout or cancelled");
    }
    if (
      error.message?.includes("Failed to fetch") ||
      error.name === "TypeError"
    ) {
      const isConnectionRefused =
        error.message?.includes("ERR_CONNECTION_REFUSED") ||
        error.message?.includes("Connection refused");

      if (isConnectionRefused) {
        throw new Error(
          `Backend server at ${config.baseUrl} is not running. Please start your MCP backend server.`
        );
      } else {
        throw new Error(
          `Failed to connect to MCP server at ${config.baseUrl}. Make sure the backend is running and CORS is configured.`
        );
      }
    }
    throw error;
  }
}

class MCPApiService {
  private config: MCPApiConfig;
  private useMock: boolean;

  constructor(config?: Partial<MCPApiConfig>, useMock: boolean = true) {
    this.config = { ...defaultConfig, ...config };
    this.useMock = useMock;
  }

  async sendQuery(
    query: string,
    signal?: AbortSignal
  ): Promise<MCPQueryResponse> {
    const request: MCPQueryRequest = { query };

    if (this.useMock) {
      return mockQuery(request, this.config);
    } else {
      return realQuery(request, this.config, signal);
    }
  }

  async sendContext(
    context: string,
    queryId: string,
    signal?: AbortSignal
  ): Promise<MCPContinueResponse> {
    const request: MCPContinueRequest = { context, queryId };

    if (this.useMock) {
      return mockContinue(request, this.config);
    } else {
      return realContinue(request, this.config, signal);
    }
  }

  updateConfig(config: Partial<MCPApiConfig>) {
    this.config = { ...this.config, ...config };
  }

  setUseMock(useMock: boolean) {
    this.useMock = useMock;
  }
}

function getMCPServerUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }
  try {
    const url = import.meta.env?.VITE_MCP_SERVER_URL || "http://localhost:3001";
    return url;
  } catch {
    return "http://localhost:3001";
  }
}

export const mcpApi = new MCPApiService(
  {
    baseUrl: undefined,
  },
  false
);

export { MCPApiService };
