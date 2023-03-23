import { IfcViewerAPI } from "web-ifc-viewer";

import {
  IFCWALL,
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCWINDOW,
  IFCMEMBER,
  IFCPLATE,
  IFCCURTAINWALL,
  IFCDOOR,
  IFCRAMP,
  IFCSTAIR,
  IFCBUILDINGELEMENTPROXY,
  IFCSITE,
  IFCCOLUMN,
  IFCFLOWTERMINAL,
  IFCRAILING,
  IFCFURNISHINGELEMENT,
  IFCROOF,
  IFCTRANSPORTELEMENT,
  IFCBEAM,
  IFCCOVERING,
} from "web-ifc";

import {
  buildModuleUrl,
  Cartesian3,
  Color,
  Credit,
  defaultValue,
  defined,
  DeveloperError,
  Ellipsoid,
  Event,
  JulianDate,
  HeadingPitchRoll,
  HeightReference,
  Math, // NOTE: overrides standard Math lib
  PinBuilder,
  Resource,
  DataSource,
  DataSourceClock,
  Entity,
  EntityCluster,
  EntityCollection,
  Transforms,
} from "cesium";

// import { createGuid } from "@cesium/engine";

// function createEntity(node, entityCollection, context) {
//   let id = queryStringAttribute(node, "id");
//   id = defined(id) && id.length !== 0 ? id : createGuid();
//   if (defined(context)) {
//     id = context + id;
//   }
//
//   // If we have a duplicate ID just generate one.
//   // This isn't valid KML but Google Earth handles this case.
//   let entity = entityCollection.getById(id);
//   if (defined(entity)) {
//     id = createGuid();
//     if (defined(context)) {
//       id = context + id;
//     }
//   }
//
//   entity = entityCollection.add(new Entity({ id: id }));
//   if (!defined(entity.kml)) {
//     entity.addProperty("kml");
//     entity.kml = new KmlFeatureData();
//   }
//   return entity;
// }

// import Uri from "urijs";
// function resolveHref(href, sourceResource, uriResolver) {
//   if (!defined(href)) {
//     return undefined;
//   }
//
//   let resource;
//   if (defined(uriResolver)) {
//     // To resolve issues with KML sources defined in Windows style paths.
//     href = href.replace(/\\/g, "/");
//     let blob = uriResolver[href];
//     if (defined(blob)) {
//       resource = new Resource({
//         url: blob,
//       });
//     } else {
//       // Needed for multiple levels of KML files in a KMZ
//       const baseUri = new Uri(sourceResource.getUrlComponent());
//       const uri = new Uri(href);
//       blob = uriResolver[uri.absoluteTo(baseUri)];
//       if (defined(blob)) {
//         resource = new Resource({
//           url: blob,
//         });
//       }
//     }
//   }
//
//   if (!defined(resource)) {
//     resource = sourceResource.getDerivedResource({
//       url: href,
//     });
//   }
//
//   return resource;
// }

function onProgress(progress, total, process) {
  // eslint-disable-next-line no-console
  console.debug(
    `IFCDataSource › processIFCData() › onProgress:`,
    progress,
    total,
    process
  );
}

