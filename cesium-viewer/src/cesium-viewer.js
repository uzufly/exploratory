import { LitElement, html, css, unsafeCSS } from "lit";
import {
  defined,
  Viewer,
  Ion,
  Cartographic,
  Math,
  WebMapServiceImageryProvider,
  createWorldTerrain,
  GetFeatureInfoFormat,
  UrlTemplateImageryProvider,
  GeographicTilingScheme,
  Rectangle,
  ShadowMode,
  CesiumTerrainProvider,
} from "cesium";

import cesiumWidgetsRawCSS from "bundle-text:cesium/Build/CesiumUnminified/Widgets/widgets.css";
const cesiumWidgetsCSS = unsafeCSS(cesiumWidgetsRawCSS);

const ourViewerOptions = {
  animation: false,
  homeButton: false,
  baseLayerPicker: false,
  geocoder: false,
  infoBox: true,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationInstructionsInitiallyVisible: false,
  navigationHelpButton: false,
  shadows: true,
  terrainShadows: ShadowMode.DISABLED,
}

/**
 * A `‹custom-element›` Custom Element, based on `LitElement`.
 *
 * @fires (nothing)
 * @slot (default) - This element has a default slot.
 * @csspart (none) - This element has no CSS Parts.
 */
export class CesiumViewer extends LitElement {
  static properties = {
    /**
     * Default camera position the viewer is greeted with.
     * The Array is of the form `{ longitude: Number, latitude: Number, height: Number }`.
     * If `null`, the default Cesium initial camera position is used.
     * @type {Array}
     */
    cameraPosition: { type: Array, attribute: "camera-position" },
    /**
     * Default camera angle the viewer is greeted with.
     * The Array is of the form `{ heading: Number, pitch: Number, roll: Number }`.
     * If `null`, the default Cesium initial camera angle is used.
     * @type {Array}
     * @see https://cesium.com/docs/cesiumjs-ref-doc/Camera.html#heading
     * @see https://cesium.com/docs/cesiumjs-ref-doc/Camera.html#pitch
     * @see https://cesium.com/docs/cesiumjs-ref-doc/Camera.html#roll
     * @see https://cesium.com/docs/cesiumjs-ref-doc/Camera.html#setView
     */
    cameraAngle: { type: Array, attribute: "camera-angle" },
    /**
     * The Cesium Ion access token to use.
     * Can be found at: https://cesium.com/ion/tokens
     * 
     * If left blank, the default Cesium access token is used. This will
     * limit the amount of data that can be loaded.
     * @type {string}
     */
    ionAccessToken: { type: String, attribute: "ion-access-token" },
    /**
     * The terrain provider to use.
     * If `null`, the default Cesium terrain provider is used.
     * @type {string}
     * @see https://cesium.com/docs/cesiumjs-ref-doc/TerrainProvider.html
     * @see https://cesium.com/docs/cesiumjs-ref-doc/CesiumTerrainProvider.html
     */
    terrainProvider: { type: String, attribute: "terrain-provider" },
    /**
     * The imagery provider to use.
     * If `null`, the default Cesium imagery provider is used.
     * The imagery used here is considered as the base layer. Only one base layer can be used.
     * It is preferable to use WMTS over WMS as WMTS are tiled and enhance performance.
     * If you want to add more imagery layers, use the `featureLayers` property.
     * @type {String}
     * @see https://cesium.com/docs/cesiumjs-ref-doc/ImageryProvider.html
     * @see https://cesium.com/docs/cesiumjs-ref-doc/UrlTemplateImageryProvider.html
     * @see https://cesium.com/docs/cesiumjs-ref-doc/TileMapServiceImageryProvider.html
     * @see https://cesium.com/docs/cesiumjs-ref-doc/WebMapServiceImageryProvider.html
     */
    imageryProvider: { type: String, attribute: "imagery-provider" },
    /**
     * The feature layers to use.
     * If `null`, no feature layers are used.
     * Multiple feature layers (or none) can be used. It is preferable to use WMS over WMTS as
     * WMS can be queried for more information.
     * For now, only WMS and WMTS are supported for the feature layers as they are hosted online.
     * Other feature layers, based on local data and built on vector layers, are not supported yet.
     * @type {String}
     */
    featureLayers: { type: String, attribute: "feature-layers" },
    /**
     * The URL on our server where CesiumJS's static files are hosted;
     * see https://github.com/CesiumGS/cesium/issues/8327 for some explanation.
     * Cesium defaults to relative paths.
     *
     * For development, this package was setup to copy Cesium's static assets
     * to the `dist/static/` folder, which the development server exposes
     * at `http://localhost:1234/static/`; `cesiumBaseURL` should therefore
     * be defined as `/static/`.
     *
     * @type {string}
     * @see {@link https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Core/buildModuleUrl.js|buildModuleUrl.js}
     */
    cesiumBaseURL: { type: String, attribute: "cesium-base-url" },

    /**
     * Internal property, which is set if a runtime error pops up while
     * processing the file that was dragged on top of the viewer.
     */
    _dropError: { type: Object, state: true },
  };

