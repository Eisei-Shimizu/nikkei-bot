module.exports = {
  async getNikkei1hourCharts() {
    var apiKey = "b70d850f62msh14f5fe645adb47fp113163jsn9694232e036d";
    var request = require("request-promise");

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
