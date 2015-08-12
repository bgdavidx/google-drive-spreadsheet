# google-drive-spreadsheet
A library to access Google Drive Spreadsheet API from Node.js https://github.com/bgdavidx/google-drive-spreadsheet

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

##### Spreadsheet.prototype.getInfo(callback) =>

returns info for each worksheet in the spreadsheet.

##### Spreadsheet.prototype.addRow(worksheetId, data, callback) =>

adds a row to the worksheet with the given worksheetId.

##### Spreadsheet.prototype.getCells(worksheetId, options, callback) =>

##### SpreadsheetWorksheet.prototype.getRows(options, callback) =>

##### SpreadsheetWorksheet.prototype.getCells(options, callback) =>

##### SpreadsheetWorksheet.prototype.addRow(data, callback) =>

##### SpreadsheetRow.save(callback) =>

##### SpreadsheetRow.del(callback) =>

##### SpreadsheetCell.setValue(newValue, callback) =>

##### SpreadsheetCell.save(callback) =>

##### SpreadsheetCell.del(callback) =>

TODO
