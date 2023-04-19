import { LitElement, html, css, unsafeCSS } from "lit";
import {
    defined,
    Cartographic,
    GeoJsonDataSource,
    Color,
    ScreenSpaceEventType,
    GroundPrimitive,
    GeometryInstance,
    PolygonGeometry,
    ColorGeometryInstanceAttribute,
} from "cesium";

const coordinates = '6.5393000025488766,46.54339219475623'

const currentLayer = 'ch.kantone.cadastralwebmap-farbe';

const identifyUrl = `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${coordinates}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=10,10,10,10&imageDisplay=1276,1287,96&lang=fr&layers=all:${currentLayer}&returnGeometry=true&sr=4326&tolerance=10`;

export default class identifyFeature {

    async identifyUrl() {
        const response = await fetch(identifyUrl);
        const data = await response.json();
        const geojson = data.results[0].geometry;
        return data;
    }
}

// viewer.screenSpaceEventHandler.setInputAction(function(click) {
//   const pickedPosition = viewer.scene.pickPosition(click.position);
//   if (defined(pickedPosition)) {
    
//     const cartographic = Cartographic.fromCartesian(pickedPosition);
//     const longitudeString = Math.toDegrees(cartographic.longitude).toFixed(14);
//     const latitudeString = Math.toDegrees(cartographic.latitude).toFixed(14);
//     const heightString = cartographic.height.toFixed(3);
//     positionString = longitudeString +','+ latitudeString;
//     console.log(positionString);
//     fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${positionString}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=10,10,10,10&imageDisplay=1276,1287,96&lang=fr&layers=all:ch.kantone.cadastralwebmap-farbe&returnGeometry=true&sr=4326&tolerance=10`)
//       .then(response => response.json())
//       .then(data => {
//         console.log(data.results[0].geometry)
//         const geojson = data.results[0].geometry;
//         const dataSource = GeoJsonDataSource.load(geojson, {
//           stroke: Color.HOTPINK,
//           fill: Color.PINK,
//           strokeWidth: 3,
//         });

//     dataSource.then(function(dataSource) {
//       viewer.dataSources.add(dataSource);
//       const entities = dataSource.entities.values;
//       console.log(dataSource.entities)
//       for (let i = 0; i < entities.length; i++) {
//         const entity = entities[i];
//         // entity.polygon.extrudedHeight = 470;

//         viewer.scene.primitives.add(
//           new GroundPrimitive({
//             geometryInstances: new GeometryInstance({ 
//               geometry: new PolygonGeometry({
//                 polygonHierarchy: entity.polygon.hierarchy.getValue(),
//                 perPositionHeight: true,
//               }),
//               attributes: {
//                 color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE.withAlpha(0.5)),
//               },
//             }),
//           })
//         )
//       }
//     });
    
//   });
//   }
// }, ScreenSpaceEventType.LEFT_CLICK);