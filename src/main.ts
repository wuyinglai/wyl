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
  applyOrderCityRevival,
  calculateOrderRevivalGain,
  hasOrderRevivalApplied,
  getCityRevivalRewardBonus,
  calculateCityRevivalBonusSilver,
  formatCityRevivalBonusText,
  formatCityRevivalStatus,
} from "./systems/cityRevivalSystem";

// C1：Demo 中型地图底座
import {
  DEMO_WORLD_NODES,
  DEMO_ROUTE_SEGMENTS,
  getDemoWorldNodeById,
  getDemoWorldRouteById,
  getDemoWorldNodes,
  getDemoWorldRoutes,
} from "./data/demoWorldMap";
import {
  createInitialDemoWorldMapState,
  getAllDemoWorldNodes,
  getAllDemoWorldRoutes,
  getDemoWorldNode,
  getDemoWorldRoute,
  getUnlockedDemoWorldNodes,
  getUnlockedDemoWorldRoutes,
  unlockDemoWorldNode,
  unlockDemoWorldRoute,
  isDemoWorldNodeUnlocked,
  isDemoWorldRouteUnlocked,
  setCurrentDemoWorldNode,
  addKnownDemoWorldRumor,
  getNodeInitialStatus,
  getRouteInitialStatus,
} from "./systems/demoWorldMapSystem";

// C2：Demo 主线状态
import {
  DEMO_MAIN_QUEST_ORDER,
  DEMO_MAIN_QUEST_OBJECTIVE_TEXT,
} from "./data/demoMainQuest";
import {
  createInitialDemoMainQuestState,
  getCurrentDemoMainQuestStage,
  getCurrentEmberCoreStatus,
  getCurrentMainQuestObjective,
  getCurrentMainQuestTitle,
  getCurrentMainQuestOrder,
  isEmberCoreCarried,
  isMainQuestTargetNode,
  isCurrentStepTargetNode,
  isFinalTargetNode,
  advanceDemoMainQuestStage,
  setEmberCoreStatus,
  markActiveMainQuestCompleted,
  advanceOnFirstOutpost,
  advanceOnDaanActivated,
  advanceOnSecondCityHint,
  advanceOnSecondCityActivated,
} from "./systems/demoMainQuestSystem";

// C3a：N3.1 固定教学路线
import {
  getN31TutorialRouteNodes,
  getN31TutorialRouteNodeById,
  getFirstN31TutorialRouteNode,
  getLastN31TutorialRouteNode,
} from "./data/tutorialRouteN31";
import {
  createInitialTutorialRouteProgressState,
  startN31TutorialRoute,
  getCurrentTutorialRouteNode,
  completeTutorialNode,
  skipOptionalTutorialNode,
  advanceToNextTutorialNode,
  isTutorialNodeCompleted,
  isTutorialRouteCompleted,
  getAvailableNextTutorialNodes,
} from "./systems/tutorialRouteSystem";

// C3b：N3.1 教学事件
import {
  getN31TutorialEvents,
  getTutorialEventByNodeId,
  getTutorialEventById,
} from "./data/tutorialEventsN31";
import {
  canResolveTutorialEvent,
  resolveTutorialEventChoice,
  isTutorialEventResolved,
} from "./systems/tutorialEventSystem";

// C3c：N3.1 普通战斗（胜利结算；不实现失败、不大改 BattleScene）
import {
  getN31TutorialBattles,
  getTutorialBattleByNodeId,
  getTutorialBattleById,
  isTutorialBattleNode,
} from "./data/tutorialBattlesN31";
import {
  canResolveTutorialBattle,
  resolveTutorialBattleVictory,
  isTutorialBattleResolved,
  getTutorialBattleEnemies,
  getTutorialBattleReward,
} from "./systems/tutorialBattleSystem";