  static get styles() {
    return [
      cesiumWidgetsCSS,
      css`
      *,
      ::after,
      ::before {
        box-sizing: border-box;
      }
      :host {
        height: 100%;
        display: flex;
      }
      h1,
      p {
        margin-block-start: 0;
        margin-block-end: 0.5rem;
      }
      div[part="slotted"] {

      }
      div[part="msg"]{

      }
    `,
    ];
  }

  constructor() {
    super();

    this._viewer = null;

    this.cameraPosition = null;
    this.ionAccessToken = null;
    this.terrainProvider = null;
    this.imageryProvider = null;
    this.featureLayers = null;
    this.cesiumBaseURL = null;
    this.cameraAngle = null;

    this._dropError = null;
  }

  render() {
    return [this.renderSlotted(), this.renderDropErrorIfAny()];
  }

  renderSlotted() {
    return html`<div part="slotted"><slot></slot></div>`;
  }
  renderDropErrorIfAny() {
    if (!this._dropError) return;
    const { source, error } = this._dropError;
    return html`<div part="msg">
      <p>
        <strong>Error processing <code>${source}</code></strong>
      </p>
      <blockquote><code>${error}</code></blockquote>
    </div>`;
  }
  _dropErrorHandler(viewerArg, source, error) {
    this._dropError = { source, error };
    // viewerArg is unused
  }

  firstUpdated() {
    CesiumViewer._setCesiumGlobalConfig(
      this.cesiumBaseURL,
      this.ionAccessToken
    );
    this._viewer = this._createCesiumViewer(this.renderRoot);
  }

  static _setCesiumGlobalConfig(cesiumBaseURL, ionAccessToken) {
    // this is the way the Cesium Viewer requires it to resolve its static resources
    // (see https://github.com/CesiumGS/cesium/issues/8327)
    if (defined(cesiumBaseURL)) {
      window.CESIUM_BASE_URL = cesiumBaseURL;
    } // … side-effect! in global scope!!

    if (defined(ionAccessToken)) {
      Ion.defaultAccessToken = ionAccessToken;
    } // … more side-effects! contained at least
  }
  _createCesiumViewer(container) {

    const viewer = new Viewer(container, {
      ...ourViewerOptions,
      terrainProvider: new CesiumTerrainProvider({
        url: this.terrainProvider,
      }),
      // cameraPosition: this.cameraPosition,
      imageryProvider: new UrlTemplateImageryProvider({
        url: this.imageryProvider
      })
      ,
    });

    const cameraLon = this.cameraPosition[0];
    const cameraLat = this.cameraPosition[1];
    const cameraHeight = this.cameraPosition[2];

    const cameraHeading = this.cameraAngle[0];
    const cameraPitch = this.cameraAngle[1];
    const cameraRoll = this.cameraAngle[2];
    
    viewer.camera.setView({
      destination: Cartographic.toCartesian(Cartographic.fromDegrees(cameraLon, cameraLat, cameraHeight)),
      orientation: {
        heading: Math.toRadians(cameraHeading),
        pitch: Math.toRadians(cameraPitch),
        roll: Math.toRadians(cameraRoll),
      }
    });

    // console.log(JSON.stringify([...this.featureLayers[0]]))

    // const imageryLayers = viewer.imageryLayers;
    // imageryLayers.addImageryProvider(
    //   new WebMapServiceImageryProvider({
    //     url: "https://wms.geo.admin.ch/",
    //     layers: this.featureLayers[0],
    //     parameters: {
    //       format: "image/png",
    //     },
    //     minimumLevel: 8,
    //     maximumLevel: 17,
    //     tilingScheme: new GeographicTilingScheme({
    //       numberOfLevelZeroTilesX: 2,
    //       numberOfLevelZeroTilesY: 1
    //     }),
    //     rectangle: Rectangle.fromDegrees(
    //       5.013926957923385,
    //       45.35600133779394,
    //       11.477436312994008,
    //       48.27502358353741
    //     ),
    //     getFeatureInfoFormats: [
    //       new GetFeatureInfoFormat(
    //         "text",
    //       ),
    //     ],
    //   })
    // );

    // if (this.featureLayers) {
    //   console.log('coucou')
    //   this.featureLayers.forEach((layer) => {
    //     console.log('coucou')
    //     viewer.imageryLayers.add(layer);
    //   });
    // }

    return viewer;
  }
}

if (!window.customElements.get("cesium-viewer")) {
  window.customElements.define("cesium-viewer", CesiumViewer);
}
