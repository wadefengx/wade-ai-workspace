"use client";

import { DeleteOutlined, EditOutlined, InboxOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Typography } from "antd";
import { useMemo, useState } from "react";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import { EmptyState, LoadingState } from "./ui-state";
import styles from "./workspace-pages.module.css";
import { ApiError, apiFetch, unwrapItems } from "../lib/api";
import { formatDateTime } from "../lib/datetime";

type MemoryType = "PERSONAL" | "TEAM" | "PROJECT";

type MemoryItem = {
  id: string;
  type: MemoryType;
  content: string;
  enabled: boolean;
  createdAt: string;
};

type CreateMemoryValues = {
  type: MemoryType;
  content: string;
};

type EditMemoryValues = {
  content: string;
};

const memoryKeys = {
  list: (workspaceId: string | null) => ["memories", workspaceId] as const
};

const memoryGroups: Array<{
  type: MemoryType;
  title: string;
  description: string;
  emptyText: string;
}> = [
  {
    type: "PERSONAL",
    title: "个人记忆",
    description: "仅自己可见，仅会注入你的个人上下文。",
    emptyText: "还没有个人记忆。"
  },
  {
    type: "TEAM",
    title: "团队记忆",
    description: "当前 Workspace 全体成员可见。",
    emptyText: "还没有团队记忆。"
  },
  {
    type: "PROJECT",
    title: "项目记忆",
    description: "适合沉淀项目背景、约束与长期约定。",
    emptyText: "还没有项目记忆。"
  }
];

async function fetchMemories(workspaceId: string) {
  return unwrapItems(await apiFetch<MemoryItem[] | { items: MemoryItem[] }>(`/workspaces/${workspaceId}/memories`));
}

function MemoryContent() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [createForm] = Form.useForm<CreateMemoryValues>();
  const [editForm] = Form.useForm<EditMemoryValues>();
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const { workspaceId } = useWorkspacePageContext();
  const memoriesQuery = useQuery({
    queryKey: memoryKeys.list(workspaceId),
    queryFn: () => fetchMemories(workspaceId as string),
    enabled: !!workspaceId
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateMemoryValues) => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
      }

      return apiFetch(`/workspaces/${workspaceId}/memories`, {
        method: "POST",
        body: values
      });
    },
    onSuccess: async () => {
      createForm.resetFields();
      createForm.setFieldValue("type", "PERSONAL");
      await queryClient.invalidateQueries({ queryKey: memoryKeys.list(workspaceId) });
      message.success("记忆已创建");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "创建记忆失败");
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ memoryId, enabled }: { memoryId: string; enabled: boolean }) =>
      apiFetch(`/memories/${memoryId}`, {
        method: "PATCH",
        body: { enabled }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memoryKeys.list(workspaceId) });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "更新记忆状态失败");
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ memoryId, content }: { memoryId: string; content: string }) =>
      apiFetch(`/memories/${memoryId}`, {
        method: "PATCH",
        body: { content }
      }),
    onSuccess: async () => {
      setEditingMemory(null);
      editForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: memoryKeys.list(workspaceId) });
      message.success("记忆已更新");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "更新记忆失败");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) =>
      apiFetch(`/memories/${memoryId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memoryKeys.list(workspaceId) });
      message.success("记忆已删除");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "删除记忆失败");
    }
  });

  const groupedMemories = useMemo(() => {
    const items = memoriesQuery.data ?? [];

    return memoryGroups.map((group) => ({
      ...group,
      items: items.filter((item) => item.type === group.type)
    }));
  }, [memoriesQuery.data]);

  return (
    <>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div>
            <Typography.Title level={5}>新建记忆</Typography.Title>
            <Typography.Paragraph type="secondary" className={styles.helperText}>
              个人记忆仅自己可见；团队/项目记忆对当前 Workspace 全体成员可见。
            </Typography.Paragraph>
          </div>
        </div>

        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ type: "PERSONAL", content: "" }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <div className={styles.formRow}>
            <Form.Item
              label="类型"
              name="type"
              className={styles.formTypeField}
              rules={[{ required: true, message: "请选择记忆类型" }]}
            >
              <Select
                options={memoryGroups.map((group) => ({
                  label: group.title,
                  value: group.type
                }))}
              />
            </Form.Item>
            <Form.Item
              label="内容"
              name="content"
              className={styles.formContentField}
              rules={[{ required: true, message: "请输入记忆内容" }]}
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder="例如：默认用中文回复；PRD 缩写统一指 Product Requirement Document。"
              />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            添加记忆
          </Button>
        </Form>
      </div>

      {memoriesQuery.isLoading ? (
        <div className={styles.pageCard}>
          <LoadingState compact title="正在读取记忆" description="同步个人、团队和项目记忆。" />
        </div>
      ) : (
        groupedMemories.map((group) => (
          <div key={group.type} className={styles.pageCard}>
            <div className={styles.sectionHeader}>
              <div>
                <Typography.Title level={5}>{group.title}</Typography.Title>
                <Typography.Text type="secondary">{group.description}</Typography.Text>
              </div>
            </div>

            {group.items.length ? (
              <div className={styles.memoryList}>
                {group.items.map((item) => (
                  <div key={item.id} className={styles.memoryItem}>
                    <div className={styles.memoryBody}>
                      <Typography.Paragraph className={styles.memoryContent}>{item.content}</Typography.Paragraph>
                      <Typography.Text type="secondary">{formatDateTime(item.createdAt)}</Typography.Text>
                    </div>

                    <div className={styles.memoryActions}>
                      <Space size={12} wrap>
                        <span className={styles.switchLabel}>启用</span>
                        <Switch
                          checked={item.enabled}
                          loading={toggleMutation.isPending && toggleMutation.variables?.memoryId === item.id}
                          onChange={(enabled) => toggleMutation.mutate({ memoryId: item.id, enabled })}
                        />
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingMemory(item);
                            editForm.setFieldsValue({ content: item.content });
                          }}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="删除记忆？"
                          description="删除后不会保留历史版本。"
                          okText="删除"
                          cancelText="取消"
                          onConfirm={() => deleteMutation.mutate(item.id)}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={deleteMutation.isPending && deleteMutation.variables === item.id}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<InboxOutlined />} title={group.title} description={group.emptyText} />
            )}
          </div>
        ))
      )}

      <Modal
        destroyOnHidden
        open={!!editingMemory}
        title="编辑记忆"
        okText="保存"
        confirmLoading={editMutation.isPending && editMutation.variables?.memoryId === editingMemory?.id}
        onCancel={() => {
          setEditingMemory(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingMemory) {
              return;
            }

            editMutation.mutate({
              memoryId: editingMemory.id,
              content: values.content
            });
          }}
        >
          <Form.Item
            label="内容"
            name="content"
            rules={[{ required: true, message: "请输入记忆内容" }]}
          >
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function MemoryPage() {

  return (
    <WorkspacePageFrame
      title="Memory"
      description="按个人、团队、项目三层管理长期记忆，并控制是否注入后续上下文。"
      contextTitle="Memory Context"
      contextDescription="个人记忆仅自己可见；团队与项目记忆会共享给当前 Workspace 成员。"
      scrollableContent
    >
      <MemoryContent />
    </WorkspacePageFrame>
  );
}
