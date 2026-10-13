import { createRoot } from "./lib/reactdom.js";
import { html } from "./lib/htm.js";
import App from "./app.js";

const root = createRoot(document.getElementById("root"));
root.render(html`<${App} />`);
