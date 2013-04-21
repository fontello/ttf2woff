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

Usage example:

``` bash
ttf2woff fontello.ttf fontello.woff
```

Or:

``` bash
ttf2woff < fontello.ttf > fontello.oet
```


Possible problems
-----------------

Due to bug in IE, font `FullName` __MUST__ begin with `FamilyName`. For example,
if `FamilyName` is `fontello`, then `FullName` should be `fontello regular` and
so on.

In this condition is not satisfyed, then font will not be shown in IE.


Authors
-------

* Viktor Semykin <thesame.ml@gmail.com>


License
-------

Copyright (c) 2013 [Vitaly Puzrin](https://github.com/puzrin).
Released under the MIT license. See
[LICENSE](https://github.com/nodeca/ttf2woff/blob/master/LICENSE) for details.

