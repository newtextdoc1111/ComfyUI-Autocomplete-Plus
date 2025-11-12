import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";
import { ComfyWidgets } from "/scripts/widgets.js";
import { settingValues } from "./settings.js";
import { loadCSS } from "./utils.js";
import { TagSource, loadDataAsync } from "./data.js";
import { AutocompleteEventHandler } from "./autocomplete.js";
import { RelatedTagsEventHandler } from "./related-tags.js";

// --- Constants ---
const id = "AutocompletePlus";
const name = "Autocomplete Plus";

// --- Functions ---
/**
 * Initialize event handlers for the autocomplete and related tags features.
 */
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

/**
 * Add Miscellaneous settings to the settings screen
 */
async function addExtraSettings() {
    // Function to perform the update check
    async function performUpdateCheck(checkButton, lastCheckSpan) {
        checkButton.textContent = "Checking...";
        checkButton.disabled = true;

        app.extensionManager.toast.add({
            severity: "info",
            summary: "Check new CSV",
            detail: "Checking the CSV updates, see console for more details.",
            life: 5000
        });

        try {
            const response = await fetch('/autocomplete-plus/csv/force-check-updates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            if (result.success) {
                // Update last check time display using the response data
                if (result.last_check_time) {
                    const newLastCheckDate = new Date(result.last_check_time);
                    lastCheckSpan.textContent = "Last checked: " + newLastCheckDate.toLocaleString();
                } else {
                    lastCheckSpan.textContent = "Last checked: Never";
                }
            }
        } catch (error) {
            console.error("[Autocomplete-Plus] Error during force check:", error);
        } finally {
            checkButton.textContent = "Check now";
            checkButton.disabled = false;
        }
    }

    // Fetch last check time from API
    let lastCheckTimeText = "Loading...";
    try {
        const response = await fetch('/autocomplete-plus/csv/last-check-time');
        const data = await response.json();

        if (data.last_check_time) {
            const lastCheckDate = new Date(data.last_check_time);
            lastCheckTimeText = "Last checked: " + lastCheckDate.toLocaleString();
        } else {
            lastCheckTimeText = "Last checked: Never";
        }
    } catch (error) {
        console.error("[Autocomplete-Plus] Error fetching last check time:", error);
        lastCheckTimeText = "Last checked: Error loading";
    }

    // Add extra setting for checking new CSV updates
    // Note: Temporarily comment out until changes to remote files can be detected
    // app.ui.settings.addSetting({
    //     id: id + ".check_new_csv",
    //     defaultValue: null,
    //     name: "Check CSV updates",
    //     category: [name, "Misc", "Check new CSV"],
    //     type: () => {
    //         const lastCheckSpan = $el("span", {
    //             textContent: lastCheckTimeText,
    //             className: "text-sm text-gray-500",
    //             style: {
    //                 marginRight: "16px"
    //             }
    //         });

    //         const checkButton = $el("button", {
    //             textContent: "Check now",
    //             className: "p-button p-component p-button-primary",
    //             onclick: async () => {
    //                 await performUpdateCheck(checkButton, lastCheckSpan);
    //             }
    //         });

    //         return $el("div", {
    //             className: "flex-row items-center gap-2",
    //         }, [
    //             $el("div", {
    //                 className: "p-component",
    //             }, [
    //                 lastCheckSpan,
    //                 checkButton,
    //             ]),
    //         ]);
    //     }
    // });
}

/**
 * Registration of the extension
 */
