# ttf2woff

ttf2woff converts TTF fonts to WOFF format. That can be useful for different
webfont generation tools.

This is node.js partial port of original woff CLI tools
http://people.mozilla.com/~jkew/woff/


## Usage

### Install globally

``` bash
npm install -g ttf2woff
```

### Usage example

``` bash
ttf2woff fontello.ttf fontello.woff
```

### Run in Docker

As an alternative, the app can be run through Docker. First, the container image needs to be built, for instance:

````bash
$ docker build -t fontello/ttf2woff -f Dockerfile .
````

Now, the `ttf2woff` application can be run within a temporary Docker container with a mounted volume (to exchange the font files between the container and the host machine).

````bash
$ docker run --rm -v $(pwd)/fixtures/:/fonts fontello/ttf2woff /fonts/test.ttf /fonts/converted.woff
````


## Authors

* Viktor Semykin <thesame.ml@gmail.com>


## License

Copyright (c) 2013 [Vitaly Puzrin](https://github.com/puzrin).
Released under the MIT license. See
[LICENSE](https://github.com/nodeca/ttf2woff/blob/master/LICENSE) for details.

