"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Form, Input, Radio, Spin, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { ApiError, apiFetch, unwrapItems } from "../lib/api";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import styles from "./workspace-pages.module.css";

type ProviderType = "ollama" | "openai-compatible";

type AgentItem = {
  id: string;
  name: string;
  engineType: string;
  isDefault: boolean;
  providerConfig: {
    baseUrl?: string | null;
    model?: string | null;
    hasApiKey?: boolean;
  } | null;
};

type AgentFormValues = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

const agentKeys = {
  list: (workspaceId: string | null) => ["workspaces", workspaceId, "agents"] as const
};

function resolveProviderType(agent: AgentItem): ProviderType {
  return agent.providerConfig?.baseUrl?.trim() ? "openai-compatible" : "ollama";
}

async function fetchAgents(workspaceId: string) {
  return unwrapItems(await apiFetch<AgentItem[] | { items: AgentItem[] }>(`/workspaces/${workspaceId}/agents`));
}

function AgentConfigCard({
  agent,
  isSaving,
  onSave
}: {
  agent: AgentItem;
  isSaving: boolean;
  onSave: (payload: {
    agentId: string;
    providerType: ProviderType;
    values: AgentFormValues;
  }) => void;
}) {
  const [form] = Form.useForm<AgentFormValues>();
  const [providerType, setProviderType] = useState<ProviderType>(() => resolveProviderType(agent));

  const baseUrlPlaceholder =
    providerType === "ollama"
      ? "留空使用默认 Ollama：http://ollama:11434/v1/chat/completions"
      : "例如 https://api.openai.com/v1/chat/completions";
  const modelPlaceholder = providerType === "ollama" ? "留空使用默认模型，例如 llama3.2:3b" : "例如 gpt-4o-mini";
  const apiKeyPlaceholder = agent.providerConfig?.hasApiKey ? "已保存，留空保持不变" : "可选";

  function handleProviderTypeChange(nextType: ProviderType) {
    setProviderType(nextType);

    if (nextType === "ollama" && form.getFieldValue("baseUrl") === (agent.providerConfig?.baseUrl ?? "")) {
      form.setFieldValue("baseUrl", "");
    }

    void form.validateFields(["baseUrl"]);
  }

  return (
    <div className={styles.agentConfigCard}>
      <div className={styles.agentConfigHeader}>
        <Typography.Title level={5}>{agent.name}</Typography.Title>
        <Typography.Text type="secondary">
          {agent.engineType} · 配置保存后即时生效。
        </Typography.Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          baseUrl: agent.providerConfig?.baseUrl ?? "",
          model: agent.providerConfig?.model ?? "",
          apiKey: ""
        }}
        onFinish={(values) =>
          onSave({
            agentId: agent.id,
            providerType,
            values
          })
        }
      >
        <Form.Item label="Provider 类型">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            value={providerType}
            options={[
              { label: "ollama", value: "ollama" },
              { label: "openai-compatible", value: "openai-compatible" }
            ]}
            onChange={(event) => handleProviderTypeChange(event.target.value as ProviderType)}
          />
        </Form.Item>

        <Form.Item
          label="baseUrl"
          name="baseUrl"
          rules={[
            {
              validator: async (_, value: string) => {
                if (providerType === "openai-compatible" && !(value ?? "").trim()) {
                  throw new Error("远程 Provider 需要填写完整 baseUrl");
                }
              }
            }
          ]}
        >
          <Input placeholder={baseUrlPlaceholder} />
        </Form.Item>

        <Form.Item label="model" name="model">
          <Input placeholder={modelPlaceholder} />
        </Form.Item>

        <Form.Item label="apiKey" name="apiKey">
          <Input.Password placeholder={apiKeyPlaceholder} />
        </Form.Item>

        <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
          保存配置
        </Button>
      </Form>
    </div>
  );
}

