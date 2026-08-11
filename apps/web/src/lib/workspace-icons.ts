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
  { key: "TeamOutlined", label: "Team", icon: createElement(TeamOutlined) },
  { key: "RocketOutlined", label: "Rocket", icon: createElement(RocketOutlined) },
  { key: "HomeOutlined", label: "Home", icon: createElement(HomeOutlined) },
  { key: "BulbOutlined", label: "Idea", icon: createElement(BulbOutlined) },
  { key: "CloudOutlined", label: "Cloud", icon: createElement(CloudOutlined) },
  { key: "DatabaseOutlined", label: "Data", icon: createElement(DatabaseOutlined) },
  { key: "CodeOutlined", label: "Code", icon: createElement(CodeOutlined) },
  { key: "ExperimentOutlined", label: "Experiment", icon: createElement(ExperimentOutlined) },
  { key: "FireOutlined", label: "Fire", icon: createElement(FireOutlined) },
  { key: "GlobalOutlined", label: "Global", icon: createElement(GlobalOutlined) },
  { key: "HeartOutlined", label: "Care", icon: createElement(HeartOutlined) },
  { key: "StarOutlined", label: "Star", icon: createElement(StarOutlined) },
  { key: "TrophyOutlined", label: "Trophy", icon: createElement(TrophyOutlined) },
  { key: "AppstoreOutlined", label: "Apps", icon: createElement(AppstoreOutlined) },
  { key: "CrownOutlined", label: "Crown", icon: createElement(CrownOutlined) },
  { key: "CompassOutlined", label: "Compass", icon: createElement(CompassOutlined) }
] as const;

export function renderWorkspaceIcon(name?: string | null) {
  return WORKSPACE_ICONS.find((item) => item.key === name)?.icon ?? createElement(TeamOutlined);
}

export function getWorkspaceIconLabel(name?: string | null) {
  return WORKSPACE_ICONS.find((item) => item.key === name)?.label ?? "Team";
}
