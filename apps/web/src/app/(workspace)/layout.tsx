"use client";

import { useQuery } from "@tanstack/react-query";
import { Layout } from "antd";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import { FullScreenSpinner, useRequireAuth } from "../../components/auth-status";
import {
  fetchChannels,
  fetchMembers,
  fetchWorkspaces,
  WorkspaceContextProvider,
  workspaceKeys
} from "../../components/workspace-context";
import { WorkspaceNavigation } from "../../components/workspace-navigation";
import { buildWorkspaceHref } from "../../lib/workspace-navigation";
import styles from "../../components/workspace-shell.module.css";

function WorkspaceLayoutContent({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hydrated, isRestoring, user } = useRequireAuth();
  const requestedWorkspaceId = searchParams.get("workspaceId");
  const requestedChannelId = searchParams.get("channelId");

  const workspacesQuery = useQuery({
    queryKey: workspaceKeys.all,
    queryFn: fetchWorkspaces,
    enabled: !!user
  });

  const workspaces = useMemo(() => workspacesQuery.data ?? [], [workspacesQuery.data]);
  const workspaceId = useMemo(() => {
    if (!workspaces.length) {
      return null;
    }

    return workspaces.some((workspace) => workspace.id === requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspaces[0].id;
  }, [requestedWorkspaceId, workspaces]);

  const channelsQuery = useQuery({
    queryKey: workspaceKeys.channels(workspaceId),
    queryFn: () => fetchChannels(workspaceId as string),
    enabled: !!workspaceId
  });

  const membersQuery = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => fetchMembers(workspaceId as string),
    enabled: !!workspaceId
  });

  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaceId, workspaces]
  );
  const selectedChannelId = useMemo(() => {
    if (!channels.length) {
      return null;
    }

    return channels.some((channel) => channel.id === requestedChannelId) ? requestedChannelId : channels[0].id;
  }, [channels, requestedChannelId]);
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  );

  useEffect(() => {
    if (!workspaceId || requestedWorkspaceId === workspaceId) {
      return;
    }

    router.replace(
      buildWorkspaceHref(pathname, workspaceId, {
        channelId: requestedChannelId
      })
    );
  }, [pathname, requestedChannelId, requestedWorkspaceId, router, workspaceId]);

  if (!hydrated || isRestoring || workspacesQuery.isLoading) {
    return <FullScreenSpinner />;
  }

  if (!user) {
    return <FullScreenSpinner />;
  }

  return (
    <WorkspaceContextProvider
      value={{
        workspaceId,
        workspaces,
        workspacesLoading: workspacesQuery.isLoading,
        selectedWorkspace,
        channels,
        channelsLoading: channelsQuery.isLoading,
        selectedChannelId,
        selectedChannel,
        members,
        membersLoading: membersQuery.isLoading
      }}
    >
      <Layout className={styles.shell}>
        <WorkspaceNavigation />
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", overflow: "hidden" }}
        >
          {children}
        </motion.div>
      </Layout>
    </WorkspaceContextProvider>
  );
}

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <WorkspaceLayoutContent>{children}</WorkspaceLayoutContent>
    </Suspense>
  );
}
