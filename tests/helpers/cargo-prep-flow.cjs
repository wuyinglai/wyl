/**
 * cargo-prep-flow.cjs
 * 测试辅助函数：从 CharacterSelectScene 经过 CargoPrepScene 进入 MapScene
 *
 * 阶段8.5.1：统一测试流程，避免每个测试重复写相同逻辑
 */

/**
 * 从 CharacterSelectScene 经过 CargoPrepScene 进入 MapScene
 *
 * @param {import('playwright').Page} page
 * @param {(ms: number) => Promise<void>} sleep
 * @param {(condition: boolean, msg: string) => void} assert
 * @returns {Promise<void>}
 */
async function proceedFromCharacterSelectToMap(page, sleep, assert) {
  // 从 CharacterSelectScene 调用 startExpedition
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });

  await sleep(1500);

  // 验证 CargoPrepScene 就绪
  const cargoPrepReady = await page.evaluate(() => {
    const cps = window.game.scene.getScene("CargoPrepScene");
    return !!cps;
  });
  if (assert) assert(cargoPrepReady, "CargoPrepScene 就绪");

  // 从 CargoPrepScene 调用 startExpedition
  await page.evaluate(() => {
    const cps = window.game.scene.getScene("CargoPrepScene");
    if (cps && cps.startExpedition) cps.startExpedition();
  });

  await sleep(2500);

  // 验证 MapScene 就绪
  const mapReady = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    return !!ms;
  });
  if (assert) assert(mapReady, "MapScene 就绪");
}

/**
 * 仅从 CharacterSelectScene 进入 CargoPrepScene（不继续到 MapScene）
 *
 * @param {import('playwright').Page} page
 * @param {(ms: number) => Promise<void>} sleep
 * @param {(condition: boolean, msg: string) => void} assert
 * @returns {Promise<void>}
 */
async function proceedFromCharacterSelectToCargoPrep(page, sleep, assert) {
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });

  await sleep(1500);

  const cargoPrepReady = await page.evaluate(() => {
    const cps = window.game.scene.getScene("CargoPrepScene");
    return !!cps;
  });
  if (assert) assert(cargoPrepReady, "CargoPrepScene 就绪");
}

module.exports = {
  proceedFromCharacterSelectToMap,
  proceedFromCharacterSelectToCargoPrep,
};