async function processIFCData(dataSource, data, options) {
  // console.log(`IFCDataSource › processIFCData(dataSource, data, options)`,
  //   dataSource, dumpIfcData(data, 100), options); // DEBUG

  // const cesiumBaseURL = buildModuleUrl(); // "http://localhost:1234/static/", i.e. FQDN(CESIUM_BASE_URL)
  const ifcBaseURL = options.ifcBaseURL;
  // console.log(`IFCDataSource › processIFCData() › ifcBaseURL`, ifcBaseURL); // DEBUG

  const viewerIFC = new IfcViewerAPI({ container: dataSource.canvas });
  viewerIFC.IFC.setWasmPath(ifcBaseURL);
  // console.log(`IFCDataSource › processIFCData() › viewerIFC`, viewerIFC); // DEBUG

  const dataAsBlobURL = URL.createObjectURL(data);
  const result = await viewerIFC.GLTF.exportIfcFileAsGltf({
    ifcFileUrl: dataAsBlobURL,
    splitByFloors: true,
    categories: {
      IFCWALL: [IFCWALL],
      IFCWALLSTANDARDCASE: [IFCWALLSTANDARDCASE],
      IFCSLAB: [IFCSLAB],
      IFCWINDOW: [IFCWINDOW],
      IFCMEMBER: [IFCMEMBER],
      IFCPLATE: [IFCPLATE],
      IFCCURTAINWALL: [IFCCURTAINWALL],
      IFCDOOR: [IFCDOOR],
      IFCRAMP: [IFCRAMP],
      IFCSTAIR: [IFCSTAIR],
      IFCBUILDINGELEMENTPROXY: [IFCBUILDINGELEMENTPROXY],
      IFCSITE: [IFCSITE],
      IFCCOLUMN: [IFCCOLUMN],
      IFCFLOWTERMINAL: [IFCFLOWTERMINAL],
      IFCRAILING: [IFCRAILING],
      IFCCOVERING: [IFCCOVERING],
      IFCFURNISHINGELEMENT: [IFCFURNISHINGELEMENT],
      IFCROOF: [IFCROOF],
      IFCTRANSPORTELEMENT: [IFCTRANSPORTELEMENT],
      IFCBEAM: [IFCBEAM],
      IFCCOVERING: [IFCCOVERING],
    },
    getProperties: false, // NOTE: traitement des propriétés désactivé, parce qu'on ne sait pas
    getModels: true, // bien faire le lien entre le modèle GLTF et les propriétés IFC
    onProgress: onProgress,
    // coordinationMatrix: Matrix4
  });
  // console.log(`IFCDataSource › processIFCData() › result`, result); // DEBUG

  URL.revokeObjectURL(dataAsBlobURL);
  await viewerIFC.dispose();

  // TODO: normaliser ces valeurs et définir valeurs par défaut
  const [lat, long, alt] = options.modelOrigin; // [ 6.137499506, 46.192506022, 425.999 ]
  const [heading, pitch, roll] = options.modelOrientation;
  const clampToGround = options.clampToGround;

  const modelOrigin = Cartesian3.fromDegrees(lat, long, alt);
  const [headingRad, pitchRad, rollRad] = [
    Math.toRadians(heading),
    Math.toRadians(pitch),
    Math.toRadians(roll),
  ];
  const HPR = new HeadingPitchRoll(headingRad, pitchRad, rollRad);
  const modelOrientation = Transforms.headingPitchRollQuaternion(
    modelOrigin,
    HPR
  );

  // const fileObjURLs = [];
  for (const categoryName in result.gltf) {
    // Catégories de l'IFC (`allCategories`)
    const category = result.gltf[categoryName];
    for (const levelName in category) {
      // Niveaux de l'IFC
      // console.log(`IFCDataSource › processIFCData() › Processing category ${categoryName}, level ${levelName}…`); // DEBUG
      const file = category[levelName].file;
      if (file) {
        // Ajout de chaque fichier glTF à la scène
        const fileObjURL = URL.createObjectURL(file);
        // fileObjURLs.push(fileObjURL);
        const modelName =
          categoryName !== "allCategories"
            ? `Category: ${categoryName} / Level: ${levelName}`
            : `Level: ${levelName}`;
        dataSource.entities.add({
          position: modelOrigin,
          orientation: modelOrientation,
          name: modelName,
          levelName: levelName,
          categoryName: categoryName,
          model: {
            uri: fileObjURL,
            silhouetteColor: Color.WHITE.withAlpha(0.5),
            silhouetteSize: 2.0,
            shadows: true,
            heightReference: clampToGround
              ? HeightReference.CLAMP_TO_GROUND
              : HeightReference.RELATIVE_TO_GROUND,
          },
        });
      }
    }
  }

  // Fichier JSON en sortie
  //
  // NOTE: définir `getProperties: true` dans appel `viewerIFC.GLTF.exportIfcFileAsGltf()`
  // ci-dessus, si l'on souhaitait réactiver le traitement des propriétés; on l'a désactivé,
  // parce qu'on ne sait pas bien faire le lien entre le modèle GLTF et les propriétés IFC.
  //
  // const jsonFile = result.json[0];
  // console.log(`IFCDataSource › processIFCData() › Processing property file ${jsonFile.name}…`); // DEBUG
  // var jsonObjURL = URL.createObjectURL(jsonFile);
  // const rawProps = await fetch(jsonObjURL);
  // props = await rawProps.json();
  //
  // Extraction de la description du projet IFC
  // const gltfGlobalId = result.id;
  // console.log(`IFCDataSource › processIFCData() › Processing property file ${jsonFile.name} › result › GlobalId`, gltfGlobalId); // DEBUG
  // Object.keys(props).filter( key => props[key].GlobalId = gltfGlobalId && props[key].type === "IFCPROJECT").forEach(
  //   key => console.log(`IFCDataSource › processIFCData() › Processing property file ${jsonFile.name} › IFCPROJECT`, key, props[key])); // DEBUG
  //
  // URL.revokeObjectURL(jsonObjURL);

  // Cesium fails to load the resources, if they are cleaned up at this time!
  // fileObjURLs.forEach((fileObjURL) => URL.revokeObjectURL(fileObjURL));

  return result;
}

