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
 * Normalizes a tag string for input.
 * @param {string} str 
 * @returns 
 */
export function normalizeTagToSearch(str) {
    if(!str) return str;
    return unescapeParentheses(str.replace(/ /g, "_"));
}

/**
 * Normalizes a tag string for input.
 * @param {string} str 
 * @returns 
 */
export function normalizeTagToInsert(str) {
    return escapeParentheses(str.replace(/_/g, " "));
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
export function getViewportMargin(){
    const topBarRect = document.querySelector("#comfyui-body-top")?.getBoundingClientRect() || {top: 0, bottom: 0};
    const bottomBarRect = document.querySelector("#comfyui-body-bottom")?.getBoundingClientRect() || {top: 0, bottom: 0};
    const leftBarRect = document.querySelector("#comfyui-body-left")?.getBoundingClientRect() || {left: 0, right: 0};
    const rightBarRect = document.querySelector("#comfyui-body-right")?.getBoundingClientRect() || {left: 0, right: 0};

    return {
        top: topBarRect.height,
        bottom: bottomBarRect.height,
        left: leftBarRect.width,
        right: rightBarRect.width,
    };
}
