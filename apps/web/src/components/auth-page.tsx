"use client";

import { useMutation } from "@tanstack/react-query";
import { App, Button, Form, Input, Space, Typography } from "antd";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AuthUser } from "../stores/auth";
import { useAuthStore } from "../stores/auth";
import styles from "./auth-page.module.css";
import { LoadingState } from "./ui-state";

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
    title: "Sign in to Wade AI",
    subtitle: "Enter your team AI workspace.",
    submitLabel: "Sign in",
    alternateLabel: "Don’t have an account?",
    alternateHref: "/register",
    alternateCta: "Sign up",
    successMessage: "Signed in successfully",
    endpoint: "/auth/login"
  },
  register: {
    title: "Create a Wade AI account",
    subtitle: "Sign up to create or join a workspace.",
    submitLabel: "Sign up",
    alternateLabel: "Already have an account?",
    alternateHref: "/login",
    alternateCta: "Sign in",
    successMessage: "Signed up successfully",
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
        setSubmitError("The sign-in response is missing an access token");
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
      setSubmitError(error instanceof ApiError ? error.message : "Request failed. Please try again later.");
    }
  });

  if (!hydrated || isRestoring) {
    return <LoadingState fullscreen title="Restoring session" description="Please wait while we open your workspace." />;
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
                Wade AI
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
              label="Name"
              rules={[{ required: true, message: "Enter your name" }]}
            >
              <Input autoComplete="name" placeholder="Wade" className={styles.input} />
            </Form.Item>
          ) : null}

          <Form.Item<LoginValues>
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Enter your email" },
              { type: "email", message: "Enter a valid email address" }
            ]}
          >
            <Input autoComplete="email" placeholder="wade@example.com" className={styles.input} />
          </Form.Item>

          <Form.Item<LoginValues>
            name="password"
            label="Password"
            rules={[{ required: true, message: "Enter your password" }]}
          >
            <Input.Password autoComplete="current-password" placeholder="Enter your password" className={styles.input} />
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
          <Typography.Text className={styles.footerHint}>Continue with your team account to enter the collaborative workspace.</Typography.Text>
        </Space>
      </motion.section>
    </div>
  );
}
