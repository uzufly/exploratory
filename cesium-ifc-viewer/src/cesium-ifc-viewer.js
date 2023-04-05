import { LitElement, html, css, unsafeCSS } from "lit";
// import OLCesium from 'olcs/OLCesium.js';
import {
  Ion,
  Viewer,
  ShadowMode,
  createWorldTerrain,
  defined,
  Color,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cesium3DTileStyle,
  Cesium3DTileset,
  IonResource,
  Cartesian3,
  Matrix4,
  HeightReference,
  OpenStreetMapImageryProvider,
  JulianDate,
  UrlTemplateImageryProvider,
  GeographicTilingScheme,
  Cartographic,
  Cesium3DTileColorBlendMode,
  WebMapServiceImageryProvider,
  Plane,
  GeometryInstance,
  RectangleGeometry,
  Rectangle,
  ColorGeometryInstanceAttribute,
  GroundPrimitive,
  ClippingPlaneCollection,
  PolygonGeometry,
  PolygonHierarchy,
} from "cesium";
import * as Cesium from 'cesium';
import { default as viewerDragDropMixin } from "./viewerDragDropMixin.js";

import cesiumWidgetsRawCSS from "bundle-text:cesium/Build/CesiumUnminified/Widgets/widgets.css";
const cesiumWidgetsCSS = unsafeCSS(cesiumWidgetsRawCSS);

const CESIUM_VERNETS_CLIPPED_ION_ASSET_ID = 1556965, // ifc-cesium-showcase-cesium-vernets-clipped
  SOCLE_VERNETS_CNPA_ION_ASSET_ID = 1557489; // ifc-cesium-showcase-socle-vernets-CNPA-v2

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
  terrainShadows: ShadowMode.ENABLED,
};

/**
 * `‹cesium-ifc-viewer›` custom element, based on `LitElement`.
 *
 * Has side-effect in _global_ scope: redefines `window.CESIUM_BASE_URL`
 * when the `base-url` attribute is defined.
 *
 * Has another side-effect in scope of the `Cesium.Ion` _module_:
 * redefines `Ion.defaultAccessToken` with your Ion Access Token,
 * when you provide one, by defining the `ion-access-token` attribute.
 *
 * @fires (nothing)
 * @slot - This element has a default slot, styled to position its
 *   contents on top of the generated Cesium container. Additional
 *   styling can be applied with a `::slotted(text)` pseudo-element.
 * @csspart slotted - The slotted content's `<div>` container element.
 */
