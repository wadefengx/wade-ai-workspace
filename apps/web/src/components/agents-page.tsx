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
    hint: "需要 API Key"
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    type: "OPENAI_COMPATIBLE" as AgentType,
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    harness: "OPENAI",
    hint: "需要 API Key"
  },
  {
    key: "ollama",
    label: "Ollama",
    type: "OLLAMA" as AgentType,
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen3:8b",
    harness: "OLLAMA",
    hint: "需要本地运行 ollama"
  },
  {
    key: "claude",
    label: "Claude",
    type: "ANTHROPIC" as AgentType,
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    harness: "ANTHROPIC",
    hint: "需要 API Key"
  },
  {
    key: "openclaw",
    label: "OpenClaw",
    type: "OPENCLAW" as AgentType,
    baseUrl: "http://localhost:18789/v1",
    model: "openclaw-7b",
    harness: "OPENCLAW",
    hint: "需要本地运行 OpenClaw (openclaw gateway)"
  },
  {
    key: "hermes",
    label: "Hermes",
    type: "HERMES" as AgentType,
    baseUrl: "http://localhost:9119/v1",
    model: "hermes-3-llama-3.1-8b",
    harness: "HERMES",
    hint: "需要本地运行 Hermes (hermes serve)"
  }
] as const;

const expertPresets = [
  {
    key: "default",
    emoji: "🤖",
    name: "默认助手",
    role: "通用助手",
    description: "回答通用问题，协助日常沟通与信息检索。",
    systemPrompt: "你是工作区默认 AI 助手，请提供准确、简洁、有帮助的中文回答。"
  },
  {
    key: "architect",
    emoji: "🧠",
    name: "架构师",
    role: "资深架构师",
    description: "负责系统设计、技术选型、架构评审与重构建议。",
    systemPrompt: "你是一名资深系统架构师，擅长权衡可扩展性、可维护性与成本，给出结构化的架构建议。"
  },
  {
    key: "designer",
    emoji: "🎨",
    name: "设计师",
    role: "产品/UI 设计师",
    description: "负责交互设计、视觉规范与用户体验优化建议。",
    systemPrompt: "你是一名产品与 UI 设计师，擅长交互设计、视觉规范与可用性优化，请给出具体可执行的设计建议。"
  },
  {
    key: "frontend",
    emoji: "🔧",
    name: "前端工程师",
    role: "资深前端工程师",
    description: "擅长 React/Next.js/性能优化与前端工程化。",
    systemPrompt: "你是一名资深前端工程师，擅长 React、Next.js、性能优化与前端工程化，请给出可落地的代码级建议。"
  },
  {
    key: "backend",
    emoji: "⚙️",
    name: "后端工程师",
    role: "资深后端工程师",
    description: "擅长服务端架构、数据库设计与 API 实现。",
    systemPrompt: "你是一名资深后端工程师，擅长服务端架构、数据库设计与 API 实现，请给出严谨、可落地的方案。"
  },
  {
    key: "qa",
    emoji: "✅",
    name: "QA工程师",
    role: "QA 测试工程师",
    description: "负责测试用例设计、缺陷分析与质量保障建议。",
    systemPrompt: "你是一名 QA 测试工程师，擅长测试用例设计、缺陷分析与质量保障，请给出严谨全面的测试建议。"
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
    return "留空使用默认 Ollama，例如 http://127.0.0.1:11434/v1";
  }

  if (type === "ANTHROPIC") {
    return "例如 https://api.anthropic.com";
  }

  if (type === "OPENCLAW" || type === "HERMES") {
    return getDefaultBaseUrl(type);
  }

  return "例如 https://api.openai.com/v1";
}

