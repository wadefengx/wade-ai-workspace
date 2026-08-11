"use client";

import { DeleteOutlined, PlusOutlined, RobotOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Collapse, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { ApiError, apiFetch, unwrapItems } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { EmptyState, LoadingState } from "./ui-state";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import styles from "./workspace-pages.module.css";

type AgentType = "OLLAMA" | "OPENAI_COMPATIBLE" | "ANTHROPIC" | "OPENCLAW" | "HERMES";
type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
type GlobalUserRole = "USER" | "ADMIN";

type AgentItem = {
  id: string;
  name: string;
  type: AgentType;
  engineType: string;
  isDefault: boolean;
  providerConfig: {
    baseUrl?: string | null;
    model?: string | null;
    hasApiKey?: boolean;
  } | null;
  embeddingModel?: string | null;
  embeddingBaseUrl?: string | null;
  emoji?: string | null;
  role?: string | null;
  description?: string | null;
  systemPrompt?: string | null;
  harness?: string;
};

type AgentFormValues = {
  type: AgentType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  emoji: string;
  role: string;
  description: string;
  systemPrompt: string;
  harness: string;
  embeddingModel: string;
  embeddingBaseUrl: string;
};

type CreateAgentValues = {
  name: string;
  type: AgentType;
  emoji?: string;
  role?: string;
  description?: string;
  systemPrompt?: string;
  harness?: string;
};

const agentKeys = {
  list: (workspaceId: string | null) => ["workspaces", workspaceId, "agents"] as const
};

const typeOptions = [
  { label: "ollama", value: "OLLAMA" },
  { label: "openai-compatible", value: "OPENAI_COMPATIBLE" },
  { label: "anthropic", value: "ANTHROPIC" },
  { label: "openclaw", value: "OPENCLAW" },
  { label: "hermes", value: "HERMES" }
] satisfies Array<{ label: string; value: AgentType }>;

const providerPresets = [
  {
    key: "openai",
    label: "OpenAI",
    type: "OPENAI_COMPATIBLE" as AgentType,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    harness: "OPENAI",
    hint: "Requires an API key"
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    type: "OPENAI_COMPATIBLE" as AgentType,
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    harness: "OPENAI",
    hint: "Requires an API key"
  },
  {
    key: "ollama",
    label: "Ollama",
    type: "OLLAMA" as AgentType,
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen3:8b",
    harness: "OLLAMA",
    hint: "Requires Ollama running locally"
  },
  {
    key: "claude",
    label: "Claude",
    type: "ANTHROPIC" as AgentType,
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    harness: "ANTHROPIC",
    hint: "Requires an API key"
  },
  {
    key: "openclaw",
    label: "OpenClaw",
    type: "OPENCLAW" as AgentType,
    baseUrl: "http://localhost:18789/v1",
    model: "openclaw-7b",
    harness: "OPENCLAW",
    hint: "Requires OpenClaw running locally (openclaw gateway)"
  },
  {
    key: "hermes",
    label: "Hermes",
    type: "HERMES" as AgentType,
    baseUrl: "http://localhost:9119/v1",
    model: "hermes-3-llama-3.1-8b",
    harness: "HERMES",
    hint: "Requires Hermes running locally (hermes serve)"
  }
] as const;

const expertPresets = [
  {
    key: "default",
    emoji: "🤖",
    name: "Default Assistant",
    role: "General Assistant",
    description: "Answers general questions and helps with everyday communication and information retrieval.",
    systemPrompt: "You are the workspace default AI assistant. Provide accurate, concise, helpful answers in English."
  },
  {
    key: "architect",
    emoji: "🧠",
    name: "Architect",
    role: "Senior Architect",
    description: "Handles system design, technology selection, architecture reviews, and refactoring recommendations.",
    systemPrompt: "You are a senior systems architect skilled at balancing scalability, maintainability, and cost. Provide structured architecture recommendations."
  },
  {
    key: "designer",
    emoji: "🎨",
    name: "Designer",
    role: "Product/UI Designer",
    description: "Handles interaction design, visual standards, and user experience improvement recommendations.",
    systemPrompt: "You are a product and UI designer skilled in interaction design, visual standards, and usability improvements. Provide specific, actionable design recommendations."
  },
  {
    key: "frontend",
    emoji: "🔧",
    name: "Frontend Engineer",
    role: "Senior Frontend Engineer",
    description: "Specializes in React, Next.js, performance optimization, and frontend engineering.",
    systemPrompt: "You are a senior frontend engineer skilled in React, Next.js, performance optimization, and frontend engineering. Provide practical, code-level recommendations."
  },
  {
    key: "backend",
    emoji: "⚙️",
    name: "Backend Engineer",
    role: "Senior Backend Engineer",
    description: "Specializes in server architecture, database design, and API implementation.",
    systemPrompt: "You are a senior backend engineer skilled in server architecture, database design, and API implementation. Provide rigorous, practical solutions."
  },
  {
    key: "qa",
    emoji: "✅",
    name: "QA Engineer",
    role: "QA Test Engineer",
    description: "Handles test-case design, defect analysis, and quality-assurance recommendations.",
    systemPrompt: "You are a QA test engineer skilled in test-case design, defect analysis, and quality assurance. Provide rigorous, comprehensive testing recommendations."
  }
] as const;


function getTypeLabel(type: AgentType) {
  return typeOptions.find((option) => option.value === type)?.label ?? type;
}

function getDefaultBaseUrl(type: AgentType) {
  if (type === "OPENCLAW") {
    return "http://localhost:3456/v1";
  }

  if (type === "HERMES") {
    return "http://localhost:8714/v1";
  }

  return "";
}

function getBaseUrlPlaceholder(type: AgentType) {
  if (type === "OLLAMA") {
    return "Leave blank to use the default Ollama endpoint, e.g. http://127.0.0.1:11434/v1";
  }

  if (type === "ANTHROPIC") {
    return "e.g. https://api.anthropic.com";
  }

  if (type === "OPENCLAW" || type === "HERMES") {
    return getDefaultBaseUrl(type);
  }

  return "e.g. https://api.openai.com/v1";
}

function getModelPlaceholder(type: AgentType) {
  if (type === "OLLAMA") {
    return "Leave blank to use the default model, e.g. qwen3:8b";
  }

  if (type === "ANTHROPIC") {
    return "e.g. claude-sonnet-4-20250514";
  }

  if (type === "OPENCLAW") {
    return "e.g. openclaw-7b";
  }

  if (type === "HERMES") {
    return "e.g. hermes-3-llama-3.1-8b";
  }

  return "e.g. gpt-4o-mini";
}

function supportsApiKey(type: AgentType) {
  return type === "OPENAI_COMPATIBLE" || type === "ANTHROPIC";
}

function getTypeTagColor(type: AgentType) {
  if (type === "OLLAMA") {
    return "geekblue";
  }

  if (type === "ANTHROPIC") {
    return "magenta";
  }

  if (type === "OPENCLAW" || type === "HERMES") {
    return "purple";
  }

  return "blue";
}

async function fetchAgents(workspaceId: string) {
  return unwrapItems(await apiFetch<AgentItem[] | { items: AgentItem[] }>(`/workspaces/${workspaceId}/agents`));
}

function AgentConfigCard({
  agent,
  isSaving,
  isDeleting,
  isTesting,
  canManageAgents,
  onSave,
  onDelete,
  onTest
}: {
  agent: AgentItem;
  isSaving: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  canManageAgents: boolean;
  onSave: (payload: { agentId: string; values: AgentFormValues }) => void;
  onDelete: (agentId: string) => void;
  onTest: (agentId: string) => void;
}) {
  const [form] = Form.useForm<AgentFormValues>();
  const [agentType, setAgentType] = useState<AgentType>(agent.type);

  function handleTypeChange(nextType: AgentType) {
    setAgentType(nextType);
    form.setFieldValue("type", nextType);

    const currentBaseUrl = form.getFieldValue("baseUrl")?.trim() ?? "";
    const nextDefaultBaseUrl = getDefaultBaseUrl(nextType);

    if (!currentBaseUrl && nextDefaultBaseUrl) {
      form.setFieldValue("baseUrl", nextDefaultBaseUrl);
    }

    if (!supportsApiKey(nextType)) {
      form.setFieldValue("apiKey", "");
    }

    void form.validateFields(["baseUrl"]);
  }

  return (
    <div className={styles.agentConfigCard}>
      <div className={`${styles.agentConfigHeader} ${styles.summaryCardHeader}`}>
        <div className={styles.helperStack}>
          <Typography.Title level={5}>
            {agent.emoji ? `${agent.emoji} ` : ""}
            {agent.name}
          </Typography.Title>
          <Typography.Text type="secondary">
            {agent.role ? `${agent.role} · ` : ""}
            {agent.engineType} · Configuration changes take effect immediately.
          </Typography.Text>
        </div>
        <Space wrap>
          {agent.isDefault ? <Tag color="blue">DEFAULT</Tag> : null}
          <Tag color="default">harness: {agent.harness ?? "OLLAMA"}</Tag>
          <Popconfirm
            title="Delete agent?"
            description="The current workspace’s custom provider configuration will not be retained."
            okText="Delete"
            cancelText="Cancel"
            disabled={agent.isDefault || !canManageAgents}
            onConfirm={() => onDelete(agent.id)}
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={agent.isDefault || !canManageAgents}
              loading={isDeleting}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: agent.type,
          baseUrl: agent.providerConfig?.baseUrl ?? "",
          model: agent.providerConfig?.model ?? "",
          apiKey: "",
          emoji: agent.emoji ?? "",
          role: agent.role ?? "",
          description: agent.description ?? "",
          systemPrompt: agent.systemPrompt ?? "",
          embeddingModel: agent.embeddingModel ?? "",
          embeddingBaseUrl: agent.embeddingBaseUrl ?? ""
        }}
        onFinish={(values) =>
          onSave({
            agentId: agent.id,
            values
          })
        }
      >
        <Form.Item label="type" name="type" rules={[{ required: true, message: "Select an agent type" }]}>
          <Select options={typeOptions} onChange={(value) => handleTypeChange(value as AgentType)} />
        </Form.Item>

        <Form.Item label="Provider preset">
          <Space wrap>
            {providerPresets.map((preset) => (
              <Button
                key={preset.key}
                size="small"
                title={preset.hint}
                onClick={() => {
                  handleTypeChange(preset.type);
                  form.setFieldsValue({
                    type: preset.type,
                    baseUrl: preset.baseUrl,
                    model: preset.model,
                    harness: preset.harness ?? "OLLAMA"
                  });
                }}
              >
                {preset.label}
                <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
                  ({preset.hint})
                </Typography.Text>
              </Button>
            ))}
          </Space>
        </Form.Item>

        <Form.Item
          label="baseUrl"
          name="baseUrl"
          rules={[
            {
              validator: async (_, value: string) => {
                if (agentType !== "OLLAMA" && !(value ?? "").trim()) {
                  throw new Error("This type requires a baseUrl");
                }
              }
            }
          ]}
        >
          <Input placeholder={getBaseUrlPlaceholder(agentType)} />
        </Form.Item>

        <Form.Item label="model" name="model">
          <Input placeholder={getModelPlaceholder(agentType)} />
        </Form.Item>

        {supportsApiKey(agentType) ? (
          <Form.Item label="apiKey" name="apiKey">
            <Input.Password placeholder={agent.providerConfig?.hasApiKey ? "Saved; leave blank to keep unchanged" : "Enter a new API key"} />
          </Form.Item>
        ) : null}

        <Form.Item label="emoji" name="emoji">
          <Input placeholder="e.g. 🧠" maxLength={8} />
        </Form.Item>

        <Form.Item label="Role" name="role">
          <Input placeholder="e.g. Senior Frontend Engineer" />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <Input.TextArea placeholder="Briefly describe what this expert can do" autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <Form.Item label="systemPrompt" name="systemPrompt">
          <Input.TextArea placeholder="Leave blank to use the default system prompt" autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>

        <Form.Item label="Harness (runtime)" name="harness" initialValue="OLLAMA">
          <Select
            placeholder="Select a harness runtime"
            options={[
              { label: "OLLAMA (local)", value: "OLLAMA" },
              { label: "OPENAI（API）", value: "OPENAI" },
              { label: "ANTHROPIC（API）", value: "ANTHROPIC" },
              { label: "HERMES（hermes serve :9119）", value: "HERMES" },
              { label: "OPENCLAW（openclaw gateway :18789）", value: "OPENCLAW" }
            ]}
          />
        </Form.Item>

        <Collapse
          ghost
          items={[
            {
              key: "embedding",
              label: "Embedding configuration (optional; defaults to the chat provider)",
              children: (
                <>
                  <Form.Item
                    label="embeddingBaseUrl"
                    name="embeddingBaseUrl"
                    tooltip="Leave blank to use the chat provider’s baseUrl (or local Ollama)"
                  >
                    <Input placeholder="e.g. https://api.openai.com/v1" />
                  </Form.Item>
                  <Form.Item
                    label="embeddingModel"
                    name="embeddingModel"
                    tooltip="Leave blank to use the default embedding model"
                  >
                    <Input placeholder="e.g. text-embedding-3-small or nomic-embed-text" />
                  </Form.Item>
                </>
              )
            }
          ]}
        />

        <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
          Save configuration
        </Button>
        <Button
          style={{ marginLeft: 8 }}
          loading={isTesting}
          onClick={() => onTest(agent.id)}
        >
          Test connection
        </Button>
      </Form>
    </div>
  );
}

