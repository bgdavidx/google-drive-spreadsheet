/**
 * @author David Xu
 */

'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _xml2js = require('xml2js');

var _xml2js2 = _interopRequireDefault(_xml2js);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _googleAuthLibrary = require('google-auth-library');

var _googleAuthLibrary2 = _interopRequireDefault(_googleAuthLibrary);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var GOOGLE_FEED_URL = 'https://spreadsheets.google.com/feeds/';
var GOOGLE_AUTH_SCOPE = ['https://spreadsheets.google.com/feeds'];

var forceArray = function forceArray(val) {
  if (Array.isArray(val)) {
    return val;
  }

  if (!val) {
    return [];
  }

  return [val];
};

var xmlSafeValue = function xmlSafeValue(val) {
  if (val == null) {
    return '';
  }

  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

var xmlSafeColumnName = function xmlSafeColumnName(val) {
  if (!val) {
    return '';
  }

  return String(val).replace(/[\s_]+/g, '').toLowerCase();
};

var GoogleSpreadsheet = (function () {
  function GoogleSpreadsheet(ssKey, authId, options) {
    _classCallCheck(this, GoogleSpreadsheet);

    this._ssKey = ssKey;
    this._authId = authId;
    this._googleAuth = null;
    this._visibility = 'public';
    this._projection = 'values';
    this._authMode = 'anonymous';
    this._authClient = new _googleAuthLibrary2['default']();

    this._options = options || {};

    this._xmlParser = new _xml2js2['default'].Parser({
      explicitArray: false,
      explicitRoot: false
    });

    if (!ssKey) {
      throw new Error('Spreadsheet key not provided');
    }

    this._setAuthAndDependencies(authId);
  }

  _createClass(GoogleSpreadsheet, [{
    key: 'setAuthToken',
    value: function setAuthToken(authId) {
      if (this._authMode === 'anonymous') {
        this._authMode = 'token';
      }

      this._setAuthAndDependencies(authId);
    }
  }, {
    key: 'useServiceAccountAuth',
    value: function useServiceAccountAuth(creds, cb) {
      if (typeof creds === 'string') {
        creds = require(creds);
      }

      this._jwtClient = new this._authClient.JWT(creds.client_email, null, creds.private_key, GOOGLE_AUTH_SCOPE, null);
      this._renewJwtAuth(cb);
    }
  }, {
    key: '_renewJwtAuth',
    value: function _renewJwtAuth(cb) {
      var _this = this;

      this._authMode = 'jwt';

      return this._jwtClient.authorize(function (err, token) {
        if (err) {
          return cb(err);
        }

        _this.setAuthToken({
          type: token.token_type,
          value: token.access_token,
          expires: token.expiry_date
        });
        cb();
      });
    }
  }, {
    key: '_setAuthAndDependencies',
    value: function _setAuthAndDependencies(auth) {
      this._googleAuth = auth;
      if (!this._options.visibility) {
        this._visibility = this._googleAuth ? 'private' : 'public';
      }

      if (!this._options.projection) {
        this._projection = this._googleAuth ? 'full' : 'values';
      }
    }
  }, {
    key: 'makeFeedRequest',
    value: function makeFeedRequest(urlParams, method, queryOrData, cb) {
      var _this2 = this;

      var url = undefined;
      var headers = {};

      if (typeof urlParams === 'string') {
        url = urlParams;
      } else if (Array.isArray(urlParams)) {
        urlParams.push(this._visibility, this._projection);
        url = '' + GOOGLE_FEED_URL + urlParams.join('/');
      }

      new _bluebird2['default'](function (resolve, reject) {
        if (_this2._authMode !== 'jwt' || _this2._googleAuth.expires > +new Date()) {
          return resolve();
        }

        return _this2._renewJwtAuth(function (err) {
          if (err) {
            return reject(err);
          }

          return resolve();
        });
      }).then(function () {
        if (_this2._googleAuth) {
          if (_this2._googleAuth.type === 'Bearer') {
            headers['Authorization'] = 'Bearer ' + _this2._googleAuth.value;
          } else {
            // bug?
            headers['Authorization'] = 'GoogleLogin auth=' + _this2._googleAuth;
          }
        }

        method = method.toUpperCase();

        if (method === 'POST' || method === 'PUT') {
          headers['content-type'] = 'application/atom+xml';
        } else if (method === 'GET' && queryOrData) {
          url = url + '?' + _querystring2['default'].stringify(queryOrData);
        }

        (0, _request2['default'])({
          url: url,
          method: method,
          headers: headers,
          body: method === 'POST' || method === 'PUT' ? queryOrData : null
        }, function (err, response, body) {
          if (err) {
            return cb(err);
          } else if (response.statusCode === 401) {
            return cb(new Error('Invalid authorization key'));
          } else if (response.statusCode >= 400) {
            return cb(new Error('HTTP error ' + response.statusCode + ': ' + _http2['default'].STATUS_CODES[response.statusCode] + ' ' + JSON.stringify(body)));
          } else if (response.statusCode === 200 && ~response.headers['content-type'].indexOf('text/html')) {
            return cb(new Error('Sheet is private. Use authentication or make it public.'));
          }

          if (body) {
            _this2._xmlParser.parseString(body, function (err, result) {
              if (err) {
                return cb(err);
              }

              return cb(null, result, body);
            });
          } else {
            if (err) {
              return cb(err);
            }

            return cb(null, true);
          }
        });
      });
    }
  }, {
    key: 'getInfo',
    value: function getInfo(cb) {
      var _this3 = this;

      this.makeFeedRequest(['worksheets', this._ssKey], 'GET', null, function (err, data, xml) {
        if (err) {
          return cb(err);
        }

        if (data === true) {
          return cb(new Error('No response to getInfo call'));
        }

        var ssData = {
          title: data.title['_'],
          updated: data.updated,
          author: data.author,
          worksheets: _lodash2['default'].map(forceArray(data.entry), function (wsData) {
            return new SpreadsheetWorksheet(_this3, wsData);
          })
        };

        return cb(null, ssData);
      });
    }
  }, {
    key: 'getRows',
    value: function getRows(worksheetId, opts, cb) {
      var _this4 = this;

      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }

      var query = {};

      if (opts.start) query['start-index'] = opts.start;
      if (opts.num) query['max-results'] = opts.num;
      if (opts.orderby) query['orderby'] = opts.orderby;
      if (opts.reverse) query['reverse'] = opts.reverse;
      if (opts.query) query['sq'] = opts.query;

      return this.makeFeedRequest(['list', this._ssKey, worksheetId], 'GET', query, function (err, data, xml) {
        if (err) {
          return cb(err);
        }

        if (data === true) {
          return cb(new Error('No response to getRows call'));
        }

        var entriesXml = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);

        return cb(null, _lodash2['default'].map(forceArray(data.entry), function (rowData, i) {
          return new SpreadsheetRow(_this4, rowData, entriesXml[i]);
        }));
      });
    }
  }, {
    key: 'addRow',
    value: function addRow(worksheetId, data, cb) {
      var dataXml = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">\n';
      _lodash2['default'].each(_lodash2['default'].keys(data), function (key) {
        if (key !== 'id' && key !== 'title' && key !== 'content' && key !== '_links') {
          dataXml += '<gsx:' + xmlSafeColumnName(key) + '>' + xmlSafeValue(data[key]) + '</gsx:' + xmlSafeColumnName(key) + '\n';
        }
      });

      dataXml += '</entry>';
      return this.makeFeedRequest(['list', this._ssKey, worksheetId], 'POST', dataXml, cb);
    }
  }, {
    key: 'getCells',
    value: function getCells(worksheetId, opts, cb) {
      var _this5 = this;

      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }

      var query = _lodash2['default'].assign({}, opts);

      this.makeFeedRequest(['cells', this._ssKey, worksheetId], 'GET', query, function (err, data, xml) {
        if (err) {
          return cb(err);
        }

        if (data === true) {
          return cb(new Error('No response to getCells call'));
        }

        return cb(null, _lodash2['default'].map(forceArray(data['entry']), function (cellData) {
          return new SpreadsheetCell(_this5, worksheetId, cellData);
        }));
      });
    }
  }]);

  return GoogleSpreadsheet;
})();

