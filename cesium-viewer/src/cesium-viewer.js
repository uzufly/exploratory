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
  PrimitiveCollection,
} from "cesium";

import {default as LayerPicker} from "./layer-picker.js";

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
const tilingScheme = new GeographicTilingScheme({
  numberOfLevelZeroTilesX: 2,
  numberOfLevelZeroTilesY: 1,
});
const rectangle = Rectangle.fromDegrees(
  5.013926957923385,
  45.35600133779394,
  11.477436312994008,
  48.27502358353741
);
const swissTLM3DURL = 'https://vectortiles4.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20190313/tileset.json';
const swissTreesURL = 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.vegetation.3d/20190313/tileset.json';

/**
 * A `‹custom-element›` Custom Element, based on `LitElement`.
 *
 * @fires (nothing)
 * @slot (default) - This element has a default slot.
 * @csspart (none) - This element has no CSS Parts.
 */
export class CesiumViewer extends LitElement {
  static get properties(){

    return {
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

    baseLayer: { type: String},
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
    }
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
    this.featureLayers = null;
    this.cesiumBaseURL = null;
    this.cameraAngle = null;
    this.baseLayer = undefined;

    this.swissBuildings = false;
    this.swissTrees = false;

  }

  render() {
    return [
      this.renderSlotted()];
  }

  renderSlotted() {
    return html`
      <div part="slotted" 
        @base-layer=${this._checkedBaseLayer} 
        @toggle-buildings=${this._checkedBuildings}
        @toggle-trees=${this._checkedTrees}
        @feature-layer=${this._checkedFeatureLayers}
      ><slot></slot></div>
      `;
  }
  _checkedFeatureLayers(e) {
    const hasChanged = true;
    this.featureLayers = e.detail
    console.log(this.featureLayers)
  }
  _checkedBaseLayer(e) {
    console.log(e.detail)
    this.baseLayer = e.detail
  }
  _checkedBuildings(event) {
    const target = event.target;
    this.swissBuildings = target.swissBuildings;
    console.log(this.swissBuildings)
  }
  _checkedTrees(event) {
    const target = event.target;
    this.swissTrees = target.swissTrees;
  }

  firstUpdated() {
    CesiumViewer._setCesiumGlobalConfig(
      this.cesiumBaseURL,
      this.ionAccessToken
    );
    this._viewer = this._createCesiumViewer(this.renderRoot);
  }

  willUpdate(changedProperties) {
    // Si on détecte un changement dans la propriété baseLayer
    if (changedProperties.has('baseLayer')) {
      // On enlève la première couche de la liste qui correspond au fond de carte
      const firstLayer = this._viewer.imageryLayers.get(0);
      this._viewer.imageryLayers.remove(firstLayer);
      // On définit les paramètres du fond de carte à ajouter
      const baseLayer =
        new UrlTemplateImageryProvider({
          url: this.baseLayer,
          minimumLevel: 8,
          maximumLevel: 17,
          tilingScheme: tilingScheme,
          rectangle: rectangle
        });
      // On ajoute le fond de carte et on le place en première position
      this._viewer.imageryLayers.addImageryProvider(baseLayer, 0);
    }
  }

