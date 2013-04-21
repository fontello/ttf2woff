#!/usr/bin/env node
/*
    Author: Viktor Semykin <thesame.ml@gmail.com>

    Written for fontello.com project.
*/

'use strict';


var fs = require('fs');
var zlib = require('zlib');
var ArgumentParser = require('argparse').ArgumentParser;

function ulong (t) {
  /*jshint bitwise:false*/
  t &= 0xffffffff;
  if (t < 0) {
    t += 0x100000000;
  }
  return t;
}

function longalign (n) {
  /*jshint bitwise:false*/
  return (n+3) & ~3;
}

function pad (src) {
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

function calc_checksum (buf) {
  var sum = 0;
  var nlongs = buf.length / 4;

  for (var i = 0; i < nlongs; ++i) {
    var t = buf.readUInt32BE (i*4);
    sum = ulong (sum + t);
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
};

var MAGIC = {
  WOFF: 0x774F4646
};

var SIZEOF = {
  WOFF_HEADER: 44,
  WOFF_ENTRY: 20,
  SFNT_HEADER: 12,
  SFNT_TABLE_ENTRY: 16
};

function ttf2woff (buf, callback)
{
  var version = {
    maj: 0,
    min: 1
  };
  //var woffTables = [];
  //var sfntTables = [];
  var numTables = buf.readUInt16BE (4);
  var flavor = 0x10000;

  var woffHeader = new Buffer (SIZEOF.WOFF_HEADER);
  woffHeader.writeUInt32BE (MAGIC.WOFF, WOFF_OFFSET.MAGIC);
  woffHeader.writeUInt16BE (numTables, WOFF_OFFSET.NUM_TABLES);
  woffHeader.writeUInt16BE (0, WOFF_OFFSET.RESERVED);
  woffHeader.writeUInt32BE (0, WOFF_OFFSET.SFNT_SIZE);
  woffHeader.writeUInt32BE (0, WOFF_OFFSET.META_OFFSET);
  woffHeader.writeUInt32BE (0, WOFF_OFFSET.META_LENGTH);
  woffHeader.writeUInt32BE (0, WOFF_OFFSET.META_ORIG_LENGTH);
  woffHeader.writeUInt32BE (0, WOFF_OFFSET.PRIV_OFFSET);
  woffHeader.writeUInt32BE (0, WOFF_OFFSET.PRIV_LENGTH);

  var entries = [];

  var i, tableEntry;

  for (i = 0; i < numTables; ++i) {
    var data = buf.slice (SIZEOF.SFNT_HEADER + i*SIZEOF.SFNT_TABLE_ENTRY);
    tableEntry = {
      Tag: data.toString ('ascii', SFNT_OFFSET.TAG, 4),
      checkSum: data.readUInt32BE (SFNT_OFFSET.CHECKSUM),
      Offset: data.readUInt32BE (SFNT_OFFSET.OFFSET),
      Length: data.readUInt32BE (SFNT_OFFSET.LENGTH)
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

  var tableBuf = new Buffer(entries.length * SIZEOF.WOFF_ENTRY);
  //var csadj = 0;
  for (i = 0; i < entries.length; ++i) {
    tableEntry = entries[i];

    if (tableEntry.Tag !== 'head') {
      var algntable = buf.slice (tableEntry.Offset, tableEntry.Offset + longalign (tableEntry.Length));
      if (calc_checksum (algntable) !== tableEntry.checkSum) {
        throw new Error ('checksum error');
      }
    }

    tableBuf.write (tableEntry.Tag, i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.TAG, i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.TAG + 4, 'ascii');
    tableBuf.writeUInt32BE (tableEntry.Length, i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.LENGTH);
    tableBuf.writeUInt32BE (tableEntry.checkSum, i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.CHECKSUM);
    sfntSize += longalign (tableEntry.Length);
  }

  var pending = entries.length;
  entries.forEach (function (tableEntry, i) {
    var sfntData = buf.slice (tableEntry.Offset, tableEntry.Offset + tableEntry.Length);
    if (tableEntry.Tag === 'head') {
      version.maj = sfntData.readUInt16BE (SFNT_ENTRY_OFFSET.VERSION_MAJ);
      version.min = sfntData.readUInt16BE (SFNT_ENTRY_OFFSET.VERSION_MIN);
      flavor = sfntData.readUInt32BE (SFNT_ENTRY_OFFSET.FLAVOR);
    }
    zlib.deflate (sfntData, function (error, woffData) {
      if (woffData.length > sfntData.length) {
        woffData = sfntData;
      }

      var compLength = woffData.length;
      woffData = pad (woffData);

      tableBuf.writeUInt32BE (offset, i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.OFFSET);

      offset += woffData.length;
      woffSize += woffData.length;

      tableBuf.writeUInt32BE (compLength, i*SIZEOF.WOFF_ENTRY + WOFF_ENTRY_OFFSET.COMPR_LENGTH);

      dataBuf = Buffer.concat ([dataBuf, woffData]);
      if (!--pending) {
        woffHeader.writeUInt32BE (woffSize, WOFF_OFFSET.SIZE);
        woffHeader.writeUInt32BE (sfntSize, WOFF_OFFSET.SFNT_SIZE);
        woffHeader.writeUInt16BE (version.maj, WOFF_OFFSET.VERSION_MAJ);
        woffHeader.writeUInt16BE (version.min, WOFF_OFFSET.VERSION_MIN);
        woffHeader.writeUInt32BE (flavor, WOFF_OFFSET.FLAVOR);
        var out = Buffer.concat ([woffHeader, tableBuf, dataBuf]);
        callback (out);
      }
    });
  });
}

function woffAppendMetadata (src, metadata, callback) {
  zlib.deflate (metadata, function (error, zdata) {
    src.writeUInt32BE (src.length + zdata.length, WOFF_OFFSET.SIZE);
    src.writeUInt32BE (src.length, WOFF_OFFSET.META_OFFSET);
    src.writeUInt32BE (zdata.length, WOFF_OFFSET.META_LENGTH);
    src.writeUInt32BE (metadata.length, WOFF_OFFSET.META_ORIG_LENGTH);
    callback (Buffer.concat ([src, zdata]));
  });
}

var parser = new ArgumentParser ({
  version: '0.0.1',
  addHelp: true,
  description: 'TTF to WOFF font converter'
});

parser.addArgument (
  ['-i', '--input'],
  {
    help: 'Input file',
    required: true
  }
);
parser.addArgument (
  ['-o', '--output'],
  {
    help: 'Output file',
    required: true
  }
);
parser.addArgument (
  ['-m', '--metadata'],
  {
    help: 'Metadata XML file (optional)',
    required: false
  }
);
var args = parser.parseArgs();

var ttf = fs.readFileSync (args.input);

ttf2woff (ttf, function (woff) {
  if (args.metadata) {
    var meta = fs.readFileSync (args.metadata);
    woffAppendMetadata (woff, meta, function (woff) {
      fs.writeFileSync (args.output, woff);
    });
  } else {
    fs.writeFileSync (args.output, woff);
  }
});