// function readBlobAsText(blob) {
//   const deferred = defer();
//   const reader = new FileReader();
//   reader.addEventListener("load", function () {
//     deferred.resolve(reader.result);
//   });
//   reader.addEventListener("error", function () {
//     deferred.reject(reader.error);
//   });
//   reader.readAsText(blob);
//   return deferred.promise;
// }

function dumpIfcData(data, numChars) {
  if (typeof data === "string") {
    return (
      `${data.slice(0, numChars)}` +
      ` [… snip snip …] ` +
      `${data.slice(-numChars, -1)}`
    );
  } else if (data instanceof Blob) {
    return data;
  } else {
    const unhandledTypeMsg = `'data' arg is expected to be a string or a Blob; got ${typeof data}`;
    console.assert(typeof data === "string", unhandledTypeMsg);
    return unhandledTypeMsg;
  }
}

async function loadIFC(dataSource, entityCollection, data, options) {
  // console.log(`IFCDataSource › loadIFC(dataSource, entityCollection, data, options):`,
  //   dataSource, entityCollection, dumpIfcData(data, 25), options);

  // TODO: read this from IFC data
  let name = options.sourceUri;
  // console.log(`IFCDataSource › loadIFC() › name:`, name);
  // Only set the name from the root document
  if (!defined(dataSource._name)) {
    dataSource._name = name;
  }

  entityCollection.removeAll();
  entityCollection.suspendEvents();

  const result = await processIFCData(dataSource, data, options);
  // console.log(`IFCDataSource › loadIFC() › result:`, result);

  entityCollection.resumeEvents();

  return result;
}

async function load(dataSource, entityCollection, data, options) {
  // console.log(`IFCDataSource › load(dataSource, entityCollection, data, options)`,
  //   dataSource, entityCollection, data, options) // DEBUG

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  try {
    if (data instanceof Blob) {
      const result = await loadIFC(dataSource, entityCollection, data, options);
      return result;
    } else {
      throw RuntimeError(
        `'data' is expected to be instance of a Blob; got ${typeof data}`
      );
    }
  } catch (error) {
    dataSource._error.raiseEvent(dataSource, error);
    console.error(error);
    return Promise.reject(error);
  }
}

// NOTE: LoadOptions properties are repeated in ConstructorOptions because some
// tooling does not support "base types" for @typedef.  Remove if/when
// https://github.com/microsoft/TypeScript/issues/20077 and/or
// https://github.com/jsdoc/jsdoc/issues/1199 actually get resolved
/**
 * @typedef {Object} IFCDataSource.LoadOptions
 *
 * Initialization options for the `load` method.
 *
 * @property {String} [sourceUri] Overrides the url to use for resolving relative links and other KML network features.
 * @property {Boolean} [clampToGround=false] true if we want the geometry features (Polygons, LineStrings and LinearRings) clamped to the ground.
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The global ellipsoid used for geographical calculations.
 * @property {Element|String} [screenOverlayContainer] A container for ScreenOverlay images.
 */

