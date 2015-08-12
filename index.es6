/**
 * @author David Xu
 */

'use strict'

import request from 'request'
import xml2js from 'xml2js'
import http from 'http'
import querystring from 'querystring'
import _ from 'lodash'
import GoogleAuth from 'google-auth-library'
import Promise from 'bluebird'

const GOOGLE_FEED_URL = "https://spreadsheets.google.com/feeds/"
const GOOGLE_AUTH_SCOPE = [ "https://spreadsheets.google.com/feeds" ]

const forceArray = (val) => {
  if (Array.isArray(val)) {
    return val
  }

  if (!val) {
    return []
  }

  return [ val ]
}

const xmlSafeValue = (val) => {
  if (val == null) {
    return ''
  }

  return String(val).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
}

const xmlSafeColumnName = (val) => {
  if (!val) {
    return ''
  }

  return String(val).replace(/[\s_]+/g, '')
      .toLowerCase()
}

class GoogleSpreadsheet {
  constructor(ssKey, authId, options) {
    this._ssKey = ssKey
    this._authId = authId
    this._googleAuth = null
    this._visibility = 'public'
    this._projection = 'values'
    this._authMode = 'anonymous'
    this._authClient = new GoogleAuth()

    this._options = options || {}

    this._xmlParser = new xml2js.Parser({
      explicitArray: false,
      explicitRoot: false
    })

    if (!ssKey) {
      throw new Error('Spreadsheet key not provided')
    }

    this._setAuthAndDependencies(authId)
  }

  setAuthToken(authId) {
    if (this._authMode === 'anonymous') {
      this._authMode = 'token'
    }

    this._setAuthAndDependencies(authId)
  }

  useServiceAccountAuth(creds, cb) {
    if (typeof creds === 'string') {
      creds = require(creds)
    }

    this._jwtClient = new this._authClient.JWT(creds.client_email, null, creds.private_key, GOOGLE_AUTH_SCOPE, null)
    this._renewJwtAuth(cb)
  }

  _renewJwtAuth(cb) {
    this._authMode = 'jwt'

    return this._jwtClient.authorize((err, token) => {
      if (err) {
        return cb(err)
      }

      this.setAuthToken({
        type: token.token_type,
        value: token.access_token,
        expires: token.expiry_date
      })
      cb()
    })
  }

  _setAuthAndDependencies(auth) {
    this._googleAuth = auth
    if (!this._options.visibility) {
      this._visibility = this._googleAuth ? 'private' : 'public'
    }

    if (!this._options.projection) {
      this._projection = this._googleAuth ? 'full' : 'values'
    }
  }

  makeFeedRequest(urlParams, method, queryOrData, cb) {
    let url
    let headers = {}

    if (typeof urlParams === 'string') {
      url = urlParams
    } else if (Array.isArray(urlParams)) {
      urlParams.push(this._visibility, this._projection)
      url = `${GOOGLE_FEED_URL}${urlParams.join('/')}`
    }

    new Promise((resolve, reject) => {
      if (this._authMode !== 'jwt' ||
          this._googleAuth.expires > +new Date()) {
        return resolve()
      }

      return this._renewJwtAuth(err => {
        if (err) {
          return reject(err)
        }

        return resolve()
      })
    }).then(() => {
      if (this._googleAuth) {
        if (this._googleAuth.type === 'Bearer') {
          headers['Authorization'] = `Bearer ${this._googleAuth.value}`
        } else {
          // bug?
          headers['Authorization'] = `GoogleLogin auth=${this._googleAuth}`
        }
      }

      method = method.toUpperCase()

      if (method === 'POST' || method === 'PUT') {
        headers['content-type'] = 'application/atom+xml'
      } else if (method === 'GET' && queryOrData) {
        url = `${url}?${querystring.stringify(queryOrData)}`
      }

      request({
        url: url,
        method: method,
        headers: headers,
        body: method === 'POST' || method === 'PUT' ? queryOrData : null
      }, (err, response, body) => {
        if (err) {
          return cb(err)
        } else if (response.statusCode === 401) {
          return cb(new Error('Invalid authorization key'))
        } else if (response.statusCode >= 400) {
          return cb(new Error(`HTTP error ${response.statusCode}: ${http.STATUS_CODES[response.statusCode]} ${JSON.stringify(body)}`))
        } else if (response.statusCode === 200 && ~response.headers['content-type'].indexOf('text/html')) {
          return cb(new Error('Sheet is private. Use authentication or make it public.'))
        }

        if (body) {
          this._xmlParser.parseString(body, (err, result) => {
            if (err) {
              return cb(err)
            }

            return cb(null, result, body)
          })
        } else {
          if (err) {
            return cb(err)
          }

          return cb(null, true)
        }
      })
    })

  }

  getInfo(cb) {
    this.makeFeedRequest(['worksheets', this._ssKey], 'GET', null, (err, data, xml) => {
      if (err) {
        return cb(err)
      }

      if (data === true) {
        return cb(new Error('No response to getInfo call'))
      }

      const ssData = {
        title: data.title['_'],
        updated: data.updated,
        author: data.author,
        worksheets: _.map(forceArray(data.entry), wsData => {
          return new SpreadsheetWorksheet(this, wsData)
        })
      }

      return cb(null, ssData)
    })
  }

