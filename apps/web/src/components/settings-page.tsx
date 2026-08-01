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
  const { workspaceId, selectedWorkspace, members, membersLoading } = useWorkspacePageContext();
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
      message.success("密码已更新");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "修改密码失败");
    }
  });

  const renameWorkspaceMutation = useMutation({
    mutationFn: (values: RenameWorkspaceValues) => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
      }

      return apiFetch(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: values
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      message.success("Workspace 名称已更新");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "更新 Workspace 失败");
    }
  });

  const transferWorkspaceMutation = useMutation({
    mutationFn: (toUserId: string) => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
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
      message.success("Workspace OWNER 已转交");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "转交 OWNER 失败");
    }
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
      }

      return apiFetch(`/workspaces/${workspaceId}`, {
        method: "DELETE"
      });
    },
    onSuccess: async () => {
      setDeleteWorkspaceArmed(false);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      message.success("Workspace 已删除");
      router.push("/");
    },
    onError: (error) => {
      setDeleteWorkspaceArmed(false);
      message.error(error instanceof ApiError ? error.message : "删除 Workspace 失败");
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
      message.success("用户角色已更新");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "更新用户角色失败");
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/users/${userId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.users(debouncedUserSearch) });
      message.success("用户已删除");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "删除用户失败");
    }
  });

  const userColumns = useMemo<TableColumnsType<ManagedUser>>(
    () => [
      {
        title: "姓名",
        dataIndex: "name",
        key: "name",
        width: 180,
        render: (name: string) => <Typography.Text strong>{name}</Typography.Text>
      },
      {
        title: "邮箱",
        dataIndex: "email",
        key: "email",
        width: 260,
        render: (email: string) => <Typography.Text type="secondary">{email}</Typography.Text>
      },
      {
        title: "角色",
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
        title: "注册时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 220,
        render: (createdAt: string) => formatDateTime(createdAt)
      },
      {
        title: "操作",
        key: "actions",
        width: 140,
        render: (_, record) => {
          const isSelf = record.id === user?.id;
          const isDeleting = deleteUserMutation.isPending && deleteUserMutation.variables === record.id;

          return (
            <Popconfirm
              title="删除用户？"
              description="删除后会移除该用户的成员关系记录。"
              okText="删除"
              cancelText="取消"
              disabled={isSelf}
              onConfirm={() => deleteUserMutation.mutate(record.id)}
            >
              <Button danger size="small" icon={<DeleteOutlined />} disabled={isSelf} loading={isDeleting}>
                删除
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
            <Typography.Title level={5}>账户</Typography.Title>
            <Typography.Text type="secondary">账号信息与登录安全。</Typography.Text>
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
              <Typography.Text strong>密码</Typography.Text>
              <Typography.Text type="secondary">已设置;修改后需重新登录(新密码至少 6 位)。</Typography.Text>
            </div>
            <Button icon={<EditOutlined />} onClick={() => setPasswordDrawerOpen(true)}>
              修改密码
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>外观</Typography.Title>
            <Typography.Text type="secondary">主题切换会立即生效，并在刷新后保留。</Typography.Text>
          </div>
        </div>

        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          value={themeMode}
          options={[
            { label: "浅色", value: "light" },
            { label: "深色", value: "dark" },
            { label: "跟随系统", value: "system" }
          ]}
          onChange={(event) => setTheme(event.target.value as ThemeMode)}
        />
      </div>

      {canManageWorkspace ? (
        <div className={styles.pageCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.helperStack}>
              <Typography.Title level={5}>Workspace 管理</Typography.Title>
              <Typography.Text type="secondary">
                当前权限：
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
                  {membersLoading ? "读取成员中" : `${members.length} 位成员`}
                </Typography.Text>
              </div>
              <Button icon={<EditOutlined />} onClick={() => setWorkspaceDrawerOpen(true)}>
                编辑
              </Button>
            </div>
          </div>

          <div className={styles.stackWithTopMargin}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardHeader}>
                <div className={styles.helperStack}>
                  <Typography.Text strong>转交 OWNER</Typography.Text>
                  <Typography.Text type="secondary">目标必须是当前成员；转交后原 OWNER 自动降为 ADMIN。</Typography.Text>
                </div>
              </div>
              <Space wrap>
                <Select
                  showSearch
                  style={{ minWidth: 280 }}
                  placeholder={membersLoading ? "读取成员中" : "选择要转交的成员"}
                  value={transferTargetUserId}
                  options={transferCandidates}
                  disabled={!workspaceId || membersLoading || transferCandidates.length === 0}
                  onChange={setTransferTargetUserId}
                />
                <Popconfirm
                  title="确认转交 OWNER？"
                  description="确认后会立即更新当前 Workspace 的角色结构。"
                  okText="确认转交"
                  cancelText="取消"
                  disabled={!transferTargetUserId}
                  onConfirm={() => transferTargetUserId && transferWorkspaceMutation.mutate(transferTargetUserId)}
                >
                  <Button
                    icon={<SwapOutlined />}
                    disabled={!transferTargetUserId}
                    loading={transferWorkspaceMutation.isPending}
                  >
                    转交 OWNER
                  </Button>
                </Popconfirm>
              </Space>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryCardHeader}>
                <div className={styles.helperStack}>
                  <Typography.Text strong>删除 Workspace</Typography.Text>
                  <Typography.Text type="secondary">
                    会级联删除 channels、messages、members、knowledge、memories、agents，且不可恢复。
                  </Typography.Text>
                </div>
              </div>
              <Popconfirm
                title={deleteWorkspaceArmed ? "再次确认删除当前 Workspace？" : "确认删除当前 Workspace？"}
                description={
                  deleteWorkspaceArmed
                    ? "这是最后一次确认，提交后会立即执行级联删除。"
                    : "首次确认后需要再点一次删除，避免误操作。"
                }
                okText={deleteWorkspaceArmed ? "最终删除" : "继续"}
                cancelText="取消"
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
                  {deleteWorkspaceArmed ? "再次确认删除" : "删除 Workspace"}
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
              <Typography.Title level={5}>用户管理</Typography.Title>
              <Typography.Text type="secondary">仅全局 ADMIN 可见；自己这一行不可删除或改角色。</Typography.Text>
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="按姓名或邮箱搜索用户"
              className={styles.searchControl}
              value={userSearchInput}
              onChange={(event) => setUserSearchInput(event.target.value)}
            />
          </div>

          {usersQuery.isLoading ? (
            <LoadingState compact title="正在读取用户" description="同步全局账户列表。" />
          ) : (
            <Table<ManagedUser>
              rowKey="id"
              columns={userColumns}
              dataSource={usersQuery.data ?? []}
              pagination={false}
              scroll={{ x: 1000 }}
              locale={{
                emptyText: <EmptyState compact icon={<SearchOutlined />} title="没有匹配的用户" description="换个姓名或邮箱关键词试试。" />
              }}
            />
          )}
        </div>
      ) : null}

      <Drawer
        title="修改密码"
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
            label="当前密码"
            name="currentPassword"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "新密码至少 6 位" }
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value: string) {
                  if (!value || value === getFieldValue("newPassword")) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error("两次输入的新密码不一致"));
                }
              })
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={changePasswordMutation.isPending} block>
            更新密码
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title="编辑 Workspace"
        width={460}
        open={workspaceDrawerOpen}
        onClose={() => setWorkspaceDrawerOpen(false)}
        destroyOnClose
      >
        <Form form={workspaceForm} layout="vertical" onFinish={(values) => renameWorkspaceMutation.mutate(values)}>
          <Form.Item
            label="Workspace 名称"
            name="name"
            rules={[{ required: true, message: "请输入 Workspace 名称" }]}
          >
            <Input placeholder="输入新的 Workspace 名称" />
          </Form.Item>
          <Form.Item label="Workspace Icon" name="icon" rules={[{ required: true, message: "请选择 Workspace Icon" }]}>
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
                    aria-label={`选择 ${iconItem.label} 图标`}
                    onClick={() => workspaceForm.setFieldValue("icon", iconItem.key)}
                  >
                    {iconItem.icon}
                  </button>
                );
              })}
            </div>
          </Form.Item>
          <div className={`${styles.helperStack} ${styles.inlinePreview}`}>
            <Typography.Text type="secondary">当前显示：</Typography.Text>
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
            保存
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
      description="管理账户、主题、Workspace 以及全局用户权限。"
    >
      <SettingsContent />
    </WorkspacePageFrame>
  );
}
