module.exports = {
  async getNikkei1hourCharts() {
    const fs = require("fs");
    const setting = JSON.parse(fs.readFileSync("./setting.json", "utf8"));
    const apiKey = setting["apiKey"];
    const request = require("request-promise");

    var options = {
      method: "GET",
      url: "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/get-charts",
      qs: { region: "JP", symbol: "NIY%3DF", interval: "60m", range: "5d" },
      headers: {
        "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
        useQueryString: true,
      },
    };

    var result = request(options)
      .then(function (body) {
        console.log(body);
        return JSON.parse(body);
      })
      .catch(function (err) {
        console.log(err);
        return err;
      });

    return result;
  },
};
