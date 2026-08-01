"use client";

import styled, { keyframes } from "styled-components";
import { Skeleton } from "antd";

/**
 * 仿 Workspace 布局的骨架屏:左侧栏 + 顶栏 + 内容区。
 * 用于登录恢复 / 刷新 / 初次加载,减少等待焦虑。
 * 样式使用 styled-components 组件化。
 */

const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const Shell = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--background, #f7f9fc);
  color: var(--text, #172033);
`;

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 260px;
  flex-shrink: 0;
  padding: 16px 12px;
  border-right: 1px solid var(--line, rgba(148, 163, 184, 0.15));
`;

const BrandBlock = styled.div`
  width: 120px;
  height: 20px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--skeleton-base, rgba(148, 163, 184, 0.08)),
    var(--skeleton-highlight, rgba(148, 163, 184, 0.2)),
    var(--skeleton-base, rgba(148, 163, 184, 0.08))
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
`;

const SidebarSection = styled.div`
  margin-top: 4px;
`;

const SidebarList = styled.div`
  display: grid;
  gap: 8px;
`;

const Main = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
`;

const Topbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line, rgba(148, 163, 184, 0.15));
`;

const Content = styled.div`
  display: grid;
  gap: 16px;
  flex: 1;
  overflow: hidden;
  padding: 24px;
`;

const ContentHeader = styled.div`
  display: grid;
  gap: 8px;
`;

const ContentCard = styled.div`
  padding: 20px;
  border: 1px solid var(--line, rgba(148, 163, 184, 0.12));
  border-radius: 16px;
  background: var(--surface, rgba(255, 255, 255, 0.03));
`;

export function WorkspaceSkeleton() {
  return (
    <Shell>
      <Sidebar>
        <BrandBlock />
        <SidebarSection>
          <Skeleton.Button active size="small" block />
        </SidebarSection>
        <SidebarList>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton.Button key={i} active size="small" block style={{ height: 36 }} />
          ))}
        </SidebarList>
        <SidebarSection>
          <Skeleton.Button active size="small" block />
        </SidebarSection>
        <SidebarList>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton.Button key={i} active size="small" block style={{ height: 36 }} />
          ))}
        </SidebarList>
      </Sidebar>
      <Main>
        <Topbar>
          <Skeleton.Input active size="small" style={{ width: 200 }} />
          <Skeleton.Avatar active size="small" shape="circle" style={{ marginInlineStart: "auto" }} />
        </Topbar>
        <Content>
          <ContentHeader>
            <Skeleton.Input active size="small" style={{ width: 180 }} />
            <Skeleton.Input active size="small" style={{ width: 320 }} />
          </ContentHeader>
          {[0, 1, 2].map((i) => (
            <ContentCard key={i}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </ContentCard>
          ))}
        </Content>
      </Main>
    </Shell>
  );
}