/**
 * @typedef {Object} IFCDataSource.ConstructorOptions
 *
 * Options for constructing a new IFCDataSource, or calling the static `load` method.
 *
 * @property {HTMLCanvasElement} [canvas] The canvas that is used for sending viewer properties to network links.
 * @property {Credit|String} [credit] A credit for the data source, which is displayed on the canvas.
 *
 * @property {String} [sourceUri] Overrides the url to use for resolving relative links and other KML network features.
 * @property {Boolean} [clampToGround=false] true if we want the geometry features (Polygons, LineStrings and LinearRings) clamped to the ground.
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The global ellipsoid used for geographical calculations.
 * @property {Element|String} [screenOverlayContainer] A container for ScreenOverlay images.

*/

/**
 * A {@link DataSource} which processes Keyhole Markup Language 2.2 (KML).
 * <p>
 * KML support in Cesium is incomplete, but a large amount of the standard,
 * as well as Google's <code>gx</code> extension namespace, is supported. See Github issue
 * {@link https://github.com/CesiumGS/cesium/issues/873|#873} for a
 * detailed list of what is and isn't supported. Cesium will also write information to the
 * console when it encounters most unsupported features.
 * </p>
 * <p>
 * Non visual feature data, such as <code>atom:author</code> and <code>ExtendedData</code>
 * is exposed via an instance of {@link KmlFeatureData}, which is added to each {@link Entity}
 * under the <code>kml</code> property.
 * </p>
 *
 * @alias IFCDataSource
 * @constructor
 *
 * @param {IFCDataSource.ConstructorOptions} [options] Object describing initialization options
 *
 * @see {@link http://www.opengeospatial.org/standards/kml/|Open Geospatial Consortium KML Standard}
 * @see {@link https://developers.google.com/kml/|Google KML Documentation}
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?src=KML.html|Cesium Sandcastle KML Demo}
 *
 * @example
 * const viewer = new Cesium.Viewer('cesiumContainer');
 * viewer.dataSources.add(
 *     Cesium.IFCDataSource.load('../../SampleData/facilities.kmz',
 *     { canvas: viewer.scene.canvas })
 * );
 */
function IFCDataSource(options) {
  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  this._changed = new Event();
  this._error = new Event();
  this._loading = new Event();
  this._refresh = new Event();

  this._clock = undefined;
  this._entityCollection = new EntityCollection(this);
  this._name = undefined;
  this._isLoading = false;
  this._pinBuilder = new PinBuilder();
  this._entityCluster = new EntityCluster();

  /**
   * The current size of this Canvas will be used to populate the Link parameters
   * for client height and width.
   *
   * @type {HTMLCanvasElement | undefined}
   */
  this.canvas = options.canvas;

  this._ellipsoid = defaultValue(options.ellipsoid, Ellipsoid.WGS84);

  // User specified credit
  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;

  this._screenOverlays = [];
}

/**
 * Creates a Promise to a new instance loaded with the provided KML data.
 *
 * @param {Resource|String|Document|Blob} data A url, parsed KML document, or Blob containing binary KMZ data or a parsed KML document.
 * @param {IFCDataSource.ConstructorOptions} [options] An object specifying configuration options
 *
 * @returns {Promise.<IFCDataSource>} A promise that will resolve to a new IFCDataSource instance once the KML is loaded.
 */
IFCDataSource.load = function (data, options) {
  options = defaultValue(options, defaultValue.EMPTY_OBJECT);
  const dataSource = new IFCDataSource(options);
  return dataSource.load(data, options);
};

