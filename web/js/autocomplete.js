import {
    TagCategory,
    TagData,
    autoCompleteData
} from './data.js';
import {
    formatCountHumanReadable,
    hiraToKata,
    kataToHira,
    normalizeTagToInsert,
    normalizeTagToSearch,
} from './utils.js';
import { settingValues } from './settings.js';

// --- Autocomplete Logic ---

/**
 * Search tag completion candidates based on the current input and cursor position in the textarea.
 * @param {HTMLTextAreaElement} textareaElement The partial tag input.
 * @returns {Array<{tag: string, count: number, alias?: string[], category: string}>} The list of matching candidates.
 */
function searchCompletionCandidates(textareaElement) {
    const startTime = performance.now(); // Record start time for performance measurement
    
    const ESCAPE_SEQUENCE = ["#", "/"]; // If the first string is that character, autocomplete will not be displayed.
    const partialTag = getCurrentPartialTag(textareaElement);
    if (!partialTag || partialTag.length <= 0 || ESCAPE_SEQUENCE.some(seq => partialTag.startsWith(seq))) {
        return []; // No valid input for autocomplete    
    }
    
    const lowerQuery = partialTag.toLowerCase();
    const exactMatches = []; // Array for exact matches (will be displayed first)
    const partialMatches = []; // Array for partial matches (will be displayed after exact matches)
    const addedTags = new Set(); // Keep track of added tags to avoid duplicates

    // Generate Hiragana/Katakana variations if applicable
    const queryVariations = new Set([lowerQuery, normalizeTagToSearch(lowerQuery)]);
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
        let isExactMatch = false;
        let matchedAlias = null;

        // Ensure tagData.tag is treated as lowercase for comparison
        const lowerTag = tagData.tag.toLowerCase();

        // Check primary tag against all variations for exact match first
        for (const variation of queryVariations) {
            if (lowerTag === variation) {
                isExactMatch = true;
                matched = true;
                break;
            }
        }

        // If not an exact match, check for partial matches in the tag
        if (!isExactMatch) {
            for (const variation of queryVariations) {
                if (lowerTag.includes(variation)) {
                    matched = true;
                    break;
                } else if (lowerTag.replace(/[\-_\s']/g, '').includes(variation.replace(/[\-_\s']/g, ''))) {
                    // Try to match with underscore, dash, or apostrophe removed
                    matched = true;
                    break;
                }
            }
        }

        // If primary tag didn't match, check aliases against all variations
        if (!matched && tagData.alias && Array.isArray(tagData.alias) && tagData.alias.length > 0) {
            for (const alias of tagData.alias) {
                const lowerAlias = alias.toLowerCase();

                // Check for exact matches in aliases first
                for (const variation of queryVariations) {
                    if (lowerAlias === variation) {
                        isExactMatch = true;
                        matched = true;
                        matchedAlias = alias;
                        break;
                    }
                }

                // If not an exact match in alias, check for partial matches
                if (!isExactMatch) {
                    for (const variation of queryVariations) {
                        if (lowerAlias.includes(variation)) {
                            matched = true;
                            matchedAlias = alias;
                            break;
                        }
                    }
                }

                if (matched) break; // Stop checking aliases for this tag if one matched
            }
        }

        // Add candidate if matched and not already added
        if (matched && !addedTags.has(tagData.tag)) {
            const candidateItem = {
                tag: tagData.tag,
                alias: tagData.alias,
                category: tagData.category,
                count: tagData.count,
            };

            // Add to exact matches or partial matches based on match type
            if (isExactMatch) {
                exactMatches.push(candidateItem);
            } else {
                partialMatches.push(candidateItem);
            }

            addedTags.add(tagData.tag);

            // Check if we've reached the maximum suggestions limit combining both arrays
            if (exactMatches.length + partialMatches.length >= settingValues.maxSuggestions) {
                // Return the combined results, prioritizing exact matches
                const result = [...exactMatches, ...partialMatches].slice(0, settingValues.maxSuggestions);

                if (settingValues._logprocessingTime) {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    // console.debug(`[Autocomplete-Plus] Search for "${query}" took ${duration.toFixed(2)}ms. Found ${result.length} candidates (max reached).`);
                }

                return result; // Early exit
            }
        }
    }

    // Combine results, with exact matches first
    const candidates = [...exactMatches, ...partialMatches];

    if (settingValues._logprocessingTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        // console.debug(`[Autocomplete-Plus] Search for "${query}" took ${duration.toFixed(2)}ms. Found ${candidates.length} candidates.`);
    }

    return candidates;
}

