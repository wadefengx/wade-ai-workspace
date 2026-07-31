import {
  AppstoreOutlined,
  BulbOutlined,
  CloudOutlined,
  CodeOutlined,
  CompassOutlined,
  CrownOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FireOutlined,
  GlobalOutlined,
  HeartOutlined,
  HomeOutlined,
  RocketOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined
} from "@ant-design/icons";
import { createElement } from "react";

export const WORKSPACE_ICONS = [
  { key: "TeamOutlined", label: "团队", icon: createElement(TeamOutlined) },
  { key: "RocketOutlined", label: "火箭", icon: createElement(RocketOutlined) },
  { key: "HomeOutlined", label: "家园", icon: createElement(HomeOutlined) },
  { key: "BulbOutlined", label: "灵感", icon: createElement(BulbOutlined) },
  { key: "CloudOutlined", label: "云端", icon: createElement(CloudOutlined) },
  { key: "DatabaseOutlined", label: "数据", icon: createElement(DatabaseOutlined) },
  { key: "CodeOutlined", label: "代码", icon: createElement(CodeOutlined) },
  { key: "ExperimentOutlined", label: "实验", icon: createElement(ExperimentOutlined) },
  { key: "FireOutlined", label: "热度", icon: createElement(FireOutlined) },
  { key: "GlobalOutlined", label: "全球", icon: createElement(GlobalOutlined) },
  { key: "HeartOutlined", label: "关怀", icon: createElement(HeartOutlined) },
  { key: "StarOutlined", label: "星标", icon: createElement(StarOutlined) },
  { key: "TrophyOutlined", label: "奖杯", icon: createElement(TrophyOutlined) },
  { key: "AppstoreOutlined", label: "应用", icon: createElement(AppstoreOutlined) },
  { key: "CrownOutlined", label: "王冠", icon: createElement(CrownOutlined) },
  { key: "CompassOutlined", label: "罗盘", icon: createElement(CompassOutlined) }
] as const;

export function renderWorkspaceIcon(name?: string | null) {
  return WORKSPACE_ICONS.find((item) => item.key === name)?.icon ?? createElement(TeamOutlined);
}

export function getWorkspaceIconLabel(name?: string | null) {
  return WORKSPACE_ICONS.find((item) => item.key === name)?.label ?? "团队";
}
