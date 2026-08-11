"use client";

import { DeleteOutlined, EditOutlined, KeyOutlined, MailOutlined, SaveOutlined, SearchOutlined, SwapOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Drawer, Form, Input, Popconfirm, Radio, Select, Space, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { WORKSPACE_ICONS, renderWorkspaceIcon } from "../lib/workspace-icons";
import { useAuthStore } from "../stores/auth";
import { type ThemeMode, useThemeStore } from "../theme/store";
import { EmptyState, LoadingState } from "./ui-state";
import { WorkspacePageFrame } from "./workspace-page-frame";
import { useWorkspacePageContext, workspaceKeys } from "./workspace-context";
import styles from "./workspace-pages.module.css";
import shellStyles from "./workspace-shell.module.css";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
type GlobalUserRole = "USER" | "ADMIN";

type ChangePasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type RenameWorkspaceValues = {
  name: string;
  icon: string;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: GlobalUserRole;
  createdAt: string;
};

const settingsKeys = {
  users: (keyword: string) => ["settings", "users", keyword] as const
};

function resolveWorkspaceIconName(workspace?: { icon?: unknown } | null) {
  return typeof workspace?.icon === "string" && workspace.icon ? workspace.icon : "TeamOutlined";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getWorkspaceRoleColor(role: WorkspaceRole) {
  if (role === "OWNER") {
    return "gold";
  }

  if (role === "ADMIN") {
    return "blue";
  }

  return "default";
}

function getGlobalRoleColor(role: GlobalUserRole) {
  return role === "ADMIN" ? "purple" : "default";
}

async function fetchUsers(keyword: string) {
  return apiFetch<ManagedUser[]>(`/users?q=${encodeURIComponent(keyword)}`);
}

function SettingsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [passwordForm] = Form.useForm<ChangePasswordValues>();
  const [workspaceForm] = Form.useForm<RenameWorkspaceValues>();
  const selectedWorkspaceIcon = Form.useWatch("icon", workspaceForm);
  const selectedWorkspaceName = Form.useWatch("name", workspaceForm);
  const user = useAuthStore((state) => state.user);
  const themeMode = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const { workspaceId, selectedWorkspace, members, membersLoading, agents } = useWorkspacePageContext();
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>();
  const [deleteWorkspaceArmed, setDeleteWorkspaceArmed] = useState(false);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false);
  const [workspaceDrawerOpen, setWorkspaceDrawerOpen] = useState(false);

  useEffect(() => {
    workspaceForm.setFieldValue("name", selectedWorkspace?.name ?? "");
    workspaceForm.setFieldValue("icon", resolveWorkspaceIconName(selectedWorkspace));
  }, [selectedWorkspace, workspaceForm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUserSearch(userSearchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [userSearchInput]);

  const currentWorkspaceRole = useMemo<WorkspaceRole | null>(() => {
    const role = members.find((member) => member.userId === user?.id)?.role;
    return role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? role : null;
  }, [members, user?.id]);
  const globalUserRole = ((user as { role?: GlobalUserRole } | null)?.role ?? "USER") as GlobalUserRole;
  const isGlobalAdmin = globalUserRole === "ADMIN";
  const canManageWorkspace = currentWorkspaceRole === "OWNER" || isGlobalAdmin;
  const canManageUsers = isGlobalAdmin;
  const transferCandidates = useMemo(
    () =>
      members
        .filter((member) => member.role !== "OWNER")
        .map((member) => ({
          label: `${member.name} · ${member.email}`,
          value: member.userId
        })),
    [members]
  );

  const usersQuery = useQuery({
    queryKey: settingsKeys.users(debouncedUserSearch),
    queryFn: () => fetchUsers(debouncedUserSearch),
    enabled: canManageUsers
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      apiFetch("/auth/password", {
        method: "PATCH",
        body: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        }
      }),
    onSuccess: () => {
      passwordForm.resetFields();
      message.success("Password updated");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to change password");
    }
  });

  const renameWorkspaceMutation = useMutation({
    mutationFn: (values: RenameWorkspaceValues) => {
      if (!workspaceId) {
        throw new Error("Workspace is required");
      }

      return apiFetch(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: values
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      message.success("Workspace name updated");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to update workspace");
    }
  });

  const setDefaultAgentMutation = useMutation({
    mutationFn: (defaultAgentId: string | null) => {
      if (!workspaceId || !selectedWorkspace) {
        throw new Error("Workspace is required");
      }

      return apiFetch(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: {
          name: selectedWorkspace.name,
          icon: resolveWorkspaceIconName(selectedWorkspace),
          defaultAgentId
        }
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      message.success("Default agent updated");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to update default agent");
    }
  });

  const transferWorkspaceMutation = useMutation({
    mutationFn: (toUserId: string) => {
      if (!workspaceId) {
        throw new Error("Workspace is required");
      }

      return apiFetch(`/workspaces/${workspaceId}/transfer`, {
        method: "POST",
        body: { toUserId }
      });
    },
    onSuccess: async () => {
      setTransferTargetUserId(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) })
      ]);
      message.success("Workspace ownership transferred");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to transfer ownership");
    }
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error("Workspace is required");
      }

      return apiFetch(`/workspaces/${workspaceId}`, {
        method: "DELETE"
      });
    },
    onSuccess: async () => {
      setDeleteWorkspaceArmed(false);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      message.success("Workspace deleted");
      router.push("/");
    },
    onError: (error) => {
      setDeleteWorkspaceArmed(false);
      message.error(error instanceof ApiError ? error.message : "Failed to delete workspace");
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: GlobalUserRole }) =>
      apiFetch(`/users/${userId}`, {
        method: "PATCH",
        body: { role }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.users(debouncedUserSearch) });
      message.success("User role updated");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to update user role");
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/users/${userId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.users(debouncedUserSearch) });
      message.success("User deleted");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "Failed to delete user");
    }
  });

  const userColumns = useMemo<TableColumnsType<ManagedUser>>(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        width: 180,
        render: (name: string) => <Typography.Text strong>{name}</Typography.Text>
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
        width: 200,
        render: (role: GlobalUserRole, record) => {
          const isSelf = record.id === user?.id;
          const isUpdating = updateUserRoleMutation.isPending && updateUserRoleMutation.variables?.userId === record.id;

          return (
            <Space wrap>
              <Tag color={getGlobalRoleColor(role)}>{role}</Tag>
              <Select<GlobalUserRole>
                size="small"
                value={role}
                disabled={isSelf}
                loading={isUpdating}
                options={[
                  { label: "USER", value: "USER" },
                  { label: "ADMIN", value: "ADMIN" }
                ]}
                onChange={(nextRole) => updateUserRoleMutation.mutate({ userId: record.id, role: nextRole })}
              />
            </Space>
          );
        }
      },
      {
        title: "Registered",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 220,
        render: (createdAt: string) => formatDateTime(createdAt)
      },
      {
        title: "Actions",
        key: "actions",
        width: 140,
        render: (_, record) => {
          const isSelf = record.id === user?.id;
          const isDeleting = deleteUserMutation.isPending && deleteUserMutation.variables === record.id;

          return (
            <Popconfirm
              title="Delete user?"
              description="This removes the user’s membership records."
              okText="Delete"
              cancelText="Cancel"
              disabled={isSelf}
              onConfirm={() => deleteUserMutation.mutate(record.id)}
            >
              <Button danger size="small" icon={<DeleteOutlined />} disabled={isSelf} loading={isDeleting}>
                Delete
              </Button>
            </Popconfirm>
          );
        }
      }
    ],
    [deleteUserMutation, updateUserRoleMutation, user?.id]
  );

  return (
    <>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Account</Typography.Title>
            <Typography.Text type="secondary">Account information and sign-in security.</Typography.Text>
          </div>
        </div>

        <div className={styles.settingsRows}>
          <div className={styles.settingsRow}>
            <MailOutlined className={styles.settingsRowIcon} />
            <div className={styles.helperStack}>
              <Typography.Text strong>{user?.name ?? "—"}</Typography.Text>
              <Typography.Text type="secondary">{user?.email ?? "—"}</Typography.Text>
            </div>
          </div>
          <div className={styles.settingsRow}>
            <KeyOutlined className={styles.settingsRowIcon} />
            <div className={styles.helperStack}>
              <Typography.Text strong>Password</Typography.Text>
              <Typography.Text type="secondary">Set; sign in again after changing it (new password must be at least 6 characters).</Typography.Text>
            </div>
            <Button icon={<EditOutlined />} onClick={() => setPasswordDrawerOpen(true)}>
              Change password
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Appearance</Typography.Title>
            <Typography.Text type="secondary">Theme changes take effect immediately and persist after refresh.</Typography.Text>
          </div>
        </div>

        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          value={themeMode}
          options={[
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
            { label: "System", value: "system" }
          ]}
          onChange={(event) => setTheme(event.target.value as ThemeMode)}
        />
      </div>

      {canManageWorkspace ? (
        <div className={styles.pageCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.helperStack}>
              <Typography.Title level={5}>Workspace management</Typography.Title>
              <Typography.Text type="secondary">
                Current permission:
                <Tag
                  color={currentWorkspaceRole ? getWorkspaceRoleColor(currentWorkspaceRole) : "default"}
                  style={{ marginInlineStart: 8 }}
                >
                  {currentWorkspaceRole ?? globalUserRole}
                </Tag>
              </Typography.Text>
            </div>
          </div>

          <div className={styles.settingsRows}>
            <div className={styles.settingsRow}>
              <span className={shellStyles.workspacePreviewIcon}>
                {renderWorkspaceIcon(resolveWorkspaceIconName(selectedWorkspace))}
              </span>
              <div className={styles.helperStack}>
                <Typography.Text strong>{selectedWorkspace?.name ?? "—"}</Typography.Text>
                <Typography.Text type="secondary">
                  {membersLoading ? "Loading members" : `${members.length} members`}
                </Typography.Text>
              </div>
              <Button icon={<EditOutlined />} onClick={() => setWorkspaceDrawerOpen(true)}>
                Edit
              </Button>
            </div>
            <div className={styles.settingsRow}>
              <div className={styles.helperStack}>
                <Typography.Text strong>Default agent</Typography.Text>
                <Typography.Text type="secondary">Use this agent by default when a chat does not @mention an agent.</Typography.Text>
              </div>
              <Select
                style={{ minWidth: 240 }}
                placeholder="Use system default agent"
                allowClear
                value={selectedWorkspace?.defaultAgentId ?? undefined}
                loading={setDefaultAgentMutation.isPending}
                disabled={!workspaceId}
                options={agents.map((agent) => ({
                  label: `${agent.emoji ? `${agent.emoji} ` : ""}${agent.name}`,
                  value: agent.id
                }))}
                onChange={(value) => setDefaultAgentMutation.mutate(value ?? null)}
                onClear={() => setDefaultAgentMutation.mutate(null)}
              />
            </div>
          </div>

          <div className={styles.stackWithTopMargin}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardHeader}>
                <div className={styles.helperStack}>
                  <Typography.Text strong>Transfer ownership</Typography.Text>
                  <Typography.Text type="secondary">The target must be a current member; the original OWNER becomes ADMIN after transfer.</Typography.Text>
                </div>
              </div>
              <Space wrap>
                <Select
                  showSearch
                  style={{ minWidth: 280 }}
                  placeholder={membersLoading ? "Loading members" : "Select a member to transfer to"}
                  value={transferTargetUserId}
                  options={transferCandidates}
                  disabled={!workspaceId || membersLoading || transferCandidates.length === 0}
                  onChange={setTransferTargetUserId}
                />
                <Popconfirm
                  title="Confirm ownership transfer?"
                  description="This immediately updates the current workspace’s role structure."
                  okText="Confirm transfer"
                  cancelText="Cancel"
                  disabled={!transferTargetUserId}
                  onConfirm={() => transferTargetUserId && transferWorkspaceMutation.mutate(transferTargetUserId)}
                >
                  <Button
                    icon={<SwapOutlined />}
                    disabled={!transferTargetUserId}
                    loading={transferWorkspaceMutation.isPending}
                  >
                    Transfer ownership
                  </Button>
                </Popconfirm>
              </Space>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryCardHeader}>
                <div className={styles.helperStack}>
                  <Typography.Text strong>Delete workspace</Typography.Text>
                  <Typography.Text type="secondary">
                    This permanently cascades to channels, messages, members, knowledge, memories, and agents.
                  </Typography.Text>
                </div>
              </div>
              <Popconfirm
                title={deleteWorkspaceArmed ? "Delete this workspace again?" : "Delete this workspace?"}
                description={
                  deleteWorkspaceArmed
                    ? "This is the final confirmation. Submitting permanently cascades deletion."
                    : "After the first confirmation, click Delete once more to prevent accidental actions."
                }
                okText={deleteWorkspaceArmed ? "Delete permanently" : "Continue"}
                cancelText="Cancel"
                onCancel={() => setDeleteWorkspaceArmed(false)}
                onConfirm={() => {
                  if (!deleteWorkspaceArmed) {
                    setDeleteWorkspaceArmed(true);
                    return;
                  }

                  deleteWorkspaceMutation.mutate();
                }}
              >
                <Button danger icon={<DeleteOutlined />} disabled={!workspaceId} loading={deleteWorkspaceMutation.isPending}>
                  {deleteWorkspaceArmed ? "Confirm deletion again" : "Delete workspace"}
                </Button>
              </Popconfirm>
            </div>
          </div>
        </div>
      ) : null}

      {canManageUsers ? (
        <div className={styles.pageCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.helperStack}>
              <Typography.Title level={5}>User management</Typography.Title>
              <Typography.Text type="secondary">Visible only to global ADMIN; you cannot delete or change your own role.</Typography.Text>
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search users by name or email"
              className={styles.searchControl}
              value={userSearchInput}
              onChange={(event) => setUserSearchInput(event.target.value)}
            />
          </div>

          {usersQuery.isLoading ? (
            <LoadingState compact title="Loading users" description="Syncing the global account list." />
          ) : (
            <Table<ManagedUser>
              rowKey="id"
              columns={userColumns}
              dataSource={usersQuery.data ?? []}
              pagination={false}
              scroll={{ x: 1000 }}
              locale={{
                emptyText: <EmptyState compact icon={<SearchOutlined />} title="No matching users" description="Try another name or email keyword." />
              }}
            />
          )}
        </div>
      ) : null}

      <Drawer
        title="Change password"
        width={420}
        open={passwordDrawerOpen}
        onClose={() => setPasswordDrawerOpen(false)}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          initialValues={{ currentPassword: "", newPassword: "", confirmPassword: "" }}
          onFinish={(values) => changePasswordMutation.mutate(values)}
        >
          <Form.Item
            label="Current password"
            name="currentPassword"
            rules={[{ required: true, message: "Enter your current password" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="New password"
            name="newPassword"
            rules={[
              { required: true, message: "Enter a new password" },
              { min: 6, message: "New password must be at least 6 characters" }
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Re-enter your new password" },
              ({ getFieldValue }) => ({
                validator(_, value: string) {
                  if (!value || value === getFieldValue("newPassword")) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error("The new passwords do not match"));
                }
              })
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={changePasswordMutation.isPending} block>
            Update password
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title="Edit workspace"
        width={460}
        open={workspaceDrawerOpen}
        onClose={() => setWorkspaceDrawerOpen(false)}
        destroyOnClose
      >
        <Form form={workspaceForm} layout="vertical" onFinish={(values) => renameWorkspaceMutation.mutate(values)}>
          <Form.Item
            label="Workspace Name"
            name="name"
            rules={[{ required: true, message: "Enter a workspace name" }]}
          >
            <Input placeholder="Enter a new workspace name" />
          </Form.Item>
          <Form.Item label="Workspace Icon" name="icon" rules={[{ required: true, message: "Select a workspace icon" }]}>
            <div className={shellStyles.workspaceIconPickerGrid}>
              {WORKSPACE_ICONS.map((iconItem) => {
                const selected = selectedWorkspaceIcon === iconItem.key;

                return (
                  <button
                    key={iconItem.key}
                    className={`${shellStyles.workspaceIconPickerButton} ${
                      selected ? shellStyles.workspaceIconPickerButtonSelected : ""
                    }`}
                    type="button"
                    aria-label={`Select ${iconItem.label} icon`}
                    onClick={() => workspaceForm.setFieldValue("icon", iconItem.key)}
                  >
                    {iconItem.icon}
                  </button>
                );
              })}
            </div>
          </Form.Item>
          <div className={`${styles.helperStack} ${styles.inlinePreview}`}>
            <Typography.Text type="secondary">Currently shown:</Typography.Text>
            <div className={shellStyles.workspaceOptionLabel}>
              <span className={shellStyles.workspacePreviewIcon}>{renderWorkspaceIcon(selectedWorkspaceIcon)}</span>
              <Typography.Text>{selectedWorkspaceName || "Workspace"}</Typography.Text>
            </div>
          </div>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            disabled={!workspaceId}
            loading={renameWorkspaceMutation.isPending}
            block
          >
            Save
          </Button>
        </Form>
      </Drawer>
    </>
  );
}

export function SettingsPage() {
  return (
    <WorkspacePageFrame
      title="Settings"
      description="Manage account, theme, workspace, and global user permissions."
    >
      <SettingsContent />
    </WorkspacePageFrame>
  );
}
