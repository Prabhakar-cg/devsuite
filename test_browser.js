const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto('http://localhost:8000/');
  
  // Select a theme
  await page.select('.global-theme-select', 'ios-glass');
  
  // See what happened to the DOM
  const bg = await page.evaluate(() => document.body.style.background);
  console.log('Background is:', bg);
  
  await browser.close();
})();
