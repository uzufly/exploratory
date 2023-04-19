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
  ImageryLayer,
  createWorldTerrain,
  GetFeatureInfoFormat,
  UrlTemplateImageryProvider,
  GeographicTilingScheme,
  Rectangle,
  ShadowMode,
  CesiumTerrainProvider,
  GeoJsonDataSource,
  Color,
  GroundPrimitive,
  GeometryInstance,
  PolygonGeometry,
  ColorGeometryInstanceAttribute,
  ScreenSpaceEventType,
  PolygonHierarchy,
  HeightReference,
  EllipsoidGeodesic,
  JulianDate,
  PrimitiveCollection,
} from "cesium";

import identifyFeature from "./highlightFeature.js";

import axios from 'axios';

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

    layerOrderList: {type: Array},
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
    this.featureLayers = [];
    this.layerOrderList = [];
    this.cesiumBaseURL = null;
    this.cameraAngle = null;
    this.baseLayer = undefined;

    this.identifyFeature = new identifyFeature();

    this.swissBuildings = false;
    this.swissTrees = false;

    // document.addEventListener('layer-deleted', this._handleLayerDeleted);

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
        @layer-order=${this._checkLayerOrder}
        @layer-deleted=${this._deleteLayer}
      ><slot></slot></div>
      
      `;
  }
  _deleteLayer(e) {
    // On itère sur chaque couche, si la couche cliquée est trouvée, on la supprime
    for (let i = 0; i < this._viewer.scene.imageryLayers.length; i++) {
      if (this._viewer.scene.imageryLayers.get(i).name === e.detail.layerName) {
        this._viewer.scene.imageryLayers.remove(this._viewer.scene.imageryLayers.get(i));
      }
    }
  }
  _checkLayerOrder (e) {
    this.layerOrderList = e.detail;
  }
  _checkedFeatureLayers(e) {
    this.featureLayers = e.detail
  }
  _checkedBaseLayer(e) {
    this.baseLayer = e.detail
  }
  _checkedBuildings(event) {
    const target = event.target;
    this.swissBuildings = target.swissBuildings;
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
    // this._querySwisstopo()
  }

  willUpdate(changedProperties) {
    // Si on détecte un changement dans la propriété baseLayer
    if (changedProperties.has('baseLayer')) {
      // On met à jour le fond de carte
      this._updateBaseLayer(this.baseLayer);
    }
    
  }

  updated(changedProperties) {
    if(changedProperties.has('featureLayers')) {  
      //this._viewer.imageryLayers.removeAll();
      this._updateFeatureLayers(this.featureLayers);
    }
    // Si la propriété swissBuildings a changé
    if (changedProperties.has('swissBuildings')) {
      // On parcourt la liste des primitives
      this._updateSwissBuildings();
    }
    // Same pour les arbres
    if (changedProperties.has('swissTrees')) {
      this._updateSwissTrees();
    }

    if (changedProperties.has('layerOrderList')) {
      this._changeLayerOrder(this._viewer.scene.imageryLayers, this.layerOrderList);
    }
  }
  _changeLayerOrder (imageryLayers, layerOrderList) {
    
    // On parcourt la liste des couches
    for (let i = 0; i < imageryLayers.length; i++) {
      // On récupère le nom de la couche
      let layerName = imageryLayers._layers[i].name;
      // Si le nom de la couche est égal au nom du layer draggé
      if (layerName === layerOrderList.layerName) {
        // Puisque la liste est inversée, on inverse la différence
        // Si l'index du layer draggé est inférieur à l'index de la couche, on doit descendre la couche
        if (window.Math.abs(layerOrderList.index - (layerOrderList.length - 1)) < (imageryLayers._layers[i]._layerIndex - 2)) {
            imageryLayers.lower(imageryLayers._layers[i]);
        }
        // Sinon, on doit monter la couche
        else if (window.Math.abs(layerOrderList.index - (layerOrderList.length - 1)) > (imageryLayers._layers[i]._layerIndex - 2)) {
            imageryLayers.raise(imageryLayers._layers[i]);
        }  
      }
    }
  }

  _updateBaseLayer (updatedBaseLayer) {
    // On enlève la première couche de la liste qui correspond au fond de carte
    const firstLayer = this._viewer.imageryLayers.get(0);
    this._viewer.imageryLayers.remove(firstLayer);
    // On définit les paramètres du fond de carte à ajouter
    const baseLayer =
      new UrlTemplateImageryProvider({
        url: updatedBaseLayer,
        minimumLevel: 8,
        maximumLevel: 17,
        tilingScheme: tilingScheme,
        rectangle: rectangle
      });
    // On ajoute le fond de carte et on le place en première position
    this._viewer.imageryLayers.addImageryProvider(baseLayer, 0);
  }

  _updateFeatureLayers (featureLayers) {
    // On ajoute les couches de données
    // On vérifie que la couche n'a pas déjà été ajoutée au viewer
    if (featureLayers) {
    if (!featureLayers.featureArray.includes(featureLayers.featureLayer)) {

      if (featureLayers.service === "WMS" || featureLayers.service === "WMTS WMS") {
        const wmsFeatureLayer =
          new WebMapServiceImageryProvider({
            url: "https://wms.geo.admin.ch/",
            layers: featureLayers.featureLayer,
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
        const layer = new ImageryLayer(wmsFeatureLayer)
        layer.name = featureLayers.featureLayer;
        this._viewer.scene.imageryLayers.add(layer);

        
      }

      if (featureLayers.service === "WMTS") {
        if (featureLayers.WMTS_format !== "png") {
          featureLayers.WMTS_format = "jpeg"
        }
        // const imageryLayers = this._viewer.scene.imageryLayers;
        // _addWebMapTileServiceImageryProvider(imageryLayers, featureLayer, imageryFormat, imageryTimestamp, tilingScheme, rectangle)
        const wmtsFeatureLayer =
          new WebMapTileServiceImageryProvider({
            
            url: `https://wmts.geo.admin.ch/1.0.0/${featureLayers.featureLayer}/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.${featureLayers.WMTS_format}`,
            layer: featureLayers.featureLayer,
            style: "default",
            format: `image/${featureLayers.WMTS_format}`,
            tileMatrixSetID: featureLayers.timestamp,
            maximumLevel: 17,
            tilingScheme: tilingScheme,
            rectangle: rectangle
          });
          const layer = new ImageryLayer(wmtsFeatureLayer);
          layer.name = featureLayers.featureLayer;

          this._viewer.scene.imageryLayers.add(layer);
      }
    }

  }

  }

  _updateSwissBuildings() {
    // On parcourt la liste des primitives
    for (let i = 0; i < this._viewer.scene.primitives._primitives.length; i++) {
      // Si la primitive correspond à la couche des bâtiments
      if (this._viewer.scene.primitives._primitives[i]._url === swissTLM3DURL) {
        // On affiche ou on cache la couche en fonction de la valeur de la propriété
        this._viewer.scene.primitives._primitives[i].show = this.swissBuildings;
      }
    }
  }

  _updateSwissTrees() {
    // On parcourt la liste des primitives
    for (let i = 0; i < this._viewer.scene.primitives._primitives.length; i++) {
      // Si la primitive correspond à la couche des arbres
      if (this._viewer.scene.primitives._primitives[i]._url === swissTreesURL) {
        // On affiche ou on cache la couche en fonction de la valeur de la propriété
        this._viewer.scene.primitives._primitives[i].show = this.swissTrees;
      }
    }
  }
  _addWebMapServiceImageryProvider(featureLayer, imageryFormat, tilingScheme, rectangle) {
    const wmsFeatureLayer =
      new WebMapServiceImageryProvider({
        url: "https://wms.geo.admin.ch/",
        layers: featureLayer,
        parameters: {
          format: `image/${imageryFormat}`,
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
    
  }

  // async _querySwisstopo() {
  //   const identifyResult = await this.identifyFeature.identifyUrl()
  //   dataSource.then(function(dataSource) {
  //     this._viewer.dataSources.add(dataSource);
  //     const entities = dataSource.entities.values;
  //     console.log(dataSource.entities)
  //     for (let i = 0; i < entities.length; i++) {
  //         const entity = entities[i];
  //         // entity.polygon.extrudedHeight = 470;
  //     }
  // });
  //   console.log(identifyResult)
  // }

  _addWebMapTileServiceImageryProvider(imageryLayers, featureLayer, imageryFormat, imageryTimestamp, tilingScheme, rectangle) {
    console.log(featureLayer)
    const wmtsLayer = new WebMapTileServiceImageryProvider({
      url: `https://wmts.geo.admin.ch/1.0.0/${featureLayer}/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.${imageryFormat}`,
      layer: featureLayer,
      style: "default",
      format: `image/${imageryFormat}`,
      tileMatrixSetID: imageryTimestamp,
      maximumLevel: 17,
      tilingScheme: tilingScheme,
      rectangle: rectangle
    });
    
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

    console.log(this.imageryProvider)

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
    // const layers = this.getAttribute("feature-layers");
    //   console.log(layers)

    if (this.featureLayers) {
      // importation des Feature Layers
      const layers = this.getAttribute("feature-layers");
      // On parse à travers les couches indiquées dans l'attribut feature-layers
      this.featureLayers = JSON.parse(layers);
      
      const featureLayerArrayLength = this.featureLayers.length;
      
      let imageryFormat = "png";
      let imageryTimestamp = "current";

      // On parcourt les couches
      for (let i = 0; i < featureLayerArrayLength; i++) {
        // Si le format est différent de image/png (99% des couches sont en image/png)
        // On applique le format indiqué par l'utilisateur dans l'attribut feature-layers
        if (this.featureLayers[i].format && this.featureLayers[i].format !== "png") {
          imageryFormat = this.featureLayers[i].format
        }
        // Si le timestamp est différent de current
        // On applique le timestamp indiqué par l'utilisateur dans l'attribut feature-layers
        if (this.featureLayers[i].timestamp && this.featureLayers[i].timestamp !== "current") {
          imageryTimestamp = this.featureLayers[i].timestamp
        }
        // On différencie l'importation des couches WMS et WMTS
        if (this.featureLayers[i].type === "WMS" | this.featureLayers[i].type === "wms") {
          _addWebMapServiceImageryProvider(imageryLayers, this.featureLayers[i].src, imageryFormat, tilingScheme, rectangle);
          imageryLayers.addImageryProvider(wmsFeatureLayer);
        } else if (this.featureLayers[i].type === "WMTS" | this.featureLayers[i].type === "wmts") {
          this._addWebMapTileServiceImageryProvider(imageryLayers, this.featureLayers[i].src, imageryFormat, imageryTimestamp, tilingScheme, rectangle);
          imageryLayers.addImageryProvider(wmtsLayer);
        }
      }
    }


    const coordinates = '6.5393000025488766,46.54339219475623';
    let currentPrimitive = null;
    
    
    

    viewer.screenSpaceEventHandler.setInputAction(function(click) {
    const pickedPosition = viewer.scene.pickPosition(click.position);
    if (defined(pickedPosition)) {
      
      const lastImageryLayer = viewer.scene.imageryLayers._layers[imageryLayers._layers.length - 1].name;
      console.log(lastImageryLayer)
      const cartographic = Cartographic.fromCartesian(pickedPosition);
      const longitudeString = Math.toDegrees(cartographic.longitude).toFixed(14);
      const latitudeString = Math.toDegrees(cartographic.latitude).toFixed(14);
      const heightString = cartographic.height.toFixed(3);
      let positionString = longitudeString +','+ latitudeString;
      let featureId;
      console.log(positionString);
      fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${positionString}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=10,10,10,10&imageDisplay=1276,1287,96&lang=fr&layers=all:${lastImageryLayer}&returnGeometry=true&sr=4326&tolerance=10`)
        .then(response => response.json())
        .then(data => {
          console.log(data.results[0].geometry)
          const geojson = data.results[0].geometry;
          featureId = data.results[0].featureId;
          //console.log(featureId)
          const dataSource = GeoJsonDataSource.load(geojson, {
            stroke: Color.HOTPINK,
            fill: Color.PINK,
            strokeWidth: 3,
          });

      dataSource.then(function(dataSource) {
        viewer.dataSources.add(dataSource);
        const entities = dataSource.entities.values;
        console.log(dataSource.entities)
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          // entity.polygon.extrudedHeight = 470;
          if(currentPrimitive) {
            viewer.scene.primitives.remove(currentPrimitive)
          }

          currentPrimitive =
            new GroundPrimitive({
              geometryInstances: new GeometryInstance({ 
                geometry: new PolygonGeometry({
                  polygonHierarchy: entity.polygon.hierarchy.getValue(),
                  perPositionHeight: true,
                }),
                attributes: {
                  color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE.withAlpha(0.5)),
                },
              }),
            })
            viewer.scene.primitives.add(currentPrimitive);
        }
      });
      fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/${lastImageryLayer}/${featureId}/htmlPopup?lang=fr`)
        .then(response => response.text())
        .then(data => {
          console.log(data)
          const popup = document.getElementById("popup");
          popup.innerHTML = data;
        })

      console.log(featureId)
    });
    
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
    

    console.log(viewer.dataSources)
    this._addWebMapTileServiceImageryProvider(imageryLayers, "ch.swisstopo.swisstlm3d-strassen", "png", "current", tilingScheme, rectangle);

    // console.log(swissRoads)
    // On ajoute la couches des routes qui restera toujours visible
    // const swissRoads =
    //   new WebMapTileServiceImageryProvider({
    //     url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-strassen/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.png",
    //     layer: "ch.swisstopo.swisstlm3d-strassen",
    //     style: "default",
    //     format: "image/png",
    //     tileMatrixSetID: "current",
    //     maximumLevel: 17,
    //     tilingScheme: tilingScheme,
    //     rectangle: rectangle
    //   });

    // imageryLayers.addImageryProvider(swissRoads);

    return viewer;
  }

  
}


  

if (!window.customElements.get("cesium-viewer")) {
  window.customElements.define("cesium-viewer", CesiumViewer);
}