  getRows(worksheetId, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    const query = {}

    if (opts.start) query["start-index"] = opts.start
    if (opts.num) query["max-results"] = opts.num
    if (opts.orderby) query["orderby"] = opts.orderby
    if (opts.reverse) query["reverse"] = opts.reverse
    if (opts.query) query['sq'] = opts.query

    return this.makeFeedRequest(['list', this._ssKey, worksheetId ], 'GET', query, (err, data, xml) => {
      if (err) {
        return cb(err)
      }

      if (data === true) {
        return cb(new Error('No response to getRows call'))
      }

      const entriesXml = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g)

      return cb(null, _.map(forceArray(data.entry), (rowData, i) => {
        return new SpreadsheetRow(this, rowData, entriesXml[i])
      }))
    })
  }

  addRow(worksheetId, data, cb) {
    let dataXml = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">\n'
    _.each(_.keys(data), key => {
      if (key !== 'id' && key !== 'title' && key !== 'content' && key !== '_links') {
        dataXml += `<gsx:${xmlSafeColumnName(key)}>${xmlSafeValue(data[key])}</gsx:${xmlSafeColumnName(key)}\n`
      }
    })

    dataXml += '</entry>'
    return this.makeFeedRequest(['list', this._ssKey, worksheetId], 'POST', dataXml, cb)
  }

  getCells(worksheetId, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    const query = _.assign({}, opts)

    this.makeFeedRequest(['cells', this._ssKey, worksheetId], 'GET', query, (err, data, xml) => {
      if (err) {
        return cb(err)
      }

      if (data === true) {
        return cb(new Error('No response to getCells call'))
      }

      return cb(null, _.map(forceArray(data['entry']), cellData => {
        return new SpreadsheetCell(this, worksheetId, cellData)
      }))
    })
  }
}

class SpreadsheetWorksheet {
  constructor(spreadsheet, data) {
    this._spreadsheet = spreadsheet
    this._id = data.id.substring(data.id.lastIndexOf('/') + 1)
    this._title = data.title['_']
    this._rowCount = data['gs:rowCount']
    this._colCount = data['gs:colCount']
  }

  getRows(opts, cb) {
    return spreadsheet.getRows(this._id, opts, cb)
  }

  getCells(opts, cb) {
    return spreadsheet.getCells(this._id, opts, cb)
  }

  addRow(data, cb) {
    return spreadsheet.addRow(this._id, data, cb)
  }
}

class SpreadsheetRow {
  constructor(spreadsheet, data, xml) {
    this._xml = xml
    _.each(_.keys(data), key => {
      let val = data[key]

      if (key.substring(0, 4) === 'gsx:') {
        if (typeof val === 'object' && _.keys(val).length === 0) {
          val = null
        }

        if (key === 'gsx:') {
          this[key.substring(0, 3)] = val
        } else {
          this[key.substring(4)] = val
        }
      } else {
        if (key === 'id') {
          this[key] = val
        } else if (val['_']) {
          this[key] = val['_']
        } else if (key === 'link') {
          this._links = []
          val = forceArray(val)
          _.each(val, link => {
            this._links[link['$']['rel']] = link['$']['href']
          })
        }
      }
    })
  }

  save(cb) {
    let dataXml = this._xml

    dataXml = dataXml.replace('<entry>', "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gsx='http://schemas.google.com/spreadsheets/2006/extended'>")

    _.each(_.keys(this), key => {
      if (key.substr(0, 1) !== '_' && typeof(this[key]) === 'string') {
        dataXml = dataXml.replace(new RegExp('<gsx:'+xmlSafeColumnName(key)+">([\\s\\S]*?)</gsx:"+xmlSafeColumnName(key)+'>'), '<gsx:'+xmlSafeColumnName(key)+'>'+ xmlSafeValue(this[key]) +'</gsx:'+xmlSafeColumnName(key)+'>')
      }
    })

    this._spreadsheet.makeFeedRequest(this._links['edit'], 'PUT', dataXml, cb)
  }

  del(cb) {
    this._spreadsheet.makeFeedRequest(this._links['edit'], 'DELETE', null, cb)
  }
}

class SpreadsheetCell {
  constructor(spreadsheet, worksheetId, data) {
    this._spreadsheet = spreadsheet
    this._worksheetId = worksheetId
    this._id = data['id']
    this._row = +(data['gs:cell']['$']['row'])
    this._col = +(data['gs:cell']['$']['col'])
    this._value = data['gs:cell']['_']
    this._numericValue = data['gs:cell']['$']['numericValue']

    this._links = _.map(forceArray(data.link), link => {
      this._links[link['$']['rel']] = link['$']['href']
    })
  }

  setValue(newValue, cb) {
    this._value = newValue
    this.save(cb)
  }

  save(cb) {
    const newValue = xmlSafeValue(this._value)
    const editId = `https://spreadsheets.google.com/feeds/cells/key/${this._worksheetId}/private/full/R${this._row}C${this._col}`
    const dataXml = `<entry><id>${editId}</id><link rel="edit" type="application/atom+xml" href="${editId}"/><gs:cell row="${this._row}" col="${this._col}" inputValue="${newValue}"/></entry>`.replace('<entry>', "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gs='http://schemas.google.com/spreadsheets/2006'>")

    return this._spreadsheet.makeFeedRequest(this._links['edit'], 'PUT', dataXml, cb)
  }

  del(cb) {
    return this.setValue('', cb)
  }
}

Promise.promisifyAll(GoogleSpreadsheet.prototype)

export default GoogleSpreadsheet