/**
 * Extracts the current tag being typed before the cursor.
 * Assumes tags are separated by commas.
 * @param {HTMLTextAreaElement} inputElement
 */
function getCurrentPartialTag(inputElement) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Find the last newline or comma before the cursor
    const lastNewLine = text.lastIndexOf('\n', cursorPos - 1);
    const lastComma = text.lastIndexOf(',', cursorPos - 1);

    // Get the position of the last separator (newline or comma) before cursor
    const lastSeparator = Math.max(lastNewLine, lastComma);
    const start = lastSeparator === -1 ? 0 : lastSeparator + 1;

    // Extract the text between the last comma (or start) and the cursor
    const partial = text.substring(start, cursorPos).trimStart();
    return partial;
}

/**
 * Inserts the selected tag into the textarea, replacing the partial tag,
 * making the change undoable.
 * @param {HTMLTextAreaElement} inputElement
 * @param {string} tagToInsert The raw tag string to insert.
 */
function insertTagToTextArea(inputElement, tagToInsert) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    const lastNewLine = text.lastIndexOf('\n', cursorPos - 1);
    const lastComma = text.lastIndexOf(',', cursorPos - 1);

    const lastSeparator = Math.max(lastNewLine, lastComma);
    const start = lastSeparator === -1 ? 0 : lastSeparator + 1;

    const normalizedTag = normalizeTagToInsert(tagToInsert);

    const currentWordStart = text.substring(start, cursorPos).search(/\S|$/) + start;
    const currentWordEndMatch = text.substring(cursorPos).match(/^[^,\n]+/);
    
    let currentWordEnd = cursorPos;

    // If the end match is found, set currentWordEnd to the end of the match
    if (currentWordEndMatch && normalizedTag.lastIndexOf(currentWordEndMatch[0]) !== -1) {
        currentWordEnd = cursorPos + currentWordEndMatch[0].length;
    }

    // The range to replace is from the start of the current partial tag
    // up to the end of the word segment at the cursor.
    const replaceStart = currentWordStart;
    // replaceEnd should be at least the cursor position, but extend to cover the word segment if cursor is within it.
    const replaceEnd = Math.max(cursorPos, currentWordEnd);

    // Add space if the previous separator was a comma and we are not at the beginning
    const needsSpaceBefore = lastSeparator === lastComma && replaceStart > 0 && text[replaceStart - 1] === ',';
    const prefix = needsSpaceBefore ? ' ' : '';

    // Standard separator (comma + space)
    const needsSuffixAfter = text[replaceEnd] !== ','
    const suffix = needsSuffixAfter ? ', ' : '';

    const textToInsertWithAffixes = prefix + normalizedTag + suffix;

    // --- Use execCommand for Undo support ---
    // 1. Select the text range to be replaced
    inputElement.focus(); // Ensure the element has focus
    inputElement.setSelectionRange(replaceStart, replaceEnd);

    // 2. Execute the 'insertText' command
    // This replaces the selection and should add the change to the undo stack
    const insertTextSuccess = document.execCommand('insertText', false, textToInsertWithAffixes);

    // Fallback for browsers where execCommand might fail or is not supported
    if (!insertTextSuccess) {
        console.warn('[Autocomplete-Plus] execCommand("insertText") failed. Falling back to direct value manipulation (Undo might not work).');
        const textBefore = text.substring(0, replaceStart);
        const textAfter = text.substring(replaceEnd);
        inputElement.value = textBefore + textToInsertWithAffixes + textAfter;
        // Manually set cursor position after the inserted text
        const newCursorPos = replaceStart + textToInsertWithAffixes.length;
        inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;
        // Trigger input event manually as a fallback
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// --- Autocomplete UI Class ---

class AutocompleteUI {
    constructor() {
        this.element = document.createElement('table'); // Use table instead of div
        this.element.id = 'autocomplete-plus-list';
        this.element.style.display = 'none'; // Initially hidden
        this.element.style.position = 'absolute'; // Position near the input
        this.element.style.borderCollapse = 'collapse'; // Optional: for table styling
        this.element.style.width = 'auto'; // Adjust width automatically

        const tbody = document.createElement('tbody');
        this.element.appendChild(tbody);

        // Add to DOM
        document.body.appendChild(this.element);

        this.target = null;
        this.selectedIndex = -1;
        this.candidates = [];

        // Add event listener for clicks on items (listen on tbody)
        tbody.addEventListener('mousedown', (e) => {
            // Check if the click target is a TD inside a TR with a data-index
            const row = e.target.closest('tr');
            if (row && row.dataset.index) {
                const index = parseInt(row.dataset.index, 10);
                if (!isNaN(index)) {
                    this.#insertTag(index);
                    e.preventDefault(); // Prevent focus loss from input
                    e.stopPropagation();
                }
            }
        });
    }

    /** Checks if the autocomplete list is visible */
    isVisible() {
        return this.element.style.display !== 'none';
    }

    /**
     * Displays the autocomplete list under the given textarea element if there are candidates.
     * @param {HTMLTextAreaElement} textareaElement 
     * @returns 
     */
    updateDisplay(textareaElement) {
        const candidates = searchCompletionCandidates(textareaElement);
        if (candidates.length <= 0) {
            this.hide();
            return;
        }

        this.target = textareaElement;

        this.candidates = candidates;
        this.selectedIndex = 0;

        this.#updateContent();

        // Calculate caret position using the helper function (returns viewport-relative coordinates)
        this.#updatePosition();

        // Highlight the first item
        this.#highlightItem();

        this.element.style.overflowY = 'auto';
        this.element.style.display = 'block'; // Make it visible
    }

    /**
     * hides the autocomplete list.
     */
    hide() {
        this.element.style.display = 'none';
        this.selectedIndex = -1;
        this.target = null;
        this.candidates = [];
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
        this.#highlightItem();
    }

    /** Selects the currently highlighted item */
    getSelectedTag() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.candidates.length) {
            return this.candidates[this.selectedIndex].tag;
        }

        return null; // No valid selection
    }

    /**
     * Updates the list from the current candidates.
     */
    #updateContent() {
        const tbody = this.element.querySelector('tbody');
        tbody.innerHTML = ''; // Clear previous items from tbody
        if (this.candidates.length === 0) {
            this.hide();
            return;
        }

        this.candidates.forEach((candidate, index) => {
            this.#createTagElement(index, candidate); // Pass candidate directly
        });

        // If the list is already visible, update its position in case content changed size significantly
        if (this.isVisible() && this.target) {
            this.#updatePosition();
        }
    }

    /**
     * Creates a table row (tr) for a candidate item.
     * @param {number} index
     * @param {TagData} tagData
     */
    #createTagElement(index, tagData) {
        const MAX_ALIAS_LENGTH = 25; // Maximum length for alias display
        const categoryText = TagCategory[tagData.category] || "unknown";
        const tbody = this.element.querySelector('tbody');

        const item = document.createElement('tr');
        item.classList.add('autocomplete-plus-item');
        item.dataset.index = index;
        item.dataset.tagCategory = categoryText;
        item.style.cursor = 'pointer';
        item.style.whiteSpace = 'nowrap';

        // 1st cell: Tag
        const tagCell = document.createElement('td');
        tagCell.style.padding = '4px 8px';
        tagCell.style.overflow = 'hidden';
        tagCell.style.textOverflow = 'ellipsis';
        tagCell.style.maxWidth = '300px'; // Limit width of the tag/alias cell

        tagCell.textContent = tagData.tag; // Display the tag

        // 2nd cell: Alias (if any)
        const aliasCell = document.createElement('td');
        aliasCell.classList.add('autocomplete-plus-alias');
        aliasCell.style.padding = '4px 8px';
        aliasCell.style.maxWidth = '300px'; // Limit width of the tag/alias cell

        let displayText = "";
        let displayAliasStr = '';
        if (tagData.alias && tagData.alias.length > 0) {
            displayAliasStr = tagData.alias.join(', '); // Join multiple aliases with commas
            // Truncate long alias
            if (displayAliasStr.length > MAX_ALIAS_LENGTH) {
                displayAliasStr = displayAliasStr.substring(0, MAX_ALIAS_LENGTH) + '...';
            }
            displayText += ` [${displayAliasStr}]`;
        }
        aliasCell.textContent = displayText;
        aliasCell.title = `${tagData.tag}${tagData.alias && tagData.alias.length > 0 ? ` [${tagData.alias.join(', ')}]` : ''}`; // Full text on hover

        // 3rd cell: Category
        const catCell = document.createElement('td');
        catCell.textContent = categoryText.substring(0, 2);
        catCell.style.padding = '4px 8px';
        catCell.style.minWidth = '50px'; // Ensure some minimum space for count alignment

        // 4th cell: Count
        const countCell = document.createElement('td');
        countCell.textContent = formatCountHumanReadable(tagData.count);
        countCell.style.padding = '4px 8px';
        countCell.style.textAlign = 'right';
        countCell.style.minWidth = '50px'; // Ensure some minimum space for count alignment

        item.appendChild(tagCell);
        item.appendChild(aliasCell);
        item.appendChild(catCell);
        item.appendChild(countCell);
        tbody.appendChild(item); // Append row to tbody
    }

    /**
     * Calculates the position of the autocomplete list based on the caret position in the input element.
     * Position calculation logic inspired by:
     * https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/common/autocomplete.js
     * License: MIT License (assumed based on repository root LICENSE file)
     * Considers ComfyUI canvas scale.
     */
    #updatePosition() {
        const { top: caretTop, left: caretLeft, lineHeight: caretLineHeight } = this.#getCaretCoordinates(this.target);

        const elOffset = this.#calculateElementOffset(this.target);
        const elScroll = { top: this.element.scrollTop, left: this.element.scrollLeft };
        this.element.scrollTop = 0;
        this.element.style.maxHeight = ''; // Reset max-height for accurate measurement

        // Get ComfyUI canvas scale if available, otherwise default to 1
        const scale = window.app?.canvas?.ds?.scale ?? 1.0;

        // Initial desired position: below the current text line where the caret is.
        let topPosition = elOffset.top - (elScroll.top * scale) + ((caretTop - elOffset.top) + caretLineHeight) * scale;
        let leftPosition = elScroll.left - elScroll.left + caretLeft;

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

    /** Highlights the item (row) at the given index */
    #highlightItem() {
        if(!this.getSelectedTag()) return; // No valid selection

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
    #insertTag(index) {
        if (!this.target || index < 0 || index >= this.candidates.length) {
            this.hide();
            return;
        }

        // Get the selected tag
        const selectedTag = this.candidates[index].tag;

        // Insert the selected tag
        insertTagToTextArea(this.target, selectedTag);

        this.hide();
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

        var debug = false;
        if (debug) {
            var el = document.querySelector("#input-textarea-caret-position-mirror-div");
            if (el) el.parentNode.removeChild(el);
        }

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
        if (!debug) style.visibility = 'hidden'; // not 'display: none' because we want rendering

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
            // const fontSize = parseFloat(computed.fontSize);
            // numericLineHeight = Math.round(fontSize * 1.2); // Common approximation
            numericLineHeight = this.#calculateLineHeightPx(element.nodeName, computed);
        } else {
            numericLineHeight = parseFloat(computedLineHeight); // Use parseFloat for pixel values like "16px"
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

        if (debug) {
            span.style.backgroundColor = "#aaa";
        } else {
            document.body.removeChild(div);
        }

        return coordinates;
    }

    /**
     * Returns calculated line-height of the given node in pixels.
     */
    #calculateLineHeightPx(nodeName, computedStyle) {
        const body = document.body;
        if (!body) return 0;

        const tempNode = document.createElement(nodeName);
        tempNode.innerHTML = "&nbsp;";
        Object.assign(tempNode.style, {
            fontSize: computedStyle.fontSize,
            fontFamily: computedStyle.fontFamily,
            padding: "0",
            position: "absolute",
        });
        body.appendChild(tempNode);

        // Make sure textarea has only 1 row
        if (tempNode instanceof HTMLTextAreaElement) {
            tempNode.rows = 1;
        }

        // Assume the height of the element is the line-height
        const height = tempNode.offsetHeight;
        body.removeChild(tempNode);

        return height;
    }

    #calculateElementOffset(element) {
        const rect = element.getBoundingClientRect();
        const owner = element.ownerDocument;
        if (owner == null) {
            throw new Error("Given element does not belong to document");
        }
        const { defaultView, documentElement } = owner;
        if (defaultView == null) {
            throw new Error("Given element does not belong to window");
        }
        const offset = {
            top: rect.top + defaultView.pageYOffset,
            left: rect.left + defaultView.pageXOffset,
        };
        if (documentElement) {
            offset.top -= documentElement.clientTop;
            offset.left -= documentElement.clientLeft;
        }
        return offset;
    }
}

