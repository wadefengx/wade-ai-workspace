"use client";

import { DeleteOutlined, FileSearchOutlined, InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Popconfirm, Space, Table, Tag, Tooltip, Typography, Upload } from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import { useMemo } from "react";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import { EmptyState, LoadingState } from "./ui-state";
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
        throw new Error("Workspace is required");
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
      message.success("Document uploaded successfully");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to upload document");
    }
  });

  const reindexMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiFetch(`/knowledge/${documentId}/reindex`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: knowledgeKeys.list(workspaceId) });
      message.success("Index rebuild submitted");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to rebuild index");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiFetch(`/knowledge/${documentId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: knowledgeKeys.list(workspaceId) });
      message.success("Document deleted");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to delete document");
    }
  });

  const columns = useMemo<TableColumnsType<KnowledgeDocument>>(
    () => [
      {
        title: "File name",
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
        title: "Status",
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
        title: "Uploaded",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 220,
        render: (createdAt: string) => formatDateTime(createdAt)
      },
      {
        title: "Actions",
        key: "actions",
        width: 220,
        render: (_, record) => (
          <Space size={8}>
            <Button
              icon={<ReloadOutlined />}
              loading={reindexMutation.isPending && reindexMutation.variables === record.id}
              onClick={() => reindexMutation.mutate(record.id)}
            >
              Rebuild index
            </Button>
            <Popconfirm
              title="Delete document?"
              description="This removes the document and its index data."
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending && deleteMutation.variables === record.id}
              >
                Delete
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

      message.error("Only .md, .txt, and .pdf files are supported");
      return Upload.LIST_IGNORE;
    },
    customRequest: async ({ file, onError, onSuccess }) => {
      try {
        await uploadMutation.mutateAsync(file as File);
        onSuccess?.({}, new XMLHttpRequest());
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error("Upload failed");
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
          <Typography.Title level={5}>Drag and drop knowledge documents</Typography.Title>
          <Typography.Paragraph type="secondary">
            Supports .md, .txt, and .pdf. The list refreshes automatically after upload and polls every 3 seconds while indexing.
          </Typography.Paragraph>
        </Upload.Dragger>
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div>
            <Typography.Title level={5}>Documents</Typography.Title>
            <Typography.Text type="secondary">
              Polling stops automatically after READY or FAILED; view errors and manually rebuild failed indexes.
            </Typography.Text>
          </div>
        </div>

        {knowledgeQuery.isLoading ? (
          <LoadingState compact title="Loading documents" description="Syncing knowledge-base index status." />
        ) : (
          <Table<KnowledgeDocument>
            rowKey="id"
            columns={columns}
            dataSource={documents}
            pagination={false}
            locale={{
              emptyText: (
                <EmptyState compact icon={<FileSearchOutlined />} title="No knowledge documents yet" description="Upload a .md, .txt, or .pdf file to start building AI retrieval context." />
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
      description="Upload .md, .txt, or .pdf documents, view index status, and rebuild failed indexes."
    >
      <KnowledgeContent />
    </WorkspacePageFrame>
  );
}
