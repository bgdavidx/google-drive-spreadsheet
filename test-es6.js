/**
 * @author David Xu
 */

import GoogleSpreadsheet from './'
import Promise from 'bluebird'
import _ from 'lodash'
import util from 'util'

const creds = {
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "...",
  "client_id": "...",
  "type": "service_account"
}

const test = async () => {
  const s = new GoogleSpreadsheet('Insert Spreadsheet Key here')

  await s.useServiceAccountAuthAsync(creds)

  console.log('info', await s.getInfoAsync())

  const r = await s.getRowsAsync(1)

  console.log('rows', r)
}

test()
