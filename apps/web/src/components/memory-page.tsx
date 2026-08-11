"use client";

import { DeleteOutlined, EditOutlined, InboxOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import { EmptyState, LoadingState } from "./ui-state";
import styles from "./workspace-pages.module.css";
import { ApiError, apiFetch, unwrapItems } from "../lib/api";
import { formatDateTime } from "../lib/datetime";

type MemoryType = "PERSONAL" | "TEAM" | "PROJECT";
type MemoryLevel = "L0_CONVERSATION" | "L1_ATOM" | "L2_SCENARIO" | "L3_PERSONA";

type MemoryItem = {
  id: string;
  type: MemoryType;
  level: MemoryLevel;
  content: string;
  priority?: number | null;
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
  level: MemoryLevel;
  title: string;
  description: string;
  emptyText: string;
}> = [
  {
    level: "L3_PERSONA",
    title: "L3 · User Profile",
    description: "User preferences and habits distilled from conversations, fully injected into chat.",
    emptyText: "No profile memories yet."
  },
  {
    level: "L2_SCENARIO",
    title: "L2 · Context",
    description: "Atomic memories grouped by topic and injected by relevance.",
    emptyText: "No contextual memories yet."
  },
  {
    level: "L1_ATOM",
    title: "L1 · Atomic Facts",
    description: "Independently understandable facts, retrieved on demand.",
    emptyText: "No atomic memories yet."
  },
  {
    level: "L0_CONVERSATION",
    title: "L0 · Conversation Source",
    description: "Original conversation records used as provenance for higher-level memories.",
    emptyText: "No conversation records yet."
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
        throw new Error("Workspace is required");
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
      message.success("Memory created");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to create memory");
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
      message.error(error instanceof ApiError ? error.message : "Failed to update memory status");
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
      message.success("Memory updated");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to update memory");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) =>
      apiFetch(`/memories/${memoryId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memoryKeys.list(workspaceId) });
      message.success("Memory deleted");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to delete memory");
    }
  });

  const groupedMemories = useMemo(() => {
    const items = memoriesQuery.data ?? [];

    return memoryGroups.map((group) => ({
      ...group,
      items: items.filter((item) => item.level === group.level)
    }));
  }, [memoriesQuery.data]);

  return (
    <>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div>
            <Typography.Title level={5}>Create memory</Typography.Title>
            <Typography.Paragraph type="secondary" className={styles.helperText}>
              Personal memories are visible only to you; team and project memories are visible to everyone in the current workspace.
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
              label="Type"
              name="type"
              className={styles.formTypeField}
              rules={[{ required: true, message: "Select a memory type" }]}
            >
              <Select
                options={[
                  { label: "Personal memory (only visible to you)", value: "PERSONAL" },
                  { label: "Team memory (all members)", value: "TEAM" },
                  { label: "Project memory (long-term convention)", value: "PROJECT" }
                ]}
              />
            </Form.Item>
            <Form.Item
              label="Content"
              name="content"
              className={styles.formContentField}
              rules={[{ required: true, message: "Enter memory content" }]}
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder="e.g. Reply in English by default; PRD always means Product Requirement Document."
              />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            Add memory
          </Button>
        </Form>
      </div>

      {memoriesQuery.isLoading ? (
        <div className={styles.pageCard}>
          <LoadingState compact title="Loading memories" description="Syncing personal, team, and project memories." />
        </div>
      ) : (
        groupedMemories.map((group) => (
          <div key={group.level} className={styles.pageCard}>
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
                      <Space size={8} wrap>
                        <Tag color={item.type === "PERSONAL" ? "purple" : item.type === "PROJECT" ? "geekblue" : "default"}>
                          {item.type}
                        </Tag>
                        {typeof item.priority === "number" && item.priority > 0 ? (
                          <Tag color="gold">Priority {item.priority}</Tag>
                        ) : null}
                        <Typography.Text type="secondary">{formatDateTime(item.createdAt)}</Typography.Text>
                      </Space>
                    </div>

                    <div className={styles.memoryActions}>
                      <Space size={12} wrap>
                        <span className={styles.switchLabel}>Enabled</span>
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
                          Edit
                        </Button>
                        <Popconfirm
                          title="Delete memory?"
                          description="Historical versions will not be retained."
                          okText="Delete"
                          cancelText="Cancel"
                          onConfirm={() => deleteMutation.mutate(item.id)}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={deleteMutation.isPending && deleteMutation.variables === item.id}
                          >
                            Delete
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
        title="Edit memory"
        okText="Save"
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
            label="Content"
            name="content"
            rules={[{ required: true, message: "Enter memory content" }]}
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
      description="Manage long-term memories across personal, team, and project levels, and control whether they are injected into later context."
      scrollableContent
    >
      <MemoryContent />
    </WorkspacePageFrame>
  );
}
