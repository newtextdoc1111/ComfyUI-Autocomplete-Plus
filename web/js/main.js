import { app } from "/scripts/app.js";
import { settingValues } from "./settings.js";
import { loadCSS } from "./utils.js";
import { loadAllData } from "./data.js";
import { AutocompleteEventHandler } from "./autocomplete.js";
import { SimilarTagsEventHandler } from "./similar-tags.js";

function initializeEventHandlers() {
    const autocompleteEventHandler = new AutocompleteEventHandler();
    const similarTagsEventHandler = new SimilarTagsEventHandler();

    // Find relevant textareas (e.g., prompt inputs)
    // This selector might need adjustment based on ComfyUI's structure
    const targetSelectors = [
        '.comfy-multiline-input',
        // Add other selectors if needed
    ];

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    targetSelectors.forEach(selector => {
                        // Check if the added node itself matches or contains matching elements
                        if (node.matches(selector)) {
                            attachListeners(node);
                        } else {
                            node.querySelectorAll(selector).forEach(attachListeners);
                        }
                    });
                }
            });
        });
    });

    // Function to attach listeners
    function attachListeners(element) {
        if (element.dataset.autocompleteAttached) return; // Prevent double attachment

        element.addEventListener('input', handleInput);
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
        element.addEventListener('keydown', handleKeyDown);

        // Add new event listeners for similar tags feature
        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('click', handleClick);

        element.dataset.autocompleteAttached = 'true';
    }

    // Initial scan for existing elements
    targetSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(attachListeners);
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    function handleInput(event) {
        autocompleteEventHandler.handleInput(event);
        similarTagsEventHandler.handleInput(event);
    }

    function handleFocus(event) {
        autocompleteEventHandler.handleFocus(event);
        similarTagsEventHandler.handleFocus(event);
    }

    function handleBlur(event) {
        autocompleteEventHandler.handleBlur(event);
        similarTagsEventHandler.handleBlur(event);
    }

    function handleKeyDown(event) {
        autocompleteEventHandler.handleKeyDown(event);
        similarTagsEventHandler.handleKeyDown(event);
    }

    // New event handler for mousemove to show similar tags on hover
    function handleMouseMove(event) {
        autocompleteEventHandler.handleMouseMove(event);
        similarTagsEventHandler.handleMouseMove(event);
    }

    // New event handler for click to show similar tags
    function handleClick(event) {
        autocompleteEventHandler.handleClick(event);
        similarTagsEventHandler.handleClick(event);
    }
}

const id = "AutocompletePlus";
const name = "Autocomplete Plus";
app.registerExtension({
    id: id,
    name: name,
    setup() {
        initializeEventHandlers();

        let rootPath = import.meta.url.replace("js/main.js", "");
        loadCSS(rootPath + "css/autocomplete-plus.css"); // Load CSS for autocomplete

        loadAllData(rootPath);
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
            id: id + ".similar_tags_position",
            name: "Similar Tags Display Position",
            description: "Position of similar tags display",
            type: "combo",
            options: ["horizontal", "vertical"],
            defaultValue: "horizontal",
            category: [name, "Similar Tags", "Display Position"],
            onChange: (newVal, oldVal) => {
                settingValues.similarTagsDisplayPosition = newVal;
            }
        }
    ]
});