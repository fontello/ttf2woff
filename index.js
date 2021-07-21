/*
    Author: Viktor Semykin <thesame.ml@gmail.com>

    Written for fontello.com project.
*/

'use strict';


var deflate = require('pako/lib/deflate.js').deflate;


function ulong(t) {
  /* eslint-disable no-bitwise */
  t &= 0xffffffff;
  if (t < 0) {
    t += 0x100000000;
  }
  return t;
}

function longAlign(n) {
  /* eslint-disable no-bitwise */
  return (n + 3) & ~3;
}

function calc_checksum(buf) {
  var sum = 0;
  var nlongs = buf.length / 4;

  for (var i = 0; i < nlongs; ++i) {
    var t = buf.readUint32BE(i * 4);

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

function woffAppendMetadata(src, metadata) {

  var zdata =  deflate(metadata);

  src.writeUint32BE(src.length + zdata.length, WOFF_OFFSET.SIZE);
  src.writeUint32BE(src.length, WOFF_OFFSET.META_OFFSET);
  src.writeUint32BE(zdata.length, WOFF_OFFSET.META_LENGTH);
  src.writeUint32BE(metadata.length, WOFF_OFFSET.META_ORIG_LENGTH);

  return Buffer.concat([ src, zdata ]);
}

function ttf2woff(arr, options) {
  arr = Buffer.from(arr.buffer, arr.byteOffset, arr.length);

  options = options || {};

  var version = {
    maj: 0,
    min: 1
  };
  var numTables = arr.readUint16BE(4);
  //var sfntVersion = arr.readUint32BE(0);
  var flavor = 0x10000;

  var woffHeader = Buffer.alloc(SIZEOF.WOFF_HEADER);

  woffHeader.writeUint32BE(MAGIC.WOFF, WOFF_OFFSET.MAGIC);
  woffHeader.writeUint16BE(numTables, WOFF_OFFSET.NUM_TABLES);
  woffHeader.writeUint16BE(0, WOFF_OFFSET.RESERVED);
  woffHeader.writeUint32BE(0, WOFF_OFFSET.SFNT_SIZE);
  woffHeader.writeUint32BE(0, WOFF_OFFSET.META_OFFSET);
  woffHeader.writeUint32BE(0, WOFF_OFFSET.META_LENGTH);
  woffHeader.writeUint32BE(0, WOFF_OFFSET.META_ORIG_LENGTH);
  woffHeader.writeUint32BE(0, WOFF_OFFSET.PRIV_OFFSET);
  woffHeader.writeUint32BE(0, WOFF_OFFSET.PRIV_LENGTH);

  var entries = [];

  var i, tableEntry;

  for (i = 0; i < numTables; ++i) {
    var data = arr.subarray(SIZEOF.SFNT_HEADER + i * SIZEOF.SFNT_TABLE_ENTRY);

    tableEntry = {
      Tag: data.subarray(SFNT_OFFSET.TAG, SFNT_OFFSET.TAG + 4),
      checkSum: data.readUint32BE(SFNT_OFFSET.CHECKSUM),
      Offset: data.readUint32BE(SFNT_OFFSET.OFFSET),
      Length: data.readUint32BE(SFNT_OFFSET.LENGTH)
    };
    entries.push (tableEntry);
  }
  entries = entries.sort(function (a, b) {
    var aStr = String.fromCharCode.apply(null, a.Tag);
    var bStr = String.fromCharCode.apply(null, b.Tag);

    return aStr === bStr ? 0 : aStr < bStr ? -1 : 1;
  });

  var offset = SIZEOF.WOFF_HEADER + numTables * SIZEOF.WOFF_ENTRY;
  var woffSize = offset;
  var sfntSize = SIZEOF.SFNT_HEADER + numTables * SIZEOF.SFNT_TABLE_ENTRY;

  var tableBuf = Buffer.alloc(numTables * SIZEOF.WOFF_ENTRY);

  for (i = 0; i < numTables; ++i) {
    tableEntry = entries[i];

    if (String.fromCharCode.apply(null, tableEntry.Tag) !== 'head') {
      var algntable = arr.subarray(tableEntry.Offset, tableEntry.Offset + longAlign(tableEntry.Length));

      if (calc_checksum(algntable) !== tableEntry.checkSum) {
        throw 'Checksum error in ' + String.fromCharCode.apply(null, tableEntry.Tag);
      }
    }

    tableBuf.writeUint32BE(tableEntry.Tag.readUint32BE(0), i * SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.TAG);
    tableBuf.writeUint32BE(tableEntry.Length, i * SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.LENGTH);
    tableBuf.writeUint32BE(tableEntry.checkSum, i * SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.CHECKSUM);
    sfntSize += longAlign(tableEntry.Length);
  }

  var sfntOffset = SIZEOF.SFNT_HEADER + entries.length * SIZEOF.SFNT_TABLE_ENTRY;
  var csum = calc_checksum(arr.subarray(0, SIZEOF.SFNT_HEADER));

  for (i = 0; i < entries.length; ++i) {
    tableEntry = entries[i];

    var b = Buffer.alloc(SIZEOF.SFNT_TABLE_ENTRY);

    b.writeUint32BE(tableEntry.Tag.readUint32BE(0), SFNT_OFFSET.TAG);
    b.writeUint32BE(tableEntry.checkSum, SFNT_OFFSET.CHECKSUM);
    b.writeUint32BE(sfntOffset, SFNT_OFFSET.OFFSET);
    b.writeUint32BE(tableEntry.Length, SFNT_OFFSET.LENGTH);
    sfntOffset += longAlign(tableEntry.Length);
    csum += calc_checksum(b);
    csum += tableEntry.checkSum;
  }

  var checksumAdjustment = ulong(MAGIC.CHECKSUM_ADJUSTMENT - csum);

  var len, woffDataChains = [];

  for (i = 0; i < entries.length; ++i) {
    tableEntry = entries[i];

    var sfntData = arr.subarray(tableEntry.Offset, tableEntry.Offset + tableEntry.Length);

    if (String.fromCharCode.apply(null, tableEntry.Tag) === 'head') {
      version.maj = sfntData.readUint16BE(SFNT_ENTRY_OFFSET.VERSION_MAJ);
      version.min = sfntData.readUint16BE(SFNT_ENTRY_OFFSET.VERSION_MIN);
      flavor = sfntData.readUint32BE(SFNT_ENTRY_OFFSET.FLAVOR);
      sfntData.writeUint32BE(checksumAdjustment, SFNT_ENTRY_OFFSET.CHECKSUM_ADJUSTMENT);
    }

    var res = deflate(sfntData);

    var compLength;

    // We should use compression only if it really save space (standard requirement).
    // Also, data should be aligned to long (with zeros?).
    compLength = Math.min(res.length, sfntData.length);
    len = longAlign(compLength);

    var woffData = Buffer.alloc(len, 0);

    if (res.length >= sfntData.length) {
      woffData.set(sfntData);
    } else {
      woffData.set(res);
    }

    tableBuf.writeUint32BE(offset, i * SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.OFFSET);

    offset += woffData.length;
    woffSize += woffData.length;

    tableBuf.writeUint32BE(compLength, i * SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.COMPR_LENGTH);

    woffDataChains.push(woffData);
  }

  woffHeader.writeUint32BE(woffSize, WOFF_OFFSET.SIZE);
  woffHeader.writeUint32BE(sfntSize, WOFF_OFFSET.SFNT_SIZE);
  woffHeader.writeUint16BE(version.maj, WOFF_OFFSET.VERSION_MAJ);
  woffHeader.writeUint16BE(version.min, WOFF_OFFSET.VERSION_MIN);
  woffHeader.writeUint32BE(flavor, WOFF_OFFSET.FLAVOR);

  var out = Buffer.alloc(woffSize);
  var pos = 0;

  out.set(woffHeader, pos);
  pos += woffHeader.length;

  out.set(tableBuf, pos);
  pos += tableBuf.length;

  for (i = 0; i < woffDataChains.length; i++) {
    out.set(woffDataChains[i], pos);
    pos += woffDataChains[i].length;
  }

  if (options.metadata) {
    out = woffAppendMetadata(out, options.metadata);
  }

  return new Uint8Array(out.buffer, out.byteOffset, out.length);
}

module.exports = ttf2woff;
