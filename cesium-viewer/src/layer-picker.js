import { LitElement, html, css, unsafeCSS } from "lit";
import {
    CesiumTerrainProvider
} from "cesium";

export class LayerPicker extends LitElement {

    static get properties() {
        return {
            defaultBuildings: {type: Boolean},
            defaultTrees: {type: Boolean},
            hillshadeBaseLayer: { type: String},
            imageryBaseLayer: {type: String},
            vectorBaseLayer: {type: String},
        };
    }

    constructor() {
        super();
        this.defaultBuildings = false;
        this.defaultTrees = false;
        this.swissTerrain = true;

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
                grid-template-columns: 1/3 1/3 1/3;
                grid-template-rows: auto auto auto;
                right: 1rem;
                top: 6rem;
                gap: 10px;
                margin: 4px;
                background-color: rgba(255,255,255,.68);
                backdrop-filter: blur(20px);
                border-radius: 10px;
                padding: 1rem;
                align-items: center;
            }
            .layer-picker input[type="radio"]{
                margin:0;padding:0;
                -webkit-appearance:none;
                   -moz-appearance:none;
                        appearance:none;
            }
            .hillshade {
                background-image: url(../static/img/hillshade.png);
                border-radius: 50%;
                justify-self: center;
            }
            .imagery {
                background-image: url(../static/img/imageAerienne.png);
                border-radius: 50%;
                justify-self: center;
            }
            .vector {
                background-image: url(../static/img/vector.png);
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
            .custom-select {
                grid-row-start: 3;
                grid-column-start: 1;
                grid-column-end: span 3;
                height: 30px;
            }
            .layers-displayed {
                grid-column-start: 1;
                grid-column-end: span 3;
            }
            .layers-displayed h3 {
              display: flex;
              justify-content: center;
              align-items: center;
              font-size: 1.2rem;
              font-weight: bold;
            }
            .item .layer-displayed {
              display: flex;
              align-items: center;
            }
            .draggable-list {
              padding: 8px;
            }
            
            .draggable-list .item{
              display: flex;
              cursor: move;
              align-items: center;
              background-color: rgba(120,120,120,.68);
              border-radius: 8px;
              align-items: center;
              padding: 4px;
              left: 0;
              margin-bottom: 4px;
            }
            .item i {
              color: #474747
            }
            .item.dragging {
              opacity: 0.5;
            }
            .item.dragging :where(.layer-displayed, i) {
          `,
          ];
    }

    render() {
        return html`
            <div class="layer-picker" id="layer-picker">
                ${this._renderCheckBox()}
                ${this._renderBaseLayerPicker()}
                ${this._renderDropDown()}
                ${this._renderLayerDisplayed()}
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
        // Change renvoit si la checkbox est cochée ou non
        // Checked renvoit si la checkbox est cochée ou non à l'initialisation
        return html`
            <label>
                <input type="checkbox" name="toggle-terrain" @change=${this._toggleTerrain} .checked=${this.swissTerrain}>
                Swiss Terrain
            </label>
            <label>
                <input type="checkbox" name="toggle-buildings" @change=${this._toggleBuildings} .checked=${this.defaultBuildings}>
                Swiss Buildings
            </label>
            <label>
                <input type="checkbox" name="toggle-trees" @change=${this._toggleTrees} .checked=${this.defaultTrees}>
                Swiss Trees
            </label>
        `;
    }

    _renderDropDown = () => {
        return html`
            <select id="feature-layer-menu" class="custom-select" name="feature-layer" @change=${this._selectFeatureLayer}>
            </select>
        `;
    }

    _renderLayerDisplayed = () => {
        return html`
            <div class="layers-displayed">
                <h3>Layer displayed :</h3>
                <ul class="draggable-list">
                    ${this._populateDraggableMenu()}
                </ul>
            </div>
        `;
    }
 
    firstUpdated() {
        // On itère sur tous les cesium viewer présents dans le document
        for (let i = 0; i < document.getElementsByTagName('cesium-viewer').length; i++) {
            // Si le cesium viewer a l'attribut swiss-buildings, on check la checkbox
            if (document.getElementsByTagName('cesium-viewer')[i].hasAttribute('swiss-buildings')) {
                this.defaultBuildings = true;
            }
            // On fait la même chose pour les arbres
            if (document.getElementsByTagName('cesium-viewer')[i].hasAttribute('swiss-trees')) {
                this.defaultTrees = true;
            }
        }
        this._populateFeatureLayerMenu();
    }

    _populateFeatureLayerMenu = () => {
        const featureLayerMenu = this.shadowRoot.getElementById('feature-layer-menu');
        featureLayerMenu.length = 0;
        let defaultOption = document.createElement('option');
        defaultOption.text = 'Choose a feature layer';
        featureLayerMenu.add(defaultOption);
        featureLayerMenu.selectedIndex = 0;
        const url = '../static/Data/swisstopo_map_service.json';
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.onload = () => {
            if (request.status === 200) {
                const data = JSON.parse(request.responseText);
                let option;
                for (let i = 0; i < data.length; i++) {
                    option = document.createElement('option');
                    option.text = data[i].Description;
                    option.value = data[i].layerName;
                    option.service = data[i].Service;
                    option.WMTS_format = data[i].WMTS_format;
                    option.timestamp = data[i].Timestamp;
                    option.code_fournisseur = data[i].Code_fournisseur;
                    option.Fournisseur = data[i].Fournisseur;
                    featureLayerMenu.add(option);
                }
            } else {
                // Reached the server, but it returned an error
            }
        }
        request.onerror = () => {
            console.error('An error occurred fetching the JSON from ' + url);
        };
        request.send();

        this._populateDraggableMenu(featureLayerMenu);

        
    }

    _populateDraggableMenu(featureLayersDraggable) {

      //const featureLayersDraggable = this.shadowRoot.getElementById('feature-layer-menu');
      if (featureLayersDraggable) {

      let selectedValuesDiv = this.shadowRoot.querySelector('.draggable-list');
        let selectedValues = [];
        featureLayersDraggable.addEventListener('change', function() {
            console.log(featureLayersDraggable);
            let selectedOption = featureLayersDraggable.options[featureLayersDraggable.selectedIndex];
            let selectedText = selectedOption.textContent;
            if (!selectedValues.includes(selectedText)) {
                selectedValues.push(selectedText);
            }
            selectedValuesDiv.innerHTML = '';
            selectedValues.forEach(function(value) {
                selectedValuesDiv.innerHTML += `
                <li class="item" draggable="true">
                  <div class="layer-displayed">
                    <span>${value}</span>
                  </div>
                  <i class="uil uil-draggabledots"></i>
                </li>`;
            });
            const items = selectedValuesDiv.querySelectorAll('.item');
            console.log(items)
            items.forEach(item => {
              item.addEventListener('dragstart', () => {
                setTimeout(() => item.classList.add("dragging"), 0);
              });
              item.addEventListener('dragend', () => item.classList.remove("dragging"));
            })
    
            const initSortableList = (e) => {
              e.preventDefault();
              const draggingItem = document.querySelector(".dragging");
              let siblings = [...selectedValuesDiv.querySelectorAll(".item:not(.dragging)")];
              let nextSibling = siblings.find(sibling => {
                return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
              });
              if (nextSibling) {
                selectedValuesDiv.insertBefore(draggingItem, nextSibling);
              }
          }
          selectedValuesDiv.addEventListener('dragover', initSortableList);
          selectedValuesDiv.addEventListener('dragenter', e => e.preventDefault());
            // selectedValuesDiv.innerHTML += `<div class="layer-displayed">${selectedOption}</div>`;
        });

        
      }
    }

        
    _selectFeatureLayer(e) {

        this.featureLayer = e.target.value;
        let service = e.target.options[e.target.selectedIndex].service;
        let WMTS_format = e.target.options[e.target.selectedIndex].WMTS_format;
        let timestamp = e.target.options[e.target.selectedIndex].timestamp;
        let codeFournisseur = e.target.options[e.target.selectedIndex].code_fournisseur;
        let fournisseur = e.target.options[e.target.selectedIndex].Fournisseur;
        console.log(service)
        
        this.dispatchEvent(new CustomEvent("feature-layer", {
            detail: {featureLayer: this.featureLayer,
                    service: service,
                    WMTS_format: WMTS_format,
                    timestamp: timestamp,
                    codeFournisseur: codeFournisseur,
                    },
            bubbles: true,
            composed: true,
        }));
        
    }

    _onChangeBaseLayer(e) {
        this.baseLayer = e.target.value;
        console.log(this.baseLayer)
        this.dispatchEvent(new CustomEvent("base-layer", {
            detail: this.baseLayer,
            bubbles: true,
            composed: true,
        }));
    }

    _toggleTerrain(e) {
        //console.log('essai', essai)
        this.swissTerrain = e.target.checked;
        //console.log(this.swissTerrain)
        this.dispatchEvent(new Event("toggle-terrain", {
            detail: this.swissTerrain
        }));
        // console.log(this.dispatchEvent(new CustomEvent("toggle-terrain", this.swissTerrain)))
    }
    // Fonction pour toggle on and off les bâtiments
    _toggleBuildings(event) {
        const swissBuildings = event.target.checked;
        const hasChanged = this.swissBuildings !== swissBuildings;
        if (hasChanged) {
            this.swissBuildings = swissBuildings;
            this.dispatchEvent(new CustomEvent("toggle-buildings", {
                detail: this.swissBuildings,
                bubbles: true,
                composed: true,
            }));
        }
    }
    // Fonction pour toggle on and off les arbres
    _toggleTrees(event) {
        const swissTrees = event.target.checked;
        const hasChanged = this.swissTrees !== swissTrees;
        if (hasChanged) {
            this.swissTrees = swissTrees;
            this.dispatchEvent(new CustomEvent("toggle-trees", {
                detail: this.swissTrees,
                bubbles: true,
                composed: true,
            }));
        }
    }

}
if (!window.customElements.get("layer-picker")) {
    window.customElements.define("layer-picker", LayerPicker);
}
