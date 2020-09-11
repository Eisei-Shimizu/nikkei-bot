const puppeteer = require("puppeteer");
const nikkei = require("./nikkei.js");
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

    console.log(period);
    for (I = 0; I < period; I++) {
      closePriceSum += priceList[priceList.length - 1 - I];
    }
    sma.push(Math.ceil(closePriceSum / period));
  }
  return sma;
}