Object.defineProperties(IFCDataSource.prototype, {
  /**
   * Gets or sets a human-readable name for this instance.
   * This will be automatically be set to the KML document name on load.
   * @memberof IFCDataSource.prototype
   * @type {String}
   */
  name: {
    get: function () {
      return this._name;
    },
    set: function (value) {
      if (this._name !== value) {
        this._name = value;
        this._changed.raiseEvent(this);
      }
    },
  },
  /**
   * Gets the clock settings defined by the loaded KML. This represents the total
   * availability interval for all time-dynamic data. If the KML does not contain
   * time-dynamic data, this value is undefined.
   * @memberof IFCDataSource.prototype
   * @type {DataSourceClock}
   */
  clock: {
    get: function () {
      return this._clock;
    },
  },
  /**
   * Gets the collection of {@link Entity} instances.
   * @memberof IFCDataSource.prototype
   * @type {EntityCollection}
   */
  entities: {
    get: function () {
      return this._entityCollection;
    },
  },
  /**
   * Gets a value indicating if the data source is currently loading data.
   * @memberof IFCDataSource.prototype
   * @type {Boolean}
   */
  isLoading: {
    get: function () {
      return this._isLoading;
    },
  },
  /**
   * Gets an event that will be raised when the underlying data changes.
   * @memberof IFCDataSource.prototype
   * @type {Event}
   */
  changedEvent: {
    get: function () {
      return this._changed;
    },
  },
  /**
   * Gets an event that will be raised if an error is encountered during processing.
   * @memberof IFCDataSource.prototype
   * @type {Event}
   */
  errorEvent: {
    get: function () {
      return this._error;
    },
  },
  /**
   * Gets an event that will be raised when the data source either starts or stops loading.
   * @memberof IFCDataSource.prototype
   * @type {Event}
   */
  loadingEvent: {
    get: function () {
      return this._loading;
    },
  },
  /**
   * Gets an event that will be raised when the data source refreshes a network link.
   * @memberof IFCDataSource.prototype
   * @type {Event}
   */
  refreshEvent: {
    get: function () {
      return this._refresh;
    },
  },
  /**
   * Gets whether or not this data source should be displayed.
   * @memberof IFCDataSource.prototype
   * @type {Boolean}
   */
  show: {
    get: function () {
      return this._entityCollection.show;
    },
    set: function (value) {
      this._entityCollection.show = value;
    },
  },

  /**
   * Gets or sets the clustering options for this data source.
   * This object can be shared between multiple data sources.
   *
   * @memberof IFCDataSource.prototype
   * @type {EntityCluster}
   */
  clustering: {
    get: function () {
      return this._entityCluster;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value must be defined.");
      }
      //>>includeEnd('debug');
      this._entityCluster = value;
    },
  },
  /**
   * Gets the credit that will be displayed for the data source
   * @memberof IFCDataSource.prototype
   * @type {Credit}
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },
});

/**
 * Asynchronously loads the provided KML data, replacing any existing data.
 *
 * @param {Resource|String|Document|Blob} data A url, parsed KML document, or Blob containing binary KMZ data or a parsed KML document.
 * @param {IFCDataSource.LoadOptions} [options] An object specifying configuration options
 *
 * @returns {Promise.<IFCDataSource>} A promise that will resolve to this instances once the KML is loaded.
 */
IFCDataSource.prototype.load = function (data, options) {
  // console.log( `IFCDataSource#.load(data, options):`, data, options)

  //>>includeStart('debug', pragmas.debug);
  if (!defined(data)) {
    throw new DeveloperError("data is required.");
  }
  //>>includeEnd('debug');

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  this._name = undefined;
  this._clampToGround = defaultValue(options.clampToGround, false);

  DataSource.setLoading(this, true);

  const that = this;
  return load(this, this._entityCollection, data, options)
    .then(function () {
      DataSource.setLoading(that, false);
      return that;
    })
    .catch(function (error) {
      DataSource.setLoading(that, false);
      that._error.raiseEvent(that, error);
      console.error(error);
      return Promise.reject(error);
    });
};

/**
 * Cleans up any non-entity elements created by the data source.
 * Currently this only affects ScreenOverlay elements.
 */
IFCDataSource.prototype.destroy = function () {
  while (this._screenOverlays.length > 0) {
    const elem = this._screenOverlays.pop();
    elem.remove();
  }
};

/**
 * Updates the data source to the provided time.  This function is optional and
 * is not required to be implemented.  It is provided for data sources which
 * retrieve data based on the current animation time or scene state.
 * If implemented, update will be called by {@link DataSourceDisplay} once a frame.
 *
 * @param {JulianDate} time The simulation time.
 * @returns {Boolean} True if this data source is ready to be displayed at the provided time, false otherwise.
 */
IFCDataSource.prototype.update = function (time) {
  return true;
};

export default IFCDataSource;
