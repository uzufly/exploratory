import {
  CzmlDataSource,
  defaultValue,
  defined,
  DeveloperError,
  Event,
  GeoJsonDataSource,
  getElement,
  GpxDataSource,
  KmlDataSource,
  wrapFunction,
} from "cesium";

import { default as IFCDataSource } from "./IFCDataSource.js";

/**
 * A mixin which adds default drag and drop support for CZML files to the Viewer widget.
 * Rather than being called directly, this function is normally passed as
 * a parameter to {@link Viewer#extend}, as shown in the example below.
 * @function viewerDragDropMixin

 * @param {Viewer} viewer The viewer instance.
 * @param {Object} [options] Object with the following properties:
 * @param {Element|String} [options.dropTarget=viewer.container] The DOM element which will serve as the drop target.
 * @param {Boolean} [options.clearOnDrop=true] When true, dropping files will clear all existing data sources first, when false, new data sources will be loaded after the existing ones.
 * @param {Boolean} [options.flyToOnDrop=true] When true, dropping files will fly to the data source once it is loaded.
 * @param {Boolean} [options.clampToGround=true] When true, datasources are clamped to the ground.
 * @param {Array} [options.origin] Default origin of the datasources (geographic coordinates ‹lat, long, alt›).
 * @param {Array} [options.orientation] Initial orientation of the datasources (‹heading, pitch, roll› in degrees).
 * @param {Proxy} [options.proxy] The proxy to be used for KML network links.
 *
 * @exception {DeveloperError} Element with id <options.dropTarget> does not exist in the document.
 * @exception {DeveloperError} dropTarget is already defined by another mixin.
 * @exception {DeveloperError} dropEnabled is already defined by another mixin.
 * @exception {DeveloperError} dropError is already defined by another mixin.
 * @exception {DeveloperError} clearOnDrop is already defined by another mixin.
 *
 * @example
 * // Add basic drag and drop support and pop up an alert window on error.
 * const viewer = new Cesium.Viewer('cesiumContainer');
 * viewer.extend(Cesium.viewerDragDropMixin);
 * viewer.dropError.addEventListener(function(viewerArg, source, error) {
 *     window.alert('Error processing ' + source + ':' + error);
 * });
 */
