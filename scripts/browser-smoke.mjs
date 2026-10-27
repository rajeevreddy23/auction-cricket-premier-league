import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from '../src/server/index.ts';

// Production bundle + actual DOM controls. No injected match state or score changes.
const app=createServer({dbPath:':memory:'});
await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--enable-unsafe-swiftshader']});
const errors=[];
async function advanceUntil(page,predicate){for(let i=0;i<600;i++){if(await page.evaluate(predicate))return;await page.clock.runFor(50);}throw Error('Browser simulation did not reach expected state in 30 seconds');}
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.goto(base);
 await page.locator('[data-page="Practice"]').first().click();
 await page.locator('.game-viewport canvas').waitFor({timeout:15000});
 await page.locator('[data-g="quality"]').selectOption('low');
 await page.locator('[data-g="loft"]').check();
 await page.locator('[data-g="power"]').fill('100');
 for(let ball=1;ball<=6;ball++){
  if(ball===1){
   await advanceUntil(page,()=>document.querySelector('[data-g="deliveryCue"]')?.textContent==='Bowler running in');
   await advanceUntil(page,()=>document.querySelector('[data-g="deliveryProgress"]')?.value>=.80);
   await page.locator('[data-g="shot"]').click({force:true});
  }
  await advanceUntil(page,()=>!document.querySelector('[data-g="next"]').disabled);
  assert.match(await page.locator('.game-overs').innerText(),new RegExp(ball===6?'1\\.0':`0\\.${ball}`));
  if(ball===1){assert.ok(Number((await page.locator('.game-runs').innerText()).split('/')[0])>=4,'Timed UI shot must score a boundary');}
  if(ball<6){await page.locator('[data-g="next"]').click({force:true});await advanceUntil(page,()=>document.querySelector('[data-g="next"]').disabled);}
 }
 const score=await page.locator('.game-runs').innerText();
 const renderer=await page.locator('.game-viewport canvas').evaluate(canvas=>canvas.getContext('webgl2')?'WebGL2':'canvas');
 if(process.env.SCREENSHOT_DIR){await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR,'playable-over.png')});}
 await page.locator('[data-g="exit"]').click();assert.equal(await page.locator('.game-stage').count(),0);
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto(base);
 // The homepage practice action is available without the collapsed navigation.
 await mobile.locator('[data-action="practice"]').first().click();
 await mobile.locator('[data-g="shot"]').waitFor();
 await mobile.locator('[data-g="quality"]').selectOption('low');
 await mobile.locator('[data-g="role"]').selectOption('bowl');
 await mobile.waitForFunction(()=>!document.querySelector('[data-g="bowl"]').disabled||!document.querySelector('[data-g="next"]').disabled);
 if(await mobile.locator('[data-g="bowl"]').isDisabled()){await mobile.waitForFunction(()=>!document.querySelector('[data-g="next"]').disabled,{},{timeout:20000});await mobile.locator('[data-g="next"]').click();}
 await mobile.waitForFunction(()=>!document.querySelector('[data-g="bowl"]').disabled);
 await mobile.locator('[data-bowl="yorker"]').tap();
 await mobile.locator('[data-g="bowl"]').tap();
 await mobile.waitForFunction(()=>document.querySelector('[data-g="deliveryCue"]')?.textContent==='Bowler running in');
 await mobile.waitForFunction(()=>!document.querySelector('[data-g="next"]').disabled,{},{timeout:20000});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile page must fit screen');
 if(process.env.SCREENSHOT_DIR)await mobile.screenshot({path:resolve(process.env.SCREENSHOT_DIR,'mobile-delivery.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({desktop:{deliveries:6,overs:'1.0',score,renderer,timedShotBoundary:true,exit:true},mobile:{width:390,touchDelivery:true,preset:'yorker',horizontalOverflow:false},pageErrors:errors},null,2));
}finally{await browser.close();await app.close();}
