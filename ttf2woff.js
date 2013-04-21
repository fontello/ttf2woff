#!/usr/bin/env node
/*
    Author: Viktor Semykin <thesame.ml@gmail.com>

    Written for fontello.com project.
*/

'use strict';


var fs = require('fs');
var ArgumentParser = require('argparse').ArgumentParser;

var ttf2woff = require('./index.js');


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
var options = {};

if (args.metadata) {
  options.metadata = fs.readFileSync (args.metadata);
}

ttf2woff (ttf, options, function (err, woff) {
  if (err) {
    console.log(err);
    return;
  }
  fs.writeFileSync (args.output, woff);
});

