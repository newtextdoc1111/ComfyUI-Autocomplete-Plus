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
 * Checks if a string contains at least one letter or number.
 * This includes Latin letters, Japanese characters, Korean characters,
 * CJK Extension A, Cyrillic letters, and Hebrew letters.
 * @param {string} str The input string.
 * @returns {boolean} True if the string contains at least one letter or number, false otherwise.
 */
export function isContainsLetterOrNumber(str) {
    if (!str) return false;
    // Check if the string contains at least one letter or number (Latin, Japanese, Korean, CJK Extension A, Cyrillic, Hebrew)
    return /[a-zA-Z0-9\u3040-\u30ff\u3400-\u4DBF\u4e00-\u9faf\uac00-\ud7af\u0400-\u04FF\u0590-\u05FF]/.test(str);
}

/**
 * Normalizes a tag string for input.
 * @param {string} str 
 * @returns 
 */
export function normalizeTagToSearch(str) {
    if (!str) return str;
    
    if (isContainsLetterOrNumber(str)) {
        return unescapeParentheses(removePromptWeight(str).replace(/ /g, "_"));
    }

    return unescapeParentheses(removePromptWeight(str));
}

/**
 * Normalizes a tag string for input.
 * Converts underscores to spaces only if the tag contains at least one letter or number.
 * Keeps underscores for tags that are only symbols (e.g. "^_^").
 * @param {string} str 
 * @returns {string}
 */
export function normalizeTagToInsert(str) {
    if (!str) return str;

    if (isContainsLetterOrNumber(str)) {
        return escapeParentheses(str.replace(/_/g, " "));
    }
    // Otherwise, keep as is (for emoji/face tags)
    return escapeParentheses(str);
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

/**
 * Gets the start and end indices of the tag at the current cursor position,
 * applying specific rules for prompt weights and parentheses.
 * @param {string} text The entire text content.
 * @param {number} cursorPos The current cursor position in the text.
 * @returns {{start: number, end: number, tag: string} | null} An object with start, end, and tag string, or null if no tag is found.
 */
export function getCurrentTagRange(text, cursorPos) {
    if (text === null || text === undefined || cursorPos < 0 || cursorPos > text.length) {
        return null;
    }

    const allTags = findAllTagPositions(text);
    let currentTagPos = null;

    for (const pos of allTags) {
        // Find the tag whose range [start, end] (inclusive start, exclusive end for substring)
        if (cursorPos >= pos.start && cursorPos <= pos.end) {
            currentTagPos = { ...pos }; // Clone the position object
            // If cursor is strictly within [pos.start, pos.end), this is a strong candidate.
            if (cursorPos < pos.end) {
                break;
            }
            // If cursorPos === pos.end, continue searching to see if a subsequent tag starts exactly here.
            // If no subsequent tag starts at cursorPos, this currentTagPos (where cursor is at its end) will be used.
        } else if (currentTagPos && cursorPos < pos.start) {
            // If we had a candidate where cursorPos === pos.end,
            // but now we've passed cursorPos, that candidate was the correct one.
            break;
        }
    }

    if (!currentTagPos) {
        return null;
    }

    let { tag, start, end } = currentTagPos;

    // Rule 1: If the tag consists only of symbols, return it as is.
    // (e.g., ";)", ">:)")
    if (!isContainsLetterOrNumber(tag)) {
        if (start < end) { // Ensure it's a valid range
            return { start, end, tag };
        }
        return null;
    }

    // For tags containing letters/numbers, apply rules for parentheses and weights.
    let adjustedTag = tag;
    let adjustedStart = start;
    let adjustedEnd = end;

    // Rule 2: Exclude non-escaped parentheses surrounding the tag.
    // (e.g., "(black hair:1.0)" -> "black hair:1.0", "foo \(bar\)" -> "foo \(bar\)")
    // Apply iteratively for cases like "((tag))" if necessary, though typically one layer.

    let changedInParenStep;
    do {
        changedInParenStep = false;

        // Remove leading non-escaped parenthesis
        const leadParenMatch = adjustedTag.match(/^(?<!\\)\((.*)/s);
        if (leadParenMatch) {
            const newTag = leadParenMatch[1];
            adjustedStart += (adjustedTag.length - newTag.length);
            adjustedTag = newTag;
            changedInParenStep = true;
        }

        // Remove trailing non-escaped parenthesis
        const trailParenMatch = adjustedTag.match(/(.*)(?<!\\)\)$/s);
        if (trailParenMatch) {
            const newTag = trailParenMatch[1];
            adjustedEnd -= (adjustedTag.length - newTag.length);
            adjustedTag = newTag;
            changedInParenStep = true;
        }
        // If the tag becomes empty or invalid during parenthesis removal, stop.
        if (adjustedStart >= adjustedEnd) break;

    } while (changedInParenStep && adjustedTag.length > 0);


    if (adjustedStart >= adjustedEnd) {
        return null; // Tag became empty after parenthesis removal
    }

    // Rule 3: Exclude prompt strength syntax (e.g., ":1.0") but include colons in names.
    // (e.g., "standing:1.0" -> "standing", "foo:bar" -> "foo:bar")
    // This applies to the tag *after* parentheses are handled.
    const weightRegex = /(.*?):(\d+(\.\d+)?)$/;
    const weightMatch = adjustedTag.match(weightRegex);

    if (weightMatch) {
        const tagPart = weightMatch[1];
        const fullWeightString = adjustedTag.substring(tagPart.length);

        if (tagPart.length > 0 || (tagPart.length === 0 && fullWeightString === adjustedTag)) {
            adjustedEnd -= fullWeightString.length;
            adjustedTag = tagPart;
        }
    }

    if (adjustedStart >= adjustedEnd || adjustedTag.length === 0) {
        return null; // Tag became empty after all processing
    }

    return { start: adjustedStart, end: adjustedEnd, tag: adjustedTag };
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