// --- Autocomplete Event Handling Class ---
export class AutocompleteEventHandler {
    constructor() {
        this.autocompleteUI = new AutocompleteUI();
    }

    /**
     * 
     * @param {InputEvent} event 
     * @returns 
     */
    handleInput(event) {
        if (!settingValues.enabled) return;
        if(!event.isTrusted) return; // ignore synthetic events

        const textareaElement = event.target;
        const partialTag = getCurrentPartialTag(textareaElement);
        if (partialTag.length <= 0){
            this.autocompleteUI.hide();
        }
    }

    handleFocus(event) {
        
    }

    handleBlur(event) {
        if (!settingValues._hideWhenOutofFocus) return;

        // Need a slight delay because clicking the autocomplete list causes blur
        setTimeout(() => {
            if (!this.autocompleteUI.element.contains(document.activeElement)) {
                this.autocompleteUI.hide();
            }
        }, 150);
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     * @returns 
     */
    handleKeyDown(event) {
        if (!settingValues.enabled) return;

        const textareaElement = event.target;

        // Handle autocomplete navigation
        if (this.autocompleteUI && this.autocompleteUI.isVisible()) {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.autocompleteUI.navigate(1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.autocompleteUI.navigate(-1);
                    break;
                case 'Enter':
                case 'Tab':
                    if (this.autocompleteUI.getSelectedTag() !== null) {
                        event.preventDefault();
                        insertTagToTextArea(textareaElement, this.autocompleteUI.getSelectedTag());
                    }
                    this.autocompleteUI.hide();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.autocompleteUI.hide();
                    break;
            }
        }        
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     * @returns 
     */
    handleKeyUp(event){
        if (!settingValues.enabled) return;
        
        if (this.autocompleteUI.isVisible()) {
			switch (event.key) {
				case "Escape":
					event.preventDefault();
					this.autocompleteUI.hide();
					break;
			}
		} else if (event.key.length > 1 && event.key != "Delete" && event.key != "Backspace") {
			return;
		}

        if (!event.defaultPrevented) {
            this.autocompleteUI.updateDisplay(event.target);
        }
    }

    /**
     * 
     * @param {MouseEvent} event 
     * @returns 
     */
    handleMouseMove(event) {
    }

    /**
     * 
     * @param {MouseEvent} event 
     * @returns 
     */
    handleClick(event) {
    }
}
