// C1：Demo 中型地图底座
// 定义 Demo 主线中的地点节点和路线段
// 灰桥镇 → 第一个驿站 → 大安 → 大安周边 → 第一条中程商路 → 第二城方向 → 第二座城市

export type DemoWorldNodeType =
  | "town_start"
  | "outpost"
  | "city"
  | "region"
  | "route_region"
  | "rumor";

export type DemoWorldNodeStatus = "unlocked" | "locked" | "hidden";

export interface DemoWorldNode {
  id: string;
  name: string;
  type: DemoWorldNodeType;
  initialStatus: DemoWorldNodeStatus;
  description: string;
}

export type DemoRouteSegmentType =
  | "tutorial_fixed"
  | "tutorial_semi_random"
  | "local_open"
  | "medium_route"
  | "story_route";

export interface DemoRouteSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: DemoRouteSegmentType;
  initialStatus: DemoWorldNodeStatus;
  description: string;
}

// ============================================================
// 节点：灰桥镇 → 第一个驿站 → 大安 → 大安周边 → 第一条中程商路 → 第二城方向 → 第二座城市
// ============================================================

export const DEMO_WORLD_NODES: DemoWorldNode[] = [
  {
    id: "greybridge",
    name: "灰桥镇",
    type: "town_start",
    initialStatus: "unlocked",
    description: "余烬商队的起点小镇，商队从这里出发。",
  },
  {
    id: "first_outpost",
    name: "第一个驿站",
    type: "outpost",
    initialStatus: "locked",
    description: "灰桥镇到大安之间的中继驿站，提供补给、修车、休整服务。",
  },
  {
    id: "daan",
    name: "大安",
    type: "city",
    initialStatus: "locked",
    description: "第一座可点亮的城市，商队的短期目的地。",
  },
  {
    id: "daan_outskirts",
    name: "大安周边",
    type: "region",
    initialStatus: "locked",
    description: "大安周围的村庄和短途商路区域。",
  },
  {
    id: "mid_route_01",
    name: "第一条中程商路",
    type: "route_region",
    initialStatus: "hidden",
    description: "从大安周边出发，通向第二座城市方向的中程商路。",
  },
  {
    id: "second_city_hint",
    name: "第二城方向",
    type: "rumor",
    initialStatus: "hidden",
    description: "关于第二座城市的传闻和线索。",
  },
  {
    id: "second_city",
    name: "第二座城市",
    type: "city",
    initialStatus: "hidden",
    description: "Demo 最终目标：商队需要点亮的第二座城市。",
  },
];

// ============================================================
// 路线段：按顺序定义
// ============================================================

export const DEMO_ROUTE_SEGMENTS: DemoRouteSegment[] = [
  {
    id: "greybridge_to_first_outpost",
    fromNodeId: "greybridge",
    toNodeId: "first_outpost",
    type: "tutorial_fixed",
    initialStatus: "unlocked",
    description: "N3.1：灰桥镇到第一个驿站的固定教学路线。",
  },
  {
    id: "first_outpost_to_daan",
    fromNodeId: "first_outpost",
    toNodeId: "daan",
    type: "tutorial_semi_random",
    initialStatus: "locked",
    description: "N3.2：从第一个驿站到大安的半随机路线，余烬核心反应出现。",
  },
  {
    id: "daan_to_outskirts",
    fromNodeId: "daan",
    toNodeId: "daan_outskirts",
    type: "local_open",
    initialStatus: "locked",
    description: "大安周边开放区，短途商路与经营。",
  },
  {
    id: "outskirts_to_mid_route",
    fromNodeId: "daan_outskirts",
    toNodeId: "mid_route_01",
    type: "medium_route",
    initialStatus: "hidden",
    description: "第一条中程商路：通向第二座城市方向。",
  },
  {
    id: "mid_route_to_second_hint",
    fromNodeId: "mid_route_01",
    toNodeId: "second_city_hint",
    type: "medium_route",
    initialStatus: "hidden",
    description: "中程商路后半段，开始出现第二城的线索。",
  },
  {
    id: "second_hint_to_second_city",
    fromNodeId: "second_city_hint",
    toNodeId: "second_city",
    type: "story_route",
    initialStatus: "hidden",
    description: "跟随线索，点亮第二座城市——Demo 主线闭环。",
  },
];

// ============================================================
// 纯函数：数据查询工具
// ============================================================

export function getDemoWorldNodeById(nodeId: string): DemoWorldNode | undefined {
  return DEMO_WORLD_NODES.find((n) => n.id === nodeId);
}

export function getDemoWorldRouteById(routeId: string): DemoRouteSegment | undefined {
  return DEMO_ROUTE_SEGMENTS.find((r) => r.id === routeId);
}

export function getDemoWorldNodes(): DemoWorldNode[] {
  return [...DEMO_WORLD_NODES];
}

export function getDemoWorldRoutes(): DemoRouteSegment[] {
  return [...DEMO_ROUTE_SEGMENTS];
}
