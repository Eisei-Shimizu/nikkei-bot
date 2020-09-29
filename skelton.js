const puppeteer = require("puppeteer");
const nikkei = require("./nikkei.js");
const loginURL = "https://www.okasan-online.co.jp/login/jp/";
const fs = require("fs");
const setting = JSON.parse(fs.readFileSync("./setting.json", "utf8"));
const dayOfWeekList = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const moment = require("moment");

//while (true) {
if (checkTradeTime()) {
  console.log("トレード可能");
} else {
  console.log("トレード不可");
}
//}

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

  await page.click("#gmenu_dealing");

  await page.click("#smenu_TrdFop");

  await page.click(".btn_futures");

  await page.waitFor(3000);

  const pages = await browser.pages();
  const tradePage = pages[2];
  await tradePage.setViewport({
    width: 1200,
    height: 800,
  });

  // 銘柄選択画面へ
  await Promise.all([
    tradePage.waitForNavigation({ waitUntil: "load" }),
    tradePage.click("#main-menu > li:nth-child(2)"),
  ]);

  // トレード画面へ
  await Promise.all([
    tradePage.waitForNavigation({ waitUntil: "load" }),
    tradePage.click(
      "#table_1 > table > tbody > tr:nth-child(4) > td:nth-child(10) > span > .side-buy"
    ),
  ]);

  // order(tradePage);
  // liquidation(tradePage);

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

    // TODO: 乖離幅設定
    // TODO: 損切り幅設定
    // TODO: エントリー
  } else {
    console.log(result["chart"]["error"]);
  }

  // ブラウザ終了
  //await browser.close();
})();

function convertWeekdays(day) {
  // 月〜金
  const weekdaysList = [
    dayOfWeekList[1],
    dayOfWeekList[2],
    dayOfWeekList[3],
    dayOfWeekList[4],
    dayOfWeekList[5],
  ];

  weekdaysList.forEach((weekday) => {
    if (weekday == day) {
      console.log("weekday!!");
      day = "Weekdays";
    }
  });

  return day;
}

function checkTradeTime() {
  const tradeTimeList = setting["tradeTime"];
  const currentDate = moment();
  const day = convertWeekdays(dayOfWeekList[currentDate.day()]);
  var result = false;

  console.log(currentDate.format("YYYY-MM-DD HH:mm"));

  tradeTimeList.forEach((tradeTime) => {
    // オンライントレード利用可能時間内
    const startM = moment(
      currentDate.format("YYYY-MM-DD") + " " + tradeTime["start"],
      "YYYY-MM-DD HH:mm"
    );
    const endM = moment(
      currentDate.format("YYYY-MM-DD") + " " + tradeTime["end"],
      "YYYY-MM-DD HH:mm"
    );

    if (
      tradeTime["dayOfWeek"] == day &&
      currentDate.isSameOrAfter(startM) &&
      currentDate.isSameOrBefore(endM)
    ) {
      result = true;
    }
  });

  return result;
}

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

  // ログイン情報入力
  await page.type("input[name=account]", setting["id"]);
  await page.type("input[name=pass]", setting["pw"]);

  // 5秒待機
  await page.waitFor(5000);

  // ログインボタンクリック
  await page.click("input[id=sougouSubmit]");
}

async function order(page) {
  // 枚数設定
  await page.type("input[id=OrderQuantity]", setting["LOT"]);

  // 成行注文
  await page.click("#OrderTypeNormal > div > label:nth-child(1)");

  // 注文内容確認画面へ
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("#OrderButton"),
  ]);

  // 取引パスワード入力
  await page.type("input[name=TradingPassword]", setting["tradePw"]);

  // 注文
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("#OrderButton"),
  ]);
}

async function liquidation(page) {
  // 建玉画面へ
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click(".sub-menu > li:nth-child(3)"),
  ]);

  // 決済注文画面へ
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click('button[cellbutton="true"]'),
  ]);

  // 全数量
  await page.click("button[id=AllQty]");

  // 成行注文
  await page.click("#OrderTypeNormal > div > label:nth-child(1)");

  // 注文内容確認画面へ
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("#OrderButton"),
  ]);

  // 取引パスワード入力
  await page.type("input[name=TradingPassword]", setting["tradePw"]);

  // 注文
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("#OrderButton"),
  ]);
}

async function RegularlyPageReload(page) {
  await page.evaluate(() => {
    location.reload(true);
  });
}
