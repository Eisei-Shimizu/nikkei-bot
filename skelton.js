const puppeteer = require("puppeteer");
const nikkei = require("./nikkei.js");
const loginURL = "https://www.okasan-online.co.jp/login/jp/";

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

  // ログイン
  await login(page);

  // 5秒待機
  await page.waitFor(5000);

  // OKボタンクリック
  await page.click("input[name=buttonOK]");

  // 5秒待機
  await page.waitFor(5000);

  // トレード画面へ遷移
  await page.click("#gmenu_dealing");

  await page.click("#smenu_TrdFop");

  await page.click(".btn_futures");

  const pages = await browser.pages();
  const detailPage = pages[2];

  await detailPage.waitFor(5000);

  // 銘柄選択画面へ
  await detailPage.click("#main-menu > li:nth-child(2)");

  var result = await nikkei.getNikkei1hourCharts();
  if (!result["chart"]["error"]) {
    const closePriceList =
      result["chart"]["result"][0]["indicators"]["quote"][0].close;
    const filterdClosePriceList = closePriceList.filter(function (value) {
      return value != null;
    });

    const smaPeriodList = [3, 10, 25];

    // 平均線を3, 10, 25 それぞれで算出
    const sma = getSMA(filterdClosePriceList, smaPeriodList);
    console.log(sma);
  } else {
    console.log(result["chart"]["error"]);
  }

  // ブラウザ終了
  await browser.close();
})();

function getSMA(priceList, periodList) {
  var sma = [];

  for (const index in periodList) {
    var closePriceSum = 0;
    var period = periodList[index];
    var tmpList = priceList;

    console.log(period);
    for (I = 0; I < period; I++) {
      closePriceSum += tmpList.pop();
    }
    sma.push(Math.ceil(closePriceSum / period));
  }
  return sma;
}

async function login(page) {
  await page.goto(loginURL);

  await page.waitForSelector("#loginId");
  await page.waitForSelector("#loginPass");

  const fs = require("fs");
  const setting = JSON.parse(fs.readFileSync("./setting.json", "utf8"));

  // ログイン情報入力
  await page.type("input[name=account]", setting["id"]);
  await page.type("input[name=pass]", setting["pw"]);

  // 5秒待機
  await page.waitFor(5000);

  // ログインボタンクリック
  await page.click("input[id=sougouSubmit]");
}
