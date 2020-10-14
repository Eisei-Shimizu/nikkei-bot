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
const SIDE_NONE = 0;
const SIDE_BUY = 1;
const SIDE_SELL = -1;
const POS_SIDE_BUY = "買";
const POS_SIDE_SELL = "売";
const UP_SIDE = 1;
const DOWN_SIDE = -1;
const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  while (true) {
    if (checkTradeTime()) {
      console.log("トレード可能");
      await trade();
    } else {
      console.log("トレード不可");
    }
    await _sleep(5000);
  }
})();

async function trade() {
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

  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("input[name=buttonOK]"),
  ]);

  // 5秒待機
  await page.waitFor(5000);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("#gmenu_dealing"),
  ]);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click("#smenu_TrdFop"),
  ]);

  await page.waitFor(5000);
  
  await page.click(".btn_futures")

  await page.waitFor(3000);

  const pages = await browser.pages();
  const tradePage = pages[2];
  await tradePage.setViewport({
    width: 1200,
    height: 800,
  });

  gotoPositionView(tradePage);

  await tradePage.waitFor(10000);

  // 取引可能時間内でループ
  while (checkTradeTime()) {
    try {
      // ポジションがあるかどうか決済ボタンの表示で判断
      let position = [];
      try {
        position = await tradePage.$$('button[cellbutton="true"]');
      } catch (error) {
        console.log("ポジションが取得できませんでした");
      }

      let posSide = SIDE_NONE;

      if (position.length != 0) {
        // 買い or 売りチェック
        const posSideText = await tradePage.evaluate(
          () =>
            document.querySelector(
              "tr.datagrid-row > td:nth-child(3) > div > span"
            ).textContent
        );

        if (posSideText == POS_SIDE_BUY) {
          posSide = SIDE_BUY;
        } else if (posSideText == POS_SIDE_SELL) {
          posSide = SIDE_SELL;
        }

        // ロスカットチェック
        // ロスカット後は建玉画面に遷移
        let currentPriceText = await tradePage.evaluate(
          () =>
            document.querySelector(
              "tr.datagrid-row > td:nth-child(7) > div > div"
            ).textContent
        );

        let posPriceText = await tradePage.evaluate(
          () =>
            document.querySelector("tr.datagrid-row > td:nth-child(6) > div")
              .textContent
        );

        currentPriceText = currentPriceText.split(" ")[0].replace(",", "");
        posPriceText = posPriceText.split(" ")[0].replace(",", "");

        console.log("評価額: " + currentPriceText);
        console.log("建て値: " + posPriceText);

        const currentPrice = parseInt(currentPriceText);
        const posPrice = parseInt(posPriceText);
        const lossCutRange = setting["lossCutRange"];

        let isLossCut = false;
        if (posSide == SIDE_BUY && -lossCutRange >= currentPrice - posPrice) {
          isLossCut = true;
        } else if (
          posSide == SIDE_SELL &&
          lossCutRange >= currentPrice - posPrice
        ) {
          isLossCut = true;
        }

        if (isLossCut) {
          // 精算
          console.log("ロスカット");
          gotoPositionView(tradePage);
          liquidation(tradePage);
        }
      }

      const result = await nikkei.getNikkei1hourCharts();
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

        let priceSide = SIDE_NONE;

        if (sma[0] > sma[1]) {
          priceSide = UP_SIDE;
          console.log("price side: UP_SIDE");
        } else if (sma[0] < sma[1]) {
          priceSide = DOWN_SIDE;
          console.log("price side: DOWN_SIDE");
        }

        // G.C or D.C
        const isCross = sma[0] == sma[1];

        if (isCross) {
          // 乖離幅設定
          const deviationRange = setting["deviationRange"];

          // 注文
          let orderSide = SIDE_NONE;

          // 短平均線が中平均線上抜け =>　買い
          if (priceSide == DOWN_SIDE && deviationRange >= sma[0] - sma[1]) {
            // 買い注文
            orderSide = SIDE_BUY;
          }
          // 短平均線が中平均線下抜け =>　売り
          else if (priceSide == UP_SIDE && deviationRange >= sma[1] - sma[0]) {
            // 売り注文
            orderSide = SIDE_SELL;
          }

          if (posSide == SIDE_NONE && orderSide != SIDE_NONE) {
            // エントリー
            order(tradePage, orderSide);
          } else if (posSide != SIDE_NONE && posSide != orderSide) {
            // 精算
            liquidation(tradePage);
          }
        }
      } else {
        console.log(result["chart"]["error"]);
      }

      await RegularlyPageReload(tradePage);
    }catch{
      // 例外発生したらブラウザを開き直してログインからスタート
      break;
    }
  }

  // ブラウザ終了
  await browser.close();
}

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
  try {
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
  } catch (error) {
    throw error;
  }
}

async function gotoPositionView(page) {
  try {
    // 銘柄選択画面へ
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click("#main-menu > li:nth-child(2)"),
    ]);

    await page.waitFor(3000);

    // ポジション確認
    // 建玉画面へ
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click(".sub-menu > li:nth-child(3)"),
    ]);
  } catch (error) {
    throw error;
  }
}

async function gotoTradeView(page) {
  try {
    // 銘柄選択画面へ
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click("#main-menu > li:nth-child(2)"),
    ]);

    // トレード画面へ
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click(
        "#table_1 > table > tbody > tr:nth-child(4) > td:nth-child(10) > span > .side-buy"
      ),
    ]);
    } catch (error) {
      throw error;
    }
}

async function order(page, orderSide) {
  try {
    gotoTradeView(page);

    await page.waitFor(3000);
  
    // 枚数設定
    await page.type("input[id=OrderQuantity]", setting["LOT"]);
  
    // 買い・売り設定
    if (orderSide == SIDE_BUY) {
      // 買い
      await page.click(
        '#all-order-content > table.order.variable.view-when-1.display-relay.display-portfolio.content-2col > tbody > tr:nth-child(1) > td.content > div > label.side-buy > input[type="radio"]'
      );
    } else {
      // 売り
      await page.click(
        '#all-order-content > table.order.variable.view-when-1.display-relay.display-portfolio.content-2col > tbody > tr:nth-child(1) > td.content > div > label.side-sell > input[type="radio"]'
      );
    }
  
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
  
    gotoPositionView(page);
    
  } catch (error) {
    throw error;  
  }
}

async function liquidation(page) {
  try {
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
  } catch (error) {
    throw error;
  }
}

async function RegularlyPageReload(page) {
  try {
    // 1時間に1度価格取得処理実行するために1分ごとの画面更新を60回繰り返す
    for (let I = 0; I < 60; I++) {
      console.log("画面更新");
      await Promise.all([page.click(".withImage")]);
      await page.waitFor(60000);
    }
  } catch(error){
    throw error;
  }
}