export function viewerDragDropMixin(viewer, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(viewer)) {
    throw new DeveloperError("viewer is required.");
  }
  if (Object.prototype.hasOwnProperty.call(viewer, "dropTarget")) {
    throw new DeveloperError("dropTarget is already defined by another mixin.");
  }
  if (Object.prototype.hasOwnProperty.call(viewer, "dropEnabled")) {
    throw new DeveloperError(
      "dropEnabled is already defined by another mixin."
    );
  }
  if (Object.prototype.hasOwnProperty.call(viewer, "dropError")) {
    throw new DeveloperError("dropError is already defined by another mixin.");
  }
  if (Object.prototype.hasOwnProperty.call(viewer, "clearOnDrop")) {
    throw new DeveloperError(
      "clearOnDrop is already defined by another mixin."
    );
  }
  if (Object.prototype.hasOwnProperty.call(viewer, "flyToOnDrop")) {
    throw new DeveloperError(
      "flyToOnDrop is already defined by another mixin."
    );
  }
  //>>includeEnd('debug');

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  //Local variables to be closed over by defineProperties.
  let dropEnabled = true;
  let flyToOnDrop = defaultValue(options.flyToOnDrop, true);
  const dropError = new Event();
  let clearOnDrop = defaultValue(options.clearOnDrop, true);
  let dropTarget = defaultValue(options.dropTarget, viewer.container);
  let clampToGround = defaultValue(options.clampToGround, true);
  let modelOrigin = defaultValue(options.modelOrigin, [0, 0, 0]);
  let modelOrientation = defaultValue(options.modelOrientation, [0, 0, 0]);
  let ifcBaseURL = defaultValue(options.ifcBaseURL, "");
  let proxy = options.proxy;

  dropTarget = getElement(dropTarget);

  Object.defineProperties(viewer, {
    /**
     * Gets or sets the element to serve as the drop target.
     * @memberof viewerDragDropMixin.prototype
     * @type {Element}
     */
    dropTarget: {
      //TODO See https://github.com/CesiumGS/cesium/issues/832
      get: function () {
        return dropTarget;
      },
      set: function (value) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(value)) {
          throw new DeveloperError("value is required.");
        }
        //>>includeEnd('debug');

        unsubscribe(dropTarget, handleDrop);
        dropTarget = value;
        subscribe(dropTarget, handleDrop);
      },
    },

    /**
     * Gets or sets a value indicating if drag and drop support is enabled.
     * @memberof viewerDragDropMixin.prototype
     * @type {Element}
     */
    dropEnabled: {
      get: function () {
        return dropEnabled;
      },
      set: function (value) {
        if (value !== dropEnabled) {
          if (value) {
            subscribe(dropTarget, handleDrop);
          } else {
            unsubscribe(dropTarget, handleDrop);
          }
          dropEnabled = value;
        }
      },
    },

    /**
     * Gets the event that will be raised when an error is encountered during drop processing.
     * @memberof viewerDragDropMixin.prototype
     * @type {Event}
     */
    dropError: {
      get: function () {
        return dropError;
      },
    },

    /**
     * Gets or sets a value indicating if existing data sources should be cleared before adding the newly dropped sources.
     * @memberof viewerDragDropMixin.prototype
     * @type {Boolean}
     */
    clearOnDrop: {
      get: function () {
        return clearOnDrop;
      },
      set: function (value) {
        clearOnDrop = value;
      },
    },

    /**
     * Gets or sets a value indicating if the camera should fly to the data source after it is loaded.
     * @memberof viewerDragDropMixin.prototype
     * @type {Boolean}
     */
    flyToOnDrop: {
      get: function () {
        return flyToOnDrop;
      },
      set: function (value) {
        flyToOnDrop = value;
      },
    },

    /**
     * Gets or sets the proxy to be used for KML.
     * @memberof viewerDragDropMixin.prototype
     * @type {Proxy}
     */
    proxy: {
      get: function () {
        return proxy;
      },
      set: function (value) {
        proxy = value;
      },
    },

    /**
     * Gets or sets a value indicating if the datasources should be clamped to the ground.
     * @memberof viewerDragDropMixin.prototype
     * @type {Boolean}
     */
    clampToGround: {
      get: function () {
        return clampToGround;
      },
      set: function (value) {
        clampToGround = value;
      },
    },

    /**
     * Gets or sets a value indicating the default origin of the datasources.
     * Should be a tuple with ‹lat, long, alt›.
     *
     * If `clamp-to-ground` is true, then ‹alt› height reference is ignored;
     * otherwise, it is considered relative to the ground at the given ‹lat, long›.
     *
     * @memberof viewerDragDropMixin.prototype
     * @type {Array}
     */
    modelOrigin: {
      get: function () {
        return modelOrigin;
      },
      set: function (value) {
        modelOrigin = value;
      },
    },

    /**
     * Gets or sets a value indicating the default orientation of the datasources.
     * Should be a tuple with ‹heading, pitch, roll›, expressed in degrees.
     *
     * @memberof viewerDragDropMixin.prototype
     * @type {Array}
     */
    modelOrientation: {
      get: function () {
        return modelOrientation;
      },
      set: function (value) {
        modelOrientation = value;
      },
    },
  });

  function handleDrop(event) {
    stop(event);

    if (clearOnDrop) {
      viewer.entities.removeAll();
      viewer.dataSources.removeAll();
    }

    const files = event.dataTransfer.files;
    const length = files.length;
    for (let i = 0; i < length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = createOnLoadCallback(
        viewer,
        file,
        proxy,
        clampToGround,
        modelOrigin,
        modelOrientation,
        ifcBaseURL
      );
      reader.onerror = createDropErrorCallback(viewer, file);
      reader.readAsText(file);
    }
  }

  //Enable drop by default;
  subscribe(dropTarget, handleDrop);

  //Wrap the destroy function to make sure all events are unsubscribed from
  viewer.destroy = wrapFunction(viewer, viewer.destroy, function () {
    viewer.dropEnabled = false;
  });

  //Specs need access to handleDrop
  viewer._handleDrop = handleDrop;
}

