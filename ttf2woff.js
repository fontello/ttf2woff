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
  version: require('./package.json').version,
  addHelp: true,
  description: 'TTF to WOFF font converter'
});

parser.addArgument(
  [ 'infile' ],
  {
    nargs: 1,
    help: 'Input file'
  }
);

parser.addArgument(
  [ 'outfile' ],
  {
    nargs: '?',
    help: 'Output file'
  }
);

parser.addArgument(
  [ '-m', '--metadata' ],
  {
    help: 'Metadata XML file (optional)',
    required: false
  }
);

var args = parser.parseArgs();

var input;
var options = {};

/* eslint-disable */

var infile = args.infile[0];
var outfile = args.outfile && args.outfile[0];

if (!outfile) {
  if (infile.endsWith('.ttf')) {
    outfile = infile.replace(/\.ttf$/, '.woff');
  } else {
    console.error("infile doesn't have a .ttf extension: can't deduce outfile name", outfile);
    process.exit(1);
  }
}

try {
  input = fs.readFileSync(infile);
} catch (e) {
  console.error("Can't open input file (%s)", infile);
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
//var ttf = Array.prototype.slice.call(input, 0);
var woff = new Buffer(ttf2woff(ttf, options).buffer);

fs.writeFileSync(outfile, woff);
