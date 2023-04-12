import { LitElement, html, css, unsafeCSS } from "lit";
import {
    CesiumTerrainProvider
} from "cesium";

console.log(window.location.pathname);

export class LayerPicker extends LitElement {

    static properties = {
        swissTerrain: { type: Boolean },
        swissBuildings: { type: Boolean },
        swissTrees: { type: Boolean },
        hillshadeBaseLayer: { type: String},
        imageryBaseLayer: {type: String},
        vectorBaseLayer: {type: String},
    };

    constructor() {
        super();
        this.swissTerrain = true;
        this.swissBuildings = false;
        this.swissTrees = false;
        this.baseLayer = ''
    }
    static get styles(){

        return [
            css`
            div[part="slotted"] {
      
            }
            .layer-picker {
                z-index: 4;
                position: absolute;
                display: grid;
                grid-template-columns: 33% 33% 33%;
                grid-template-rows: 50% 50%;
                right: 1rem;
                top: 6rem;
                width: 300px;
                height: 200px;
                background-color: rgba(255,255,255,.68);
                backdrop-filter: blur(20px);
                border-radius: 10px;
                padding: 1rem;
            }
            .layer-picker input[type="radio"]{
                margin:0;padding:0;
                -webkit-appearance:none;
                   -moz-appearance:none;
                        appearance:none;
            }
            .hillshade {
                background-image: url(https://raw.githubusercontent.com/uzufly/exploratory/main/cesium-viewer/src/assets/img/hillshade.png);
                border-radius: 50%;
                justify-self: center;
            }
            .imagery {
                background-image: url(https://raw.githubusercontent.com/uzufly/exploratory/main/cesium-viewer/src/assets/img/imageAerienne.png);
                border-radius: 50%;
                justify-self: center;
            }
            .vector {
                background-image: url(https://raw.githubusercontent.com/uzufly/exploratory/main/cesium-viewer/src/assets/img/vector.png);
                border-radius: 50%;
                justify-self: center;
            }

            .layer-picker input[type="radio"]:active +.chosen-map{
                opacity: .9;

            }
            .layer-picker input[type="radio"]:checked +.chosen-map{
                -webkit-filter: none;
                -moz-filter: none;
                filter: none;
                box-shadow: 0px 0px 2px grey;
            }
            .chosen-map{
                cursor:pointer;
                background-size:cover;
                background-repeat:no-repeat;
                width:60px;height:60px;
                -webkit-transition: all 100ms ease-in;
                   -moz-transition: all 100ms ease-in;
                        transition: all 100ms ease-in;
                -webkit-filter: brightness(1.8) grayscale(1) opacity(.7);
                   -moz-filter: brightness(1.8) grayscale(1) opacity(.7);
                        filter: brightness(1.8) grayscale(1) opacity(.7);
            }
            .chosen-map:hover{
                -webkit-filter: brightness(1.2) grayscale(.5) opacity(.9);
                   -moz-filter: brightness(1.2) grayscale(.5) opacity(.9);
                        filter: brightness(1.2) grayscale(.5) opacity(.9);
            }
            .hillshade, .imagery, .vector {
                grid-row-start: 2;
            }
          `,
          ];
    }

    render() {
        return html`
            <div class="layer-picker">
                ${this._renderCheckBox()}
                ${this._renderBaseLayerPicker()}
            </div>
        `;
    }

    _renderBaseLayerPicker() {
        return html`
            <input type="radio" id="hillshade" name="base-layer" value="https://wmts100.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/4326/{z}/{x}/{y}.png" @change=${this._onChangeBaseLayer} checked>
            <label class="chosen-map hillshade" for="hillshade"></label>
            <input type="radio" id="imagery" name="base-layer" value="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/4326/{z}/{x}/{y}.jpeg" @change=${this._onChangeBaseLayer}>
            <label class="chosen-map imagery" for="imagery"></label>
            <input type="radio" id="vector" name="base-layer" value="https://wmts10.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-farbe.3d/default/current/4326/{z}/{x}/{y}.jpeg" @change=${this._onChangeBaseLayer}>
            <label class="chosen-map vector" for="vector"></label>
        `;
    }

    _renderCheckBox = () => {
        return html`
            <label>
                <input type="checkbox" @change=${this._toggleTerrain} ?checked=${this.swissTerrain}>
                Swiss Terrain
            </label>
            <label>
                <input type="checkbox" @change=${this._toggleBuildings} ?checked=${this.swissBuildings}>
                Swiss Buildings
            </label>
            <label>
                <input type="checkbox" @change=${this._toggleTrees} ?checked=${this.swissTrees}>
                Swiss Trees
            </label>
        `;
    }

    async _onChangeBaseLayer(e) {
        
        await this.updateComplete;
        this.baseLayer = e.target.value;
        console.log(this.baseLayer)
        this.dispatchEvent(new CustomEvent("base-layer", {
            detail: this.baseLayer,
            bubbles: true,
            composed: true
        }));
    }

    _toggleTerrain(e) {

        const essai = e.target.checked;
        //console.log('essai', essai)
        this.swissTerrain = !this.swissTerrain;
        //console.log(this.swissTerrain)
        this.dispatchEvent(new Event("toggle-terrain", { detail: { checked: this.swissTerrain}}));
        // console.log(this.dispatchEvent(new CustomEvent("toggle-terrain", this.swissTerrain)))
    }   
    _toggleBuildings(e) {

        this.swissBuildings = e.target.checked;
        console.log(this.swissBuildings)
        this.dispatchEvent(new CustomEvent("toggle-buildings", { detail: { checked: this.swissBuildings}}));
    }
    _toggleTrees(e) {
        this.swissTrees = e.target.checked;
        
        this.dispatchEvent(new CustomEvent("toggle-trees", {detail: this.swissTrees}));

        //console.log(this.dispatchEvent(new CustomEvent("swiss-trees", {detail: this.swissTrees})))
    }

}
if (!window.customElements.get("layer-picker")) {
    window.customElements.define("layer-picker", LayerPicker);
}