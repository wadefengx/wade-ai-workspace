"use client";

import { useMutation } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Space, Spin, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AuthUser } from "../stores/auth";
import { useAuthStore } from "../stores/auth";
import styles from "./auth-page.module.css";

type AuthMode = "login" | "register";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type LoginValues = {
  email: string;
  password: string;
};

type RegisterValues = LoginValues & {
  name: string;
};

const contentByMode: Record<
  AuthMode,
  {
    title: string;
    subtitle: string;
    submitLabel: string;
    alternateLabel: string;
    alternateHref: string;
    alternateCta: string;
    successMessage: string;
    endpoint: "/auth/login" | "/auth/register";
  }
> = {
  login: {
    title: "登录 Wade AI Workspace",
    subtitle: "进入你的团队 AI Workspace。",
    submitLabel: "登录",
    alternateLabel: "还没有账号？",
    alternateHref: "/register",
    alternateCta: "立即注册",
    successMessage: "登录成功",
    endpoint: "/auth/login"
  },
  register: {
    title: "创建账号",
    subtitle: "注册后即可创建或加入 Workspace。",
    submitLabel: "注册",
    alternateLabel: "已经有账号？",
    alternateHref: "/login",
    alternateCta: "去登录",
    successMessage: "注册成功",
    endpoint: "/auth/register"
  }
};

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { message } = App.useApp();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const content = contentByMode[mode];

  useEffect(() => {
    if (hydrated && user) {
      router.replace("/");
    }
  }, [hydrated, router, user]);

  const mutation = useMutation({
    mutationFn: async (values: LoginValues | RegisterValues) =>
      apiFetch<AuthResponse>(content.endpoint, {
        method: "POST",
        auth: false,
        body: values
      }),
    onSuccess: ({ token, user: currentUser }) => {
      setSession({ token, user: currentUser });
      message.success(content.successMessage);
      router.replace("/");
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "请求失败，请稍后重试");
    }
  });

  if (!hydrated || isRestoring) {
    return (
      <div className={styles.page}>
        <Spin size="large" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <Typography.Title level={2} className={styles.title}>
            {content.title}
          </Typography.Title>
          <Typography.Text type="secondary">{content.subtitle}</Typography.Text>
        </div>

        <Form<LoginValues | RegisterValues>
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => mutation.mutate(values)}
        >
          {mode === "register" ? (
            <Form.Item<RegisterValues>
              name="name"
              label="姓名"
              rules={[{ required: true, message: "请输入姓名" }]}
            >
              <Input autoComplete="name" placeholder="Wade" size="large" />
            </Form.Item>
          ) : null}

          <Form.Item<LoginValues>
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "请输入有效邮箱" }
            ]}
          >
            <Input autoComplete="email" placeholder="wade@example.com" size="large" />
          </Form.Item>

          <Form.Item<LoginValues>
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password autoComplete="current-password" placeholder="请输入密码" size="large" />
          </Form.Item>

          <Button block htmlType="submit" type="primary" size="large" loading={mutation.isPending}>
            {content.submitLabel}
          </Button>
        </Form>

        <Space className={styles.footer} direction="vertical" size={4}>
          <Typography.Text type="secondary">
            {content.alternateLabel}{" "}
            <Link href={content.alternateHref}>{content.alternateCta}</Link>
          </Typography.Text>
        </Space>
      </Card>
    </div>
  );
}
