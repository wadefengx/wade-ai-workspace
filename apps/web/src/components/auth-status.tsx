"use client";

import { Spin } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";

export function useRequireAuth() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (hydrated && !isRestoring && !user) {
      router.replace("/login");
    }
  }, [hydrated, isRestoring, router, user]);

  return {
    hydrated,
    isRestoring,
    user
  };
}

export function FullScreenSpinner() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Spin size="large" />
    </div>
  );
}
