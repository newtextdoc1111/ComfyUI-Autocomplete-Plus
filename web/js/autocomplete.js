import { settingValues } from './settings.js';
import { autoCompleteData, loadAllData } from './data.js';
import {
    hiraToKata,
    kataToHira,
    formatCountHumanReadable,
    swapUnderscoresAndSpaces,
    escapeParentheses,
    unescapeParentheses
} from './helper.js';

// --- Autocomplete UI Class ---

class AutocompleteUI {
    constructor() {
        this.element = document.createElement('table'); // Use table instead of div
        this.element.id = 'autocomplete-plus-list';
        this.element.style.display = 'none'; // Initially hidden
        this.element.style.position = 'absolute'; // Position near the input
        this.element.style.zIndex = '10000'; // Ensure it's on top
        this.element.style.borderCollapse = 'collapse'; // Optional: for table styling
        this.element.style.width = 'auto'; // Adjust width automatically

        const tbody = document.createElement('tbody');
        this.element.appendChild(tbody);

        this.activeInput = null;
        this.selectedIndex = -1;
        this.candidates = [];

        document.body.appendChild(this.element);

        // Add event listener for clicks on items (listen on tbody)
        tbody.addEventListener('mousedown', (e) => {
            // Check if the click target is a TD inside a TR with a data-index
            const row = e.target.closest('tr');
            if (row && row.dataset.index) {
                const index = parseInt(row.dataset.index, 10);
                if (!isNaN(index)) {
                    this.#selectItem(index);
                    e.preventDefault(); // Prevent focus loss from input
                    e.stopPropagation();
                }
            }
        });
    }

    show(textareaElement, candidates) {
        this.#update(candidates);
        if (candidates.length > 0) {
            this.#show(textareaElement);
        } else {
            this.#hide();
        }
    }

    hide() {
        this.#hide();
    }

    isVisible() {
        return this.element.style.display !== 'none';
    }

    /** Moves the selection up or down */
    navigate(direction) {
        if (this.candidates.length === 0) return;
        this.selectedIndex += direction;

        if (this.selectedIndex < 0) {
            this.selectedIndex = this.candidates.length - 1; // Wrap around to bottom
        } else if (this.selectedIndex >= this.candidates.length) {
            this.selectedIndex = 0; // Wrap around to top
        }
        this.#highlightItem(this.selectedIndex);
    }

