// 奖励系统模块（阶段6.4）
// 从 BattleScene 中轻量抽离的奖励生成和入牌组逻辑

import { CardDef, CharacterId } from "../data/types";
import { CHARACTER_DEFS, generateRewardCards } from "../data/characters";
import { getGameState, setGameState } from "./GameState";

/**
 * 生成战斗奖励卡牌
 * - 排除死亡角色
 * - 优先从 REWARD_CARDS 抽取
 * - 返回3张不重复的候选卡
 */
export function generateBattleRewardCards(
  selectedCharacters: CharacterId[],
  characterStates: Record<CharacterId, { isDead?: boolean }>,
): CardDef[] {
  const aliveTeamIds = selectedCharacters.filter(
    (id) => !characterStates[id]?.isDead,
  );
  return generateRewardCards(aliveTeamIds);
}

/**
 * 将奖励卡加入角色牌组
 * - 深拷贝卡牌
 * - 生成唯一 instanceId
 * - 持久化到 GameState
 * - 返回新卡牌实例
 */
export function addRewardCardToDeck(card: CardDef): CardDef | null {
  const gameState = getGameState();
  const charId = card.characterId;
  const charState = gameState.characterStates[charId];

  if (!charState) {
    console.error(`[奖励] 角色状态不存在: ${charId}`);
    return null;
  }

  // 深拷贝卡牌并生成唯一 instanceId
  const newCard: CardDef = {
    ...card,
    effects: card.effects.map((e) => ({ ...e })),
    instanceId: `${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  charState.deck.push(newCard);
  setGameState(gameState);

  const charName = CHARACTER_DEFS[charId].name;
  console.log(
    `[奖励] 加入卡牌: ${card.name} → ${charName}，当前牌组: ${charState.deck.length}张`,
  );
  console.log(
    `[奖励] ${charName} 牌组: ${charState.deck.map((c) => c.name).join(", ")}`,
  );

  return newCard;
}
