/* global it */
'use strict';


var assert   = require('assert');
var fs       = require('fs');
var ttf2woff = require('.');


it('bin compare', function () {
  var src = new Uint8Array(fs.readFileSync('./fixtures/test.ttf'));
  var dst = new Uint8Array(fs.readFileSync('./fixtures/test.woff'));

  assert.deepEqual(ttf2woff(src).buffer, dst);
});