function AgentsContent() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { workspaceId } = useWorkspacePageContext();
  const agentsQuery = useQuery({
    queryKey: agentKeys.list(workspaceId),
    queryFn: () => fetchAgents(workspaceId as string),
    enabled: !!workspaceId
  });

  const saveMutation = useMutation({
    mutationFn: ({
      agentId,
      providerType,
      values
    }: {
      agentId: string;
      providerType: ProviderType;
      values: AgentFormValues;
    }) => {
      const trimmedBaseUrl = values.baseUrl.trim();
      const trimmedModel = values.model.trim();
      const trimmedApiKey = values.apiKey.trim();
      const providerConfig: {
        baseUrl?: string;
        model?: string;
        apiKey?: string;
      } = {
        baseUrl: providerType === "ollama" ? trimmedBaseUrl : trimmedBaseUrl,
        model: trimmedModel
      };

      if (trimmedApiKey) {
        providerConfig.apiKey = trimmedApiKey;
      }

      return apiFetch(`/agents/${agentId}`, {
        method: "PATCH",
        body: { providerConfig }
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

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const summaryCards = useMemo(
    () =>
      agents.map((agent) => {
        const providerType = resolveProviderType(agent);
        const providerConfig = agent.providerConfig ?? {};

        return (
          <div key={agent.id} className={styles.summaryCard}>
            <div className={styles.summaryCardHeader}>
              <div className={styles.summaryMeta}>
                <Typography.Text strong>{agent.name}</Typography.Text>
                <Typography.Text type="secondary">{agent.engineType}</Typography.Text>
              </div>
              {agent.isDefault ? <Tag color="blue">DEFAULT</Tag> : null}
            </div>
            <div className={styles.metaRow}>
              <Tag color={providerType === "ollama" ? "geekblue" : "purple"}>{providerType}</Tag>
              {providerConfig.hasApiKey ? <Tag color="success">API Key 已保存</Tag> : null}
            </div>
            <div className={styles.agentMeta}>
              <Typography.Text type="secondary">
                baseUrl：{providerConfig.baseUrl?.trim() || "使用默认值"}
              </Typography.Text>
              <Typography.Text type="secondary">
                model：{providerConfig.model?.trim() || "使用默认值"}
              </Typography.Text>
            </div>
          </div>
        );
      }),
    [agents]
  );

  if (agentsQuery.isLoading) {
    return (
      <div className={styles.pageCard}>
        <div className={styles.loadingState}>
          <Spin />
        </div>
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
              配置即时生效；远程 Provider 需要填写完整 baseUrl，兼容以 /chat/completions 结尾的地址。
            </Typography.Text>
          </div>
        </div>

        {agents.length ? (
          <div className={styles.summaryGrid}>{summaryCards}</div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前 Workspace 还没有可配置的 Agent。" />
        )}
      </div>

      {agents.length ? (
        <div className={styles.pageCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.helperStack}>
              <Typography.Title level={5}>Provider 配置</Typography.Title>
              <Typography.Text type="secondary">
                留空时继续使用服务端默认值；apiKey 仅写入，不会再次回显。
              </Typography.Text>
            </div>
          </div>

          <div className={styles.agentGrid}>
            {agents.map((agent) => (
              <AgentConfigCard
                key={`${agent.id}:${agent.providerConfig?.baseUrl ?? ""}:${agent.providerConfig?.model ?? ""}:${agent.providerConfig?.hasApiKey ? 1 : 0}`}
                agent={agent}
                isSaving={saveMutation.isPending && saveMutation.variables?.agentId === agent.id}
                onSave={(payload) => saveMutation.mutate(payload)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AgentsPage() {
  return (
    <WorkspacePageFrame
      title="Agents"
      description="查看默认 Agent 的引擎与 Provider 配置，并按 Workspace 覆盖模型参数。"
      contextTitle="Agent Context"
      contextDescription="Workspace 级 Agent 配置会覆盖默认 Provider 环境变量，并立即影响后续 @AI 对话。"
    >
      <AgentsContent />
    </WorkspacePageFrame>
  );
}
