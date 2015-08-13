# google-drive-spreadsheet
A library to access Google Drive Spreadsheet API from Node.js https://github.com/bgdavidx/google-drive-spreadsheet

```bash
npm install --save google-drive-spreadsheet
```

# API


Promise version (via Bluebird):
```js
var Spreadsheet = require('google-drive-spreadsheet')

new Spreadsheet(SPREADSHEET_ID).getRowsAsync(1).then(function(rows) {
  console.log(rows)
}).catch(function(err) {
  console.log('Error', err)
})

```

Async-Await version (via babel-runtime):

```js
import Spreadsheet from 'google-drive-spreadsheet'

const fn = async () => {
  const ss = new Spreadsheet(SPREADSHEET_ID)
  
  try {
    const rows = await ss.getRowsAsync(1)
    
    console.log(rows)
  } catch (err) {
    console.log('Error', err)
  }
}

```

Callback version:

```js
var Spreadsheet = require('google-drive-spreadsheet')

new Spreadsheet(SPREADSHEET_ID).getRows(1, function(err, rows) {
  if (err) {
    console.log('Error', err)
  } else {
    console.log(rows)
  }
})


```

## API

**Note: Promisified versions also available, omit callback and add async, for example `getRows(worksheetId, options, callback)` -> `getRowsAsync(worksheetId, options)`**


##### Spreadsheet.prototype.getRows(worksheetId, options, callback) => 

returns an array of SpreadsheetRow from the given worksheetId.

example return:

```json
[
  {
    "_xml": "<entry><id>https://spreadsheets.google.com/feeds/list/1JCqI21cPaw3hn53EC3XdsP_7UacwKxGi5_i472FP-DU/1/public/values/cokwr</id><updated>2015-08-13T07:04:55.399Z</updated><category scheme='http://schemas.google.com/spreadsheets/2006' term='http://schemas.google.com/spreadsheets/2006#list'/><title type='text'>Hello</title><content type='text'>columntwo: world, columnthree: !</content><link rel='self' type='application/atom+xml' href='https://spreadsheets.google.com/feeds/list/1JCqI21cPaw3hn53EC3XdsP_7UacwKxGi5_i472FP-DU/1/public/values/cokwr'/><gsx:columnone>Hello</gsx:columnone><gsx:columntwo>world</gsx:columntwo><gsx:columnthree>!</gsx:columnthree></entry>",
    "id": "https://spreadsheets.google.com/feeds/list/1JCqI21cPaw3hn53EC3XdsP_7UacwKxGi5_i472FP-DU/1/public/values/cokwr",
    "title": "Hello",
    "content": "columntwo: world, columnthree: !",
    "_links": [],
    "columnone": "Hello",
    "columntwo": "world",
    "columnthree": "!"
  }
]
```

##### Spreadsheet.prototype.getInfo(callback) =>

returns info for each worksheet in the spreadsheet.

##### Spreadsheet.prototype.addRow(worksheetId, data, callback) =>

adds a row to the worksheet with the given worksheetId.

##### Spreadsheet.prototype.getCells(worksheetId, options, callback) =>

returns cells from the spreadsheet.

##### SpreadsheetWorksheet.prototype.getRows(options, callback) =>

returns rows from the spreadsheet

##### SpreadsheetWorksheet.prototype.getCells(options, callback) =>

returns rows from the worksheet.

##### SpreadsheetWorksheet.prototype.addRow(data, callback) =>

adds a row to the worksheet.

##### SpreadsheetRow.save(callback) =>

saves the modified spreadsheet row to the cloud.

##### SpreadsheetRow.del(callback) =>

deletes the row from the cloud.

##### SpreadsheetCell.setValue(newValue, callback) =>

updates the value of the cell in the cloud.

##### SpreadsheetCell.save(callback) =>

saves the cell to the cloud.

##### SpreadsheetCell.del(callback) =>

deletes the cell from the cloud.
