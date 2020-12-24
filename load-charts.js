module.exports = {
    loadCharts(){
        const fs = require("fs");
        const setting = JSON.parse(fs.readFileSync("./setting.json", "utf8"));
        const xlsx = require('xlsx');
        const MAX_CHARTS_LEN = 25;
        const FIRST_CEL_POS = 3;

        try{
            let chartsFile = xlsx.readFile(setting["chartsFilePath"]);
            let worksheet = chartsFile.Sheets['四本値'];
            let closePriceList = [];

            for(var i=0; i < MAX_CHARTS_LEN; i++){
                closePriceList.push(worksheet['G' + (FIRST_CEL_POS + i)].v);
                console.log(closePriceList[i]);
            }

            return closePriceList;
        }
        catch(err){
            console.log(err);
            return [];
        }
    }
}