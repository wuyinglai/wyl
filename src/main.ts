import Phaser from "phaser";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { TownScene } from "./scenes/TownScene";
import { RouteSelectScene } from "./scenes/RouteSelectScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { CargoPrepScene } from "./scenes/CargoPrepScene";
import { MapScene } from "./scenes/MapScene";
import { ExpeditionResultScene } from "./scenes/ExpeditionResultScene";
import { BattleScene } from "./scenes/BattleScene";
import { WorldMapScene } from "./scenes/WorldMapScene";
import { isDevCheatEnabled } from "./systems/devConfig";
import {
  getGameState,
  setGameState,
  getMovableNeighbors,
  resolveQuestionCell,
  resetGameState,
  initOrderTimeState,
  recordOrderStep,
  markOrderCompleted,
  getOrderTimeState,
  moveToCell,
  addUnfinishedOrder,
  removeUnfinishedOrder,
  isUnfinishedOrder,
  getUnfinishedOrderIds,
} from "./systems/GameState";
import { GOODS, getGoodById, getGoodName, formatGoodsRequirement, validateGoods } from "./data/goods";
import { getOrderById, CITY_ORDERS } from "./data/cityOrders";
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

// 远征工具系统（阶段12）
import {
  getAllTools,
  getToolById,
  getToolsByCategory,
  getToolsByRarity,
  isKnownToolId,
  formatToolSummary,
  isToolOwned,
  tryBuyTool,
  formatToolCardSummary,
  formatBuyResultMessage,
  getActiveToolEffectSummary,
  applyCargoProtection,
  applyRetreatCostDiscount,
  applyEncounterReduction,
  applyWeatherResistance,
  applyCaravanProtection,
} from "./systems/toolSystem";

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
  scene: [MainMenuScene, TownScene, RouteSelectScene, CharacterSelectScene, CargoPrepScene, MapScene, ExpeditionResultScene, BattleScene, WorldMapScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
// 暴露到 window 以便调试（无条件暴露）
(window as any).game = game;

// 订单货物检查工具（阶段8.3）
import {
  checkOrderCargo,
  formatMissingGoods,
  getOrderCargoStatusText,
  checkCargoWeight,
  getCargoWeightStatusText,
} from "./systems/orderCargoSystem";
import { deliverOrder } from "./systems/orderDeliverySystem";

// 城市贡献与城市状态（阶段8.6）
import {
  getCityProgress,
  getCityStatusLabel,
  formatCityProgress,
  getCityProgressDetailLines,
} from "./systems/cityProgressSystem";

// 远征结算系统（阶段8.7）
import {
  createSuccessExpeditionResult,
  formatExpeditionResult,
  createRetreatedExpeditionResult,
  createFailedExpeditionResult,
} from "./systems/expeditionResultSystem";

// 撤退系统（阶段10.1）
import {
  calculateRetreatSupplyCost,
  checkRetreatCost,
  getRetreatCostText,
} from "./systems/retreatSystem";

// 城市复兴系统（阶段13.1）
import {
  applyPassiveCityRevival,
  getCityRevivalState,
  getAllCityRevivalStates,
  calculateCityRevivalLevel,
  formatCityRevivalBrief,
  getCityDisplayName,
  getCityRevivalLevelLabel,
} from "./systems/cityRevivalSystem";

// 测试 API（仅开发/测试模式暴露）
function exposeTestApi(): void {
  const w = window as any;

  // 游戏状态 API
  w.getGameState = getGameState;
  w.setGameState = setGameState;
  w.getMovableNeighbors = getMovableNeighbors;
  w.resolveQuestionCell = resolveQuestionCell;
  w.resetGameState = resetGameState;
  w.moveToCell = moveToCell;
  
  // 订单时间管理 API（阶段10.2）
  w.initOrderTimeState = initOrderTimeState;
  w.recordOrderStep = recordOrderStep;
  w.markOrderCompleted = markOrderCompleted;
  w.getOrderTimeState = getOrderTimeState;
  
  // 未完成订单管理 API（阶段10.3）
  w.addUnfinishedOrder = addUnfinishedOrder;
  w.removeUnfinishedOrder = removeUnfinishedOrder;
  w.isUnfinishedOrder = isUnfinishedOrder;
  w.getUnfinishedOrderIds = getUnfinishedOrderIds;
  
  // 订单数据
  w.CITY_ORDERS = CITY_ORDERS;

  // 商品与货物系统
  w.GOODS = GOODS;
  w.getGoodById = getGoodById;
  w.getGoodName = getGoodName;
  w.formatGoodsRequirement = formatGoodsRequirement;
  w.validateGoods = validateGoods;
  w.createEmptyCargo = createEmptyCargo;
  w.createCargo = createCargo;
  w.getCargoQuantity = getCargoQuantity;
  w.addCargo = addCargo;
  w.removeCargo = removeCargo;
  w.hasCargo = hasCargo;
  w.calculateCargoWeight = calculateCargoWeight;
  w.formatCargo = formatCargo;

  // 订单货物检查工具
  w.checkOrderCargo = checkOrderCargo;
  w.formatMissingGoods = formatMissingGoods;
  w.getOrderCargoStatusText = getOrderCargoStatusText;
  w.checkCargoWeight = checkCargoWeight;
  w.getCargoWeightStatusText = getCargoWeightStatusText;

  // 订单数据查询
  w.getOrderById = getOrderById;

  // 订单交付系统
  w.deliverOrder = deliverOrder;

  // 城市贡献与城市状态
  w.getCityProgress = getCityProgress;
  w.getCityStatusLabel = getCityStatusLabel;
  w.formatCityProgress = formatCityProgress;
  w.getCityProgressDetailLines = getCityProgressDetailLines;

  // 远征结算系统
  w.createSuccessExpeditionResult = createSuccessExpeditionResult;
  w.formatExpeditionResult = formatExpeditionResult;
  w.createRetreatedExpeditionResult = createRetreatedExpeditionResult;
  w.createFailedExpeditionResult = createFailedExpeditionResult;

  // 撤退系统（阶段10.1）
  w.calculateRetreatSupplyCost = calculateRetreatSupplyCost;
  w.checkRetreatCost = checkRetreatCost;
  w.getRetreatCostText = getRetreatCostText;

  // 远征工具系统（阶段12）
  w.getAllTools = getAllTools;
  w.getToolById = getToolById;
  w.getToolsByCategory = getToolsByCategory;
  w.getToolsByRarity = getToolsByRarity;
  w.isKnownToolId = isKnownToolId;
  w.formatToolSummary = formatToolSummary;
  w.isToolOwned = isToolOwned;
  w.tryBuyTool = tryBuyTool;
  w.formatToolCardSummary = formatToolCardSummary;
  w.formatBuyResultMessage = formatBuyResultMessage;
  w.getActiveToolEffectSummary = getActiveToolEffectSummary;
  w.applyCargoProtection = applyCargoProtection;
  w.applyRetreatCostDiscount = applyRetreatCostDiscount;
  w.applyEncounterReduction = applyEncounterReduction;
  w.applyWeatherResistance = applyWeatherResistance;
  w.applyCaravanProtection = applyCaravanProtection;

  // 城市复兴系统（阶段13.1）
  w.applyPassiveCityRevival = applyPassiveCityRevival;
  w.getCityRevivalState = getCityRevivalState;
  w.getAllCityRevivalStates = getAllCityRevivalStates;
  w.calculateCityRevivalLevel = calculateCityRevivalLevel;
  w.formatCityRevivalBrief = formatCityRevivalBrief;
  w.getCityDisplayName = getCityDisplayName;
  w.getCityRevivalLevelLabel = getCityRevivalLevelLabel;
}

// 只在开发/测试模式暴露测试 API
if (isDevCheatEnabled()) {
  exposeTestApi();
}

console.log("[余烬商队] 阶段2 - 地图探索原型已启动");
