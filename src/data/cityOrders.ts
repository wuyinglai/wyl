// 城市订单数据（阶段7.2）
// 定义可选择的远征订单，关联到特定城市和商路

export interface CityOrder {
  id: string;
  cityId: string;
  routeId: string;
  title: string;
  description: string;
  requiredGoods: Record<string, number>;
  rewardSilver: number;
  rewardEmbers: number;
  cityContribution: number;
  difficulty: string;
  tags: string[];
  isUnlocked: boolean;
}

export const CITY_ORDERS: CityOrder[] = [
  {
    id: "order_ash_supply",
    cityId: "city_ash_post",
    routeId: "route_ash_post",
    title: "基础补给委托",
    description: "灰烬驿城需要一批基础补给，以维持旧商路上的驿站运转。",
    requiredGoods: {
      grain: 5,
    },
    rewardSilver: 30,
    rewardEmbers: 5,
    cityContribution: 1,
    difficulty: "low",
    tags: ["supply", "beginner", "safe"],
    isUnlocked: true,
  },
  {
    id: "order_furnace_food_medicine",
    cityId: "city_furnace_mine",
    routeId: "route_furnace_mine",
    title: "矿工粮药支援",
    description: "矿炉城的矿工缺粮缺药。送达补给后，矿炉才有机会重新点火。",
    requiredGoods: {
      grain: 8,
      medicine: 2,
    },
    rewardSilver: 45,
    rewardEmbers: 8,
    cityContribution: 1,
    difficulty: "medium",
    tags: ["industry", "mine", "support"],
    isUnlocked: true,
  },
  {
    id: "order_heal_spring_medicine",
    cityId: "city_medicine_spring",
    routeId: "route_medicine_spring",
    title: "药材紧急委托",
    description: "药泉城正在救治伤病者，需要尽快获得药材和粮食。",
    requiredGoods: {
      medicine: 4,
      grain: 3,
    },
    rewardSilver: 35,
    rewardEmbers: 8,
    cityContribution: 1,
    difficulty: "low_medium",
    tags: ["medicine", "rescue", "supply"],
    isUnlocked: true,
  },
];

/**
 * 根据路线ID获取订单列表
 */
export function getOrdersByRouteId(routeId: string): CityOrder[] {
  return CITY_ORDERS.filter((order) => order.routeId === routeId);
}

/**
 * 根据城市ID获取订单列表
 */
export function getOrdersByCityId(cityId: string): CityOrder[] {
  return CITY_ORDERS.filter((order) => order.cityId === cityId);
}

/**
 * 根据订单ID获取订单
 */
export function getOrderById(orderId: string): CityOrder | undefined {
  return CITY_ORDERS.find((order) => order.id === orderId);
}

/**
 * 获取路线的默认订单（第一个已解锁的订单）
 */
export function getDefaultOrderForRoute(routeId: string): CityOrder | undefined {
  const orders = getUnlockedOrdersForRoute(routeId);
  return orders.length > 0 ? orders[0] : undefined;
}

/**
 * 获取路线所有已解锁的订单
 */
export function getUnlockedOrdersForRoute(routeId: string): CityOrder[] {
  return CITY_ORDERS.filter((order) => order.routeId === routeId && order.isUnlocked);
}
