import Phaser from "phaser";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { RouteSelectScene } from "./scenes/RouteSelectScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { CargoPrepScene } from "./scenes/CargoPrepScene";
import { MapScene } from "./scenes/MapScene";
import { BattleScene } from "./scenes/BattleScene";
import {
  getGameState,
  setGameState,
  getMovableNeighbors,
  resolveQuestionCell,
  resetGameState,
} from "./systems/GameState";
import { GOODS, getGoodById, getGoodName, formatGoodsRequirement, validateGoods } from "./data/goods";
import { getOrderById } from "./data/cityOrders";
import {
  createEmptyCargo,
  createCargo,
  getCargoQuantity,
  addCargo,
  removeCargo,
  hasCargo,
  calculateCargoWeight,
  formatCargo,
} from "./systems/cargoSystem";

// 全局错误处理
window.onerror = (message, source, lineno, colno, error) => {
  console.error("[全局错误]", message, source, lineno, colno, error);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error("[未处理的Promise]", event.reason);
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: "app",
  backgroundColor: "#0a0a1a",
  scene: [MainMenuScene, RouteSelectScene, CharacterSelectScene, CargoPrepScene, MapScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
// 暴露到 window 以便调试
(window as any).game = game;
(window as any).getGameState = getGameState;
(window as any).setGameState = setGameState;
(window as any).getMovableNeighbors = getMovableNeighbors;
(window as any).resolveQuestionCell = resolveQuestionCell;
(window as any).resetGameState = resetGameState;
// 商品与货物系统（阶段8.1）
(window as any).GOODS = GOODS;
(window as any).getGoodById = getGoodById;
(window as any).getGoodName = getGoodName;
(window as any).formatGoodsRequirement = formatGoodsRequirement;
(window as any).validateGoods = validateGoods;
(window as any).createEmptyCargo = createEmptyCargo;
(window as any).createCargo = createCargo;
(window as any).getCargoQuantity = getCargoQuantity;
(window as any).addCargo = addCargo;
(window as any).removeCargo = removeCargo;
(window as any).hasCargo = hasCargo;
(window as any).calculateCargoWeight = calculateCargoWeight;
(window as any).formatCargo = formatCargo;
// 订单货物检查工具（阶段8.3）
import {
  checkOrderCargo,
  formatMissingGoods,
  getOrderCargoStatusText,
  checkCargoWeight,
  getCargoWeightStatusText,
} from "./systems/orderCargoSystem";
import { deliverOrder } from "./systems/orderDeliverySystem";
(window as any).checkOrderCargo = checkOrderCargo;
(window as any).formatMissingGoods = formatMissingGoods;
(window as any).getOrderCargoStatusText = getOrderCargoStatusText;
(window as any).checkCargoWeight = checkCargoWeight;
(window as any).getCargoWeightStatusText = getCargoWeightStatusText;
// 订单数据查询（测试需要）
(window as any).getOrderById = getOrderById;
// 订单交付系统（阶段8.4）
(window as any).deliverOrder = deliverOrder;
// 城市贡献与城市状态（阶段8.6）
import {
  getCityProgress,
  getCityStatusLabel,
  formatCityProgress,
  getCityProgressDetailLines,
} from "./systems/cityProgressSystem";
(window as any).getCityProgress = getCityProgress;
(window as any).getCityStatusLabel = getCityStatusLabel;
(window as any).formatCityProgress = formatCityProgress;
(window as any).getCityProgressDetailLines = getCityProgressDetailLines;

console.log("[余烬商队] 阶段2 - 地图探索原型已启动");
