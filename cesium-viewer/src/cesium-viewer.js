import { LitElement, html, css, unsafeCSS } from "lit";
import {
  defined,
  Viewer,
  Ion,
  Cartographic,
  Cesium3DTileStyle,
  Math,
  Cesium3DTileset,
  Cartesian3,
  WebMapTileServiceImageryProvider,
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
    cameraPosition: { type: Array, attribute: "camera-position", reflect: true },
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
     * Uses the swisstopo terrain provider. If you add the attribute `swiss-terrain` to the element, it will be set to true.
     * If you don't add the attribute, it will be set to false and the layer will not be displayed. It
     * will use the default Cesium terrain provider instead.
     * @type {Boolean}
     * @see https://cesium.com/docs/cesiumjs-ref-doc/TerrainProvider.html
     * @see https://cesium.com/docs/cesiumjs-ref-doc/CesiumTerrainProvider.html
     */
    swissTerrainProvider: { type: Boolean, attribute: "swiss-terrain" },
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
     * The format of the array is as follows:
     * 
     * [
     *  {
     *  type: "WMS", // or "WMTS"
     *  layer: "ch.swisstopo.swisstlm3d-wald",
     *  // OPTIONAL
     *  format: "image/jpeg", // default is "image/png, has to be defined if format is JPEG"
     *  timestamp: "2019", // default is "current"
     *  
     * Multiple feature layers (or none) can be used. It is preferable to use WMS over WMTS as
     * WMS can be queried for more information.
     * For now, only WMS and WMTS are supported for the feature layers as they are hosted online.
     * Other feature layers, based on local data and built on vector layers, are not supported yet.
     * @type {Array}
     */
    featureLayers: { type: Array, attribute: "feature-layers" },
    /** 
     * Can toggle on and off the swiss buildings (swissTLM3D)
     * If you add the attribute `swiss-buildings` to the element, it will be set to true.
     * If you don't add the attribute, it will be set to false and the layer will not be displayed.
     * @type {Boolean}
     * 
     */
    swissBuildings: { type: Boolean, attribute: "swiss-buildings" },
    /**
     * Can toggle on and off the swiss trees
     * If you add the attribute `swiss-trees` to the element, it will be set to true.
     * If you don't add the attribute, it will be set to false and the layer will not be displayed.
     * @type {Boolean}
     * 
     */
    swissTrees: { type: Boolean, attribute: "swiss-trees" },
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
    this.swissTerrainProvider = false;
    this.imageryProvider = null;
    this.featureLayers = [];
    this.cesiumBaseURL = null;
    this.cameraAngle = null;
    this.swissBuildings = false;
    this.swissTrees = false;

    this._dropError = null;
  }

  render() {
    return [
      this.renderSlotted(), this.renderDropErrorIfAny()];
  }

  renderSlotted() {
    return html`
      <div part="slotted"><slot></slot></div>`;
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
    
    let terrainProvider;
    if (this.swissTerrainProvider) {
      terrainProvider = new CesiumTerrainProvider({
        url: "https://3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20160115/4326/"
      });
    }

    const viewer = new Viewer(container, {
      ...ourViewerOptions,
      // cameraPosition: this.cameraPosition,
      terrainProvider: terrainProvider,
      imageryProvider: new UrlTemplateImageryProvider({
        url: this.imageryProvider
      }),
    });
    // Définit si les 3DTiles traversent le terrain
    viewer.scene.globe.depthTestAgainstTerrain = true;
  
    const [cameraLon, cameraLat, cameraHeight] = this.cameraPosition;
    const [cameraHeading, cameraPitch, cameraRoll] = this.cameraAngle;

    const cameraPosition = new Cartesian3.fromDegrees(cameraLon, cameraLat, cameraHeight);

    viewer.camera.setView({
      destination: cameraPosition,
      orientation: {
        heading: Math.toRadians(cameraHeading),
        pitch: Math.toRadians(cameraPitch),
        roll: Math.toRadians(cameraRoll),
      }
    });

    const swissTLM3D = new Cesium3DTileset({
      url: 'https://vectortiles4.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20190313/tileset.json',
      shadows: ShadowMode.DISABLED,
      // colorBlendAmount : 0,
      // colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      // backFaceCulling: false,
    });
    const swissTREES = new Cesium3DTileset({
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.vegetation.3d/20190313/tileset.json',
      shadows: ShadowMode.DISABLED,
    });

    swissTLM3D.readyPromise.then(function(swissTLM3D) {
      var style = new Cesium3DTileStyle({
        color: 'color("GHOSTWHITE", 0.9)'
      });
      swissTLM3D.style = style;
    });

    if (this.swissBuildings) { 
      viewer.scene.primitives.add(swissTLM3D);
    }
    if (this.swissTrees) { 
      viewer.scene.primitives.add(swissTREES);
    }

    // importation des Feature Layers
    
    const layers = this.getAttribute("feature-layers");
    this.featureLayers = JSON.parse(layers);
    console.log(this.featureLayers)
    const featureLayerArrayLenght = this.featureLayers.length;
    const imageryLayers = viewer.imageryLayers;
    let imageryFormat = "image/png";
    let imageryTimestamp = "current";

    for (let i = 0; i < featureLayerArrayLenght; i++) {
      if (this.featureLayers[i].format && this.featureLayers[i].format !== "image/png") {
        imageryFormat = this.featureLayers[i].format
      }
      if (this.featureLayers[i].timestamp && this.featureLayers[i].timestamp !== "current") {
        imageryTimestamp = this.featureLayers[i].timestamp
      }
      if (this.featureLayers[i].type === "WMS" | this.featureLayers[i].type === "wms") {

        const wmsFeatureLayer =
          new WebMapServiceImageryProvider({
            url: "https://wms.geo.admin.ch/",
            layers: this.featureLayers[i].src,
              parameters: {
                format: imageryFormat,
                transparent: true,
            },
            minimumLevel: 8,
            maximumLevel: 17,
            tilingScheme: new GeographicTilingScheme({
              numberOfLevelZeroTilesX: 2,
              numberOfLevelZeroTilesY: 1
            }),
            rectangle: Rectangle.fromDegrees(
              5.013926957923385,
              45.35600133779394,
              11.477436312994008,
              48.27502358353741
            ),
            getFeatureInfoFormats: [
              new GetFeatureInfoFormat(
                "text",
              ),
            ],
          });
        //const imageryLayers = viewer.imageryLayers;
        imageryLayers.addImageryProvider(wmsFeatureLayer);

      } else if (this.featureLayers[i].type === "WMTS" | this.featureLayers[i].type === "wmts") {
        const wmtsFeatureLayer =
        new WebMapTileServiceImageryProvider({
          url: `https://wmts.geo.admin.ch/1.0.0/${this.featureLayers[i].src}/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.png`,
          layer: this.featureLayers[i].src,
          style: "default",
          format: imageryFormat,
          tileMatrixSetID: imageryTimestamp,
          maximumLevel: 17,
          tilingScheme: new GeographicTilingScheme({
            numberOfLevelZeroTilesX: 2,
            numberOfLevelZeroTilesY: 1
          }),
          rectangle: Rectangle.fromDegrees(
            5.013926957923385,
            45.35600133779394,
            11.477436312994008,
            48.27502358353741
          )
        });
        imageryLayers.addImageryProvider(wmtsFeatureLayer);
      }
    }

    const wmtsLayer2 =
    new WebMapTileServiceImageryProvider({
      url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-strassen/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.png",
      layer: "ch.swisstopo.swisstlm3d-strassen",
      style: "default",
      format: "image/png",
      tileMatrixSetID: "current",
      maximumLevel: 17,
      tilingScheme: new GeographicTilingScheme({
        numberOfLevelZeroTilesX: 2,
        numberOfLevelZeroTilesY: 1
      }),
      rectangle: Rectangle.fromDegrees(
        5.013926957923385,
        45.35600133779394,
        11.477436312994008,
        48.27502358353741
      )
    });

    imageryLayers.addImageryProvider(wmtsLayer2);

    return viewer;
  }
}

if (!window.customElements.get("cesium-viewer")) {
  window.customElements.define("cesium-viewer", CesiumViewer);
}