function getModelPlaceholder(type: AgentType) {
  if (type === "OLLAMA") {
    return "留空使用默认模型，例如 qwen3:8b";
  }

  if (type === "ANTHROPIC") {
    return "例如 claude-sonnet-4-20250514";
  }

  if (type === "OPENCLAW") {
    return "例如 openclaw-7b";
  }

  if (type === "HERMES") {
    return "例如 hermes-3-llama-3.1-8b";
  }

  return "例如 gpt-4o-mini";
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
            {agent.engineType} · 配置保存后即时生效。
          </Typography.Text>
        </div>
        <Space wrap>
          {agent.isDefault ? <Tag color="blue">DEFAULT</Tag> : null}
          <Tag color="default">harness: {agent.harness ?? "OLLAMA"}</Tag>
          <Popconfirm
            title="删除 Agent？"
            description="删除后不会保留当前 Workspace 的自定义 Provider 配置。"
            okText="删除"
            cancelText="取消"
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
              删除
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
        <Form.Item label="type" name="type" rules={[{ required: true, message: "请选择 Agent 类型" }]}>
          <Select options={typeOptions} onChange={(value) => handleTypeChange(value as AgentType)} />
        </Form.Item>

        <Form.Item label="Provider 预设">
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
                  throw new Error("当前类型需要填写 baseUrl");
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
            <Input.Password placeholder={agent.providerConfig?.hasApiKey ? "已保存,留空保持不变" : "输入新的 API Key"} />
          </Form.Item>
        ) : null}

        <Form.Item label="emoji" name="emoji">
          <Input placeholder="例如 🧠" maxLength={8} />
        </Form.Item>

        <Form.Item label="role（角色名）" name="role">
          <Input placeholder="例如 资深前端工程师" />
        </Form.Item>

        <Form.Item label="description（我能做什么）" name="description">
          <Input.TextArea placeholder="简要描述该专家能做什么" autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <Form.Item label="systemPrompt" name="systemPrompt">
          <Input.TextArea placeholder="留空使用默认 system prompt" autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>

        <Form.Item label="harness（运行环境）" name="harness" initialValue="OLLAMA">
          <Select
            placeholder="选择 harness 运行环境"
            options={[
              { label: "OLLAMA（本地）", value: "OLLAMA" },
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
              label: "Embedding 配置（可选，默认跟随 chat provider）",
              children: (
                <>
                  <Form.Item
                    label="embeddingBaseUrl"
                    name="embeddingBaseUrl"
                    tooltip="留空则跟随 chat provider 的 baseUrl（或本地 Ollama）"
                  >
                    <Input placeholder="例如 https://api.openai.com/v1" />
                  </Form.Item>
                  <Form.Item
                    label="embeddingModel"
                    name="embeddingModel"
                    tooltip="留空则使用默认 embedding 模型"
                  >
                    <Input placeholder="例如 text-embedding-3-small 或 nomic-embed-text" />
                  </Form.Item>
                </>
              )
            }
          ]}
        />

        <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
          保存配置
        </Button>
        <Button
          style={{ marginLeft: 8 }}
          loading={isTesting}
          onClick={() => onTest(agent.id)}
        >
          测试连接
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
      message.success("Agent 配置已保存");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "保存 Agent 配置失败");
    }
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateAgentValues) => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
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
      message.success("Agent 已创建");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "创建 Agent 失败");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId: string) =>
      apiFetch(`/agents/${agentId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) });
      message.success("Agent 已删除");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "删除 Agent 失败");
    }
  });

  const testMutation = useMutation({
    mutationFn: (agentId: string) =>
      apiFetch<{ ok: boolean; message: string }>(`/agents/${agentId}/test`, {
        method: "POST"
      }),
    onSuccess: (result) => {
      if (result.ok) {
        message.success(result.message || "连接成功");
      } else {
        message.error(result.message || "连接失败");
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "测试连接失败");
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
              {providerConfig.hasApiKey ? <Tag color="success">API Key 已保存</Tag> : null}
            </div>
            {agent.description ? (
              <Typography.Text type="secondary">{agent.description}</Typography.Text>
            ) : null}
            <div className={styles.agentMeta}>
              <Typography.Text type="secondary">baseUrl：{providerConfig.baseUrl?.trim() || "使用默认值"}</Typography.Text>
              <Typography.Text type="secondary">model：{providerConfig.model?.trim() || "使用默认值"}</Typography.Text>
            </div>
          </div>
        );
      }),
    [agents]
  );

  if (agentsQuery.isLoading) {
    return (
      <div className={styles.pageCard}>
        <LoadingState compact title="正在读取 Agents" description="同步默认 Agent 与 Provider 配置。" />
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>默认 Agent</Typography.Title>
            <Typography.Text type="secondary">
              配置即时生效；不同 type 会切换对应 Provider 协议，预设按钮可快速填充常用参数。
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
              新增 Agent
            </Button>
          ) : null}
        </div>

        {agents.length ? (
          <div className={styles.summaryGrid}>{summaryCards}</div>
        ) : (
          <EmptyState compact icon={<RobotOutlined />} title="还没有可配置的 Agent" description="创建一个 Agent 后，就能按 Workspace 覆盖模型和 Provider 参数。" />
        )}
      </div>

      {agents.length ? (
        <div className={styles.pageCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.helperStack}>
              <Typography.Title level={5}>Provider 配置</Typography.Title>
              <Typography.Text type="secondary">留空时继续使用服务端默认值；apiKey 仅写入，不会再次回显。</Typography.Text>
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
        title="新增 Agent"
        okText="创建"
        cancelText="取消"
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
          <Form.Item label="专家预设">
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
          <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入 Agent 名称" }]}>
            <Input placeholder="例如 DeepSeek Assistant" />
          </Form.Item>
          <Form.Item label="type" name="type" rules={[{ required: true, message: "请选择 Agent 类型" }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item label="emoji" name="emoji">
            <Input placeholder="例如 🧠" maxLength={8} />
          </Form.Item>
          <Form.Item label="role（角色名）" name="role">
            <Input placeholder="例如 资深前端工程师" />
          </Form.Item>
          <Form.Item label="description（我能做什么）" name="description">
            <Input.TextArea placeholder="简要描述该专家能做什么" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="systemPrompt" name="systemPrompt">
            <Input.TextArea placeholder="留空使用默认 system prompt" autoSize={{ minRows: 2, maxRows: 6 }} />
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
      description="查看默认 Agent 的引擎与 Provider 配置，并按 Workspace 覆盖模型参数。"
    >
      <AgentsContent />
    </WorkspacePageFrame>
  );
}
