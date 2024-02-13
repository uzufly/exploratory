import { LitElement, html, css, unsafeCSS } from "lit";
import {
  Ion,
  Viewer,
  ShadowMode,
  createWorldTerrainAsync,
  defined,
  Color,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cesium3DTileStyle,
  Cesium3DTileset,
  Cartesian3,
  Matrix4,
  HeightReference,
  OpenStreetMapImageryProvider,
  JulianDate,
  CustomDataSource,
} from "cesium";
import { default as viewerDragDropMixin } from "./viewerDragDropMixin.js";
import ObjectLoader from "@speckle/objectloader";
import * as THREE from "three";
import * as Cesium from "cesium";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { ApolloClient, InMemoryCache, HttpLink, split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { gql } from "@apollo/client";

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
 * @fires `ready` - Fired when the Cesium Viewer has been instantiated.
 *
 * @slot default - This element has a default slot, styled to position
 *   its contents on top of the generated Cesium container. Additional
 *   styling can be applied with a `::slotted(text)` pseudo-element.
 *
 * @csspart slotted - The `<div>` container element of the slotted content.
 * @csspart msg - The `<div>` container element of any error message.
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
    serverUrl: { type: String },
    token: { type: String },
    streamId: { type: String },
    objectId: { type: String },
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
    this._apolloClient = null;
    this._subscription = null;
    this.streamId = null;
    this.correspondingObjects = [];

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

  /**
   * The Cesium Viewer instance, available once it has been created
   * by the `_createCesiumViewer()` private method, upon first update.
   *
   * Returns a WeakRef, which needs to be deferenced (`.deref()`);
   * this allows the Viewer instance to be garbage-collected when
   * the custom element is removed from the DOM.
   */
  get viewer() {
    return new WeakRef(this._viewer);
  }

  /**
   * @returns {Node} A clone of the DOM element containing the list of
   * credits that Cesium would display on screen and in the lightbox.
   * Returns undefined, if the Viewer has not been instantiated yet.
   * This list is computed and rendered by the CreditDisplay object of
   * the Viewer. Results may vary for each call, as the list of credits
   * is updated for every data source that is added to the Viewer.
   */
  get viewerCreditList() {
    // The `CreditDisplay` object of the Viewer manages the list of
    // credits to display on screen and in the lightbox
    const creditDisplay = this._viewer?.creditDisplay;

    // This CreditDisplay has a private property `_creditList` which
    // is a DOM element containing the list of credits to display,
    // that the CreditDisplay object computes and renders.
    //
    // This access to a private prop is bit hacky, but since the computed
    // credits array is not exposed as a method or property, grabing the
    // private resulting rendered value is the best we can do for now.
    //
    // We clone it to avoid side-effects on the original element.
    return creditDisplay?._creditList.cloneNode(true);
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopSubscription();
  }

  startSubscription() {
    if (!this.apolloClient || !this.streamId) {
      console.warn(
        "Apollo client or stream ID not available for subscription.",
      );
      return;
    }

    console.log("Starting subscription for stream ID:", this.streamId);

    const SUBSCRIPTION_QUERY = gql`
      subscription Subscription($streamId: String!) {
        commitCreated(streamId: $streamId)
      }
    `;

    this.subscription = this.apolloClient
      .subscribe({
        query: SUBSCRIPTION_QUERY,
        variables: {
          streamId: "8917fd99d7",
        },
      })
      .subscribe({
        next: (data) => {
          console.log("Subscription data:", data);
          const dialog = document.querySelector("dialog");

          // If the dialog doesn't exist, create it
          if (!dialog) {
            const newDialog = document.createElement("dialog");

            const message = document.createElement("div");
            message.className = "message";
            let formattedMessage =
              "Upstream project updated message:\n" +
              JSON.stringify(data.data.commitCreated.message, null, 2); // Indented for better readability
            formattedMessage = formattedMessage.replace(/\\n/g, "\n"); // Replace escaped newlines with actual newlines
            message.textContent = formattedMessage;

            // Create a container for the buttons
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "dialog-buttons";

            // Creating the refresh button
            const reloadButton = document.createElement("button");
            reloadButton.textContent = "Refresh";
            reloadButton.onclick = () => location.reload();

            // Creating the close button
            const closeButton = document.createElement("button");
            closeButton.className = "close-button";
            closeButton.textContent = "Close";
            closeButton.onclick = () => newDialog.close();

            // Append buttons to the container
            buttonContainer.appendChild(reloadButton);
            buttonContainer.appendChild(closeButton);

            // Append the message and button container to the dialog
            newDialog.appendChild(message);
            newDialog.appendChild(buttonContainer);

            document.body.appendChild(newDialog);
            newDialog.showModal();
          } else {
            // If the dialog already exists, just show it
            dialog.showModal();
          }
        },
        error: (err) => {
          console.error("Subscription error:", err);
        },
      });
  }

  stopSubscription() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
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

  /*------------------------------------------------------------------------------------------------------------------------ */
  /**
   * This module provides functionality for loading and displaying 3D objects from a server.
   * It uses the Three.js library to create meshes from the loaded objects from speckle and display them in a 3D scene.
   *
   * The main method is `_load`, which fetches the objects from the server and processes them.
   * If an object has vertices and faces, it is stored for later processing.
   * If an object has a "@displayValue" property, the method finds the corresponding object and stores it.
   *
   * The `_getCorrespondingObject` method is used to find an object that corresponds to a given ID in an array of objects.
   *
   * The `_createMeshes` method processes the vertices and face indices of the objects and creates meshes from them.
   * It creates a new mesh whenever it encounters a face index of 0.
   *
   * The `createMesh` method creates a single mesh from given vertices and faces.
   * It creates a new THREE.BufferGeometry object and sets its 'position' attribute and index.
   * It then creates a new THREE.Mesh object with the geometry and a basic material and returns it.
   */

  /**
   * Asynchronously loads 3D objects from a server.
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.serverUrl - The server URL.
   * @param {string} config.streamId - The stream ID.
   * @param {string} config.objectId - The object ID.
   * @param {string} config.token - The authentication token.
   * @returns {Promise<void>}
   */
  _createApolloClient(token) {
    // HTTP connection to the API
    const httpLink = new HttpLink({
      uri: "https://speckle.xyz/graphql",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // WebSocket link for subscriptions
    const wsLink = new WebSocketLink({
      uri: `wss://speckle.xyz/graphql`,
      options: {
        reconnect: true,
        connectionParams: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    });

    // Using the ability to split links, you can send data to each link
    // depending on what kind of operation is being sent
    const link = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === "OperationDefinition" &&
          definition.operation === "subscription"
        );
      },
      wsLink,
      httpLink,
    );

    // Instantiate Apollo Client
    return new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
  }

  async _load({ serverUrl, streamId, objectId, token }) {
    const loader = new ObjectLoader({ serverUrl, streamId, objectId, token });
    this.allObjects = [];
    let objectRelations = {};

    for await (let obj of loader.getObjectIterator()) {
      this.allObjects.push(obj);

      if(obj.faces & obj.vertices){
        console.log("pushing obj with id:", obj.id)
        this.correspondingObjects.push(obj);
      }
    }

    for (let obj of this.allObjects) {
      if (obj["@displayValue"]) {
        console.log("Display value:", obj);
        for (let ref of obj["@displayValue"]) {
          if (ref.referencedId) {
            let correspondingObject = this._getCorrespondingObject(
              ref.referencedId,
              this.allObjects,
            );
            this.correspondingObjects.push(correspondingObject);
          }
        }
      }
    }

    this.objectRelations = objectRelations;
  }

  _findParentPath(objectId, objectRelations) {
    let path = [objectId];
    let currentId = objectId;

    while (objectRelations[currentId]) {
      let parentId = objectRelations[currentId];
      path.push(parentId);
      currentId = parentId;
    }

    return path;
  }

  _getCorrespondingObject(referencedId, objectsArray) {
    console.log("Objects array:", objectsArray);
    console.log("Referenced ID search in:", referencedId);
    let correspondingObject = objectsArray.filter(
      (obj) => obj.id.trim() === referencedId.trim(),
    );
    if (correspondingObject.length === 0) {
      console.error(
        `No corresponding object found for referencedId: ${referencedId}`,
      );
    }
    console.log("Corresponding object:", correspondingObject);
    console.log("Object array:", objectsArray)
    return correspondingObject;
  }


  _createSingleMesh(vertices, faces, objectId) {
    let geometry = new THREE.BufferGeometry();
    let faceIndices = [];

    // Create a rotation matrix
    let rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationX(THREE.Math.degToRad(-90));

    // Create a new array for the rotated vertices
    let rotatedVertices = [];

    // Apply the rotation to the vertices
    for (let i = 0; i < vertices.length; i += 3) {
      let vertex = new THREE.Vector3(
        vertices[i],
        vertices[i + 1],
        vertices[i + 2],
      );
      vertex.applyMatrix4(rotationMatrix);
      rotatedVertices.push(vertex.x, vertex.y, vertex.z);
    }

    let k = 0;
    while (k < faces.length) {
      if (faces[k] === 1) {
        // QUAD FACE
        faceIndices.push(faces[k + 1], faces[k + 2], faces[k + 3]);
        faceIndices.push(faces[k + 1], faces[k + 3], faces[k + 4]);
        k += 5;
      } else if (faces[k] === 0) {
        // TRIANGLE FACE
        faceIndices.push(faces[k + 1], faces[k + 2], faces[k + 3]);
        k += 4;
      } else {
        throw new Error(
          `Mesh face type not supported. Face indicator: ${faces[k]}`,
        );
      }
    }

    geometry.setIndex(faceIndices);
    //geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(rotatedVertices, 3),
    );

    geometry.computeVertexNormals();

    let grayScale = Math.floor(Math.random() * (50 - 10) + 10).toString(16);
    let color = "#" + grayScale + grayScale + grayScale;
    let material = new THREE.MeshBasicMaterial({color: color});
    let mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
      objectId: objectId,
    };
    console.log("creating mesh with id:", objectId);
    return mesh;
  }

  _downloadString(text, contentType, filename) {
    let a = document.createElement("a");
    a.href =
      "data:" + contentType + ";charset=utf-8," + encodeURIComponent(text);
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async firstUpdated() {
    this.apolloClient = this._createApolloClient(this.token);
    this.startSubscription();
    const STREAM_QUERY = gql`
      query Stream(
        $streamId: String!
      ) {
        stream(id: $streamId) {
          id
          name
          description
          commits {
            totalCount
            cursor
            items {
              commentCount
              id
              referencedObject
              message
              branchName
              authorName
              createdAt
            }
          }
        }
      }
    `;

    // Execute the query
    const result = await this.apolloClient.query({
      query: STREAM_QUERY,
      variables: {
      streamId: "8917fd99d7",
    },
    });

    // Extract the objectId from the result
    const objectId = result.data.stream.commits.items[0].referencedObject;
    console.log("Object ID:", objectId);
    CesiumIfcViewer._setCesiumGlobalConfig(
      this.cesiumBaseURL,
      this.ionAccessToken,
    );
    this._viewer = await this._createCesiumViewer(this.renderRoot);
    this.fireReady();
    await this._load({
      serverUrl: this.serverUrl,
      streamId: this.streamId,
      objectId: objectId,
      token: this.token,
    });
    const ifcSite = this.allObjects.find((obj) => obj.type === "IFCSITE");
    const latitude = this._convertToDecimalDegrees(ifcSite.RefLatitude);
    const longitude = this._convertToDecimalDegrees(ifcSite.RefLongitude);
    const elevation = 729;
    console.log(
      `Latitude: ${latitude}, Longitude: ${longitude}, Elevation: ${elevation}`,
    );

    let ifcDataSource = new CustomDataSource("myGltfDataSource");
    this._viewer.dataSources.add(ifcDataSource);

    // const scene = new THREE.Scene();
    console.log("Creating meshes for objects:", this.correspondingObjects);

    this.correspondingObjects.forEach(async (obj) => {
      obj.forEach(async (obj) => {
        if (obj.faces && obj.vertices) {
          console.log("Creating mesh for object:", obj.id)
          let mesh = this._createSingleMesh(obj.vertices, obj.faces, obj.id);
          //TODO: instead of drawing one gltf for each mesh, draw one gltf for all meshes
          let gltfBlob = await this._convertMeshToGltf(mesh);
          let gltfUrl = URL.createObjectURL(gltfBlob);

          ifcDataSource.entities.add({
            position: Cartesian3.fromDegrees(longitude, latitude, elevation),
            model: {
              uri: gltfUrl,
            },
            speckleId: obj.id, // Store the object ID in the entity ID for easy access later
          });
        }
      });
    });

    /* const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
      const gltfString = JSON.stringify(gltf, null, 2);
      this._downloadString(gltfString, 'model/gltf+json', 'scene.gltf');
    }); */

    const viewer = this._viewer;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(async (click) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id.model) {
        const objectId = pickedObject.id.speckleId;
        const parentObject = this.allObjects.find(
          (obj) =>
            obj["@displayValue"] &&
            obj["@displayValue"].some((ref) => ref.referencedId === objectId),
        );
        const parentId = parentObject.id;

        const response = await fetch("https://speckle.xyz/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            query: `
                  query Object($streamId: String!, $id: String!) {
                      stream(id: $streamId) {
                          id
                          object(id: $id) {
                              data
                          }
                      }
                  }
              `,
            variables: {
              streamId: this.streamId,
              id: parentId,
            },
          }),
        });

        const data = await response.json();

        const extractProperties = (data) => {
          return {
            expressID: data.expressID,
            ObjectType: data.ObjectType,
            Description: data.Description,
            OwnerHistory: data.OwnerHistory,
            Name: data.Name,
            type: data.type,
          };
        };

        const objectData = data.data.stream.object.data;
        const specificProperties = extractProperties(objectData);

        const propertiesArray = Object.entries(specificProperties);
        const description = propertiesArray
          .map(
            ([key, value]) => `
          <tr>
              <th>${key}</th>
              <td>${JSON.stringify(value)}</td>
          </tr>
      `,
          )
          .join("");

        pickedObject.id.description = `<table>${description}</table>`;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    const destination = Cartesian3.fromDegrees(longitude, latitude, 750);

    this._viewer.camera.flyTo({
      destination: destination,
      duration: 3.0,
    });
  }

  async _convertMeshToGltf(mesh) {
    return new Promise((resolve, reject) => {
      // Crea un'istanza dell'esportatore glTF
      const exporter = new GLTFExporter();
      const options = {
        binary: true,
        trs: true,
        onlyVisible: true,
        truncateDrawRange: true,
        embedImages: true,
        animations: [],
      };

      exporter.parse(
        mesh,
        (gltf) => {
          if (options.binary) {
            const blob = new Blob([gltf], { type: "model/gltf-binary" });
            resolve(blob);
          } else {
            const gltfString = JSON.stringify(gltf, null, 2);
            const blob = new Blob([gltfString], { type: "model/gltf+json" });
            resolve(blob);
          }
        },
        options,
      );
    });
  }

  _convertToDecimalDegrees(coordinateArray) {
    let degrees = coordinateArray[0];
    let minutes = coordinateArray[1];
    let seconds = coordinateArray[2] + coordinateArray[3] / 1000000;
    return degrees + minutes / 60 + seconds / 3600;
  }

  /* ----------------------------------------------------------------------------------------------------------------------------------------------------------- */

  fireReady() {
    return this.dispatchEvent(new CustomEvent("ready", { composed: true }));
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

  async _createCesiumViewer(containerEl) {
    const viewer = new Viewer(containerEl, {
      ...ourViewerOptions,
      terrainProvider: await createWorldTerrainAsync(),
    });

    // Make the 3D Tilesets have higher priority than terrain,
    // when they would be below the terrain surface
    viewer.scene.globe.depthTestAgainstTerrain = false;

    const OSMImageryLayer = new OpenStreetMapImageryProvider({
      url: "https://tiles.stadiamaps.com/tiles/stamen_toner/",
      fileExtension: "png",
      credit:
        "Map tiles hosting by Stadia Maps, design by Stamen Design," +
        " under CC BY 3.0. Data by OpenStreetMap, under CC BY SA.",
    });

    const layer = viewer.imageryLayers.addImageryProvider(OSMImageryLayer);
    layer.contrast = 0.85;

    const dragDropMixinOptions = {
      modelOrigin: this.modelOrigin,
      modelOrientation: this.modelOrientation,
      clampToGround: this.clampToGround,
      ifcBaseURL: this.ifcBaseURL,
    };

    viewer.extend(viewerDragDropMixin, dragDropMixinOptions);
    viewer.dropError.addEventListener(this._dropErrorHandler.bind(this));

    viewer.clock.currentTime = JulianDate.fromIso8601("2022-08-01T12:00:00Z");

    const tileset = await Cesium3DTileset.fromIonAssetId(
      CESIUM_VERNETS_CLIPPED_ION_ASSET_ID,
      {
        shadows: ShadowMode.DISABLED,
        maximumScreenSpaceError: 1,
      },
    );

    let translation = Cartesian3.fromArray([0.0, 0.0, 6]);
    let matrix = Matrix4.fromTranslation(translation);

    tileset.modelMatrix = matrix;

    tileset.style = new Cesium3DTileStyle({
      heightReference: HeightReference.CLAMP_TO_GROUND,
    });

    const socle = await Cesium3DTileset.fromIonAssetId(
      SOCLE_VERNETS_CNPA_ION_ASSET_ID,
      { shadows: ShadowMode.DISABLED },
    );

    socle.modelMatrix = matrix;

    viewer.scene.primitives.add(tileset);
    viewer.scene.primitives.add(socle);
    // viewer.zoomTo(tileset);

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
