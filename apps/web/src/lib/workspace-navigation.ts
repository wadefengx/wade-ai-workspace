export function buildWorkspaceHref(
  pathname: string,
  workspaceId: string | null,
  options?: {
    channelId?: string | null;
  }
) {
  const searchParams = new URLSearchParams();

  if (workspaceId) {
    searchParams.set("workspaceId", workspaceId);
  }

  if (options?.channelId) {
    searchParams.set("channelId", options.channelId);
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
