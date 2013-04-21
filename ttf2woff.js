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
    nargs: 1,
    help: 'Output file'
  }
);

parser.addArgument(
  ['-m', '--metadata'],
  {
    help: 'Metadata XML file (optional)',
    required: false
  }
);

var args = parser.parseArgs();
var ttf;
var options = {};

try {
  ttf = fs.readFileSync(args.infile[0]);
} catch(e) {
  console.error("Can't open input file (%s)", args.infile[0]);
  process.exit(1);
}

if (args.metadata) {
  try {
    options.metadata = fs.readFileSync (args.metadata);
  } catch(e) {
    console.error("Can't open metadata file (%s)", args.infile);
    process.exit(1);
  }
}

ttf2woff(ttf, options, function (err, woff) {
  if (err) {
    console.log(err);
    return;
  }
  fs.writeFileSync(args.outfile[0], woff);
});

