/**
 * smoke-test-production-api-guard-9-3-2.cjs
 * 阶段9.3.2：生产环境测试 API 守卫验收
 * 验证正式构建中测试 API 不可用
 */

const { chromium } = require("playwright");
const { spawn } = require("child_process");

async function main() {
  let server = null;
  let serverExited = false;
  
  try {
    // 启动 vite preview（生产构建预览）
    server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    
    // 监听服务器输出
    server.stdout.on('data', (data) => {
      console.log(`[vite] ${data.toString().trim()}`);
    });
    
    server.stderr.on('data', (data) => {
      console.log(`[vite] ${data.toString().trim()}`);
    });
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // 不设置 __EMBER_TEST_MODE__（关键！）
    
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // 等待游戏初始化
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    
    // 断言测试 API 为 undefined
    const apis = [
      'getGameState',
      'setGameState',
      'resetGameState',
      'addCargo',
      'removeCargo',
      'deliverOrder',
      'createSuccessExpeditionResult',
    ];
    
    let allPassed = true;
    for (const api of apis) {
      const result = await page.evaluate((name) => {
        return typeof window[name] === 'undefined';
      }, api);
      
      if (!result) {
        console.error(`FAIL: ${api} should be undefined in production`);
        allPassed = false;
      } else {
        console.log(`PASS: ${api} is undefined`);
      }
    }
    
    // 验证 game 对象仍然存在（正常功能不受影响）
    const hasGame = await page.evaluate(() => typeof window.game !== 'undefined');
    if (!hasGame) {
      console.error('FAIL: window.game should exist');
      allPassed = false;
    } else {
      console.log('PASS: window.game exists');
    }
    
    await browser.close();
    
    if (!allPassed) {
      console.error('\nProduction API guard test FAILED');
      process.exit(1);
    }
    
    console.log('\nProduction API guard test PASSED!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
    if (server) server.kill();
    process.exit(1);
  } finally {
    if (server && !serverExited) {
      server.kill();
    }
  }
}

main();
