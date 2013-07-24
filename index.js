/*
    Author: Viktor Semykin <thesame.ml@gmail.com>

    Written for fontello.com project.
*/

'use strict';

var zlib = require('zlib');
var jDataView = require('jDataView');


// eachSerries is stol^Wgently borrowed from async, to minimize code
// https://github.com/caolan/async
// the only difference is additionally passing index as second iterator param
function eachSeries(arr, iterator, callback) {
  callback = callback || function () {};
  if (!arr.length) {
    return callback();
  }
  var completed = 0;
  var iterate = function () {
    iterator(arr[completed], completed, function (err) {
      if (err) {
        callback(err);
        callback = function () {};
      }
      else {
        completed += 1;
        if (completed >= arr.length) {
          callback(null);
        }
        else {
          iterate();
        }
      }
    });
  };
  iterate();
}

function ulong(t) {
  /*jshint bitwise:false*/
  t &= 0xffffffff;
  if (t < 0) {
    t += 0x100000000;
  }
  return t;
}

function longAlign(n) {
  /*jshint bitwise:false*/
  return (n+3) & ~3;
}

function pad(src) {
  /*jshint bitwise:false*/
  switch (src.length & 3) {
  case 0:
    return src;
  case 1:
    return Buffer.concat ([src, new Buffer ([0, 0, 0])]);
  case 2:
    return Buffer.concat ([src, new Buffer ([0, 0])]);
  case 3:
    return Buffer.concat ([src, new Buffer ([0])]);
  }
}

function calc_checksum(buf) {
  var sum = 0;
  var nlongs = buf.byteLength / 4;

  for (var i = 0; i < nlongs; ++i) {
    var t = buf.getUint32(i*4);
    sum = ulong(sum + t);
  }
  return sum;
}

var WOFF_OFFSET = {
  MAGIC: 0,
  FLAVOR: 4,
  SIZE: 8,
  NUM_TABLES: 12,
  RESERVED: 14,
  SFNT_SIZE: 16,
  VERSION_MAJ: 20,
  VERSION_MIN: 22,
  META_OFFSET: 24,
  META_LENGTH: 28,
  META_ORIG_LENGTH: 32,
  PRIV_OFFSET: 36,
  PRIV_LENGTH: 40
};

var WOFF_ENTRY_OFFSET = {
  TAG: 0,
  OFFSET: 4,
  COMPR_LENGTH: 8,
  LENGTH: 12,
  CHECKSUM: 16
};

var SFNT_OFFSET = {
  TAG: 0,
  CHECKSUM: 4,
  OFFSET: 8,
  LENGTH: 12
};

var SFNT_ENTRY_OFFSET = {
  FLAVOR: 0,
  VERSION_MAJ: 4,
  VERSION_MIN: 6,
  CHECKSUM_ADJUSTMENT: 8
};

var MAGIC = {
  WOFF: 0x774F4646,
  CHECKSUM_ADJUSTMENT: 0xB1B0AFBA
};

var SIZEOF = {
  WOFF_HEADER: 44,
  WOFF_ENTRY: 20,
  SFNT_HEADER: 12,
  SFNT_TABLE_ENTRY: 16
};

function woffAppendMetadata(src, metadata, callback) {
  if (!metadata) {
    callback(null, src);
    return;
  }
  zlib.deflate(metadata, function (err, zdata) {
    if (err) {
      callback(err);
      return;
    }
    src.setUint32(WOFF_OFFSET.SIZE, src.byteLength + zdata.length);
    src.setUint32(WOFF_OFFSET.META_OFFSET, src.byteLength);
    src.setUint32(WOFF_OFFSET.META_LENGTH, zdata.length);
    src.setUint32(WOFF_OFFSET.META_ORIG_LENGTH, metadata.length);

    //concatenate src and zdata
    var buf = new jDataView(src.byteLength + zdata.length);
    buf.writeBytes(src.buffer);
    buf.writeBytes(zdata);
    callback(null, buf);
  });
}

