// 商路与目标城市数据（阶段7.1）
// 定义可选择的远征目标城市和商路方案

export interface CityRoute {
  id: string;
  cityId: string;
  cityName: string;
  routeName: string;
  title: string;
  tagline: string;
  description: string;
  riskLevel: "低" | "低-中" | "中" | "中-高" | "高";
  profitLevel: "低" | "低-中" | "中" | "中-高" | "高";
  supplyLevel: "普通" | "丰富" | "稀少";
  combatLevel: "少" | "普通" | "中" | "高";
  tradeLevel: "普通" | "高" | "低";
  recommendedGoods: string[];
  recommendedCharacters: string[];
  mapTheme: string;
  isUnlocked: boolean;
}

export const CITY_ROUTES: CityRoute[] = [
  {
    id: "route_ash_post",
    cityId: "city_ash_post",
    cityName: "灰烬驿城",
    routeName: "灰烬荒原线",
    title: "灰烬驿城 / 灰烬荒原线",
    tagline: "新手安全路线",
    description: "稳定旧商路，适合完成基础远征。沿途补给点较多，敌人较弱，是初次远征的理想选择。",
    riskLevel: "低",
    profitLevel: "低-中",
    supplyLevel: "普通",
    combatLevel: "普通",
    tradeLevel: "普通",
    recommendedGoods: ["粮食", "盐"],
    recommendedCharacters: ["守卫", "枪手", "修理工"],
    mapTheme: "ash_wasteland",
    isUnlocked: true,
  },
  {
    id: "route_furnace_mine",
    cityId: "city_furnace_mine",
    cityName: "矿炉城",
    routeName: "铁锈矿区线",
    title: "矿炉城 / 铁锈矿区线",
    tagline: "工业支援路线",
    description: "矿场与机械废墟较多，旧零件价值高。适合有经验的商队，收益可观但风险也相应增加。",
    riskLevel: "中",
    profitLevel: "高",
    supplyLevel: "普通",
    combatLevel: "中",
    tradeLevel: "高",
    recommendedGoods: ["粮食", "药材", "旧零件"],
    recommendedCharacters: ["修理工", "守卫", "学者"],
    mapTheme: "rust_mine",
    isUnlocked: true,
  },
  {
    id: "route_medicine_spring",
    cityId: "city_medicine_spring",
    cityName: "药泉城",
    routeName: "河谷补给线",
    title: "药泉城 / 河谷补给线",
    tagline: "医疗与补给路线",
    description: "村落与补给点较多，适合稳健推进。医疗资源丰富，能有效恢复队伍状态。",
    riskLevel: "低-中",
    profitLevel: "中",
    supplyLevel: "丰富",
    combatLevel: "少",
    tradeLevel: "普通",
    recommendedGoods: ["药材", "粮食", "布匹"],
    recommendedCharacters: ["医师", "厨师", "斥候"],
    mapTheme: "valley_supply",
    isUnlocked: true,
  },
];

/**
 * 获取所有已解锁的商路
 */
export function getUnlockedRoutes(): CityRoute[] {
  return CITY_ROUTES.filter((route) => route.isUnlocked);
}

/**
 * 根据ID获取商路
 */
export function getRouteById(id: string): CityRoute | undefined {
  return CITY_ROUTES.find((route) => route.id === id);
}

/**
 * 根据城市ID获取商路
 */
export function getRouteByCityId(cityId: string): CityRoute | undefined {
  return CITY_ROUTES.find((route) => route.cityId === cityId);
}
