'use strict';

/* eslint-env mocha,es6 */

var assert   = require('assert');
var fs       = require('fs');
var ttf2woff = require('.');


it('bin compare', function () {
  var src = new Uint8Array(fs.readFileSync('./fixtures/test.ttf'));
  var dst = new Uint8Array(fs.readFileSync('./fixtures/test.woff'));

  assert.deepEqual(ttf2woff(src), dst);
});


it('bin compare (with metadata)', function () {
  var src = new Uint8Array(fs.readFileSync('./fixtures/test.ttf'));
  var dst = new Uint8Array(fs.readFileSync('./fixtures/test_with_meta.woff'));

  assert.deepEqual(ttf2woff(src, { metadata: Uint8Array.from([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 0 ]) }), dst);
});
