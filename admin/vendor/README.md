# Local barcode libraries

Pinned browser builds, served from the site itself (no runtime CDN requests):

- JsBarcode 3.12.1, Code 128 build — https://github.com/lindell/JsBarcode — MIT (JsBarcode-LICENSE.txt).
- @zxing/browser 0.1.5 — https://github.com/zxing-js/browser — MIT (ZXing-LICENSE.txt). Its bundled @zxing/library decoder is Apache-2.0 (ZXing-library-LICENSE.txt).

Downloaded from cdn.jsdelivr.net/npm at the pinned versions. The camera decoder is lazy-loaded only when requested; no video/images are sent to a server.

Bundled decoder dependencies also include @zxing/text-encoding (Apache-2.0; ZXing-text-encoding-LICENSE.txt) and tslib (0BSD; tslib-LICENSE.txt).