app.registerExtension({
    id: id,
    name: name,
    async setup() {
        initializeEventHandlers();

        addExtraSettings();

        let rootPath = import.meta.url.replace("js/main.js", "");
        loadCSS(rootPath + "css/autocomplete-plus.css"); // Load CSS for autocomplete

        await loadDataAsync();
    },

    // One the Settings Screen, displays reverse order in same category
    settings: [
        // --- Tag source Settings ---
        {
            id: id + ".TagSource.IconPosition",
            name: "Tag Source Icon Position",
            type: "combo",
            options: ["left", "right", "hidden"],
            defaultValue: "left",
            category: [name, "Tag Source", "Tag Source Icon Position"],
            onChange: (newVal, oldVal) => {
                settingValues.tagSourceIconPosition = newVal;
            }
        },
        {
            id: id + ".TagSource.PrimaryTagSource",
            name: "Primary source for 'all' Source",
            tooltip: "When 'Autocomplete Tag Source' is 'all', this determines which source's tags appear first in suggestions.",
            type: "combo",
            options: Object.values(TagSource),
            defaultValue: TagSource.Danbooru,
            category: [name, "Tag Source", "Prioritize Tag Source"],
            onChange: (newVal, oldVal) => {
                settingValues.primaryTagSource = newVal;
            }
        },
        {
            id: id + ".TagSource",
            name: "Autocomplete Tag Source",
            tooltip: "Select the tag source for autocomplete suggestions. 'all' includes tags from all loaded sources.",
            type: "combo",
            options: [...Object.values(TagSource), "all"],
            defaultValue: "all",
            category: [name, "Tag Source", "Tag Source"],
            onChange: (newVal, oldVal) => {
                settingValues.tagSource = newVal;
            }
        },

        // --- Autocomplete Settings ---
        {
            id: id + ".Autocompletion.UseFastSearch",
            name: "Use Fast Search",
            tooltip: "Tag search processing during text input operates faster, improving responsiveness.",
            type: "boolean",
            defaultValue: false,
            category: [name, "Autocompletion", "Use Fast Search"],
            onChange: (newVal, oldVal) => {
                settingValues.useFastSearch = newVal;
            }
        },
        {
            id: id + ".Autocompletion.EnableModels",
            name: "Enable Loras and Embeddings",
            type: "boolean",
            defaultValue: true,
            category: [name, "Autocompletion", "Enable Loras and Embeddings"],
            onChange: (newVal, oldVal) => {
                settingValues.enableModels = newVal;
            }
        },
        {
            id: id + ".Autocompletion.ReplaceUnderscoreWithSpace",
            name: "Replace '_' with 'Space'",
            tooltip: "This setting also affects related tags display.",
            type: "boolean",
            defaultValue: true,
            category: [name, "Autocompletion", "Replace Underscore with Space"],
            onChange: (newVal, oldVal) => {
                settingValues.replaceUnderscoreWithSpace = newVal;
            }
        },
        {
            id: id + ".Autocompletion.AutoInsertComma",
            name: "Auto Insert Comma",
            tooltip: "Automatically insert a comma after tags when inserting from autocomplete.",
            type: "boolean",
            defaultValue: true,
            category: [name, "Autocompletion", "Auto Insert Comma"],
            onChange: (newVal, oldVal) => {
                settingValues.autoInsertComma = newVal;
            }
        },
        {
            id: id + ".Autocompletion.MaxSuggestions",
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
            id: id + ".Autocompletion.Enable",
            name: "Enable Autocomplete",
            type: "boolean",
            defaultValue: true,
            category: [name, "Autocompletion", "Enable Autocomplete"],
            onChange: (newVal, oldVal) => {
                settingValues.enabled = newVal;
            }
        },

        // --- Related Tags Settings ---
        {
            id: id + ".RelatedTags.RelatedTagsTriggerMode",
            name: "Related Tags Trigger Mode",
            tooltip: "Which action will trigger displaying related tags for the entered tag (click only, Ctrl+click).",
            type: "combo",
            options: ["click", "ctrl+Click"],
            defaultValue: "click",
            category: [name, "Related Tags", "Trigger Mode"],
            onChange: (newVal, oldVal) => {
                settingValues.relatedTagsTriggerMode = newVal;
            }
        },
        {
            id: id + ".RelatedTags.DisplayPosition",
            name: "Default Display Position",
            tooltip: "Display position (relative to Textarea).",
            type: "combo",
            options: ["horizontal", "vertical"],
            defaultValue: "horizontal",
            category: [name, "Related Tags", "Display Position"],
            onChange: (newVal, oldVal) => {
                settingValues.relatedTagsDisplayPosition = newVal;
            }
        },
        {
            id: id + ".RelatedTags.MaxRelatedTags",
            name: "Max related tags",
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
            id: id + ".RelatedTags.Enable",
            name: "Enable Related Tags",
            type: "boolean",
            defaultValue: true,
            category: [name, "Related Tags", "Enable Related Tags"],
            onChange: (newVal, oldVal) => {
                settingValues.enableRelatedTags = newVal;
            }
        },

        // --- Display settings ---
        {
            id: id + ".Display.HideAlias",
            name: "Hide Alias",
            tooltip: "Hide alias column in the autocomplete and related tags display.",
            type: "boolean",
            defaultValue: false,
            category: [name, "Display", "Hide Alias"],
            onChange: (newVal, oldVal) => {
                settingValues.hideAlias = newVal;
            }
        },
    ]
});