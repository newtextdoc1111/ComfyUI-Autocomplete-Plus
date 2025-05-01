import { app } from "../../../scripts/app.js";
import { initializeAutocomplete } from "./autocomplete.js";

// Function to load a CSS file
function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
    // Ensure the CSS is loaded before other scripts might rely on its styles
    // by adding it to the head.
    document.head.appendChild(link);
    console.log(`Loaded CSS: ${href}`); // Optional: Log loading
}

app.registerExtension({
    name: "comfyui-autocomplete-plus",
    setup() {
        let rootPath = import.meta.url.replace("js/main.js", "");
        loadCSS(rootPath + "css/autocomplete.css"); // Load CSS for autocomplete

        initializeAutocomplete(); // Initialize after tags are loaded
    },
});