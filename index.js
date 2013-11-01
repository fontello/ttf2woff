/*
    Author: Viktor Semykin <thesame.ml@gmail.com>

    Written for fontello.com project.
*/

'use strict';

var zlib = require('zlib');

var ByteBuffer = require('./lib/byte_buffer.js');
var Deflate = require('./lib/deflate.js');

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
    return new ByteBuffer(src.buffer.concat([0, 0, 0]));
  case 2:
    return new ByteBuffer(src.buffer.concat([0, 0]));
  case 3:
    return new ByteBuffer(src.buffer.concat([0]));
  }
}

function calc_checksum(buf) {
  var sum = 0;
  var nlongs = buf.length / 4;

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

  var  res = Deflate(metadata);

  var zdata =  new ByteBuffer(Array.prototype.slice.call(res, 0));
  src.setUint32(WOFF_OFFSET.SIZE, src.length + zdata.length);
  src.setUint32(WOFF_OFFSET.META_OFFSET, src.length);
  src.setUint32(WOFF_OFFSET.META_LENGTH, zdata.length);
  src.setUint32(WOFF_OFFSET.META_ORIG_LENGTH, metadata.length);

  //concatenate src and zdata
  var len = src.length + zdata.length;
  var buf = new ByteBuffer(Uint8Array ? new Uint8Array(len) : new Array(len));
  buf.writeBytes(src.buffer);
  buf.writeBytes(zdata);
  return buf;
}

function ttf2woff(arr, options, callback) {
  var buf = new ByteBuffer(arr);
  var version = {
    maj: 0,
    min: 1
  };
  var numTables = buf.getUint16 (4);
  //var sfntVersion = buf.getUint32 (0);
  var flavor = 0x10000;

  var woffHeader = new ByteBuffer(new Array(SIZEOF.WOFF_HEADER));
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
    var data = new ByteBuffer(buf.buffer, SIZEOF.SFNT_HEADER + i*SIZEOF.SFNT_TABLE_ENTRY);
    tableEntry = {
      Tag: data.getString(SFNT_OFFSET.TAG, 4),
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
  var dataBuf = new ByteBuffer(new Array(0));

  var tableBuf = new ByteBuffer(new Array(entries.length * SIZEOF.WOFF_ENTRY));
  for (i = 0; i < entries.length; ++i) {
    tableEntry = entries[i];

    if (tableEntry.Tag !== 'head') {
      var algntable = new ByteBuffer(buf.buffer, tableEntry.Offset, longAlign(tableEntry.Length));
      if (calc_checksum(algntable) !== tableEntry.checkSum) {
        callback(new Error('checksum error'));
        return;
      }
    }

    tableBuf.setString(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.TAG, tableEntry.Tag);
    tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.LENGTH, tableEntry.Length);
    tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.CHECKSUM, tableEntry.checkSum);
    sfntSize += longAlign(tableEntry.Length);
  }

  var sfntOffset = SIZEOF.SFNT_HEADER + entries.length * SIZEOF.SFNT_TABLE_ENTRY;
  var csum = calc_checksum (new ByteBuffer(buf.buffer, 0, SIZEOF.SFNT_HEADER));
  for (i = 0; i < entries.length; ++i)
  {
    tableEntry = entries[i];
    var b = new ByteBuffer (new Array(SIZEOF.SFNT_TABLE_ENTRY));
    b.setString (SFNT_OFFSET.TAG, tableEntry.Tag);
    b.setUint32 (SFNT_OFFSET.CHECKSUM, tableEntry.checkSum);
    b.setUint32 (SFNT_OFFSET.OFFSET, sfntOffset);
    b.setUint32 (SFNT_OFFSET.LENGTH, tableEntry.Length);
    sfntOffset += longAlign (tableEntry.Length);
    csum += calc_checksum (b);
    csum += tableEntry.checkSum;
  }
  var checksumAdjustment = ulong (MAGIC.CHECKSUM_ADJUSTMENT - csum);

  for (i = 0; i < entries.length; ++i) {
    tableEntry = entries[i];
    var sfntData = new ByteBuffer(buf.buffer, tableEntry.Offset, tableEntry.Length);
    if (tableEntry.Tag === 'head') {
      version.maj = sfntData.getUint16(SFNT_ENTRY_OFFSET.VERSION_MAJ);
      version.min = sfntData.getUint16(SFNT_ENTRY_OFFSET.VERSION_MIN);
      flavor = sfntData.getUint32(SFNT_ENTRY_OFFSET.FLAVOR);
      sfntData.setUint32 (SFNT_ENTRY_OFFSET.CHECKSUM_ADJUSTMENT, checksumAdjustment);
    }

    var res = Deflate(sfntData.buffer.slice(sfntData.start, sfntData.start + sfntData.length));

    var woffData;
    if (res.length >= sfntData.length) { //WOFF standard requires packed data only if size is reduced.
      woffData = new ByteBuffer(sfntData.buffer.slice(sfntData.start, sfntData.start + sfntData.length));
    } else
      woffData = new ByteBuffer(Array.prototype.slice.call(res, 0));


    var compLength = woffData.length;
    woffData = pad(woffData);

    tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.OFFSET, offset);

    offset += woffData.length;
    woffSize += woffData.length;

    tableBuf.setUint32(i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.COMPR_LENGTH, compLength);
    var len = (dataBuf.length || 0) + woffData.length;
    var newBuf = new ByteBuffer(Uint8Array ? new Uint8Array(len) : new Array(len));
    if (dataBuf.buffer) {
      newBuf.writeBytes(dataBuf.buffer);
    }
    newBuf.writeBytes(woffData.buffer);
    dataBuf = newBuf;
  }

  woffHeader.setUint32(WOFF_OFFSET.SIZE, woffSize);
  woffHeader.setUint32(WOFF_OFFSET.SFNT_SIZE, sfntSize);
  woffHeader.setUint16(WOFF_OFFSET.VERSION_MAJ, version.maj);
  woffHeader.setUint16(WOFF_OFFSET.VERSION_MIN, version.min);
  woffHeader.setUint32(WOFF_OFFSET.FLAVOR, flavor);

  var len = woffHeader.length + tableBuf.length + dataBuf.length;
  var out = new ByteBuffer(Uint8Array ? new Uint8Array(len) : new Array(len));
  out.writeBytes(woffHeader.buffer);
  out.writeBytes(tableBuf.buffer);
  out.writeBytes(dataBuf.buffer);
  if (!options.metadata) {
    return out;
  } else {
    return woffAppendMetadata(out, options.metadata);
  }
}

module.exports = ttf2woff;
