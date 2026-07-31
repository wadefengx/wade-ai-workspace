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
  { key: "TeamOutlined", icon: createElement(TeamOutlined) },
  { key: "RocketOutlined", icon: createElement(RocketOutlined) },
  { key: "HomeOutlined", icon: createElement(HomeOutlined) },
  { key: "BulbOutlined", icon: createElement(BulbOutlined) },
  { key: "CloudOutlined", icon: createElement(CloudOutlined) },
  { key: "DatabaseOutlined", icon: createElement(DatabaseOutlined) },
  { key: "CodeOutlined", icon: createElement(CodeOutlined) },
  { key: "ExperimentOutlined", icon: createElement(ExperimentOutlined) },
  { key: "FireOutlined", icon: createElement(FireOutlined) },
  { key: "GlobalOutlined", icon: createElement(GlobalOutlined) },
  { key: "HeartOutlined", icon: createElement(HeartOutlined) },
  { key: "StarOutlined", icon: createElement(StarOutlined) },
  { key: "TrophyOutlined", icon: createElement(TrophyOutlined) },
  { key: "AppstoreOutlined", icon: createElement(AppstoreOutlined) },
  { key: "CrownOutlined", icon: createElement(CrownOutlined) },
  { key: "CompassOutlined", icon: createElement(CompassOutlined) }
] as const;

export function renderWorkspaceIcon(name?: string | null) {
  return WORKSPACE_ICONS.find((item) => item.key === name)?.icon ?? createElement(TeamOutlined);
}
