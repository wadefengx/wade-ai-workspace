export type AgentProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

export type AgentProviderConfigSummary = {
  baseUrl?: string;
  model?: string;
  hasApiKey: boolean;
};

export function parseAgentProviderConfigRef(providerConfigRef?: string | null): AgentProviderConfig {
  if (!providerConfigRef) {
    return {};
  }

  let payload: unknown;

  try {
    payload = JSON.parse(providerConfigRef);
  } catch {
    throw new Error("Invalid agent configuration format");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid agent configuration format");
  }

  const config = payload as Record<string, unknown>;

  return {
    baseUrl: readOptionalString(config.baseUrl),
    apiKey: readOptionalString(config.apiKey),
    model: readOptionalString(config.model)
  };
}

export function serializeAgentProviderConfig(config: AgentProviderConfig) {
  const normalizedConfig = {
    baseUrl: readOptionalString(config.baseUrl),
    apiKey: readOptionalString(config.apiKey),
    model: readOptionalString(config.model)
  };

  if (!hasAgentProviderConfig(normalizedConfig)) {
    return null;
  }

  return JSON.stringify(normalizedConfig);
}

export function summarizeAgentProviderConfig(config: AgentProviderConfig): AgentProviderConfigSummary {
  return {
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    ...(config.model ? { model: config.model } : {}),
    hasApiKey: Boolean(config.apiKey)
  };
}

export function hasAgentProviderConfig(config?: AgentProviderConfig) {
  return Boolean(config?.baseUrl || config?.apiKey || config?.model);
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