var SpreadsheetWorksheet = (function () {
  function SpreadsheetWorksheet(spreadsheet, data) {
    _classCallCheck(this, SpreadsheetWorksheet);

    this._spreadsheet = spreadsheet;
    this._id = data.id.substring(data.id.lastIndexOf('/') + 1);
    this._title = data.title['_'];
    this._rowCount = data['gs:rowCount'];
    this._colCount = data['gs:colCount'];
  }

  _createClass(SpreadsheetWorksheet, [{
    key: 'getRows',
    value: function getRows(opts, cb) {
      return spreadsheet.getRows(this._id, opts, cb);
    }
  }, {
    key: 'getCells',
    value: function getCells(opts, cb) {
      return spreadsheet.getCells(this._id, opts, cb);
    }
  }, {
    key: 'addRow',
    value: function addRow(data, cb) {
      return spreadsheet.addRow(this._id, data, cb);
    }
  }]);

  return SpreadsheetWorksheet;
})();

var SpreadsheetRow = (function () {
  function SpreadsheetRow(spreadsheet, data, xml) {
    var _this6 = this;

    _classCallCheck(this, SpreadsheetRow);

    this._xml = xml;
    _lodash2['default'].each(_lodash2['default'].keys(data), function (key) {
      var val = data[key];

      if (key.substring(0, 4) === 'gsx:') {
        if (typeof val === 'object' && _lodash2['default'].keys(val).length === 0) {
          val = null;
        }

        if (key === 'gsx:') {
          _this6[key.substring(0, 3)] = val;
        } else {
          _this6[key.substring(4)] = val;
        }
      } else {
        if (key === 'id') {
          _this6[key] = val;
        } else if (val['_']) {
          _this6[key] = val['_'];
        } else if (key === 'link') {
          _this6._links = [];
          val = forceArray(val);
          _lodash2['default'].each(val, function (link) {
            _this6._links[link['$']['rel']] = link['$']['href'];
          });
        }
      }
    });
  }

  _createClass(SpreadsheetRow, [{
    key: 'save',
    value: function save(cb) {
      var _this7 = this;

      var dataXml = this._xml;

      dataXml = dataXml.replace('<entry>', '<entry xmlns=\'http://www.w3.org/2005/Atom\' xmlns:gsx=\'http://schemas.google.com/spreadsheets/2006/extended\'>');

      _lodash2['default'].each(_lodash2['default'].keys(this), function (key) {
        if (key.substr(0, 1) !== '_' && typeof _this7[key] === 'string') {
          dataXml = dataXml.replace(new RegExp('<gsx:' + xmlSafeColumnName(key) + '>([\\s\\S]*?)</gsx:' + xmlSafeColumnName(key) + '>'), '<gsx:' + xmlSafeColumnName(key) + '>' + xmlSafeValue(_this7[key]) + '</gsx:' + xmlSafeColumnName(key) + '>');
        }
      });

      this._spreadsheet.makeFeedRequest(this._links['edit'], 'PUT', dataXml, cb);
    }
  }, {
    key: 'del',
    value: function del(cb) {
      this._spreadsheet.makeFeedRequest(this._links['edit'], 'DELETE', null, cb);
    }
  }]);

  return SpreadsheetRow;
})();

