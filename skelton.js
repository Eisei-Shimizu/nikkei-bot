const puppeteer = require("puppeteer");

(async () => {
  // Puppeteerの起動
  const browser = await puppeteer.launch({
    headless: false, // Headlessモードで起動するか
    slowMo: 50, // 指定ミリ秒のスローモーションで実行
  });

  // 新規ページ開く
  const page = await browser.newPage();

  await page.setViewport({
    width: 1200,
    height: 800,
  });

  await page.goto("http://www.google.co.jp/");

  // ブラウザ終了
  await browser.close();
})();
