import { app } from "/scripts/app.js";
import { initializeAutocomplete } from './autocomplete.js';
import { settingValues } from "./settings.js";

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

const id = "AutocompletePlus";
const name = "Autocomplete Plus";
app.registerExtension({
    id: id,
    name: name,
    setup() {
        let rootPath = import.meta.url.replace("js/main.js", "");
        loadCSS(rootPath + "css/autocomplete.css"); // Load CSS for autocomplete

        initializeAutocomplete(); // Initialize after tags are loaded
    },
    settings: [
        {
            id: id + ".boolean",
            name: "Enable Autocomplete",
            description: "Enable or disable the autocomplete feature.",
            type: "boolean",
            defaultValue: true,
            category: [name, "General", "Enable Autocomplete"],
            onChange: (newVal, oldVal) => {
                settingValues.enabled = newVal;
            }
        },
        {
            id: id + ".max_suggestions",
            name: "Max suggestions",
            type: "slider",
            attrs: {
                min: 5,
                max: 50,
                step: 5,
            },
            defaultValue: 10,
            category: [name, "Behaviour", "Max suggestions"],
            onChange: (newVal, oldVal) => {
                settingValues.maxSuggestions = newVal;
            }
        }
    ]
});