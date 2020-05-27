ttf2woff
========

ttf2woff converts TTF fonts to WOFF format. That can be useful for different
webfont generation tools.

This is node.js partial port of original woff CLI tools
http://people.mozilla.com/~jkew/woff/


Usage
-----

Install:

``` bash
npm install -g ttf2woff
```

Usage:
```bash
ttf2woff [-h] [-v] [-m METADATA] infile [outfile]
```

Example:
```bash
ttf2woff fontello.ttf fontello.woff
```

If the outfile name can be deduced from the infile name, it can be omitted
```bash
ttf2woff fontello.ttf
```

Authors
-------

* Viktor Semykin <thesame.ml@gmail.com>


License
-------

Copyright (c) 2013 [Vitaly Puzrin](https://github.com/puzrin).
Released under the MIT license. See
[LICENSE](https://github.com/nodeca/ttf2woff/blob/master/LICENSE) for details.

