import { LitElement, html, css, unsafeCSS } from "lit";
import {
    CesiumTerrainProvider
} from "cesium";

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
                right: 1rem;
                top: 6rem;
                width: 200px;
                height: 100px;
                background-color: rgba(255,255,255,.68);
                backdrop-filter: blur(20px);
                border-radius: 10px;
                padding: 1rem;
          `,
          ];
    }

    render() {
        return html`
            <div class=layer-picker>
                ${this._renderCheckBox()}
                ${this._renderBaseLayerPicker()}
            </div>
        `;
    }

    _renderBaseLayerPicker() {
        return html`
            <label>
                <input type="radio" name="base-layer" value="https://wmts100.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/4326/{z}/{x}/{y}.png" @change=${this._onChangeBaseLayer} checked>
                Hillshade
            </label><br>
            <label>
                <input type="radio" name="base-layer" value="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/4326/{z}/{x}/{y}.jpeg" @change=${this._onChangeBaseLayer}>
                Imagery
            </label><br>
            <label>
                <input type="radio" name="base-layer" value="https://wmts10.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-farbe.3d/default/current/4326/{z}/{x}/{y}.jpeg" @change=${this._onChangeBaseLayer}>
                Vector
            </label><br>
        `;
    }

    _renderCheckBox = () => {
        return html`
            <label>
                <input type="checkbox" @change=${this._toggleTerrain} ?checked=${this.swissTerrain}>
                Swiss Terrain
            </label><br>
            <label>
                <input type="checkbox" @change=${this._toggleBuildings} ?checked=${this.swissBuildings}>
                Swiss Buildings
            </label><br>
            <label>
                <input type="checkbox" @change=${this._toggleTrees} ?checked=${this.swissTrees}>
                Swiss Trees
            </label><br>
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