export class CesiumIfcViewer extends LitElement {
  static properties = {
    /**
     * Geographic coordinates at which any dropped IFC file will be
     * placed, if it does not contain any georeference.
     *
     * Should be a tuple with ‹lat, long, alt›. If `clamp-to-ground`
     * is true, then ‹alt› height reference is ignored; otherwise,
     * it is considered relative to the ground at the given ‹lat, long›.
     *
     * @type {Array}
     */
    modelOrigin: { type: Array, attribute: "model-origin" },

    /**
     * Initial orientation of a dropped IFC file.
     *
     * Should be a tuple with ‹heading, pitch, roll›,
     * expressed in degrees.
     *
     * @type {Array}
     */
    modelOrientation: { type: Array, attribute: "model-orientation" },

    /**
     * Gets or sets a value indicating if a dropped IFC file should
     * be clamped to the ground.
     *
     * @type {Array}
     */
    clampToGround: { type: Boolean, attribute: "clamp-to-ground" },

    /**
     * Cesium Ion access token, which can be found at:
     * https://cesium.com/ion/tokens
     *
     * If left undefined, Cesium will use its default Ion Access Token,
     * and will limit the resolution of terrain tiles it provides at
     * higher levels of zoom.
     *
     * @type {string}
     */
    ionAccessToken: { type: String, attribute: "ion-access-token" },

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
     * The URL on our server where IFCjs's WASM files are hosted;
     * IFCjs only supports relative paths and resolves them against
     * its location in node_modules folder! therefore we needed to
     * add this attribute, distinct from `cesium-base-url`.
     *
     * For development, this package was setup to copy IFCjs WASM files
     * to the `dist/static/` folder, which the development server exposes at
     * at `http://localhost:1234/static/`; `cesiumBaseURL` should therefore
     * be defined as `../../static/` (to go up from `node_modules/web-ifc/`…)
     *
     * @type {string}
     */
    ifcBaseURL: { type: String, attribute: "ifc-base-url" },

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
          display: flex;
          height: 100%;
        }
        div[part="slotted"] {
        }
        div[part="msg"] {
        }
      `,
    ];
  }

  constructor() {
    super();

    // Private instance property
    this._viewer = null;

    // Public observed properties, reflected from attribute values
    this.modelOrigin = null;
    this.modelOrientation = null;
    this.clampToGround = false;
    this.ionAccessToken = null;
    this.cesiumBaseURL = null;
    this.ifcBaseURL = null;

    // Private observed property
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
    CesiumIfcViewer._setCesiumGlobalConfig(
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

  _createCesiumViewer(containerEl) {
      const viewer = new Viewer(containerEl, {
        ...ourViewerOptions,
        terrainProvider: new Cesium.CesiumTerrainProvider({
          url:
            "https://3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20160115/4326/"
        }),
        imageryProvider: new OpenStreetMapImageryProvider()

        });

    // Make the 3D Tilesets have higher priority than terrain,
    // when they would be below the terrain surface
    // viewer.scene.globe.depthTestAgainstTerrain = true;

    // const imageryLayers = viewer.imageryLayers;
    // const imageryLayers = viewer.imageryLayers;
    const imageryLayers = viewer.imageryLayers;
    const wmsLayer = 
      new Cesium.WebMapServiceImageryProvider({
        url: "https://geodienste.ch/db/av_0/fra",
          layers: "Aggregierte_Amtliche_Vermessung",
          parameters: {
            // transparent: true,
            format: "image/png",
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
          new Cesium.GetFeatureInfoFormat(
            "text",
          ),
        ],

        // getFeatureInfoUrl: "https://wms.geo.admin.ch/"

      })

      const layer = imageryLayers.addImageryProvider(wmsLayer);
      wmsLayer.readyPromise.then(function() {
        layer.alpha = 0.5;
      });
      // let dataSource = new Cesium.GeoJsonDataSource();
      // viewer.dataSources.add(dataSource);
      // dataSource.load('https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryEnvelope&geometry=548945.5,147956,549402,148103.5&imageDisplay=500,600,96&mapExtent=548945.5,147956,549402,148103.5&tolerance=1&layers=all:ch.bfs.arealstatistik&geometryFormat=geojson'
      // ).then(function() {
      //   handler.setInputAction(function(movement) {
      //     let pickedObject = viewer.scene.pick(movement.position);
      //     if (Cesium.defined(pickedObject)) {
      //       let feature = pickedObject.id;
      //       console.log(feature);
      //     }
      // }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      // });
      const tileset2 = viewer.scene.primitives.add(
        new Cesium.Cesium3DTileset({
          url: Cesium.IonResource.fromAssetId(96188),
        })
      );
      
    

    

    // viewer.imageryLayers.addImageryProvider(wmtsLayer);
    // const wmtsLayer =
    //   new Cesium.UrlTemplateImageryProvider({
    //     url: "https://wmts.geo.admin.ch/1.0.0/ch.bav.schienennetz/default/current/4326/{z}/{x}/{y}.png",
    //     minimumLevel: 8,
    //       maximumLevel: 17,
    //       tilingScheme: new GeographicTilingScheme({
    //         numberOfLevelZeroTilesX: 2,
    //         numberOfLevelZeroTilesY: 1
    //       }),
    //       rectangle: Rectangle.fromDegrees(
    //           5.013926957923385,
    //           45.35600133779394,
    //           11.477436312994008,
    //           48.27502358353741
    //         )
    //   });
      // const wmtsLayer2 =
      //   new Cesium.WebMapTileServiceImageryProvider({
      //     url: "https://wmts.geo.admin.ch/1.0.0/ch.bazl.einschraenkungen-drohnen/default/{TileMatrixSet}/4326/{TileMatrix}/{TileCol}/{TileRow}.png",
      //     layer: "ch.bazl.einschraenkungen-drohnen",
      //     style: "default",
      //     format: "image/png",
      //     tileMatrixSetID: "current",
      //     //minimumLevel: 8,
      //     maximumLevel: 17,
      //     // defaultAlpha: 0.5,
      //       tilingScheme: new GeographicTilingScheme({
      //         numberOfLevelZeroTilesX: 2,
      //         numberOfLevelZeroTilesY: 1
      //       }),
      //       rectangle: Rectangle.fromDegrees(
      //           5.013926957923385,
      //           45.35600133779394,
      //           11.477436312994008,
      //           48.27502358353741
      //         )
      //   });
      // const imageryLayers = viewer.imageryLayers;
      // const layer = imageryLayers.addImageryProvider(wmtsLayer2);
      // wmtsLayer2.readyPromise.then(function() {
      //   layer.alpha= 0.5;
      // });
      
    


    // viewer.extend(Cesium.viewerCesiumInspectorMixin); 

    const dragDropMixinOptions = {
      modelOrigin: this.modelOrigin,
      modelOrientation: this.modelOrientation,
      clampToGround: this.clampToGround,
      ifcBaseURL: this.ifcBaseURL,
    };

    viewer.extend(viewerDragDropMixin, dragDropMixinOptions);
    viewer.dropError.addEventListener(this._dropErrorHandler.bind(this));

    viewer.clock.currentTime = JulianDate.fromIso8601("2022-08-01T12:00:00Z");

    const tileset = new Cesium3DTileset({
      url: IonResource.fromAssetId(CESIUM_VERNETS_CLIPPED_ION_ASSET_ID),
      shadows: ShadowMode.DISABLED,
      maximumScreenSpaceError: 1,
    });

    tileset.style = new Cesium3DTileStyle({
      heightReference: HeightReference.CLAMP_TO_GROUND,
    });

    const socle = new Cesium3DTileset({
      url: IonResource.fromAssetId(SOCLE_VERNETS_CNPA_ION_ASSET_ID), // ifc-cesium-showcase-socle-vernets-CNPA-v2
      shadows: ShadowMode.DISABLED,
    });

    const swissTLM3D = new Cesium3DTileset({
      url: 'https://vectortiles4.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20190313/tileset.json',
      shadows: ShadowMode.DISABLED,
      colorBlendAmount : 0,
      colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      backFaceCulling: false,
    });

    const swissTREES = new Cesium3DTileset({
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.vegetation.3d/20190313/tileset.json',
      shadows: ShadowMode.DISABLED,
    });
    const swissNAMES = new Cesium3DTileset({
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
      shadows: ShadowMode.DISABLED,
    });
    // Promise.resolve(swissTLM3D.readyPromise).then(function(swissTLM3D) {
      
    //   let boundingSphere = swissTLM3D.boundingSphere;
    //   let cartographic = Cartographic.fromCartesian(boundingSphere.center);
    //   let surface = Cartesian3.fromRadians(
    //     cartographic.longitude,
    //     cartographic.latitude,
    //     0.0
    //   );
    //   let offset = Cartesian3.fromRadians(
    //     cartographic.longitude,
    //     cartographic.latitude,
    //     50.0
    //   );
    //   let translation = Cartesian3.subtract(offset, surface, new Cartesian3());
    //   swissTLM3D.modelMatrix = Matrix4.fromTranslation(translation);

    //   // swissTLM3D.style = new Cesium.Cesium3DTileStyle({
    //   //   defines: {
    //   //     distance:
    //   //       "distance(vec2(${feature['cesium#longitude']}, ${feature['cesium#latitude']}), vec2(144.96007, -37.82249))",
    //   //   },
    //   //   color: {
    //   //     conditions: [
    //   //       ["${distance} > 0.010", "color('#d65c5c')"],
    //   //       ["${distance} > 0.006", "color('#f58971')"],
    //   //       ["${distance} > 0.002", "color('#f5af71')"],
    //   //       ["${distance} > 0.0001", "color('#f5ec71')"],
    //   //       ["true", "color('#ffffff')"],
    //   //     ],
    //   //   },
    //   // });
      
    // })
    Promise.resolve(swissTREES.readyPromise).then(function(swissTREES) {
      
      
      let boundingSphere = swissTREES.boundingSphere;
      let cartographic = Cartographic.fromCartesian(boundingSphere.center);
      let surface = Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        0.0
      );
      let offset = Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        50.0
      );
      let translation = Cartesian3.subtract(offset, surface, new Cartesian3());
      swissTREES.modelMatrix = Matrix4.fromTranslation(translation);
    })
    Promise.resolve(swissNAMES.readyPromise).then(function(swissNAMES) {
      
      let boundingSphere = swissNAMES.boundingSphere;
      let cartographic = Cartographic.fromCartesian(boundingSphere.center);
      let surface = Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        0.0
      );
      let offset = Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        50.0
      );
      let translation = Cartesian3.subtract(offset, surface, new Cartesian3());
      swissNAMES.modelMatrix = Matrix4.fromTranslation(translation);
    })

    viewer.scene.primitives.add(tileset);
    viewer.scene.primitives.add(socle);
    // viewer.imageryLayers.addImageryProvider(wmtsLayer2);
    

    // viewer.scene.primitives.add(swissTLM3D);
    //viewer.scene.primitives.add(swissTREES);
    // viewer.scene.primitives.add(swissNAMES);
    
    viewer.zoomTo(tileset);

// });

    return this.modelTooltipMixin(viewer);
  }

  modelTooltipMixin(viewer) {
    // console.log(`modelTooltipMixin(): viewer`, viewer);

    // Défintion des constantes et variables
    const container = viewer.container;
    const scene = viewer.scene;
    const handler = new ScreenSpaceEventHandler(scene.canvas);
    let highlightedModel = null;
    let clickedModel = null;
    let tooltip = null;

    // Highlight du modèle on hover
    function highlightModel(model, clickedModel) {
      // Si une entité n'est pas déjà en rouge à cause d'un clic
      if (clickedModel === null) {
        if (model !== highlightedModel) {
          unhighlightModel();
          highlightedModel = model;

          model.color = Color.YELLOW;
        }
      }
    }

    // Remettre l'entité hovered avec sa couleur d'origine
    function unhighlightModel() {
      if (clickedModel === null) {
        if (highlightedModel) {
          highlightedModel.color = Color.WHITE;
          highlightedModel = null;
        }
      }
    }

    // Déplacer le tooltip suivant mouvement du pointeur
    function onMouseMove(movement) {
      let pickedObject = scene.pick(movement.endPosition);
      if (defined(pickedObject) && pickedObject.id instanceof Entity) {
        highlightModel(pickedObject.id.model, clickedModel);

        if (tooltip !== null) {
          container.removeChild(tooltip);
          tooltip = null;
        }

        tooltip = document.createElement("div");
        tooltip.setAttribute("class", "tooltip");
        tooltip.style.top = movement.endPosition.y + 50 + "px";
        tooltip.style.left = movement.endPosition.x + 50 + "px";
        tooltip.style.position = "absolute";
        tooltip.style.background = "white";
        tooltip.style.color = "black";
        tooltip.style.padding = "5px";
        tooltip.style.borderRadius = "5px";

        const categoryName = `${pickedObject.id.categoryName}`;
        const levelName = `${pickedObject.id.levelName}`;
        tooltip.innerHTML =
          typeof categoryName !== "undefined" &&
          categoryName !== "allCategories"
            ? `Level: <strong>${levelName}</strong></br>Category: <strong>${categoryName}</strong>`
            : `Level: <strong>${levelName}</strong><br>`;

        container.appendChild(tooltip);
      } else {
        unhighlightModel();
        if (tooltip) {
          container.removeChild(tooltip);
          tooltip = null;
        }
      }
    }

    handler.setInputAction(onMouseMove, ScreenSpaceEventType.MOUSE_MOVE);

    function clickModel(model) {
      if (model !== clickedModel) {
        unclickModel();

        clickedModel = model;
        // console.log(clickedModel);
        model.color = Color.RED;
      }
    }

    function unclickModel() {
      if (clickedModel) {
        clickedModel.color = Color.WHITE;
        clickedModel = null;
      }
    }

    function onLeftClick(movement) {
      let clickedObject = scene.pick(movement.position);
      if (defined(clickedObject) && clickedObject.id instanceof Entity) {
        clickModel(clickedObject.id.model);
      } else {
        unclickModel();
      }
    }

    handler.setInputAction(onLeftClick, ScreenSpaceEventType.LEFT_CLICK);

    return viewer;
  }
}

if (!window.customElements.get("cesium-ifc-viewer")) {
  window.customElements.define("cesium-ifc-viewer", CesiumIfcViewer);
}
