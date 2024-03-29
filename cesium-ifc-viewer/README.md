# ‹cesium-ifc-viewer› Web Component

An exploratory [`‹cesium-ifc-viewer›`](cesium-ifc-viewer/) Web Component, which adds an IFC datasource to a Cesium scene. Built with [Cesium.js](https://cesium.com/platform/cesiumjs/), [IFC.js](https://ifcjs.github.io/info/) and [LitElement](https://lit.dev).

### Status

MVP quality. Package was built during a hackathon: it worked, we shipped it, to showcase and collect feedback. Not intended for production use.

## Features

* Drag & drop IFC file to import it;
* View the imported IFC model in the Cesium 3D canvas;
* Highlight IFC model parts on mouse hover;
* Tooltip with level and category names, while hovering model parts;
* Pick a model part (only shows Cesium's InfoBox with its ID so far);
* Custom data attribution dialog.

## How does it work?

Essentially based on [IFC.viewer.GLTF.exportIfcFileAsGltf](https://ifcjs.github.io/info/docs/Guide/web-ifc-viewer/Tutorials/IFC%20to%20gLTF/):

1. uses IFC API to import the file;
2. IFC THREE to export to GLTF _in-memory_ (ugh);
3. then import in Cesium as [Entities](https://cesium.com/learn/cesiumjs/ref-doc/Entity.html).

## Installation

Available on [GitHub Packages][registry] as [`@uzufly/cesium-ifc-viewer`][package].

```shell
npm install
```

[registry]: https://npm.pkg.github.com
[package]: https://github.com/uzufly/explorator/pkgs/npm/cesium-ifc-viewer

## Usage

### Script

Import as ES modules:

```js
import '@uzufly/cesium-ifc-viewer'
import '@uzufly/cesium-ifc-viewer-data-attribution'
```

And use with such HTML code:

```html
<cesium-ifc-viewer
  id="mainViewer"
  cesium-base-url="/static/" ifc-base-url="../../static/"
  ion-access-token="‹CESIUM_ION_ACCESS_TOKEN›"
  model-origin="[ 6.137499506, 46.192506022, 425.999 ]"
  model-orientation="[ 90, 0, 0 ]"
  clamp-to-ground>
</cesium-ifc-viewer>

<cesium-ifc-viewer-data-attribution for="mainViewer">
</cesium-ifc-viewer-data-attribution>
```

## Further work

There are many opportunities to optimize this codebase:

* cleanup the code, namely check if there would be opportunity to reduce the number of BLOBs created with `createObjectURL()` hanging around;
* fix the odd `web-ifc`/`web-ifc-three`/`web-ifc-viewer` version mix, that was introduced to fix incompatible `web-ifc-viewer` and `web-ifc` peer deps at time of writing (see [IFCjs/web-ifc-viewer#188](https://github.com/IFCjs/web-ifc-viewer/issues/188));
* run the transform of IFC models to Cesium Entities _off main thread_, in a Web Worker;
* exploit upcoming [IFCjs/fragment](https://github.com/IFCjs/fragment) library;
* build the IFC geospatial model and link it to the Cesium entites.

## Browser support

Browsers without native [custom element support][support] require a [polyfill][].

* Chrome
* Firefox
* Safari
* Microsoft Edge

[support]: https://caniuse.com/custom-elementsv1
[polyfill]: https://github.com/webcomponents/polyfills

## License

Distributed under the Apache-2.0 license. See [LICENSE](./LICENSE) for details.