// C3d：N3.1 特殊战斗（劫匪抢货战；protect_cargo + cargoIntegrity）
import {
  getN31TutorialSpecialBattles,
  getTutorialSpecialBattleByNodeId,
  getTutorialSpecialBattleById,
  isTutorialSpecialBattleNode,
} from "./data/tutorialSpecialBattlesN31";
import {
  getTutorialSpecialBattleObjectives,
  getTutorialSpecialBattleEnemies,
  getTutorialSpecialBattleReward,
  createInitialSpecialBattleObjectiveState,
  canResolveTutorialSpecialBattle,
  resolveTutorialSpecialBattleVictory,
  resolveTutorialSpecialBattleCargoLoss,
  isTutorialSpecialBattleResolved,
} from "./systems/tutorialSpecialBattleSystem";

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
  // 城市复兴系统（阶段13.2）：订单联动
  w.applyOrderCityRevival = applyOrderCityRevival;
  w.calculateOrderRevivalGain = calculateOrderRevivalGain;
  w.hasOrderRevivalApplied = hasOrderRevivalApplied;
  // 城市复兴系统（阶段13.3）：等级反馈 + 奖励加成
  w.getCityRevivalRewardBonus = getCityRevivalRewardBonus;
  w.calculateCityRevivalBonusSilver = calculateCityRevivalBonusSilver;
  w.formatCityRevivalBonusText = formatCityRevivalBonusText;
  w.formatCityRevivalStatus = formatCityRevivalStatus;

  // C1：Demo 中型地图底座
  w.DEMO_WORLD_NODES = DEMO_WORLD_NODES;
  w.DEMO_ROUTE_SEGMENTS = DEMO_ROUTE_SEGMENTS;
  w.getDemoWorldNodes = getDemoWorldNodes;
  w.getDemoWorldRoutes = getDemoWorldRoutes;
  w.getDemoWorldNodeById = getDemoWorldNodeById;
  w.getDemoWorldRouteById = getDemoWorldRouteById;
  w.getAllDemoWorldNodes = getAllDemoWorldNodes;
  w.getAllDemoWorldRoutes = getAllDemoWorldRoutes;
  w.getDemoWorldNode = getDemoWorldNode;
  w.getDemoWorldRoute = getDemoWorldRoute;
  w.getUnlockedDemoWorldNodes = (state: any) => getUnlockedDemoWorldNodes(state);
  w.getUnlockedDemoWorldRoutes = (state: any) => getUnlockedDemoWorldRoutes(state);
  w.unlockDemoWorldNode = (state: any, nodeId: string) => unlockDemoWorldNode(state, nodeId);
  w.unlockDemoWorldRoute = (state: any, routeId: string) => unlockDemoWorldRoute(state, routeId);
  w.isDemoWorldNodeUnlocked = (state: any, nodeId: string) => isDemoWorldNodeUnlocked(state, nodeId);
  w.isDemoWorldRouteUnlocked = (state: any, routeId: string) => isDemoWorldRouteUnlocked(state, routeId);
  w.setCurrentDemoWorldNode = (state: any, nodeId: string) => setCurrentDemoWorldNode(state, nodeId);
  w.addKnownDemoWorldRumor = (state: any, rumorNodeId: string) => addKnownDemoWorldRumor(state, rumorNodeId);
  w.getNodeInitialStatus = getNodeInitialStatus;
  w.getRouteInitialStatus = getRouteInitialStatus;
  w.createInitialDemoWorldMapState = createInitialDemoWorldMapState;

  // C2：Demo 主线状态
  w.DEMO_MAIN_QUEST_ORDER = DEMO_MAIN_QUEST_ORDER;
  w.DEMO_MAIN_QUEST_OBJECTIVE_TEXT = DEMO_MAIN_QUEST_OBJECTIVE_TEXT;
  w.createInitialDemoMainQuestState = createInitialDemoMainQuestState;
  w.getCurrentDemoMainQuestStage = (s: any) => getCurrentDemoMainQuestStage(s);
  w.getCurrentEmberCoreStatus = (s: any) => getCurrentEmberCoreStatus(s);
  w.getCurrentMainQuestObjective = (s: any) => getCurrentMainQuestObjective(s);
  w.getCurrentMainQuestTitle = (s: any) => getCurrentMainQuestTitle(s);
  w.getCurrentMainQuestOrder = getCurrentMainQuestOrder;
  w.isEmberCoreCarried = (s: any) => isEmberCoreCarried(s);
  w.isMainQuestTargetNode = (s: any, nodeId: string) => isMainQuestTargetNode(s, nodeId);
  w.isCurrentStepTargetNode = (s: any, nodeId: string) => isCurrentStepTargetNode(s, nodeId);
  w.isFinalTargetNode = (s: any, nodeId: string) => isFinalTargetNode(s, nodeId);
  w.advanceDemoMainQuestStage = (s: any, next: any) => advanceDemoMainQuestStage(s, next);
  w.setEmberCoreStatus = (s: any, next: any) => setEmberCoreStatus(s, next);
  w.markActiveMainQuestCompleted = (s: any) => markActiveMainQuestCompleted(s);
  w.advanceOnFirstOutpost = (s: any) => advanceOnFirstOutpost(s);
  w.advanceOnDaanActivated = (s: any) => advanceOnDaanActivated(s);
  w.advanceOnSecondCityHint = (s: any) => advanceOnSecondCityHint(s);
  w.advanceOnSecondCityActivated = (s: any) => advanceOnSecondCityActivated(s);

  // C3a：N3.1 固定教学路线
  w.getN31TutorialRouteNodes = getN31TutorialRouteNodes;
  w.getN31TutorialRouteNodeById = getN31TutorialRouteNodeById;
  w.getFirstN31TutorialRouteNode = getFirstN31TutorialRouteNode;
  w.getLastN31TutorialRouteNode = getLastN31TutorialRouteNode;
  w.createInitialTutorialRouteProgressState = createInitialTutorialRouteProgressState;
  w.startN31TutorialRoute = (s: any) => startN31TutorialRoute(s);
  w.getCurrentTutorialRouteNode = (s: any) => getCurrentTutorialRouteNode(s);
  w.completeTutorialNode = (s: any, nodeId: string) => completeTutorialNode(s, nodeId);
  w.skipOptionalTutorialNode = (s: any, nodeId: string) => skipOptionalTutorialNode(s, nodeId);
  w.advanceToNextTutorialNode = (s: any) => advanceToNextTutorialNode(s);
  w.isTutorialNodeCompleted = (s: any, nodeId: string) => isTutorialNodeCompleted(s, nodeId);
  w.isTutorialRouteCompleted = (s: any) => isTutorialRouteCompleted(s);
  w.getAvailableNextTutorialNodes = (s: any) => getAvailableNextTutorialNodes(s);

  // C3b：N3.1 教学事件
  w.getN31TutorialEvents = getN31TutorialEvents;
  w.getTutorialEventByNodeId = (nodeId: string) => getTutorialEventByNodeId(nodeId);
  w.getTutorialEventById = (eventId: string) => getTutorialEventById(eventId);
  w.canResolveTutorialEvent = (s: any, eventId: string) => canResolveTutorialEvent(s, eventId);
  w.resolveTutorialEventChoice = (s: any, eventId: string, choiceId: string) =>
    resolveTutorialEventChoice(s, eventId, choiceId);
  w.isTutorialEventResolved = (s: any, eventId: string) => isTutorialEventResolved(s, eventId);

  // C3c：N3.1 普通战斗（不包含 Boss / 劫匪特殊战 / 灰烬母巢精英）
  w.getN31TutorialBattles = getN31TutorialBattles;
  w.getTutorialBattleByNodeId = (nodeId: string) => getTutorialBattleByNodeId(nodeId);
  w.getTutorialBattleById = (battleId: string) => getTutorialBattleById(battleId);
  w.isTutorialBattleNode = (nodeId: string) => isTutorialBattleNode(nodeId);
  w.getTutorialBattleEnemies = (battleId: string) => getTutorialBattleEnemies(battleId);
  w.getTutorialBattleReward = (battleId: string) => getTutorialBattleReward(battleId);
  w.canResolveTutorialBattle = (s: any, battleId: string) => canResolveTutorialBattle(s, battleId);
  w.resolveTutorialBattleVictory = (s: any, battleId: string) =>
    resolveTutorialBattleVictory(s, battleId);
  w.isTutorialBattleResolved = (s: any, battleId: string) => isTutorialBattleResolved(s, battleId);

  // C3d：N3.1 特殊战斗（劫匪抢货战：protect_cargo + cargoIntegrity）
  w.getN31TutorialSpecialBattles = getN31TutorialSpecialBattles;
  w.getTutorialSpecialBattleByNodeId = (nodeId: string) =>
    getTutorialSpecialBattleByNodeId(nodeId);
  w.getTutorialSpecialBattleById = (specialBattleId: string) =>
    getTutorialSpecialBattleById(specialBattleId);
  w.isTutorialSpecialBattleNode = (nodeId: string) => isTutorialSpecialBattleNode(nodeId);
  w.getTutorialSpecialBattleObjectives = (specialBattleId: string) =>
    getTutorialSpecialBattleObjectives(specialBattleId);
  w.getTutorialSpecialBattleEnemies = (specialBattleId: string) =>
    getTutorialSpecialBattleEnemies(specialBattleId);
  w.getTutorialSpecialBattleReward = (specialBattleId: string) =>
    getTutorialSpecialBattleReward(specialBattleId);
  w.createInitialSpecialBattleObjectiveState = (specialBattleId: string) =>
    createInitialSpecialBattleObjectiveState(specialBattleId);
  w.canResolveTutorialSpecialBattle = (s: any, specialBattleId: string) =>
    canResolveTutorialSpecialBattle(s, specialBattleId);
  w.resolveTutorialSpecialBattleVictory = (s: any, specialBattleId: string) =>
    resolveTutorialSpecialBattleVictory(s, specialBattleId);
  w.resolveTutorialSpecialBattleCargoLoss = (s: any, specialBattleId: string, loss: number) =>
    resolveTutorialSpecialBattleCargoLoss(s, specialBattleId, loss);
  w.isTutorialSpecialBattleResolved = (s: any, specialBattleId: string) =>
    isTutorialSpecialBattleResolved(s, specialBattleId);
}

// 只在开发/测试模式暴露测试 API
if (isDevCheatEnabled()) {
  exposeTestApi();
}

console.log("[余烬商队] 阶段2 - 地图探索原型已启动");
