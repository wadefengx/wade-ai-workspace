"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider, theme as antdThemeAlgorithms } from "antd";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { antdTheme } from "../theme/antd";
import { useThemeStore } from "../theme/store";
import { useAuthStore } from "../stores/auth";

function AuthBootstrap({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );
  const themeMode = useThemeStore((state) => state.theme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const resolvedTheme = useMemo(
    () => (themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode),
    [systemPrefersDark, themeMode]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return (
    <ConfigProvider
      theme={{
        ...antdTheme,
        algorithm:
          resolvedTheme === "dark"
            ? antdThemeAlgorithms.darkAlgorithm
            : antdThemeAlgorithms.defaultAlgorithm
      }}
    >
      <App>
        <QueryClientProvider client={queryClient}>
          <AuthBootstrap>{children}</AuthBootstrap>
        </QueryClientProvider>
      </App>
    </ConfigProvider>
  );
}