function ttf2woff(buf, options, callback)
{
  // Check buffer type. If not jDataView - cast it.
  if (!(buf instanceof jDataView)) {
    buf = new jDataView(buf);
  }

  var version = {
    maj: 0,
    min: 1
  };
  var numTables = buf.getUint16 (4);
  //var sfntVersion = buf.getUint32 (0);
  var flavor = 0x10000;

  var woffHeader = new jDataView(SIZEOF.WOFF_HEADER);
  woffHeader.setUint32(WOFF_OFFSET.MAGIC, MAGIC.WOFF);
  woffHeader.setUint16(WOFF_OFFSET.NUM_TABLES, numTables);
  woffHeader.setUint16(WOFF_OFFSET.RESERVED, 0);
  woffHeader.setUint32(WOFF_OFFSET.SFNT_SIZE, 0);
  woffHeader.setUint32(WOFF_OFFSET.META_OFFSET, 0);
  woffHeader.setUint32(WOFF_OFFSET.META_LENGTH, 0);
  woffHeader.setUint32(WOFF_OFFSET.META_ORIG_LENGTH, 0);
  woffHeader.setUint32(WOFF_OFFSET.PRIV_OFFSET, 0);
  woffHeader.setUint32(WOFF_OFFSET.PRIV_LENGTH, 0);

  var entries = [];

  var i, tableEntry;

  for (i = 0; i < numTables; ++i) {
    var data = buf.slice(SIZEOF.SFNT_HEADER + i*SIZEOF.SFNT_TABLE_ENTRY);
    tableEntry = {
      Tag: data.getString(4, SFNT_OFFSET.TAG, 'ascii'),
      checkSum: data.getUint32(SFNT_OFFSET.CHECKSUM),
      Offset: data.getUint32(SFNT_OFFSET.OFFSET),
      Length: data.getUint32(SFNT_OFFSET.LENGTH)
    };
    entries.push (tableEntry);
  }
  entries = entries.sort(function (a, b) {
    return a.Tag === b.Tag ? 0 : a.Tag < b.Tag ? -1 : 1;
  });

  var offset = SIZEOF.WOFF_HEADER + numTables * SIZEOF.WOFF_ENTRY;
  var woffSize = offset;
  var sfntSize = SIZEOF.SFNT_HEADER + numTables * SIZEOF.SFNT_TABLE_ENTRY;
  var dataBuf = new Buffer(0);

  var tableBuf = new jDataView(entries.length * SIZEOF.WOFF_ENTRY);
  for (i = 0; i < entries.length; ++i) {
    tableEntry = entries[i];

    if (tableEntry.Tag !== 'head') {
      var algntable = buf.slice(tableEntry.Offset, tableEntry.Offset + longAlign(tableEntry.Length));
      if (calc_checksum(algntable) !== tableEntry.checkSum) {
        callback(new Error('checksum error'));
        return;
      }
    }

    tableBuf.setString(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.TAG,
      tableEntry.Tag,
      'ascii'
    );
    tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.LENGTH, tableEntry.Length);
    tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.CHECKSUM, tableEntry.checkSum);
    sfntSize += longAlign(tableEntry.Length);
  }

  var sfntOffset = SIZEOF.SFNT_HEADER + entries.length * SIZEOF.SFNT_TABLE_ENTRY;
  var csum = calc_checksum (buf.slice (0, SIZEOF.SFNT_HEADER));
  for (i = 0; i < entries.length; ++i)
  {
    tableEntry = entries[i];
    var b = new jDataView (SIZEOF.SFNT_TABLE_ENTRY);
    b.setString (SFNT_OFFSET.TAG, tableEntry.Tag);
    b.setUint32 (SFNT_OFFSET.CHECKSUM, tableEntry.checkSum);
    b.setUint32 (SFNT_OFFSET.OFFSET, sfntOffset);
    b.setUint32 (SFNT_OFFSET.LENGTH, tableEntry.Length);
    sfntOffset += longAlign (tableEntry.Length);
    csum += calc_checksum (b);
    csum += tableEntry.checkSum;
  }
  var checksumAdjustment = ulong (MAGIC.CHECKSUM_ADJUSTMENT - csum);

  eachSeries(
    entries,
    function (tableEntry, i, next) {
      var sfntData = buf.slice(tableEntry.Offset, tableEntry.Offset + tableEntry.Length, true);
      if (tableEntry.Tag === 'head') {
        version.maj = sfntData.getUint16(SFNT_ENTRY_OFFSET.VERSION_MAJ);
        version.min = sfntData.getUint16(SFNT_ENTRY_OFFSET.VERSION_MIN);
        flavor = sfntData.getUint32(SFNT_ENTRY_OFFSET.FLAVOR);
        sfntData.setUint32 (SFNT_ENTRY_OFFSET.CHECKSUM_ADJUSTMENT, checksumAdjustment);
      }
      zlib.deflate(sfntData.buffer, function (err, woffData) {
        if (err) {
          next(err);
          return;
        }

        if (woffData.length >= sfntData.byteLength) { //WOFF standard requires packed data only if size is reduced.
          woffData = sfntData.buffer;
        }

        var compLength = woffData.length;
        woffData = pad(woffData);

        tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.OFFSET, offset);

        offset += woffData.length;
        woffSize += woffData.length;

        tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.COMPR_LENGTH, compLength);
        var newBuf = new jDataView((dataBuf.byteLength || 0) + woffData.length);
        if (dataBuf.buffer) {
          newBuf.writeBytes(dataBuf.buffer);
        }
        newBuf.writeBytes(woffData);
        dataBuf = newBuf;
        next();
      });
    },
    function(err) {
      if (err) {
        callback(err);
        return;
      }
      woffHeader.setUint32(WOFF_OFFSET.SIZE, woffSize);
      woffHeader.setUint32(WOFF_OFFSET.SFNT_SIZE, sfntSize);
      woffHeader.setUint16(WOFF_OFFSET.VERSION_MAJ, version.maj);
      woffHeader.setUint16(WOFF_OFFSET.VERSION_MIN, version.min);
      woffHeader.setUint32(WOFF_OFFSET.FLAVOR, flavor);

      var out = new jDataView(woffHeader.byteLength + tableBuf.byteLength + dataBuf.byteLength);
      out.writeBytes(woffHeader.buffer);
      out.writeBytes(tableBuf.buffer);
      out.writeBytes(dataBuf.buffer);
      woffAppendMetadata(out, options.metadata, callback);
    }
  );
}

module.exports = ttf2woff;
