// --- Html String constants ---

/**
 * HTML string for the tag source icon.
 */
export const IconSvgHtmlString = `
    <svg>
        <defs>
            <symbol id="autocomplete-plus-icon-danbooru" viewBox="14 12 42 42">
                <polygon points="20,20 20,44 44,44 44,20" fill="#a67c52" stroke="#2d1400" stroke-width="2" stroke-linejoin="bevel"/>
                <polygon points="20,20 26,14 50,14 44,20" fill="#6e4b2c" stroke="#2d1400" stroke-width="2" stroke-linejoin="bevel"/>
                <polygon points="44,20 50,14 50,38 44,44" fill="#8b5e3c" stroke="#2d1400" stroke-width="2" stroke-linejoin="bevel"/>
            </symbol>
            <symbol id="autocomplete-plus-icon-e621" viewBox="-33 -38 66 76">
                <style>
                .e621-blue { fill: #0d2e69; }
                .e621-white { fill:rgb(230, 230, 230); }
                </style>
                <g>
                <path class="e621-blue" d="M0 -38 L32.909 -19 L32.909 19 L0 38 L-32.909 19 L-32.909 -19 Z"/>
                <text x="0" y="0" class="e621-white" font-family="Arial Black, Gadget, sans-serif" font-size="56" text-anchor="middle" dominant-baseline="middle">e</text>
                </g>
            </symbol>
        </defs>
    </svg>`;

// --- String Helper Functions ---

const MAX_PROMPT_WEIGHT_VALUE = 9.9;

// Regex constants
const REG_ESCAPE_OPEN_PAREN = /(?<!\\)\(/g;
const REG_ESCAPE_CLOSE_PAREN = /(?<!\\)\)/g;
const REG_UNESCAPE_OPEN_PAREN = /\\\(/g;
const REG_UNESCAPE_CLOSE_PAREN = /\\\)/g;

const REG_CONTAINS_LETTER_NUMBER = /[a-zA-Z0-9\u3040-\u30ff\u3400-\u4DBF\u4e00-\u9faf\uac00-\ud7af\u0400-\u04FF\u0590-\u05FF]/;

const REG_PROMPT_WEIGHT = /(.*?):([0-9](\.\d+)?)$/;

const REG_STRIP_LEADING_PAREN = /^(?<!\\)\((.*)/s;
const REG_STRIP_TRAILING_PAREN = /(.*)(?<!\\)\)$/s;

const REG_WILDCARD_WEIGHTED_TAG = /(\d+)[_\s]*::(.*?)(?=\||$)/g;
const REG_WILDCARD_SIMPLE_WORD = /[^{}_|]+/g;

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
    return str.replace(REG_ESCAPE_OPEN_PAREN, '\\(').replace(REG_ESCAPE_CLOSE_PAREN, '\\)');
}

/**
 * Unescapes parentheses in a string.
 * Replaces '\(' with '(' and '\)' with ')'.
 * @param {string} str The input string.
 * @returns {string} The string with parentheses unescaped.
 */
export function unescapeParentheses(str) {
    if (!str) return str;
    return str.replace(REG_UNESCAPE_OPEN_PAREN, '(').replace(REG_UNESCAPE_CLOSE_PAREN, ')');
}

/**
 * Removes prompt weights from a tag (e.g., "tag:1.2" becomes "tag").
 * Preserves tags with colons like "year:2000" or "foo:bar".
 * Preserves symbol-only tags like ";)" or "^_^".
 * @param {string} str The input tag string.
 * @returns {string} The tag without weight and without surrounding non-escaped brackets.
 */