function AgentsContent() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const { workspaceId, members } = useWorkspacePageContext();
  const [createForm] = Form.useForm<CreateAgentValues>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const agentsQuery = useQuery({
    queryKey: agentKeys.list(workspaceId),
    queryFn: () => fetchAgents(workspaceId as string),
    enabled: !!workspaceId
  });

  const currentWorkspaceRole = useMemo<WorkspaceRole | null>(() => {
    const role = members.find((member) => member.userId === user?.id)?.role;
    return role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? role : null;
  }, [members, user?.id]);
  const userRole = ((user as { role?: GlobalUserRole } | null)?.role ?? "USER") as GlobalUserRole;
  const canManageAgents = userRole === "ADMIN" || currentWorkspaceRole === "OWNER" || currentWorkspaceRole === "ADMIN";

  const saveMutation = useMutation({
    mutationFn: ({ agentId, values }: { agentId: string; values: AgentFormValues }) => {
      const trimmedBaseUrl = values.baseUrl.trim();
      const trimmedModel = values.model.trim();
      const trimmedApiKey = (values.apiKey ?? "").trim();
      const providerConfig: {
        baseUrl?: string;
        model?: string;
        apiKey?: string;
      } = {};

      if (trimmedBaseUrl) {
        providerConfig.baseUrl = trimmedBaseUrl;
      }

      if (trimmedModel) {
        providerConfig.model = trimmedModel;
      }

      if (trimmedApiKey) {
        providerConfig.apiKey = trimmedApiKey;
      }

      return apiFetch(`/agents/${agentId}`, {
        method: "PATCH",
        body: {
          type: values.type,
          providerConfig,
          emoji: values.emoji?.trim() ?? "",
          role: values.role?.trim() ?? "",
          description: values.description?.trim() ?? "",
          systemPrompt: values.systemPrompt?.trim() ?? "",
          embeddingModel: values.embeddingModel?.trim() ?? "",
          embeddingBaseUrl: values.embeddingBaseUrl?.trim() ?? ""
        }
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) });
      message.success("Agent configuration saved");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to save agent configuration");
    }
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateAgentValues) => {
      if (!workspaceId) {
        throw new Error("Workspace is required");
      }

      return apiFetch(`/workspaces/${workspaceId}/agents`, {
        method: "POST",
        body: values
      });
    },
    onSuccess: async () => {
      setIsCreateModalOpen(false);
      createForm.resetFields();
      createForm.setFieldValue("type", "OPENAI_COMPATIBLE");
      await queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) });
      message.success("Agent created");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to create agent");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId: string) =>
      apiFetch(`/agents/${agentId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) });
      message.success("Agent deleted");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to delete agent");
    }
  });

  const testMutation = useMutation({
    mutationFn: (agentId: string) =>
      apiFetch<{ ok: boolean; message: string }>(`/agents/${agentId}/test`, {
        method: "POST"
      }),
    onSuccess: (result) => {
      if (result.ok) {
        message.success(result.message || "Connection successful");
      } else {
        message.error(result.message || "Connection failed");
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Connection test failed");
    }
  });

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const summaryCards = useMemo(
    () =>
      agents.map((agent) => {
        const providerConfig = agent.providerConfig ?? {};

        return (
          <div key={agent.id} className={styles.summaryCard}>
            <div className={styles.summaryCardHeader}>
              <div className={styles.summaryMeta}>
                <Typography.Text strong>
                  {agent.emoji ? `${agent.emoji} ` : ""}
                  {agent.name}
                </Typography.Text>
                <Typography.Text type="secondary">{agent.role || agent.engineType}</Typography.Text>
              </div>
              {agent.isDefault ? <Tag color="blue">DEFAULT</Tag> : null}
            </div>
            <div className={styles.metaRow}>
              <Tag color={getTypeTagColor(agent.type)}>{getTypeLabel(agent.type)}</Tag>
              <Tag color="default">harness: {agent.harness ?? "OLLAMA"}</Tag>
              {providerConfig.hasApiKey ? <Tag color="success">API key saved</Tag> : null}
            </div>
            {agent.description ? (
              <Typography.Text type="secondary">{agent.description}</Typography.Text>
            ) : null}
            <div className={styles.agentMeta}>
              <Typography.Text type="secondary">baseUrl：{providerConfig.baseUrl?.trim() || "Using default"}</Typography.Text>
              <Typography.Text type="secondary">model：{providerConfig.model?.trim() || "Using default"}</Typography.Text>
            </div>
          </div>
        );
      }),
    [agents]
  );

  if (agentsQuery.isLoading) {
    return (
      <div className={styles.pageCard}>
        <LoadingState compact title="Loading agents" description="Syncing the default agent and provider configuration." />
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Default agent</Typography.Title>
            <Typography.Text type="secondary">
              Configuration changes take effect immediately. Different types use their matching provider protocol, and presets quickly fill common values.
            </Typography.Text>
          </div>
          {canManageAgents ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setIsCreateModalOpen(true);
                createForm.setFieldsValue({ name: "", type: "OPENAI_COMPATIBLE" });
              }}
            >
              Add agent
            </Button>
          ) : null}
        </div>

        {agents.length ? (
          <div className={styles.summaryGrid}>{summaryCards}</div>
        ) : (
          <EmptyState compact icon={<RobotOutlined />} title="No configurable agents yet" description="Create an agent to override model and provider settings by workspace." />
        )}
      </div>

      {agents.length ? (
        <div className={styles.pageCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.helperStack}>
              <Typography.Title level={5}>Provider configuration</Typography.Title>
              <Typography.Text type="secondary">Leave blank to keep server defaults; apiKey is write-only and is never shown again.</Typography.Text>
            </div>
          </div>

          <div className={styles.agentGrid}>
            {agents.map((agent) => (
              <AgentConfigCard
                key={`${agent.id}:${agent.type}:${agent.providerConfig?.baseUrl ?? ""}:${agent.providerConfig?.model ?? ""}:${agent.providerConfig?.hasApiKey ? 1 : 0}:${agent.emoji ?? ""}:${agent.role ?? ""}:${agent.description ?? ""}:${agent.systemPrompt ?? ""}:${agent.embeddingModel ?? ""}:${agent.embeddingBaseUrl ?? ""}`}
                agent={agent}
                isSaving={saveMutation.isPending && saveMutation.variables?.agentId === agent.id}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === agent.id}
                isTesting={testMutation.isPending && testMutation.variables === agent.id}
                canManageAgents={canManageAgents}
                onSave={(payload) => saveMutation.mutate(payload)}
                onDelete={(agentId) => deleteMutation.mutate(agentId)}
                onTest={(agentId) => testMutation.mutate(agentId)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <Modal
        destroyOnHidden
        open={isCreateModalOpen}
        title="Add agent"
        okText="Create"
        cancelText="Cancel"
        confirmLoading={createMutation.isPending}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ name: "", type: "OPENAI_COMPATIBLE", emoji: "", role: "", description: "", systemPrompt: "" }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item label="Expert preset">
            <Space wrap>
              {expertPresets.map((preset) => (
                <Button
                  key={preset.key}
                  size="small"
                  onClick={() => {
                    createForm.setFieldsValue({
                      name: preset.name,
                      emoji: preset.emoji,
                      role: preset.role,
                      description: preset.description,
                      systemPrompt: preset.systemPrompt
                    });
                  }}
                >
                  {preset.emoji} {preset.name}
                </Button>
              ))}
            </Space>
          </Form.Item>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter an agent name" }]}>
            <Input placeholder="e.g. DeepSeek Assistant" />
          </Form.Item>
          <Form.Item label="type" name="type" rules={[{ required: true, message: "Select an agent type" }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item label="emoji" name="emoji">
            <Input placeholder="e.g. 🧠" maxLength={8} />
          </Form.Item>
          <Form.Item label="Role" name="role">
            <Input placeholder="e.g. Senior Frontend Engineer" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea placeholder="Briefly describe what this expert can do" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="systemPrompt" name="systemPrompt">
            <Input.TextArea placeholder="Leave blank to use the default system prompt" autoSize={{ minRows: 2, maxRows: 6 }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function AgentsPage() {
  return (
    <WorkspacePageFrame
      title="Agents"
      description="View the default agent’s engine and provider configuration, and override model settings by workspace."
    >
      <AgentsContent />
    </WorkspacePageFrame>
  );
}
