import { app } from "../../../scripts/app.js";
import { AutocompleteUI } from "./autocomplete.js";

(function() {
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

    // Construct the path to the CSS file
    // Assumes your custom node directory is 'ComfyUI-Autocomplete-Plus'
    const cssPath = `/extensions/ComfyUI-Autocomplete-Plus/css/autocomplete.css`;

    // Load the CSS file
    loadCSS(cssPath);

    // --- ここから下に既存の main.js のコードを追加 ---
    // 例:
    // import { app } from "/scripts/app.js";
    // app.registerExtension({...});

})(); // IIFE to avoid polluting the global scope

// Data storage
let tagMap = new Map();
let aliasMap = new Map();
let sortedTags = []; // Now populated directly from sorted API response
let cooccurrenceMap = new Map(); // Structure remains Map<string, Map<string, number>>

let tagsLoaded = false;
let cooccurrenceLoaded = false;

// --- Data Loading Functions ---

/**
 * Loads and processes tag data from the Python API endpoint.
 */
async function loadTags() {
    const url = '/autocomplete-plus/tags';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); // Data is already sorted by count

        sortedTags = data; // Assign directly as it's pre-sorted

        data.forEach(tagData => {
            tagMap.set(tagData.tag, tagData);
            if (tagData.alias && Array.isArray(tagData.alias)) {
                tagData.alias.forEach(alias => {
                    if (!aliasMap.has(alias)) {
                        aliasMap.set(alias, tagData.tag); // Map alias back to the main tag
                    }
                });
            }
        });

        tagsLoaded = true;
        console.log(`[Autocomplete-Plus] Processed ${sortedTags.length} tags from API.`);

    } catch (error) {
        console.error(`[Autocomplete-Plus] Failed to fetch or process tags from ${url}:`, error);
        tagsLoaded = false;
    }
}

/**
 * Loads and processes cooccurrence data from the Python API endpoint.
 */
async function loadCooccurrence() {
    const url = '/autocomplete-plus/cooccurrence';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); // Data is in { tag_a: { tag_b: count, ... }, ... } format

        let primaryTagCount = 0;
        let pairCount = 0;
        for (const tagA in data) {
            if (Object.hasOwnProperty.call(data, tagA)) {
                const innerMap = new Map();
                const pairs = data[tagA];
                for (const tagB in pairs) {
                    if (Object.hasOwnProperty.call(pairs, tagB)) {
                        innerMap.set(tagB, pairs[tagB]);
                        pairCount++;
                    }
                }
                if (innerMap.size > 0) {
                    cooccurrenceMap.set(tagA, innerMap);
                    primaryTagCount++;
                }
            }
        }

        cooccurrenceLoaded = true;
        console.log(`[Autocomplete-Plus] Processed ${pairCount} cooccurrence pairs for ${primaryTagCount} primary tags from API.`);

    } catch (error) {
        console.error(`[Autocomplete-Plus] Failed to fetch or process cooccurrence data from ${url}:`, error);
        cooccurrenceLoaded = false;
    }
}

// --- End Data Loading Functions ---

// --- Helper Functions ---

/**
 * Converts Hiragana to Katakana.
 * @param {string} str Input string.
 * @returns {string} Katakana string.
 */
