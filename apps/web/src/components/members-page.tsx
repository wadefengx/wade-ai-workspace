"use client";

import { PlusOutlined, TeamOutlined, UserDeleteOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Avatar,
  Button,
  Form,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
  Typography
} from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { formatDateTime } from "../lib/datetime";
import { useAuthStore } from "../stores/auth";
import { EmptyState } from "./ui-state";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext } from "./workspace-context";
import styles from "./workspace-pages.module.css";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

type WorkspaceMemberRecord = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  avatarUrl?: string | null;
};

type UserSearchResult = {
  id: string;
  name: string;
  email: string;
};

type AddMemberValues = {
  email: string;
  role: Exclude<WorkspaceRole, "OWNER">;
};

const membersKeys = {
  list: (workspaceId: string | null) => ["workspaces", workspaceId, "members"] as const,
  userSearch: (keyword: string) => ["users", "search", keyword] as const
};

const roleSelectOptions = [
  { label: "OWNER", value: "OWNER", disabled: true },
  { label: "MEMBER", value: "MEMBER" },
  { label: "ADMIN", value: "ADMIN" }
];

const addMemberRoleOptions = [
  { label: "MEMBER", value: "MEMBER" },
  { label: "ADMIN", value: "ADMIN" }
];

function getRoleColor(role: WorkspaceRole) {
  if (role === "OWNER") {
    return "gold";
  }

  if (role === "ADMIN") {
    return "blue";
  }

  return "default";
}

function getAvatarText(member: Pick<WorkspaceMemberRecord, "name" | "email">) {
  const source = member.name.trim() || member.email.trim();
  return source.slice(0, 1).toUpperCase();
}

