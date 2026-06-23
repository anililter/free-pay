const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/admin.html');
  await page.waitForTimeout(2000); // wait for load
  
  console.log("Clicking button...");
  await page.click("button[onclick=\"openKasaTransactionModal('', 'income')\"]");
  await page.waitForTimeout(1000);
  console.log("Checking if modal is visible...");
  const isVisible = await page.evaluate(() => {
    return document.getElementById('kasaTransactionModal').classList.contains('show');
  });
  console.log("Modal visible:", isVisible);
  await browser.close();
  process.exit(0);
})();
