"use client";

import { DeleteOutlined, InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Popconfirm, Space, Spin, Table, Tag, Tooltip, Typography, Upload } from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import { useMemo } from "react";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import styles from "./workspace-pages.module.css";
import { ApiError, apiFetch, unwrapItems } from "../lib/api";
import { formatDateTime } from "../lib/datetime";

type ExtractionStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

type KnowledgeDocument = {
  id: string;
  filename: string;
  mimeType: string;
  extractionStatus: ExtractionStatus;
  errorMessage: string | null;
  createdAt: string;
};

const knowledgeKeys = {
  list: (workspaceId: string | null) => ["knowledge", workspaceId] as const
};

const statusTagColor: Record<ExtractionStatus, string> = {
  PENDING: "default",
  PROCESSING: "processing",
  READY: "success",
  FAILED: "error"
};

function isProcessingStatus(status: ExtractionStatus) {
  return status === "PENDING" || status === "PROCESSING";
}

function isSupportedKnowledgeFile(filename: string) {
  return /\.(md|txt|pdf)$/i.test(filename);
}

async function fetchKnowledgeDocuments(workspaceId: string) {
  return unwrapItems(
    await apiFetch<KnowledgeDocument[] | { items: KnowledgeDocument[] }>(`/workspaces/${workspaceId}/knowledge`)
  );
}

function KnowledgeContent() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { workspaceId } = useWorkspacePageContext();
  const knowledgeQuery = useQuery({
    queryKey: knowledgeKeys.list(workspaceId),
    queryFn: () => fetchKnowledgeDocuments(workspaceId as string),
    enabled: !!workspaceId,
    refetchInterval: (query) =>
      query.state.data?.some((item) => isProcessingStatus(item.extractionStatus)) ? 3_000 : false
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
      }

      const formData = new FormData();
      formData.append("file", file, file.name);
      await apiFetch(`/workspaces/${workspaceId}/knowledge`, {
        method: "POST",
        body: formData
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: knowledgeKeys.list(workspaceId) });
      message.success("文档上传成功");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "文档上传失败");
    }
  });

  const reindexMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiFetch(`/knowledge/${documentId}/reindex`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: knowledgeKeys.list(workspaceId) });
      message.success("已提交重建索引");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "重建索引失败");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiFetch(`/knowledge/${documentId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: knowledgeKeys.list(workspaceId) });
      message.success("文档已删除");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "删除文档失败");
    }
  });

  const columns = useMemo<TableColumnsType<KnowledgeDocument>>(
    () => [
      {
        title: "文件名",
        dataIndex: "filename",
        key: "filename",
        render: (filename: string, record) => (
          <div className={styles.fileCell}>
            <Typography.Text strong>{filename}</Typography.Text>
            <Typography.Text type="secondary">{record.mimeType}</Typography.Text>
          </div>
        )
      },
      {
        title: "状态",
        dataIndex: "extractionStatus",
        key: "extractionStatus",
        width: 180,
        render: (status: ExtractionStatus, record) => {
          const tag = <Tag color={statusTagColor[status]}>{status}</Tag>;

          if (status !== "FAILED") {
            return tag;
          }

          return record.errorMessage ? <Tooltip title={record.errorMessage}>{tag}</Tooltip> : tag;
        }
      },
      {
        title: "上传时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 220,
        render: (createdAt: string) => formatDateTime(createdAt)
      },
      {
        title: "操作",
        key: "actions",
        width: 220,
        render: (_, record) => (
          <Space size={8}>
            <Button
              icon={<ReloadOutlined />}
              loading={reindexMutation.isPending && reindexMutation.variables === record.id}
              onClick={() => reindexMutation.mutate(record.id)}
            >
              重建索引
            </Button>
            <Popconfirm
              title="删除文档？"
              description="删除后将移除文档及其索引数据。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending && deleteMutation.variables === record.id}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [deleteMutation, reindexMutation]
  );

  const uploadProps: UploadProps = {
    accept: ".md,.txt,.pdf",
    disabled: !workspaceId || uploadMutation.isPending,
    maxCount: 1,
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      if (isSupportedKnowledgeFile(file.name)) {
        return true;
      }

      message.error("仅支持 .md、.txt、.pdf 文件");
      return Upload.LIST_IGNORE;
    },
    customRequest: async ({ file, onError, onSuccess }) => {
      try {
        await uploadMutation.mutateAsync(file as File);
        onSuccess?.({}, new XMLHttpRequest());
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error("上传失败");
        onError?.(resolvedError);
      }
    }
  };

  const documents = knowledgeQuery.data ?? [];

  return (
    <>
      <div className={styles.pageCard}>
        <Upload.Dragger {...uploadProps} className={styles.uploadDragger}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <Typography.Title level={5}>拖拽上传知识文档</Typography.Title>
          <Typography.Paragraph type="secondary">
            支持 .md、.txt、.pdf；上传后会自动刷新列表，索引处理中每 3 秒轮询一次。
          </Typography.Paragraph>
        </Upload.Dragger>
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div>
            <Typography.Title level={5}>文档列表</Typography.Title>
            <Typography.Text type="secondary">
              READY / FAILED 后自动停止轮询；FAILED 可查看错误并手动重建索引。
            </Typography.Text>
          </div>
        </div>

        {knowledgeQuery.isLoading ? (
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : (
          <Table<KnowledgeDocument>
            rowKey="id"
            columns={columns}
            dataSource={documents}
            pagination={false}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有知识文档，先上传一个文件。" />
              )
            }}
          />
        )}
      </div>
    </>
  );
}

export function KnowledgePage() {

  return (
    <WorkspacePageFrame
      title="Knowledge"
      description="上传 .md / .txt / .pdf 文档，查看索引状态，并在失败后重新构建。"
      contextTitle="Knowledge Context"
      contextDescription="文档完成提取并索引后，可作为后续 AI 检索上下文的一部分。"
    >
      <KnowledgeContent />
    </WorkspacePageFrame>
  );
}