async function searchUsers(keyword: string) {
  return apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(keyword)}`);
}

function MembersContent() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<AddMemberValues>();
  const { workspaceId, members, membersLoading } = useWorkspacePageContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedKeyword(searchKeyword.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isModalOpen, searchKeyword]);

  const currentUserRole = useMemo<WorkspaceRole | null>(() => {
    const role = members.find((member) => member.userId === user?.id)?.role;
    return role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? role : null;
  }, [members, user?.id]);
  const canManageMembers = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const userSearchQuery = useQuery({
    queryKey: membersKeys.userSearch(debouncedKeyword),
    queryFn: () => searchUsers(debouncedKeyword),
    enabled: isModalOpen && debouncedKeyword.length > 0
  });

  const addMemberMutation = useMutation({
    mutationFn: (values: AddMemberValues) => {
      if (!workspaceId) {
        throw new Error("Workspace is required");
      }

      return apiFetch(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: values
      });
    },
    onSuccess: async () => {
      setIsModalOpen(false);
      setSearchKeyword("");
      setDebouncedKeyword("");
      form.resetFields();
      form.setFieldValue("role", "MEMBER");
      await queryClient.invalidateQueries({ queryKey: membersKeys.list(workspaceId) });
      message.success("Member added");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to add member");
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Exclude<WorkspaceRole, "OWNER"> }) =>
      apiFetch(`/members/${memberId}`, {
        method: "PATCH",
        body: { role }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKeys.list(workspaceId) });
      message.success("Member role updated");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to update member role");
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/members/${memberId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKeys.list(workspaceId) });
      message.success("Member removed");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to remove member");
    }
  });

  const userOptions = useMemo(
    () =>
      (userSearchQuery.data ?? []).map((candidate) => ({
        label: `${candidate.name} · ${candidate.email}`,
        value: candidate.email
      })),
    [userSearchQuery.data]
  );

  const columns = useMemo<TableColumnsType<WorkspaceMemberRecord>>(
    () => {
      const baseColumns: TableColumnsType<WorkspaceMemberRecord> = [
        {
          title: "Member",
          dataIndex: "name",
          key: "name",
          width: 280,
          render: (_: string, record) => (
            <div className={styles.memberIdentity}>
              <Avatar>{getAvatarText(record)}</Avatar>
              <div className={styles.memberMeta}>
                <Typography.Text strong>{record.name}</Typography.Text>
              </div>
            </div>
          )
        },
        {
          title: "Email",
          dataIndex: "email",
          key: "email",
          width: 260,
          render: (email: string) => <Typography.Text type="secondary">{email}</Typography.Text>
        },
        {
          title: "Role",
          dataIndex: "role",
          key: "role",
          width: 140,
          render: (role: string) => <Tag color={getRoleColor(role as WorkspaceRole)}>{role}</Tag>
        },
        {
          title: "Joined",
          dataIndex: "createdAt",
          key: "createdAt",
          width: 220,
          render: (createdAt: string) => formatDateTime(createdAt)
        }
      ];

      if (!canManageMembers) {
        return baseColumns;
      }

      return [
        ...baseColumns,
        {
          title: "Actions",
          key: "actions",
          width: 260,
          render: (_, record) => {
            const isOwner = record.role === "OWNER";
            const isUpdatingRole =
              updateRoleMutation.isPending && updateRoleMutation.variables?.memberId === record.id;
            const isRemoving = removeMemberMutation.isPending && removeMemberMutation.variables === record.id;

            return (
              <div className={styles.memberActions}>
                <Select
                  value={record.role}
                  className={styles.memberRoleSelect}
                  options={roleSelectOptions}
                  disabled={isOwner}
                  loading={isUpdatingRole}
                  onChange={(role) =>
                    updateRoleMutation.mutate({
                      memberId: record.id,
                      role: role as Exclude<WorkspaceRole, "OWNER">
                    })
                  }
                />
                <Popconfirm
                  title="Remove member?"
                  description="This person will lose access to the current workspace."
                  okText="Remove"
                  cancelText="Cancel"
                  disabled={isOwner}
                  onConfirm={() => removeMemberMutation.mutate(record.id)}
                >
                  <Button
                    danger
                    icon={<UserDeleteOutlined />}
                    disabled={isOwner}
                    loading={isRemoving}
                  >
                    Remove
                  </Button>
                </Popconfirm>
              </div>
            );
          }
        }
      ];
    },
    [canManageMembers, removeMemberMutation, updateRoleMutation]
  );

  const tableLocale = useMemo(
    () => ({
      emptyText: <EmptyState compact icon={<TeamOutlined />} title="No members yet" description="Add members to manage knowledge, memory, and agents together." />
    }),
    []
  );

  return (
    <>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Members</Typography.Title>
            <Typography.Text type="secondary">
              OWNER cannot be changed or removed; only OWNER and ADMIN can manage members.
            </Typography.Text>
          </div>
          {canManageMembers ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setIsModalOpen(true);
                setSearchKeyword("");
                setDebouncedKeyword("");
                form.setFieldsValue({ role: "MEMBER", email: "" });
              }}
            >
              Add member
            </Button>
          ) : null}
        </div>

        <Table<WorkspaceMemberRecord>
          rowKey="id"
          columns={columns}
          dataSource={members}
          loading={membersLoading}
          locale={tableLocale}
          pagination={false}
          scroll={{ x: 860 }}
        />
      </div>

      <Modal
        destroyOnHidden
        open={isModalOpen}
        title="Add member"
        okText="Add"
        cancelText="Cancel"
        confirmLoading={addMemberMutation.isPending}
        onCancel={() => {
          setIsModalOpen(false);
          setSearchKeyword("");
          setDebouncedKeyword("");
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ email: "", role: "MEMBER" }}
          onFinish={(values) => addMemberMutation.mutate(values)}
        >
          <Form.Item
            label="User"
            name="email"
            rules={[{ required: true, message: "Select a member to add" }]}
          >
            <Select
              showSearch
              filterOption={false}
              placeholder="Search users by name or email"
              options={userOptions}
              notFoundContent={userSearchQuery.isFetching ? <Spin size="small" /> : null}
              onSearch={setSearchKeyword}
            />
          </Form.Item>
          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: "Select a member role" }]}
          >
            <Select options={addMemberRoleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function MembersPage() {
  return (
    <WorkspacePageFrame
      title="Members"
      description="View workspace members and grant or revoke management permissions by role."
    >
      <MembersContent />
    </WorkspacePageFrame>
  );
}
