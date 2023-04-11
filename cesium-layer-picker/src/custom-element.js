import { LitElement, html, css } from "lit";

/**
 * A `‹custom-element›` Custom Element, based on `LitElement`.
 *
 * @fires (nothing)
 * @slot (default) - This element has a default slot.
 * @csspart (none) - This element has no CSS Parts.
 */
export class CustomElementElement extends LitElement {
  static properties = {
    /**
     * Greeting message.
     *
     * @type {string}
     */
    greetingMessage: { type: String, attribute: "greeting" },
  };

  static get styles() {
    return css`
      *,
      ::after,
      ::before {
        box-sizing: border-box;
      }
      :host {
        height: 100%;
        display: block;
      }
      h1,
      p {
        margin-block-start: 0;
        margin-block-end: 0.5rem;
      }
    `;
  }

  constructor() {
    super();

    // Public observed properties, reflected from attribute values
    this.greetingMessage = "World";
  }

  render() {
    return html` <h1>Hello, ${this.greetingMessage}</h1>
      <slot></slot>`;
  }
}

if (!window.customElements.get("custom-element")) {
  window.customElements.define("custom-element", CustomElementElement);
}