  updated(changedProperties) {
    if(changedProperties.has('featureLayers')) {
      // On enlève les couches de la liste qui correspondent aux couches de données
      console.log(this._viewer.imageryLayers)
      console.log(this.featureLayers.featureLayer)
      
      // const imageryLayersLength = this._viewer.imageryLayers.length;
      // const lastLayer = this._viewer.imageryLayers.get(imageryLayersLength - 1);
      // this._viewer.imageryLayers.remove(lastLayer);
      
      
      //this._viewer.imageryLayers.removeAll();
      if (this.featureLayers.service === "WMS" || this.featureLayers.service === "WMTS WMS") {
      const wmsFeatureLayer =
            new WebMapServiceImageryProvider({
              url: "https://wms.geo.admin.ch/",
              layers: this.featureLayers.featureLayer,
              parameters: {
                format: "image/png",
                transparent: true,
              },
              minimumLevel: 8,
              maximumLevel: 17,
              tilingScheme: tilingScheme,
              rectangle: rectangle,
              getFeatureInfoFormats: [
                new GetFeatureInfoFormat(
                  "text",
                ),
              ],
            });
            this._viewer.imageryLayers.addImageryProvider(wmsFeatureLayer);
            // this._viewer.imageryLayers.lowerToBottom(wmsFeatureLayer)
      } if (this.featureLayers.service === "WMTS") {
        const wmtsFeatureLayer =
          new WebMapTileServiceImageryProvider({
            url: `https://wmts.geo.admin.ch/1.0.0/${this.featureLayers.featureLayer}/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.png`,
            layer: this.featureLayers.featureLayer,
            style: "default",
            format: "image/png",
            tileMatrixSetID: this.featureLayers.timestamp,
            maximumLevel: 17,
            tilingScheme: tilingScheme,
            rectangle: rectangle
          });
          this._viewer.imageryLayers.addImageryProvider(wmtsFeatureLayer);
      }
    }
    // Si la propriété swissBuildings a changé
    if (changedProperties.has('swissBuildings')) {
      // On parcourt la liste des primitives
      for (let i = 0; i < this._viewer.scene.primitives._primitives.length; i++) {
        // Si la primitive correspond à la couche des bâtiments
        if (this._viewer.scene.primitives._primitives[i]._url === swissTLM3DURL) {
          // On affiche ou on cache la couche en fonction de la valeur de la propriété
          this._viewer.scene.primitives._primitives[i].show = this.swissBuildings;
        }
      }
    }
    // Same pour les arbres
    if (changedProperties.has('swissTrees')) {
      for (let i = 0; i < this._viewer.scene.primitives._primitives.length; i++) {
        if (this._viewer.scene.primitives._primitives[i]._url === swissTreesURL) {
          this._viewer.scene.primitives._primitives[i].show = this.swissTrees;
        }
      }
    }
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
      url: swissTLM3DURL,
      shadows: ShadowMode.DISABLED,
      show: this.swissBuildings,
    });
    const swissTREES = new Cesium3DTileset({
      url: swissTreesURL,
      shadows: ShadowMode.DISABLED,
      show: this.swissTrees,
    });

    // Style des bâtiments
    // On attend que la couche soit chargée pour appliquer le style
    // On applique ici un style blanc transparent, ce qui ne change pas la couleur des bâtiments
    swissTLM3D.readyPromise.then(function(swissTLM3D) {
      var style = new Cesium3DTileStyle({
        color: 'color("GHOSTWHITE", 1)'
      });
      swissTLM3D.style = style;
    });

    viewer.scene.primitives.add(swissTLM3D);
    viewer.scene.primitives.add(swissTREES);
    const imageryLayers = viewer.imageryLayers;

    if (this.featureLayers) {
      // importation des Feature Layers
      const layers = this.getAttribute("feature-layers");
      // On parse à travers les couches indiquées dans l'attribut feature-layers
      this.featureLayers = JSON.parse(layers);
      
      const featureLayerArrayLength = this.featureLayers.length;
      
      let imageryFormat = "image/png";
      let imageryTimestamp = "current";

      // On parcourt les couches
      for (let i = 0; i < featureLayerArrayLength; i++) {
        // Si le format est différent de image/png (99% des couches sont en image/png)
        // On applique le format indiqué par l'utilisateur dans l'attribut feature-layers
        if (this.featureLayers[i].format && this.featureLayers[i].format !== "image/png") {
          imageryFormat = this.featureLayers[i].format
        }
        // Si le timestamp est différent de current
        // On applique le timestamp indiqué par l'utilisateur dans l'attribut feature-layers
        if (this.featureLayers[i].timestamp && this.featureLayers[i].timestamp !== "current") {
          imageryTimestamp = this.featureLayers[i].timestamp
        }
        // On différencie l'importation des couches WMS et WMTS
        if (this.featureLayers[i].type === "WMS" | this.featureLayers[i].type === "wms") {

          const wmsFeatureLayer =
            new WebMapServiceImageryProvider({
              url: "https://wms.geo.admin.ch/",
              layers: this.featureLayers[i].src,
              parameters: {
                transparent: true,
              },
              minimumLevel: 8,
              maximumLevel: 17,
              tilingScheme: tilingScheme,
              rectangle: rectangle,
              getFeatureInfoFormats: [
                new GetFeatureInfoFormat(
                  "text",
                ),
              ],
            });
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
            tilingScheme: tilingScheme,
            rectangle: rectangle
          });
          imageryLayers.addImageryProvider(wmtsFeatureLayer);
        }
      }
    }
    

    // On ajoute la couches des routes qui restera toujours visible
    const wmtsLayer2 =
    new WebMapTileServiceImageryProvider({
      url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-strassen/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.png",
      layer: "ch.swisstopo.swisstlm3d-strassen",
      style: "default",
      format: "image/png",
      tileMatrixSetID: "current",
      maximumLevel: 17,
      tilingScheme: tilingScheme,
      rectangle: rectangle
    });

    imageryLayers.addImageryProvider(wmtsLayer2);

    return viewer;
  }
}

if (!window.customElements.get("cesium-viewer")) {
  window.customElements.define("cesium-viewer", CesiumViewer);
}
