import { app } from "/scripts/app.js";
import { ComfyWidgets } from "/scripts/widgets.js";
import { settingValues } from "./settings.js";
import { loadCSS } from "./utils.js";
import { TagSource, fetchCsvList, getTagSourceInPriorityOrder, initializeData } from "./data.js";
import { AutocompleteEventHandler } from "./autocomplete.js";
import { RelatedTagsEventHandler } from "./related-tags.js";

function initializeEventHandlers() {
    const autocompleteEventHandler = new AutocompleteEventHandler();
    const relatedTagsEventHandler = new RelatedTagsEventHandler();
    const attachedElements = new WeakSet(); // Keep track of elements that have listeners attached

    // Function to attach listeners
    function attachListeners(element) {
        if (attachedElements.has(element)) return; // Prevent double attachment

        element.addEventListener('input', handleInput);
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
        element.addEventListener('keydown', handleKeyDown);
        element.addEventListener('keyup', handleKeyUp);
        // element.addEventListener('keypress', handleKeyPress); // keypress is deprecated

        // Add new event listeners for related tags feature
        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('click', handleClick);

        attachedElements.add(element); // Mark as attached
    }

    // Attempt Widget Override as the primary method
    // The original ComfyWidgets.STRING arguments are (node, inputName, inputData, app)
    // inputData is often an array like [type, config]
    if (ComfyWidgets && ComfyWidgets.STRING) {
        const originalStringWidget = ComfyWidgets.STRING;
        ComfyWidgets.STRING = function (node, inputName, inputData, appInstance) { // Use appInstance to avoid conflict with global app
            const result = originalStringWidget.apply(this, arguments);

            // Check if the widget has an inputEl and if it's a TEXTAREA
            // This is to ensure we are targeting multiline text inputs, related to '.comfy-multiline-input'
            if (result && result.widget && result.widget.inputEl && result.widget.inputEl.tagName === 'TEXTAREA') {
                const widgetConfig = inputData && inputData[1] ? inputData[1] : {};
                // Future: Add checks for Autocomplete Plus specific configurations if needed
                // e.g., if (widgetConfig["AutocompletePlus.enabled"] === false) return result;

                attachListeners(result.widget.inputEl);
            }
            return result;
        };
    }

    if (settingValues._useFallbackAttachmentForEventListener) {
        // Fallback and for dynamically added elements not caught by widget override: MutationObserver
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

        // Initial scan for existing elements
        targetSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(attachListeners);
        });

        // Start observing the document body for changes
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function handleInput(event) {
        autocompleteEventHandler.handleInput(event);
        relatedTagsEventHandler.handleInput(event);
    }

    function handleFocus(event) {
        autocompleteEventHandler.handleFocus(event);
        relatedTagsEventHandler.handleFocus(event);
    }

    function handleBlur(event) {
        autocompleteEventHandler.handleBlur(event);
        relatedTagsEventHandler.handleBlur(event);
    }

    function handleKeyDown(event) {
        autocompleteEventHandler.handleKeyDown(event);
        relatedTagsEventHandler.handleKeyDown(event);
    }

    function handleKeyUp(event) {
        autocompleteEventHandler.handleKeyUp(event);
        relatedTagsEventHandler.handleKeyUp(event);
    }

    // New event handler for mousemove to show related tags on hover
    function handleMouseMove(event) {
        autocompleteEventHandler.handleMouseMove(event);
        relatedTagsEventHandler.handleMouseMove(event);
    }

    // New event handler for click to show related tags
    function handleClick(event) {
        autocompleteEventHandler.handleClick(event);
        relatedTagsEventHandler.handleClick(event);
    }
}

const id = "AutocompletePlus";
const name = "Autocomplete Plus";
app.registerExtension({
    id: id,
    name: name,
    async setup() {
        initializeEventHandlers();

        let rootPath = import.meta.url.replace("js/main.js", "");
        loadCSS(rootPath + "css/autocomplete-plus.css"); // Load CSS for autocomplete

        fetchCsvList().then((csvList) => {
            getTagSourceInPriorityOrder().forEach((source) => {
                initializeData(csvList, source);
            });
        });
    },

    // One the Settings Screen, displays reverse order in same category
    settings: [
        // --- General Settings ---
        {
            id: id + ".priority_tag_source",
            name: "Priotized Tag Source",
            tooltip: "If all tag source are enabled, which tag source's tags should be displayed first.",
            type: "combo",
            options: Object.values(TagSource),
            defaultValue: TagSource.Danbooru,
            category: [name, "General", "Priority Tag Source"],
            onChange: (newVal, oldVal) => {
                settingValues.priorityTagSource = newVal;
            }
        },
                {
            id: id + ".display_tag_source",
            name: "Display Tag Source",
            tooltip: "If multiple tag source are avirable, which tag source's tags should be displayed.",
            type: "combo",
            options: [...Object.values(TagSource), "all"],
            defaultValue: "all",
            category: [name, "General", "Display Tag Source"],
            onChange: (newVal, oldVal) => {
                settingValues.displayTagSource = newVal;
            }
        },
        // --- Autocomplete Settings ---
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

        // --- Related Tags Settings ---
        {
            id: id + ".related_tags_trigger_mode",
            name: "Related Tags Trigger Mode",
            description: "Trigger mode for related tags (click or ctrl+click)",
            type: "combo",
            options: ["click", "ctrl+Click"],
            defaultValue: "click",
            category: [name, "Related Tags", "Trigger Mode"],
            onChange: (newVal, oldVal) => {
                settingValues.relatedTagsTriggerMode = newVal;
            }
        },
        {
            id: id + ".related_tags_position",
            name: "Default Display Position",
            description: "Display position (relative to Textarea)",
            type: "combo",
            options: ["horizontal", "vertical"],
            defaultValue: "horizontal",
            category: [name, "Related Tags", "Display Position"],
            onChange: (newVal, oldVal) => {
                settingValues.relatedTagsDisplayPosition = newVal;
            }
        },
        {
            id: id + ".max_related_tags",
            name: "Max related tags",
            description: "Maximum number of related tags to display",
            type: "slider",
            attrs: {
                min: 5,
                max: 100,
                step: 5,
            },
            defaultValue: 20,
            category: [name, "Related Tags", "Max related tags"],
            onChange: (newVal, oldVal) => {
                settingValues.maxRelatedTags = newVal;
            }
        },
        {
            id: id + ".related_tags_enable",
            name: "Enable Related Tags",
            description: "Enable or disable the related tags feature.",
            type: "boolean",
            defaultValue: true,
            category: [name, "Related Tags", "Enable Related Tags"],
            onChange: (newVal, oldVal) => {
                settingValues.enableRelatedTags = newVal;
            }
        }
    ]
});