var SpreadsheetCell = (function () {
  function SpreadsheetCell(spreadsheet, worksheetId, data) {
    var _this8 = this;

    _classCallCheck(this, SpreadsheetCell);

    this._spreadsheet = spreadsheet;
    this._worksheetId = worksheetId;
    this._id = data['id'];
    this._row = +data['gs:cell']['$']['row'];
    this._col = +data['gs:cell']['$']['col'];
    this._value = data['gs:cell']['_'];
    this._numericValue = data['gs:cell']['$']['numericValue'];

    this._links = _lodash2['default'].map(forceArray(data.link), function (link) {
      _this8._links[link['$']['rel']] = link['$']['href'];
    });
  }

  _createClass(SpreadsheetCell, [{
    key: 'setValue',
    value: function setValue(newValue, cb) {
      this._value = newValue;
      this.save(cb);
    }
  }, {
    key: 'save',
    value: function save(cb) {
      var newValue = xmlSafeValue(this._value);
      var editId = 'https://spreadsheets.google.com/feeds/cells/key/' + this._worksheetId + '/private/full/R' + this._row + 'C' + this._col;
      var dataXml = ('<entry><id>' + editId + '</id><link rel="edit" type="application/atom+xml" href="' + editId + '"/><gs:cell row="' + this._row + '" col="' + this._col + '" inputValue="' + newValue + '"/></entry>').replace('<entry>', '<entry xmlns=\'http://www.w3.org/2005/Atom\' xmlns:gs=\'http://schemas.google.com/spreadsheets/2006\'>');

      return this._spreadsheet.makeFeedRequest(this._links['edit'], 'PUT', dataXml, cb);
    }
  }, {
    key: 'del',
    value: function del(cb) {
      return this.setValue('', cb);
    }
  }]);

  return SpreadsheetCell;
})();

exports['default'] = GoogleSpreadsheet;
module.exports = exports['default'];

