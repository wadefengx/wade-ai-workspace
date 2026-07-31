"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { antdTheme } from "../theme/antd";
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

  return (
    <ConfigProvider theme={antdTheme}>
      <App>
        <QueryClientProvider client={queryClient}>
          <AuthBootstrap>{children}</AuthBootstrap>
        </QueryClientProvider>
      </App>
    </ConfigProvider>
  );
}
