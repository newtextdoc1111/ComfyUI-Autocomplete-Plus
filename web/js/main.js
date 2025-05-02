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
        loadCSS(rootPath + "css/autocomplete-plus.css"); // Load CSS for autocomplete

        initializeAutocomplete(rootPath); // Initialize after tags are loaded
    },
    settings: [
        {
            id: id + ".boolean",
            name: "Enable Autocomplete",
            description: "Enable or disable the autocomplete feature.",
            type: "boolean",
            defaultValue: true,
            category: [name, "Autocompletion", "Enable Autocomplete"],
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
            category: [name, "Autocompletion", "Max suggestions"],
            onChange: (newVal, oldVal) => {
                settingValues.maxSuggestions = newVal;
            }
        },
        // Similar Tags Settings
        {
            id: id + ".similar_tags_enable",
            name: "Enable Similar Tags",
            description: "Enable or disable the similar tags feature.",
            type: "boolean",
            defaultValue: true,
            category: [name, "Similar Tags", "Enable Similar Tags"],
            onChange: (newVal, oldVal) => {
                settingValues.enableSimilarTags = newVal;
            }
        },
        {
            id: id + ".max_similar_tags",
            name: "Max similar tags",
            description: "Maximum number of similar tags to display",
            type: "slider",
            attrs: {
                min: 5,
                max: 50,
                step: 5,
            },
            defaultValue: 20,
            category: [name, "Similar Tags", "Max similar tags"],
            onChange: (newVal, oldVal) => {
                settingValues.maxSimilarTags = newVal;
            }
        },
        {
            id: id + ".similar_tags_mode",
            name: "Similar Tags Display Mode",
            description: "When to show similar tags",
            type: "combo",
            options: ["hover", "click"],
            defaultValue: "hover",
            category: [name, "Similar Tags", "Display Mode"],
            onChange: (newVal, oldVal) => {
                settingValues.similarTagsDisplayMode = newVal;
            }
        }
    ]
});