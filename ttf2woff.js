#!/usr/bin/env node
/*
    Author: Viktor Semykin <thesame.ml@gmail.com>

    Written for fontello.com project.
*/

'use strict';


var fs = require('fs');
var ArgumentParser = require('argparse').ArgumentParser;

var ttf2woff = require('./index.js');


var parser = new ArgumentParser({
  add_help: true,
  description: 'TTF to WOFF font converter'
});

parser.add_argument(
  'infile',
  {
    nargs: 1,
    help: 'Input file'
  }
);

parser.add_argument(
  'outfile',
  {
    nargs: 1,
    help: 'Output file'
  }
);

parser.add_argument(
  '-m', '--metadata',
  {
    help: 'Metadata XML file (optional)',
    required: false
  }
);

parser.add_argument(
  '-v', '--version',
  {
    action: 'version',
    version: require('./package.json').version,
    help: "show program's version number and exit"
  }
);

var args = parser.parse_args();
var input;
var options = {};

/* eslint-disable */

try {
  input = fs.readFileSync(args.infile[0]);
} catch (e) {
  console.error("Can't open input file (%s)", args.infile[0]);
  process.exit(1);
}

if (args.metadata) {
  try {
    options.metadata = Array.prototype.slice.call(fs.readFileSync (args.metadata), 0);
  } catch (e) {
    console.error("Can't open metadata file (%s)", args.infile);
    process.exit(1);
  }
}

var ttf = new Uint8Array(input);
var woff = ttf2woff(ttf, options);

fs.writeFileSync(args.outfile[0], woff);

