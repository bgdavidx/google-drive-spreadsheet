/**
 * @author David Xu
 */

require('babel-core/register')({
  'optional': [ 'es7.asyncFunctions', 'bluebirdCoroutines' ],
  'blacklist': [ 'regenerator' ]
})

require('./test-es6')