    /** Selects the currently highlighted item */
    getSelectedTag() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.candidates.length) {
            return this.candidates[this.selectedIndex].tag;
        }

        return null; // No valid selection
    }

    /**
     * Shows the autocomplete list near the target input element.
     * Adjusts max-height and enables scrolling if the list exceeds viewport bounds.
     * @param {HTMLTextAreaElement} inputElement The textarea being typed into.
     */
    #show(inputElement) {
        this.activeInput = inputElement;
        this.selectedIndex = 0;

        // Calculate caret position using the helper function (returns viewport-relative coordinates)
        this.#updateListPosition();

        this.element.style.overflowY = 'auto';
        this.element.style.display = 'block'; // Make it visible

        // Highlight the first item
        this.#highlightItem(this.selectedIndex);
    }

    /**
     * Calculates the position of the autocomplete list based on the caret position in the input element.
     * Position calculation logic inspired by:
     * https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/common/autocomplete.js
     * License: MIT License (assumed based on repository root LICENSE file)
     * Considers ComfyUI canvas scale.
     */
    #updateListPosition() {
        const { top: caretTop, left: caretLeft, lineHeight: caretLineHeight } = this.#getCaretCoordinates(this.activeInput);

        // Reset scroll position and max-height before calculating position
        this.element.scrollTop = 0;
        this.element.style.maxHeight = ''; // Reset max-height for accurate measurement

        // Get ComfyUI canvas scale if available, otherwise default to 1
        const scale = window.app?.canvas?.ds?.scale ?? 1.0;

        // Initial desired position: below the current text line where the caret is.
        let topPosition = caretTop + ((caretLineHeight) * scale);
        let leftPosition = caretLeft;

        // Make the list visible *before* getting its dimensions to ensure they are accurate
        // Use visibility instead of display to measure without affecting layout yet
        this.element.style.visibility = 'hidden';
        this.element.style.display = 'block';
        const listRect = this.element.getBoundingClientRect(); // Dimensions without max-height constraint
        const naturalHeight = listRect.height;
        this.element.style.display = 'none'; // Hide again until final position is set
        this.element.style.visibility = 'visible';

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 5; // Small margin from viewport edges


        // --- Horizontal Collision Detection and Adjustment ---
        if (leftPosition + listRect.width > viewportWidth - margin) {
            leftPosition = viewportWidth - listRect.width - margin;
        }
        if (leftPosition < margin) {
            leftPosition = margin;
        }

        // --- Vertical Collision Detection and Adjustment ---
        const availableSpaceBelow = viewportHeight - topPosition - margin;
        const availableSpaceAbove = caretTop - margin; // Space above the caret line

        // Reset max-height before deciding
        this.element.style.maxHeight = '';

        if (naturalHeight <= availableSpaceBelow) {
            // Fits perfectly below the caret
            // topPosition remains as calculated initially
        } else {
            // Doesn't fit below, check if it fits perfectly above
            const topAboveCaret = caretTop - naturalHeight - margin; // Position list bottom just above caret line
            if (naturalHeight <= availableSpaceAbove) {
                // Fits perfectly above
                topPosition = topAboveCaret;
            } else {
                // Doesn't fit perfectly either below or above, needs scrolling.
                // Choose the position (above or below) that offers more space.
                if (availableSpaceBelow >= availableSpaceAbove) {
                    // Scroll below: topPosition remains as initially calculated
                    this.element.style.maxHeight = `${availableSpaceBelow}px`;
                } else {
                    // Scroll above: Position near the top edge and set max-height
                    topPosition = margin;
                    this.element.style.maxHeight = `${availableSpaceAbove}px`;
                }
            }
        }

        // Final check to prevent going off the top edge
        if (topPosition < margin) {
            topPosition = margin;
            // If pushed down, recalculate max-height if it was set based on top alignment
            if (this.element.style.maxHeight && availableSpaceBelow < availableSpaceAbove) {
                // Recalculate max-height based on space from the top margin
                this.element.style.maxHeight = `${viewportHeight - margin - margin}px`;
            }
        }

        // Apply the calculated position and display the element
        this.element.style.left = `${leftPosition}px`;
        this.element.style.top = `${topPosition}px`;
    }

    /**
     * Hides the autocomplete list.
     */
    #hide() {
        this.element.style.display = 'none';
        this.selectedIndex = -1;
        this.activeInput = null;
        this.candidates = [];
    }

    /**
     * Updates the list with new candidates.
     * @param {Array<{tag: string, count: number, alias?: string}>} candidates List of candidate tags.
     */
    #update(candidates) {
        this.candidates = candidates;
        const tbody = this.element.querySelector('tbody');
        tbody.innerHTML = ''; // Clear previous items from tbody
        if (candidates.length === 0) {
            this.#hide();
            return;
        }

        candidates.forEach((candidate, index) => {
            this.#createCandidateItem(index, candidate); // Pass candidate directly
        });

        // If the list is already visible, update its position in case content changed size significantly
        if (this.isVisible() && this.activeInput) {
            this.#updateListPosition();
        }
    }

    /**
     * Creates a table row (tr) for a candidate item.
     * @param {number} index
     * @param {{tag: string, count: number, alias?: string[]}} candidate
     */
    #createCandidateItem(index, candidate) {
        const MAX_ALIAS_LENGTH = 25; // Maximum length for alias display
        const tbody = this.element.querySelector('tbody');

        const item = document.createElement('tr'); // Create a table row
        item.classList.add('autocomplete-plus-item');
        item.dataset.index = index;
        item.style.cursor = 'pointer';
        item.style.whiteSpace = 'nowrap'; // Prevent wrapping within the row

        // Left cell: Tag
        const leftTd = document.createElement('td');
        leftTd.style.padding = '4px 8px';
        leftTd.style.overflow = 'hidden';
        leftTd.style.textOverflow = 'ellipsis';
        leftTd.style.maxWidth = '300px'; // Limit width of the tag/alias cell
        leftTd.style.textAlign = 'left';

        leftTd.textContent = candidate.tag; // Display the tag

        // Middle cell: Alias (if any)
        const middleTd = document.createElement('td');
        middleTd.style.padding = '4px 8px';
        middleTd.style.overflow = 'hidden';
        middleTd.style.textOverflow = 'ellipsis';
        middleTd.style.maxWidth = '300px'; // Limit width of the tag/alias cell
        middleTd.style.textAlign = 'left';

        let displayText = "";
        let displayAliasStr = '';
        if (candidate.alias && candidate.alias.length > 0) {
            displayAliasStr = candidate.alias.join(', '); // Join multiple aliases with commas
            // Truncate long alias
            if (displayAliasStr.length > MAX_ALIAS_LENGTH) {
                displayAliasStr = displayAliasStr.substring(0, MAX_ALIAS_LENGTH) + '...';
            }
            displayText += ` [${displayAliasStr}]`;
        }
        middleTd.textContent = displayText;
        middleTd.title = `${candidate.tag}${candidate.alias && candidate.alias.length > 0 ? ` [${candidate.alias.join(', ')}]` : ''}`; // Full text on hover

        // Right cell: Count
        const rightTd = document.createElement('td');
        rightTd.textContent = formatCountHumanReadable(candidate.count);
        rightTd.style.padding = '4px 8px';
        rightTd.style.textAlign = 'right';
        rightTd.style.minWidth = '50px'; // Ensure some minimum space for count alignment

        item.appendChild(leftTd);
        item.appendChild(middleTd);
        item.appendChild(rightTd);
        tbody.appendChild(item); // Append row to tbody
    }

    /** Highlights the item (row) at the given index */
    #highlightItem() {
        const tbody = this.element.querySelector('tbody');
        if (!tbody) return;
        const items = tbody.children; // Get rows (tr) from tbody
        for (let i = 0; i < items.length; i++) {
            if (i === this.selectedIndex) {
                items[i].classList.add('selected'); // Use CSS class for selection
                items[i].scrollIntoView({ block: 'nearest' });
            } else {
                items[i].classList.remove('selected');
            }
        }
    }

    /**
     * Handles the selection of an item (e.g., inserts into input).
     * @param {number} index The index of the selected candidate.
     */
    #selectItem(index) {
        if (!this.activeInput || index < 0 || index >= this.candidates.length) {
            this.#hide();
            return;
        }

        // Get the selected tag
        const selectedTag = this.candidates[index].tag;

        // Insert the selected tag
        insertTag(this.activeInput, selectedTag);

        this.#hide();
    }

    /**
     * Gets the pixel coordinates of the caret in the input element.
     * Uses a temporary div to calculate the position accurately.
     * Based on https://github.com/component/textarea-caret-position
     * @param {HTMLTextAreaElement} element The textarea element.
     * @returns {{ top: number, left: number, lineHeight: number }}
     */
    #getCaretCoordinates(element) {
        const properties = [
            'direction', // RTL support
            'boxSizing',
            'width', // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
            'height',
            'overflowX',
            'overflowY', // copy the scrollbar for IE

            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'borderStyle',

            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',

            // https://developer.mozilla.org/en-US/docs/Web/CSS/font
            'fontStyle',
            'fontVariant',
            'fontWeight',
            'fontStretch',
            'fontSize',
            'fontSizeAdjust',
            'lineHeight',
            'fontFamily',

            'textAlign',
            'textTransform',
            'textIndent',
            'textDecoration', // might not make a difference, but better be safe

            'letterSpacing',
            'wordSpacing',

            'tabSize',
            'MozTabSize' // Firefox
        ];

        const isBrowser = typeof window !== 'undefined';
        const isFirefox = isBrowser && window.mozInnerScreenX != null;

        // The mirror div will replicate the textarea's style
        const div = document.createElement('div');
        div.id = 'input-textarea-caret-position-mirror-div';
        document.body.appendChild(div);

        const style = div.style;
        const computed = window.getComputedStyle(element);
        const isInput = element.nodeName === 'INPUT';

        // Default textarea styles
        style.whiteSpace = 'pre-wrap';
        if (!isInput) style.wordWrap = 'break-word'; // only for textarea-s

        // Position off-screen
        style.position = 'absolute'; // required to return coordinates properly
        style.visibility = 'hidden'; // not 'display: none' because we want rendering

        // Transfer the element's properties to the div
        properties.forEach(prop => {
            if (isInput && prop === "lineHeight") {
                // Special case for <input>s because text is rendered centered and line height may be != height
                if (computed.boxSizing === "border-box") {
                    var height = parseInt(computed.height);
                    var outerHeight =
                        parseInt(computed.paddingTop) +
                        parseInt(computed.paddingBottom) +
                        parseInt(computed.borderTopWidth) +
                        parseInt(computed.borderBottomWidth);
                    var targetHeight = outerHeight + parseInt(computed.lineHeight);
                    if (height > targetHeight) {
                        style.lineHeight = height - outerHeight + "px";
                    } else if (height === targetHeight) {
                        style.lineHeight = computed.lineHeight;
                    } else {
                        style.lineHeight = 0;
                    }
                } else {
                    style.lineHeight = computed.height;
                }
            } else {
                style[prop] = computed[prop];
            }
        });

        // Calculate lineHeight more robustly
        let computedLineHeight = computed.lineHeight;
        let numericLineHeight;
        if (computedLineHeight === 'normal') {
            // Calculate fallback based on font size
            const fontSize = parseFloat(computed.fontSize);
            numericLineHeight = Math.round(fontSize * 1.2); // Common approximation
        } else {
            numericLineHeight = parseFloat(computedLineHeight); // Use parseFloat for pixel values like "16px"
        }
        // Ensure we have a valid number, fallback if somehow still NaN
        if (isNaN(numericLineHeight)) {
            const fontSize = parseFloat(computed.fontSize);
            numericLineHeight = Math.round(fontSize * 1.2) || 16; // Final fallback
        }

        if (isFirefox) {
            // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
            if (element.scrollHeight > parseInt(computed.height)) style.overflowY = 'scroll';
        } else {
            style.overflow = 'hidden'; // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
        }

        div.textContent = element.value.substring(0, element.selectionStart);
        // The second special handling for input type=text doesn't need to be copied:
        // If isInput then usage is https://github.com/component/textarea-caret-position#usage-input-typetext

        const span = document.createElement('span');
        // Wrapping must be replicated *exactly*, including whitespace spaces and carriage returns
        span.textContent = element.value.substring(element.selectionStart) || '.'; // || '.' because a completely empty faux span doesn't render at all
        div.appendChild(span);

        const coordinates = {
            top: span.offsetTop + (parseInt(computed['borderTopWidth']) || 0),
            left: span.offsetLeft + (parseInt(computed['borderLeftWidth']) || 0),
            lineHeight: numericLineHeight // Use the calculated numeric lineHeight
        };

        // Calculate the bounding rect of the input element relative to the viewport
        const rect = element.getBoundingClientRect();

        // Adjust the coordinates to be relative to the viewport
        coordinates.top = rect.top + element.scrollTop + coordinates.top;
        coordinates.left = rect.left + element.scrollLeft + coordinates.left;

        document.body.removeChild(div);

        return coordinates;
    }
}

