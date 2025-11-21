import { settingValues } from './settings.js';
import { NodeInfo } from './node-info.js';


/**
 * Determines if the text content should be auto-formatted.
 *
 * Format conditions:
 * 1. Skip formatting if node is in blocklist
 * 2. Skip formatting if text contains only numbers, hyphens, commas, dots, and spaces
 * 3. Format if text contains "word + comma" pattern at least twice
 * 4. Otherwise, don't format
 *
 * @param {NodeInfo} nodeInfo - The node information.
 * @returns {boolean} - True if the text should be formatted, false otherwise.
 */
function shouldAutoFormat(text, nodeInfo) {
    if (!text || text.trim().length === 0) return false;

    // 1. Check if the node name is in the blocklist
    const blocklist = [
        ["Power Puter (rgthree)", "code"],
        ["LoraLoaderBlockWeight //Inspire", "block_vector"]
    ];

    const isBlocklisted = blocklist.some(([type, input]) =>
        type === nodeInfo.nodeType && input === nodeInfo.inputName
    );

    if (isBlocklisted) {
        // console.debug(`[Autocomplete-Plus] auto-formatter on blur => nodeType: ${nodeInfo.nodeType}, inputName: ${nodeInfo.inputName} => blocklisted`);
        return false;
    } else {
        // console.debug(`[Autocomplete-Plus] auto-formatter on blur => nodeType: ${nodeInfo.nodeType}, inputName: ${nodeInfo.inputName}`);
    }


    const trimmedText = text.trim();

    // 2. Check if the text is purely numeric data with hyphens and commas
    // (e.g., "0,0,0,1,1,1" or "0.5, -1.2, 0.8" for LoRA Block Weight)
    const numericPattern = /^[\d.,\s-]+$/;
    if (numericPattern.test(trimmedText)) {
        return false; // Don't format numeric data
    }

    // 3. Check if the text contains the pattern "word + comma"
    const wordCommaPattern = /\w+\s*,/g;
    const matches = trimmedText.match(wordCommaPattern);

    if (matches == null) {
        return false;
    }

    return true; // Text should be formatted
}

/**
 * Format the prompt text: add a comma and space after each tag, and remove extra spaces.
 * Preserve special syntax such as weights (tag:1.2), parentheses, and wildcards.
 * @param {string} text - The original text.
 * @returns {string} - The formatted text.
 */
export function formatPromptText(text) {
    if (!text || text.trim().length === 0) return text;

    // Split text into individual lines for processing
    const lines = text.split('\n');
    const formattedLines = [];

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Keep empty lines unchanged
        if (trimmedLine.length === 0) {
            formattedLines.push('');
            continue;
        }

        // Split the line by commas into raw tag segments
        const rawTags = trimmedLine.split(',');

        const cleanedTags = [];
        for (const tag of rawTags) {
            // Trim spaces around each tag
            const trimmedTag = tag.trim();

            // Keep only non-empty tags
            if (trimmedTag.length > 0) {
                cleanedTags.push(trimmedTag);
            }
        }

        // Rejoin cleaned tags with ", "
        let formattedLine = cleanedTags.join(', ');

        // Add a trailing comma and space if the line contains valid tags
        if (formattedLine.length > 0) {
            formattedLine += ', ';
        }

        formattedLines.push(formattedLine);
    }

    // Rejoin all lines with newline characters
    return formattedLines.join('\n');
}

/**
 * Format the content of a textarea when it loses focus.
 * @param {HTMLTextAreaElement} textarea - The target textarea element.
 */
export function formatTextareaOnBlur(textarea) {
    const originalText = textarea.value;
    const formattedText = formatPromptText(originalText);

    if (originalText !== formattedText) {
        const cursorPos = textarea.selectionStart;
        textarea.value = formattedText;

        // Try to preserve cursor position
        const newCursorPos = Math.min(cursorPos, formattedText.length);
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }
}

/**
 * Event handler for auto-formatting functionality
 */
export class AutoFormatterEventHandler {
    constructor() { }

    /**
     * Handle blur event to trigger auto-formatting
     * @param {Event} event - The blur event
     */
    handleBlur(event, nodeInfo) {
        if (
            settingValues.enableAutoFormat &&
            settingValues.autoFormatTrigger === 'auto' &&
            event.target.tagName === 'TEXTAREA'
        ) {
            const textarea = event.target;
            const text = textarea.value;

            // Check if the content should be auto-formatted
            if (shouldAutoFormat(text, nodeInfo)) {
                formatTextareaOnBlur(textarea);
            }
        }
    }

    // Placeholder methods to maintain consistency with other event handlers
    handleInput(event) { }
    handleFocus(event) { }
    handleKeyDown(event) { }
    handleKeyUp(event) { }
    handleMouseMove(event) { }
    handleClick(event) { }

    /**
     * Format textarea content via manual trigger (e.g., keyboard shortcut)
     * @param {HTMLTextAreaElement} textarea - The textarea element to format
     * @param {NodeInfo} nodeInfo - The node information
     * @returns {boolean} - True if formatting was performed, false otherwise
     */
    applyFormatTextarea(textarea, nodeInfo) {
        if (!textarea || textarea.tagName !== 'TEXTAREA') {
            return false;
        }

        if (!settingValues.enableAutoFormat) {
            return false;
        }

        const text = textarea.value;

        if (shouldAutoFormat(text, nodeInfo)) {
            formatTextareaOnBlur(textarea);
            return true;
        }

        return false;
    }
}
