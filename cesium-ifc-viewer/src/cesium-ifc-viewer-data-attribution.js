import { LitElement, html, css } from "lit";
import { until } from "lit/directives/until.js";

/**
 * `‹cesium-ifc-viewer-data-attribution›` custom element, based on
 * `LitElement`. Displays a button to open a dialog, which displays
 * the credits of the data used in a related `‹cesium-ifc-viewer›`
 * custom element.
 *
 * @fires (nothing)
 *
 * @slot dialog-open - Text of the button to open the credits dialog.
 * @slot dialog-title - Text of the credits dialog title.
 *
 * @csspart dialog-open - The button element, opening the credits dialog.
 * @csspart dialog-close - The button element, closing the credits dialog.
 * @csspart dialog - The dialog container element, displaying the credits.
 */
export class CesiumIfcViewerDataAttribution extends LitElement {
  // Private properties
  _viewerEl = null; // ref to the foreign `‹cesium-ifc-viewer›` custom element
  _dialogEl = null; // ref to our `‹dialog›` element displaying the credits

  // Public reactive properties, reflected from attribute values
  static properties = {
    /**
     * Reference to the single id of the `‹cesium-ifc-viewer›` custom element
     * to which this custom element is associated, and which must be defined
     * in the same document as this custom element.
     *
     * Used to retrieve the `Cesium.Viewer` instance from the foreign
     * custom element and get the credits from it.
     *
     * @type {string}
     */
    for: { type: String },

    /**
     * Internal state reactive property, which contains a weak reference
     * to the foreign UL element, containing the credits computed by the
     * Cesium Viewer Widget instance — or `undefined`, as long as the Cesium
     * Viewer has not been instantiated. Use `this._creditsEl.deref()` to
     * get the actual value.
     */
    _creditsEl: { state: true },
  };

  static get styles() {
    return css`
      *,
      ::after,
      ::before {
        box-sizing: border-box;
      }
      :host {
        display: block;
      }
      div[part="dialog-open"],
      dialog button {
        cursor: pointer;
      }
      dialog {
        color: white;
        background-color: #444;
      }
      dialog::backdrop {
        background-color: rgba(240, 240, 240, 0.6);
      }
      dialog h1 {
        margin-block-start: 0;
      }
    `;
  }

  constructor() {
    super();
    this.for = null;
    this._creditsEl = undefined;
  }

  render() {
    return html`
      <div part="dialog-open" @click="${this._onClick}">
        <slot name="dialog-open">Data attribution</slot>
      </div>
      <dialog part="dialog">
        <h1><slot name="dialog-title">Data provided by</slot></h1>
        ${until(this._creditsEl, html`<p>Loading...</p>`)}
        <form method="dialog"><button part="dialog-close">Close</button></form>
      </dialog>
    `;
  }

  async firstUpdated() {
    this._dialogEl = this.renderRoot.querySelector(`dialog`);
    this._viewerEl = document.querySelector(`cesium-ifc-viewer#${this.for}`);
    this._viewerEl.addEventListener("ready", () => {
      // Grab the credits directly from the internals of the Cesium
      // `Viewer` widget (more precisely, from the internals of its
      // `CreditDisplay` object, which manages the credits), as Cesium
      // provides no API for this
      this._creditsEl = this._viewerEl.viewerCreditList;
    });
  }

  _onClick(e) {
    e.preventDefault();
    this._dialogEl.showModal();
  }
}

if (!window.customElements.get("cesium-ifc-viewer-data-attribution")) {
  window.customElements.define(
    "cesium-ifc-viewer-data-attribution",
    CesiumIfcViewerDataAttribution,
  );
}
