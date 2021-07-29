3.0.0 / 2021-07-29
------------------

- Use node.js `Buffer` instead of `microbuffer` module internally.
- `require('ttf2eot')(buf)` now accepts `Uint8Array` and returns `Uint8Array` instead
  of `microbuffer` (you now should use `result` directly instead of `result.buffer`).


2.0.2 / 2020-05-27
------------------

- Fix deprecation warning in CLI (`new Buffer` => `Buffer.from`), #15.
- Dev deps bump & configs update.


2.0.1 / 2016-03-06
------------------

- Added missed CLI file to published package.


2.0.0 / 2016-03-06
------------------

- Maintenance release, no API changes.
- Drop old nodes support.
- Deps, CS update, tests.


1.3.0 / 2014-08-06
------------------

- Replaced deflate implementation with pako (speed).
- Replaced ByteBuffer implementation with more fresh (sync with svg2ttf).


1.2.0 / 2013-11-04
------------------

- Changed API to sync.
- Removed jDataView dependency.
- Removed node.js `zlib` dependency (use built-in js compressor).
- Should work in browser.


1.1.0 / 2013-07-24
------------------

- Changed API to return jDataView (internals still uses async code for zlib).
- Fixed store for uncompressable tables.
- Code cleanup.


1.0.1 / 2013-04-25
------------------

- Added tables checksums calculation.
- Minor code improvments.


1.0.0 / 2013-04-21
------------------

- First release.
