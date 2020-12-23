module.exports = {
    loadCharts(){
        const fs = require("fs");
        const setting = JSON.parse(fs.readFileSync("./setting.json", "utf8"));
        const xlsx = require('xlsx');
        try{
            let chartsFile = xlsx.readFile(setting["chartsFilePath"]);
            let worksheet = chartsFile.Sheets['四本値'];
            let range = worksheet['!ref'];
            console.log(range);
            console.log(worksheet['G3'].v);
            console.log(worksheet['G4'].v);
            console.log(worksheet['G5'].v);
        }
        catch(err){
            console.log(err);
        }
    }
}