function hiraToKata(str) {
    return str.replace(/[\u3041-\u3096]/g, function(match) {
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}

/**
 * Converts Katakana to Hiragana.
 * @param {string} str Input string.
 * @returns {string} Hiragana string.
 */
function kataToHira(str) {
    return str.replace(/[\u30a1-\u30f6]/g, function(match) {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

// --- End Helper Functions ---

// --- Autocomplete Logic ---

const MAX_CANDIDATES = 50; // Max number of suggestions to show
let autocompleteUI = null; // Singleton UI instance

/**
 * Finds tag completion candidates based on the input query.
 * Handles Hiragana/Katakana conversion for matching.
 * @param {string} query The partial tag input.
 * @returns {Array<{tag: string, count: number, alias?: string}>}
 */
function findCompletionCandidates(query) {
    const startTime = performance.now(); // 検索開始時間を記録

    if (!query || !tagsLoaded) {
        return [];
    }

    const lowerQuery = query.toLowerCase();
    const candidates = [];
    const addedTags = new Set(); // Keep track of added tags to avoid duplicates

    // Generate Hiragana/Katakana variations if applicable
    const queryVariations = new Set([lowerQuery]);
    const kataQuery = hiraToKata(lowerQuery);
    if (kataQuery !== lowerQuery) {
        queryVariations.add(kataQuery);
    }
    const hiraQuery = kataToHira(lowerQuery);
    if (hiraQuery !== lowerQuery) {
        queryVariations.add(hiraQuery);
    }

    // Search in sortedTags (already sorted by count)
    for (const tagData of sortedTags) {
        let matched = false;
        let matchedAlias = null;

        // Check primary tag against all variations
        for (const variation of queryVariations) {
            // Ensure tagData.tag is treated as lowercase for comparison
            if (tagData.tag.toLowerCase().includes(variation)) {
                matched = true;
                break;
            }
        }

        // If primary tag didn't match, check aliases against all variations
        if (!matched && tagData.alias && Array.isArray(tagData.alias) && tagData.alias.length > 0) {
            for (const alias of tagData.alias) {
                const lowerAlias = alias.toLowerCase();
                for (const variation of queryVariations) {
                    if (lowerAlias.includes(variation)) {
                        matched = true;
                        matchedAlias = alias; // Store the alias that matched
                        break;
                    }
                }
                if (matched) break; // Stop checking aliases for this tag if one matched
            }
        }

        // Add candidate if matched and not already added
        if (matched && !addedTags.has(tagData.tag)) {
            candidates.push({
                tag: tagData.tag,
                count: tagData.count,
                ...(matchedAlias && { alias: matchedAlias }) // Add alias property only if matched via alias
            });
            addedTags.add(tagData.tag);
            if (candidates.length >= MAX_CANDIDATES) {
                // 早期リターンする場合もログを出力
                const endTime = performance.now();
                const duration = endTime - startTime;
                console.log(`[Autocomplete-Plus] Search for "${query}" took ${duration.toFixed(2)}ms. Found ${candidates.length} candidates (max reached).`);
                return candidates; // Early exit
            }
        }
    }

    // 検索終了時間を記録し、コンソールに出力
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[Autocomplete-Plus] Search for "${query}" took ${duration.toFixed(2)}ms. Found ${candidates.length} candidates.`);

    return candidates;
}

/**
 * Extracts the current tag being typed before the cursor.
 * Assumes tags are separated by commas.
 * @param {HTMLTextAreaElement} inputElement
 * @returns {string} The partial tag or empty string.
 */
function getCurrentPartialTag(inputElement) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;
    // Find the last comma before the cursor
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    const start = lastComma === -1 ? 0 : lastComma + 1;
    // Extract the text between the last comma (or start) and the cursor
    const partial = text.substring(start, cursorPos).trimStart();
    return partial;
}

/**
 * Inserts the selected tag into the textarea, replacing the partial tag.
 * @param {HTMLTextAreaElement} inputElement
 * @param {string} tagToInsert
 */
function insertTag(inputElement, tagToInsert) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    const start = lastComma === -1 ? 0 : lastComma + 1;
    const actualTag = tagToInsert.replace("_", " ");

    // Find the end of the word/tag at the cursor (if any)
    // This basic version assumes we replace up to the next comma or end of string
    let end = text.indexOf(',', cursorPos);
    if (end === -1) {
        end = text.length;
    }
    // More precise: find word boundary if not comma
    const nextSpace = text.indexOf(' ', cursorPos);
    if (nextSpace !== -1 && nextSpace < end) {
        // This logic might need refinement depending on desired behavior
        // For now, replace up to the original cursor position if inserting mid-word
        end = cursorPos;
    }

    // Ensure space after comma if inserting after a comma
    const prefix = text.substring(0, start).trimEnd();
    const needsSpaceBefore = start > 0 && prefix[prefix.length - 1] === ',';

    const textBefore = text.substring(0, start) + (needsSpaceBefore ? ' ' : '');
    const textAfter = text.substring(cursorPos); // Use cursorPos to replace only typed part

    // Add comma and space if needed after insertion
    const suffix = ', '; // Standard separator

    inputElement.value = textBefore + actualTag + suffix + textAfter;

    // Set cursor position after the inserted tag and the following comma+space
    const newCursorPos = textBefore.length + actualTag.length + suffix.length;
    inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;

    // Trigger input event for ComfyUI to recognize change
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- Event Handlers ---

function handleInput(event) {
    if (!autocompleteUI) return;
    const textareaElement = event.target;
    const partialTag = getCurrentPartialTag(textareaElement);

    if (partialTag.length > 0) {
        const candidates = findCompletionCandidates(partialTag);
        autocompleteUI.show(textareaElement, candidates);
    } else {
        autocompleteUI.hide();
    }
}

function handleFocus(event) {
    // Potentially show suggestions immediately on focus?
    // For now, only show on input
    if (!autocompleteUI) {
        autocompleteUI = new AutocompleteUI();
    }
    // Maybe check if there's already text and show suggestions?
    // handleInput(event); // Trigger check immediately
}

function handleBlur(event) {
    // Need a slight delay because clicking the autocomplete list causes blur
    setTimeout(() => {
        if (autocompleteUI && !autocompleteUI.element.contains(document.activeElement)) {
            autocompleteUI.hide();
        }
    }, 150);
}

function handleKeyDown(event) {
    if (!autocompleteUI || !autocompleteUI.isVisible()) return;
    const textareaElement = event.target;

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            autocompleteUI.navigate(1);
            break;
        case 'ArrowUp':
            event.preventDefault();
            autocompleteUI.navigate(-1);
            break;
        case 'Enter':
        case 'Tab':
            if (autocompleteUI.getSelectedTag() !== null) {
                event.preventDefault();
                
                insertTag(textareaElement, autocompleteUI.getSelectedTag());
            } else {
                // Allow default Tab/Enter if no item is selected
                autocompleteUI.hide();
            }
            break;
        case 'Escape':
            event.preventDefault();
            autocompleteUI.hide();
            break;
    }
}

// --- Initialization ---

function initializeAutocomplete() {
    if (!tagsLoaded) {
        console.warn("[Autocomplete-Plus] Tags not loaded, cannot initialize autocomplete.");
        return;
    }
    console.log("[Autocomplete-Plus] Initializing autocomplete features...");
    autocompleteUI = new AutocompleteUI();

    // Find relevant textareas (e.g., prompt inputs)
    // This selector might need adjustment based on ComfyUI's structure
    const targetSelectors = [
		'.comfy-multiline-input',
        // Add other selectors if needed
    ];

    // Use MutationObserver to detect dynamically added textareas
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
        console.log("[Autocomplete-Plus] Attaching listeners to:", element);
        element.addEventListener('input', handleInput);
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
        element.addEventListener('keydown', handleKeyDown);
        element.dataset.autocompleteAttached = 'true';
    }

    // Initial scan for existing elements
    targetSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(attachListeners);
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    console.log("[Autocomplete-Plus] Autocomplete initialized and observer started.");
}

app.registerExtension({
    name: "comfyui-autocomplete-plus",
    async setup() {
        console.log("[Autocomplete-Plus] Starting setup...");

        // Load data asynchronously from API endpoints
        Promise.all([loadTags(), loadCooccurrence()])
            .then(() => {
                if (tagsLoaded) { // Only need tags for autocomplete
                    console.log("[Autocomplete-Plus] Tag data loaded successfully via API.");
                    initializeAutocomplete(); // Initialize after tags are loaded
                } else {
                    console.error("[Autocomplete-Plus] Failed to load tag data via API. Autocomplete disabled.");
                }
                if (!cooccurrenceLoaded) {
                    console.warn("[Autocomplete-Plus] Failed to load cooccurrence data via API. Similar tags disabled.");
                }
            })
            .catch(error => {
                console.error("[Autocomplete-Plus] Error during API data loading:", error);
            });

        console.log("[Autocomplete-Plus] Setup complete (API data loading initiated)!");
    },
});