function stop(event) {
  event.stopPropagation();
  event.preventDefault();
}

function unsubscribe(dropTarget, handleDrop) {
  const currentTarget = dropTarget;
  if (defined(currentTarget)) {
    currentTarget.removeEventListener("drop", handleDrop, false);
    currentTarget.removeEventListener("dragenter", stop, false);
    currentTarget.removeEventListener("dragover", stop, false);
    currentTarget.removeEventListener("dragexit", stop, false);
  }
}

function subscribe(dropTarget, handleDrop) {
  dropTarget.addEventListener("drop", handleDrop, false);
  dropTarget.addEventListener("dragenter", stop, false);
  dropTarget.addEventListener("dragover", stop, false);
  dropTarget.addEventListener("dragexit", stop, false);
}

function createOnLoadCallback(
  viewer,
  file,
  proxy,
  clampToGround,
  modelOrigin,
  modelOrientation,
  ifcBaseURL
) {
  // console.log( `viewerDragDropMixin › createOnLoadCallback(viewer, file, proxy, clampToGround, modelOrigin, modelOrientation, ifcBaseURL): `,
  //   viewer, file, proxy, clampToGround, modelOrigin, modelOrientation, ifcBaseURL); // DEBUG

  const scene = viewer.scene;

  return function (evt) {
    const fileName = file.name;
    try {
      let loadPromise;

      if (/\.czml$/i.test(fileName)) {
        loadPromise = CzmlDataSource.load(JSON.parse(evt.target.result), {
          sourceUri: fileName,
        });
      } else if (/\.ifc$/i.test(fileName)) {
        loadPromise = IFCDataSource.load(file, {
          sourceUri: fileName,
          canvas: scene.canvas,
          clampToGround: clampToGround,
          modelOrigin: modelOrigin,
          modelOrientation: modelOrientation,
          ifcBaseURL: ifcBaseURL,
          screenOverlayContainer: viewer.container, // TODO: keep?
        });
      } else if (
        /\.geojson$/i.test(fileName) ||
        /\.json$/i.test(fileName) ||
        /\.topojson$/i.test(fileName)
      ) {
        loadPromise = GeoJsonDataSource.load(JSON.parse(evt.target.result), {
          sourceUri: fileName,
          clampToGround: clampToGround,
        });
      } else if (/\.(kml|kmz)$/i.test(fileName)) {
        loadPromise = KmlDataSource.load(file, {
          sourceUri: fileName,
          proxy: proxy,
          camera: scene.camera,
          canvas: scene.canvas,
          clampToGround: clampToGround,
          screenOverlayContainer: viewer.container,
        });
      } else if (/\.gpx$/i.test(fileName)) {
        loadPromise = GpxDataSource.load(file, {
          sourceUri: fileName,
          proxy: proxy,
        });
      } else {
        viewer.dropError.raiseEvent(
          viewer,
          fileName,
          `Unrecognized file: ${fileName}`
        );
        return;
      }

      if (defined(loadPromise)) {
        viewer.dataSources
          .add(loadPromise)
          .then(function (dataSource) {
            if (viewer.flyToOnDrop) {
              viewer.flyTo(dataSource);
            }
          })
          .catch(function (error) {
            viewer.dropError.raiseEvent(viewer, fileName, error);
          });
      }
    } catch (error) {
      viewer.dropError.raiseEvent(viewer, fileName, error);
    }
  };
}

function createDropErrorCallback(viewer, file) {
  return function (evt) {
    viewer.dropError.raiseEvent(viewer, file.name, evt.target.error);
  };
}

export default viewerDragDropMixin;
