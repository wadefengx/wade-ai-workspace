"use client";

import { useMutation } from "@tanstack/react-query";
import { App, Button, Form, Input, Space, Spin, Typography } from "antd";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AuthUser } from "../stores/auth";
import { useAuthStore } from "../stores/auth";
import styles from "./auth-page.module.css";

type AuthMode = "login" | "register";

type AuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
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
    title: "登录 Zone AI",
    subtitle: "进入你的团队 AI Workspace。",
    submitLabel: "登录",
    alternateLabel: "还没有账号？",
    alternateHref: "/register",
    alternateCta: "立即注册",
    successMessage: "登录成功",
    endpoint: "/auth/login"
  },
  register: {
    title: "创建 Zone AI 账号",
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
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    onSuccess: ({ accessToken, refreshToken, token, user: currentUser }) => {
      const resolvedAccessToken = accessToken ?? token;

      if (!resolvedAccessToken) {
        setSubmitError("登录响应缺少 access token");
        return;
      }

      setSubmitError(null);
      setSession({
        accessToken: resolvedAccessToken,
        refreshToken,
        user: currentUser
      });
      message.success(content.successMessage);
      router.replace("/");
    },
    onError: (error) => {
      setSubmitError(error instanceof ApiError ? error.message : "请求失败，请稍后重试");
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
      <motion.section
        className={styles.card}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <Image src="/icon.svg" alt="" width={44} height={44} priority />
            </div>
            <div>
              <Typography.Title level={1} className={styles.brandLabel}>
                Zone AI
              </Typography.Title>
              <Typography.Text className={styles.brandSubtitle}>AI Native workspace for your team.</Typography.Text>
            </div>
          </div>
          <Typography.Title level={2} className={styles.title}>
            {content.title}
          </Typography.Title>
          <Typography.Text className={styles.subtitle}>{content.subtitle}</Typography.Text>
        </div>

        <Form<LoginValues | RegisterValues>
          className={styles.form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => {
            setSubmitError(null);
            mutation.mutate(values);
          }}
        >
          {mode === "register" ? (
            <Form.Item<RegisterValues>
              name="name"
              label="姓名"
              rules={[{ required: true, message: "请输入姓名" }]}
            >
              <Input autoComplete="name" placeholder="Wade" className={styles.input} />
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
            <Input autoComplete="email" placeholder="wade@example.com" className={styles.input} />
          </Form.Item>

          <Form.Item<LoginValues>
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password autoComplete="current-password" placeholder="请输入密码" className={styles.input} />
          </Form.Item>

          {submitError ? <Typography.Text className={styles.inlineError}>{submitError}</Typography.Text> : null}

          <Button block htmlType="submit" type="primary" className={styles.submitButton} loading={mutation.isPending}>
            {content.submitLabel}
          </Button>
        </Form>

        <Space className={styles.footer} direction="vertical" size={4}>
          <Typography.Text className={styles.footerText}>
            {content.alternateLabel} <Link href={content.alternateHref}>{content.alternateCta}</Link>
          </Typography.Text>
          <Typography.Text className={styles.footerHint}>使用你的团队账号继续进入协作空间。</Typography.Text>
        </Space>
      </motion.section>
    </div>
  );
}
