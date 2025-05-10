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
 * Checks if a tag is valid (not wildcard or Lora notation).
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
 * Finds all tag positions in the given text.
 * Searches for tags separated by commas or newlines.
 * @param {string} text The text to search in
 * @returns {Array<{start: number, end: number, tag: string}>} Array of tag positions and content
 */
export function findAllTagPositions(text) {
    const positions = [];
    let startPos = 0;

    while (startPos < text.length) {
        // Skip any leading whitespace, commas, or newlines
        while (startPos < text.length &&
            (text[startPos] === ' ' || text[startPos] === ',' || text[startPos] === '\n')) {
            startPos++;
        }

        if (startPos >= text.length) break;

        // Find the end of this tag (next comma or newline)
        let endPosComma = text.indexOf(',', startPos);
        let endPosNewline = text.indexOf('\n', startPos);

        if (endPosComma === -1) endPosComma = text.length;
        if (endPosNewline === -1) endPosNewline = text.length;

        const endPos = Math.min(endPosComma, endPosNewline);
        const tag = text.substring(startPos, endPos);

        if (tag.trim().length > 0) {
            positions.push({
                start: startPos,
                end: endPos,
                tag: tag
            });
        }

        // Move to the next tag
        startPos = endPos + 1;
    }

    return positions;
}
/**
 * Extracts existing tags from the textarea with search normalization (possibly duplicated).
 * @param {HTMLTextAreaElement} textarea The textarea element to extract tags from
 * @returns {string[]} Array of existing tags
 */
export function extractTagsFromTextArea(textarea) {
    const existingTagsInTextarea = [];
    if (textarea && textarea.value) {
        const tagPositions = findAllTagPositions(textarea.value);
        tagPositions.forEach(pos => {
            existingTagsInTextarea.push(normalizeTagToSearch(pos.tag));
        });
    }
    return existingTagsInTextarea;
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