// --- Autocomplete Logic ---
const autocompleteUI = new AutocompleteUI();

/**
 * Finds tag completion candidates based on the input query.
 * Handles Hiragana/Katakana conversion for matching.
 * @param {string} query The partial tag input.
 * @returns {Array<{tag: string, count: number, alias?: string}>}
 */
function findCompletionCandidates(query) {
    const startTime = performance.now(); // 検索開始時間を記録

    if (!query) {
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
    for (const tagData of autoCompleteData.sortedTags) {
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
                alias: tagData.alias // Add alias property only if matched via alias
            });
            addedTags.add(tagData.tag);
            if (candidates.length >= settingValues.maxSuggestions) {
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
 * @param {string} tagToInsert The raw tag string to insert.
 */
function insertTag(inputElement, tagToInsert) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Find the last newline or comma before the cursor
    const lastNewLine = text.lastIndexOf('\n', cursorPos - 1);
    const lastComma = text.lastIndexOf(',', cursorPos - 1);

    // Get the position of the last separator (newline or comma) before cursor
    const lastSeparator = Math.max(lastNewLine, lastComma);
    const start = lastSeparator === -1 ? 0 : lastSeparator + 1;

    // Process the tag: swap underscores/spaces and escape parentheses
    const processedTag = swapUnderscoresAndSpaces(tagToInsert);
    const normalizedTag = escapeParentheses(processedTag); // Use helper functions

    // Find the next comma or newline after the cursor position
    let endComma = text.indexOf(',', cursorPos);
    let endNewLine = text.indexOf('\n', cursorPos);

    // Find the next separator (comma or newline) or end of string
    let end;
    if (endComma === -1 && endNewLine === -1) {
        end = text.length;
    } else if (endComma === -1) {
        end = endNewLine;
    } else if (endNewLine === -1) {
        end = endComma;
    } else {
        end = Math.min(endComma, endNewLine);
    }

    // Check word boundary if in the middle of a word
    const nextSpace = text.indexOf(' ', cursorPos);
    if (nextSpace !== -1 && nextSpace < end) {
        end = cursorPos;
    }

    // Add space if the previous separator was a comma
    const needsSpaceBefore = lastSeparator === lastComma && start > 0;

    // Prepare text before the cursor (with space if needed)
    const textBefore = text.substring(0, start) + (needsSpaceBefore ? ' ' : '');

    // Get text after the cursor
    // We need to determine the correct end position for replacement
    // It should be the end of the word/tag being replaced, not just the cursor position
    const textAfter = text.substring(end); // Use 'end' instead of 'cursorPos'

    // Standard separator (comma + space)
    const suffix = ', ';

    // Set the new value
    inputElement.value = textBefore + normalizedTag + suffix + textAfter;

    // Set cursor position after the tag and separator
    const newCursorPos = textBefore.length + normalizedTag.length + suffix.length;
    inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;

    // Trigger input event to notify ComfyUI about the change
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

export class AutocompleteEventHandler {
    handleInput(event) {
        if (!settingValues.enabled || !autocompleteUI) return;
    
        const ESCAPE_SEQUENCE = ["#", "/"]; // prevent autocomplete for these sequences
        const textareaElement = event.target;
        const partialTag = getCurrentPartialTag(textareaElement);
        if (partialTag.length > 0 && !ESCAPE_SEQUENCE.some(seq => partialTag.startsWith(seq))) {
            const candidates = findCompletionCandidates(partialTag);
            autocompleteUI.show(textareaElement, candidates);
        } else {
            autocompleteUI.hide();
        }
    }
    
    handleFocus(event) {
        if (!settingValues.enabled) return;
        // Potentially show suggestions immediately on focus?
        // For now, only show on input
        if (!autocompleteUI) {
            autocompleteUI = new AutocompleteUI();
        }
        // Maybe check if there's already text and show suggestions?
        // handleInput(event); // Trigger check immediately
    }
    
    handleBlur(event) {
        // Need a slight delay because clicking the autocomplete list causes blur
        setTimeout(() => {
            if (autocompleteUI && !autocompleteUI.element.contains(document.activeElement)) {
                autocompleteUI.hide();
            }
        }, 150);
    }
    
    handleKeyDown(event) {
        if (!settingValues.enabled) return;
    
        const textareaElement = event.target;
    
        // Handle autocomplete navigation
        if (autocompleteUI && autocompleteUI.isVisible()) {
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
    }
    
    // New event handler for mousemove to show similar tags on hover
    handleMouseMove(event) {
    }
    
    // New event handler for click to show similar tags
    handleClick(event) {
        if (!settingValues.enabled || !settingValues.enableSimilarTags ||
            settingValues.similarTagsDisplayMode !== 'click') return;
    }
}