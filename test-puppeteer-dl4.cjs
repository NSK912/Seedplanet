const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8087/test-downloaded.html');
  await new Promise(r => setTimeout(r, 1000));
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log('HTML length:', html.length);
  console.log('HTML content:', html.substring(0, 1000));
  await browser.close();
  process.exit(0);
})();
