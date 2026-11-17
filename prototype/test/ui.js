'use strict';
/*
 * Drives two real Chrome windows: join, every panel, ordering, pricing, upgrades,
 * chat, crew board, minimap, interaction prompt, day summary. Needs playwright.
 *   MM_SAVE=off MM_DEMO=1 MM_DAY=900 node server.js 8099 &
 *   PORT=8099 node test/ui.js
 */
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const PORT = process.env.PORT || 8099;
const base = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, passes = 0;
const check = (l, c, x = '') => { console.log(`${c ? ' PASS' : ' FAIL'}  [browser] ${l}${x ? '  (' + x + ')' : ''}`); c ? passes++ : fails++; };
const visible = (page, sel) => page.$eval(sel, e => !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none').catch(() => false);
const tp = (page, x, y, yaw) => page.evaluate(v => { __mm.send({ t: 'tp', x: v.x, y: v.y }); __mm.look(v.yaw, 0); }, { x, y, yaw });

(async () => {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
  await ctx.addInitScript(() => localStorage.setItem('mm.quality', '"low"'));
  const a = await ctx.newPage(), b = await ctx.newPage();
  const errs = [];
  for (const p of [a, b]) p.on('pageerror', e => errs.push(e.message));

  await a.goto(base + '/');
  check('join screen shows', await visible(a, '#joinScreen'));
  await a.fill('#nameInput', 'Akshay');
  await a.click('#joinBtn');
  await b.goto(base + '/?name=Friend');
  const ready = () => window.__mm && __mm.state && __mm.scene && !document.getElementById('game').classList.contains('hidden');
  check('loading screen shows progress while the world builds', await a.waitForFunction(() => !document.getElementById('loadScreen').classList.contains('hidden'), null, { timeout: 20000 }).then(() => true).catch(() => false));
  await a.waitForFunction(ready, null, { timeout: 120000 });
  await b.waitForFunction(ready, null, { timeout: 120000 });
  check('loading screen goes away when the store is ready', !(await visible(a, '#loadScreen')));
  check('both players enter the 3D store', await visible(a, '#game') && await visible(b, '#game'));
  check('3D scene renders', await a.evaluate(() => __mm.scene.renderer.info.render.calls > 20), await a.evaluate(() => __mm.scene.renderer.info.render.calls + ' draw calls'));
  check('HUD shows cash and day', /₹/.test(await a.textContent('#hCash')) && (await a.textContent('#hDay')).trim() === '1');
  check('crew count shows 2', (await a.textContent('#hCrew')).trim() === '2');
  check('today\'s goals are on screen', (await a.$$eval('#goals .goal', g => g.length)) === 3);
  check('the store level badge shows the Supermarket', /Supermarket/.test(await a.textContent('#hLevel')));

  // panels via keyboard
  for (const [key, sel, name] of [['o', '#orderPanel', 'order'], ['p', '#pricePanel', 'prices'], ['u', '#upPanel', 'upgrades'], ['h', '#helpPanel', 'help']]) {
    await a.keyboard.press(key); await sleep(300);
    const open = await visible(a, sel);
    await a.keyboard.press('Escape'); await sleep(200);
    check(`${name} panel opens with ${key.toUpperCase()} and closes with Esc`, open && !(await visible(a, sel)));
  }
  await a.click('#btnSet'); await sleep(900);
  check('settings panel opens from the gear button', await visible(a, '#setPanel'));
  check('settings lists 3 save slots and marks the host', (await a.$$eval('#slotList .slot', x => x.length)) === 3 && /host/.test(await a.textContent('#hostBadge')));
  await a.keyboard.press('Escape');

  // order through the panel
  await a.keyboard.press('o'); await sleep(300);
  const tabs = await a.$$eval('#orderTabs button', bs => bs.map(b => b.textContent));
  check('supplier has four category tabs', tabs.length === 4, tabs.join(' / '));
  await a.click('#orderTabs button[data-k="chilled"]'); await sleep(200);
  const rows = await a.$$eval('#orderTable tbody tr', r => r.length);
  check('chilled tab lists 7 products', rows === 7, String(rows));
  const pend0 = await a.evaluate(() => __mm.state.pend);
  await a.click('#orderTable tbody tr:first-child [data-buy]'); await sleep(600);
  check('clicking Order queues a delivery', (await a.evaluate(() => __mm.state.pend)) > pend0);
  await a.keyboard.press('Escape');

  // prices through the panel, seen by the other player
  await a.keyboard.press('p'); await sleep(300);
  const before = await b.evaluate(() => __mm.state.prices[0]);
  await a.click('#priceTable tbody tr[data-pid="0"] [data-inc]'); await sleep(700);
  check('price + button changes the price for the other player', (await b.evaluate(() => __mm.state.prices[0])) === before + 1);
  await a.click('#priceTable tbody tr[data-pid="5"] [data-promo]'); await sleep(700);
  check('promo tick box puts a product on promotion for everyone', await b.evaluate(() => __mm.state.pr.includes(5)));
  await a.keyboard.press('Escape');

  // upgrades through the panel
  await a.keyboard.press('u'); await sleep(300);
  const cards = await a.$$eval('#upGrid .up', c => c.length);
  check('grow panel lists all 9 upgrades', cards === 9, String(cards));
  check('grow panel shows the 4 store levels with the current one marked', (await a.$$eval('#lvlTrack .lvcard', c => c.length)) === 4 &&
    await a.$eval('#lvlTrack .lvcard[data-lv="3"]', e => e.classList.contains('cur')));
  check('grow panel lists the 7 product licences', (await a.$$eval('#licGrid .up', c => c.length)) === 7);
  await a.click('#upGrid .up[data-key="ads"] [data-buy]'); await sleep(700);
  check('buying Radio ads works and shows as owned', await a.evaluate(() => !!__mm.state.up.ads) && await a.$eval('#upGrid .up[data-key="ads"]', e => e.classList.contains('owned')));
  await a.keyboard.press('Escape');

  // chat
  await a.keyboard.press('t'); await sleep(200);
  await a.keyboard.type('stock the fridges');
  await a.keyboard.press('Enter'); await sleep(800);
  check('chat message shows for the other player', /stock the fridges/.test(await b.textContent('#chatLog')));

  // crew board
  await a.keyboard.down('Tab'); await sleep(300);
  const boardRows = await a.$$eval('#boardTable tbody tr', r => r.length);
  const boardOpen = await visible(a, '#board');
  await a.keyboard.up('Tab');
  check('holding Tab shows the crew board with both players', boardOpen && boardRows === 2, String(boardRows));

  // minimap
  const mapPixels = await a.evaluate(() => { const c = document.getElementById('minimap').getContext('2d').getImageData(0, 0, 240, 190).data; let n = 0; for (let i = 0; i < c.length; i += 4) if (c[i] + c[i + 1] + c[i + 2] > 120) n++; return n; });
  check('minimap is drawn', mapPixels > 2000, mapPixels + ' lit pixels');

  // interaction prompt: walk up to the order terminal
  await tp(a, 11.6, 13.5, -Math.PI / 2); await sleep(1500);
  const prompt = await a.textContent('#prompt');
  check('prompt appears at the order terminal', /order terminal/i.test(prompt), prompt.trim());
  await a.keyboard.press('e'); await sleep(400);
  check('E at the terminal opens the supplier', await visible(a, '#orderPanel'));
  await a.keyboard.press('Escape');

  // other player is visible as an avatar
  check('the other player has an avatar in my world', await a.evaluate(() => __mm.scene.pools.players.size === 1));
  check('shoppers are rendered', await a.evaluate(() => __mm.scene.pools.customers.size > 0));

  await a.screenshot({ path: '/tmp/ui-a.png', timeout: 120000 });

  // a phone: touch controls instead of mouse look (desktop windows closed to free the CPU)
  await a.close(); await b.close();
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await phone.addInitScript(() => localStorage.setItem('mm.quality', '"low"'));
  const m = await phone.newPage();
  m.on('pageerror', e => errs.push('phone: ' + e.message));
  await m.goto(base + '/?name=Phone');
  await m.waitForFunction(ready, null, { timeout: 120000 });
  check('phones get on-screen touch controls', await visible(m, '#touch'));
  const x0 = await m.evaluate(() => __mm.me.x), y0 = await m.evaluate(() => __mm.me.y);
  await m.evaluate(() => { __mm.touch.my = -1; });
  await m.waitForFunction(v => Math.hypot(__mm.me.x - v.x, __mm.me.y - v.y) > 0.5, { x: x0, y: y0 }, { timeout: 30000 }).catch(() => {});
  await m.evaluate(() => { __mm.touch.my = 0; });
  const moved = await m.evaluate(v => Math.hypot(__mm.me.x - v.x, __mm.me.y - v.y), { x: x0, y: y0 });
  check('the touch stick walks the player', moved > 0.5, moved.toFixed(2) + ' tiles');
  await m.tap('#touch [data-t="order"]'); await sleep(500);
  check('touch menu button opens the supplier', await visible(m, '#orderPanel'));
  await phone.close();

  console.log(errs.length ? 'page errors:\n  ' + errs.join('\n  ') : '');
  check('no JavaScript errors in either window', errs.length === 0);
  console.log('');
  console.log(fails === 0 ? `ALL ${passes} CHECKS PASSED` : `${fails} CHECK(S) FAILED, ${passes} passed`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test crashed:', e); process.exit(1); });
