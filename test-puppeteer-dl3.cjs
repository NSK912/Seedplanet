const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://127.0.0.1:8087/test-downloaded.html');
  await new Promise(r => setTimeout(r, 2000));
  const hasFade = await page.evaluate(() => !!document.getElementById('fadeToBlack'));
  const hasCanvas = await page.evaluate(() => !!document.getElementById('mapCanvas'));
  console.log('hasFade:', hasFade, 'hasCanvas:', hasCanvas);
  await browser.close();
  process.exit(0);
})();