export function removePromptWeight(str) {
    if (!str) return str;

    // For symbol-only tags (no letters/numbers), return as-is
    if (!isContainsLetterOrNumber(str)) {
        return str;
    }

    // Only remove weight notation for patterns that look like actual weights
    // (e.g., ":1.2" where the number is between 0-9.9)
    let result = str.replace(/(.+?):([0-9](\.\d+)?)$/, (match, p1, p2) => {
        // If the number after colon is between 0-9.9, it's likely a weight
        if (parseFloat(p2) <= MAX_PROMPT_WEIGHT_VALUE) {
            return p1;
        }
        // Otherwise preserve the entire string (like "year:2000")
        return match;
    });

    // Only remove non-escaped brackets if the string contains letters or numbers
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
    return REG_CONTAINS_LETTER_NUMBER.test(str);
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
 * Converts underscores to spaces only if the tag contains at least one letter or number,
 * and is not a wildcard call (e.g., "__wildcard__").
 * Keeps underscores for tags that are only symbols (e.g. "^_^") or wildcard calls.
 * @param {string} str 
 * @returns {string}
 */
export function normalizeTagToInsert(str) {
    if (!str) return str;

    if (isContainsLetterOrNumber(str)) {
        const isWildcardCall = str.startsWith('__') && str.endsWith('__') && str.length > 4;

        if (!isWildcardCall) {
            // If doesn't wildcard call, replace underscores with spaces
            return escapeParentheses(str.replace(/_/g, " "));
        }
    }

    // Otherwise, keep it as is (e.g., ""^_^", "__wildcard__")
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
 * Recursively finds all words in a string, even those inside nested braces.
 * This helps extract all possible tags from complex nested wildcards.
 * @param {string} text The text to extract words from
 * @param {number} baseStart The starting position of the text in the original string
 * @returns {Array<{start: number, end: number, tag: string}>} Array of parsed tags
 */
function extractAllWords(text, baseStart) {
    const result = [];

    // First, extract weighted tag patterns like "20::from above"
    let weightMatch = REG_WILDCARD_WEIGHTED_TAG.exec(text);
    while (weightMatch !== null) {
        const tagText = weightMatch[2].trim();

        if (tagText) {
            // Calculate position with original offsets
            const fullMatchStart = baseStart + weightMatch.index;
            const tagTextStart = fullMatchStart + weightMatch[0].indexOf(tagText);
            const tagTextEnd = tagTextStart + tagText.length;

            result.push({
                start: tagTextStart,
                end: tagTextEnd,
                tag: tagText
            });
        }

        weightMatch = REG_WILDCARD_WEIGHTED_TAG.exec(text);
    }

    // If no weighted tags were found, extract simple words
    if (result.length === 0) {
        // Regular expression to match words (sequences of non-whitespace characters)
        // We consider a word to be any continuous sequence of characters that's not a space, pipe, or brace
        const wordRegex = REG_WILDCARD_SIMPLE_WORD;
        let match;

        // Find all standalone words in the text
        while ((match = wordRegex.exec(text)) !== null) {
            const wordStart = baseStart + match.index;
            const wordEnd = wordStart + match[0].length;

            // Remove leading and trailing spaces from the matched word
            const trimmedTag = match[0].trim();
            const leadingSpaces = match[0].length - match[0].trimStart().length;
            const adjustedStart = wordStart + leadingSpaces;
            const adjustedEnd = wordStart + leadingSpaces + trimmedTag.length;

            result.push({
                start: adjustedStart,
                end: adjustedEnd,
                tag: trimmedTag
            });
        }
    }

    return result;
}

/**
 * Parses a wildcard selection and returns individual tags.
 * Supports syntax like {tag1|tag2|tag3} and {weight::tag1|weight::tag2}.
 * Also handles nested wildcards like {tag1 {tag2|tag3}|tag4}.
 * @param {string} tag The complete tag text that might contain a wildcard
 * @param {number} startPos The starting position of the tag in the original text
 * @param {number} endPos The ending position of the tag in the original text
 * @returns {Array<{start: number, end: number, tag: string}>} Array of parsed tags or null
 */
function parseWildcardSelection(tag, startPos, endPos) {
    // Trim the tag for matching but keep original position
    const trimmedTag = tag.trim();

    // Check if this is a wildcard selection
    if (!trimmedTag.startsWith('{') || !trimmedTag.endsWith('}')) {
        return null; // Not a wildcard
    }

    // Calculate position offsets for the trim operation
    const leadingSpaces = tag.length - tag.trimStart().length;
    const tagStart = startPos + leadingSpaces;

    // For nested wildcards, we'll extract all words from the content
    // This treats each word as a separate tag, regardless of nesting
    // Extract the content between the outermost braces
    const wildcardContent = trimmedTag.substring(1, trimmedTag.length - 1);

    // Extract all words from the wildcard content, including those in nested structures
    const allTags = extractAllWords(wildcardContent, tagStart + 1);

    return allTags.length > 0 ? allTags : null;
}

/**
 * Finds all tag positions in the given text.
 * Searches for tags separated by commas or newlines.
 * Also handles wildcard selections in the format {tag1|tag2|tag3}.
 * @param {string} text The text to search in
 * @returns {Array<{start: number, end: number, tag: string}>} Array of tag positions and content
 */
export function findAllTagPositions(text) {
    if (!text) return [];

    const positions = [];
    let startPos = 0;

    // Process text segment by segment (comma or newline separated)
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
		let endPosPeriod = text.indexOf('.', startPos);

        if (endPosComma === -1) endPosComma = text.length;
        if (endPosNewline === -1) endPosNewline = text.length;
		if (endPosPeriod === -1) endPosPeriod = text.length;

        const endPos = Math.min(endPosComma, endPosNewline, endPosPeriod);
        const tagText = text.substring(startPos, endPos);

        if (tagText.trim().length > 0) {
            const trimmedTag = tagText.trim();

            // Check if this is a wildcard selection
            if (trimmedTag.startsWith('{') && trimmedTag.endsWith('}')) {
                // Process wildcard using our existing wildcard parser
                const wildcardTags = parseWildcardSelection(tagText, startPos, endPos);
                if (wildcardTags) {
                    positions.push(...wildcardTags);
                }
            } else {
                // Normal tag, add it directly
                positions.push({
                    start: startPos,
                    end: endPos,
                    tag: tagText
                });
            }
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
    if (!text || typeof text !== 'string') {
        return null;
    }

    // Clamp cursorPos to valid range
    const clampedCursorPos = Math.min(Math.max(cursorPos, 0), text.length);

    const allTags = findAllTagPositions(text);
    let currentTagPos = null;

    for (const pos of allTags) {
        // Find the tag whose range [start, end] (inclusive start, exclusive end for substring)
        if (clampedCursorPos >= pos.start && clampedCursorPos <= pos.end) {
            currentTagPos = { ...pos }; // Clone the position object
            // If cursor is strictly within [pos.start, pos.end), this is a strong candidate.
            if (clampedCursorPos < pos.end) {
                break;
            }
            // If clampedCursorPos === pos.end, continue searching to see if a subsequent tag starts exactly here.
            // If no subsequent tag starts at clampedCursorPos, this currentTagPos (where cursor is at its end) will be used.
        } else if (currentTagPos && clampedCursorPos < pos.start) {
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
        const leadParenMatch = adjustedTag.match(REG_STRIP_LEADING_PAREN);
        if (leadParenMatch) {
            const newTag = leadParenMatch[1];
            adjustedStart += (adjustedTag.length - newTag.length);
            adjustedTag = newTag;
            changedInParenStep = true;
        }

        // Remove trailing non-escaped parenthesis
        const trailParenMatch = adjustedTag.match(REG_STRIP_TRAILING_PAREN);
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
    // (e.g., "standing:1.0" -> "standing", "foo:bar" -> "foo:bar", "year:2000" -> "year:2000")
    // This applies to the tag *after* parentheses are handled.
    const weightMatch = adjustedTag.match(REG_PROMPT_WEIGHT);

    if (weightMatch) {
        const tagPart = weightMatch[1];
        const weightValue = weightMatch[2];
        // Only consider it as a weight if it's a simple number between 0-9 possibly with decimal
        // Don't treat larger numbers like :1999 or :2000 as weights
        if (parseFloat(weightValue) <= MAX_PROMPT_WEIGHT_VALUE) {
            const fullWeightString = adjustedTag.substring(tagPart.length);
            if (tagPart.length > 0 || (tagPart.length === 0 && fullWeightString === adjustedTag)) {
                adjustedEnd -= fullWeightString.length;
                adjustedTag = tagPart;
            }
        }
    }

    if (adjustedStart >= adjustedEnd || adjustedTag.length === 0) {
        return null; // Tag became empty after all processing
    }

    return { start: adjustedStart, end: adjustedEnd, tag: adjustedTag };
}

// --- End String Helper Functions ---

/**
 * Load a CSS file dynamically.
 * @param {string} href 
 */
export function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
    // Ensure the CSS is loaded before other scripts might rely on its styles
    // by adding it to the head.
    document.head.appendChild(link);
    // console.debug(`[Autocomplete-Plus] Loaded CSS: ${href}`); // Optional: Log loading
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
