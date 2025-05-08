// --- String Helper Functions ---

/**
 * Converts Hiragana to Katakana.
 * @param {string} str Input string.
 * @returns {string} Katakana string.
 */
export function hiraToKata(str) {
    return str.replace(/[\u3041-\u3096]/g, function (match) {
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}

/**
 * Converts Katakana to Hiragana.
 * @param {string} str Input string.
 * @returns {string} Hiragana string.
 */
export function kataToHira(str) {
    return str.replace(/[\u30a1-\u30f6]/g, function (match) {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

/**
 * Formats a number into a human-readable string with metric prefixes (k, M, G).
 * @param {number} num The number to format.
 * @returns {string} The formatted string.
 */
export function formatCountHumanReadable(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0'; // Or handle as an error/empty string
    }
    if (num < 1000) {
        return num.toString();
    }
    const si = [
        { value: 1, symbol: "" },
        { value: 1E3, symbol: "k" },
        { value: 1E6, symbol: "M" },
        { value: 1E9, symbol: "G" },
        // Add more prefixes if needed (T, P, E)
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    let i;
    for (i = si.length - 1; i > 0; i--) {
        if (num >= si[i].value) {
            break;
        }
    }
    // Format with one decimal place if needed, remove trailing zeros and '.'.
    return (num / si[i].value).toFixed(1).replace(rx, "$1") + si[i].symbol;
}

/**
 * Escapes parentheses in a string for use in prompts.
 * Replaces '(' with '\(' and ')' with '\)'.
 * Ignores already escaped parentheses like '\('.
 * @param {string} str The input string.
 * @returns {string} The string with parentheses escaped.
 */
export function escapeParentheses(str) {
    if (!str) return str;
    // Use lookbehind assertions to avoid double escaping
    return str.replace(/(?<!\\)\(/g, '\\(').replace(/(?<!\\)\)/g, '\\)');
}

/**
 * Unescapes parentheses in a string.
 * Replaces '\(' with '(' and '\)' with ')'.
 * @param {string} str The input string.
 * @returns {string} The string with parentheses unescaped.
 */
export function unescapeParentheses(str) {
    if (!str) return str;
    return str.replace(/\\\(/g, '(').replace(/\\\)/g, ')');
}

/**
 * Removes prompt weights from a tag (e.g., "tag:1.2" becomes "tag").
 * @param {string} str The input tag string.
 * @returns {string} The tag without weight and without surrounding non-escaped brackets.
 */
export function removePromptWeight(str) {
    if (!str) return str;

    // First remove weight notation (e.g., ":1.2")
    let result = str.replace(/(.+?):\d+(\.\d+)?/, '$1');

    // Then remove non-escaped brackets at the beginning and/or end
    // Use negative lookbehind (?<!\\) to avoid matching escaped brackets
    result = result.replace(/^(?<!\\)\((.+)$/, '$1');
    result = result.replace(/^(.+)(?<!\\)\)$/, '$1');
    return result;
}

/**
 * Normalizes a tag string for input.
 * @param {string} str 
 * @returns 
 */
export function normalizeTagToSearch(str) {
    if (!str) return str;
    return unescapeParentheses(removePromptWeight(str).replace(/ /g, "_"));
}

/**
 * Normalizes a tag string for input.
 * @param {string} str 
 * @returns 
 */
export function normalizeTagToInsert(str) {
    return escapeParentheses(str.replace(/_/g, " "));
}

/**
 * Checks if a tag is valid.
 * @param {string} tag 
 * @returns 
 */
export function isValidTag(tag) {
    if (!tag || tag.length < 2) {
        return false;
    }

    // Skip wildcard notation (e.g., "__character__")
    if (tag.startsWith('__') && tag.endsWith('__')) {
        return false;
    }

    // Skip Lora notation (e.g., "<lora:lorapath/loraname:0.8>")
    if (/<lora:.+>/i.test(tag)) {
        return false;
    }

    return true;
}
/**
 * Extracts the tag at the current cursor position.
 * Handles tags separated by commas or newlines.
 * @param {HTMLTextAreaElement} inputElement The textarea element
 * @returns {string|null} The tag at cursor or null
 */
export function getCurrentTag(inputElement) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Find the start position of the current tag
    // Look for the last comma or newline before the cursor
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    const lastNewline = text.lastIndexOf('\n', cursorPos - 1);
    let startPos = Math.max(lastComma, lastNewline);
    startPos = startPos === -1 ? 0 : startPos + 1; // If no separator found, start from the beginning

    // Find the end position of the current tag
    // Look for the next comma or newline after the start position (or cursor position if more appropriate)
    // We search from startPos to correctly handle cases where the cursor is at the beginning of a tag
    let searchEndFrom = Math.max(cursorPos, startPos);
    let endPosComma = text.indexOf(',', searchEndFrom);
    let endPosNewline = text.indexOf('\n', searchEndFrom);

    // If a separator is not found, treat it as the end of the text
    if (endPosComma === -1) endPosComma = text.length;
    if (endPosNewline === -1) endPosNewline = text.length;

    // Choose the closer separator as the end position
    let endPos = Math.min(endPosComma, endPosNewline);

    // Extract and trim the tag
    const tag = text.substring(startPos, endPos).trim();

    // If no tag found, return null
    if (!tag) return null;

    // Process the tag: swap underscores/spaces and unescape parentheses
    return tag;
}

// --- End String Helper Functions ---

// Function to load a CSS file
export function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
    // Ensure the CSS is loaded before other scripts might rely on its styles
    // by adding it to the head.
    document.head.appendChild(link);
    console.debug(`Loaded CSS: ${href}`); // Optional: Log loading
}

/**
 * Get the viewport margin based on the positions of the top, bottom, left, and right bars.
 * @returns {Object} - An object containing the top, bottom, left, and right margins of the viewport.
 */
export function getViewportMargin() {
    const topBarRect = document.querySelector("#comfyui-body-top")?.getBoundingClientRect() || { top: 0, bottom: 0 };
    const bottomBarRect = document.querySelector("#comfyui-body-bottom")?.getBoundingClientRect() || { top: 0, bottom: 0 };
    const leftBarRect = document.querySelector("#comfyui-body-left")?.getBoundingClientRect() || { left: 0, right: 0 };
    const rightBarRect = document.querySelector("#comfyui-body-right")?.getBoundingClientRect() || { left: 0, right: 0 };

    return {
        top: topBarRect.height,
        bottom: bottomBarRect.height,
        left: leftBarRect.width,
        right: rightBarRect.width,
    };
}
