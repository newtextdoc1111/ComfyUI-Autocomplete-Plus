import {
    TagCategory,
    TagData,
    autoCompleteData,
    getEnabledTagSourceInPriorityOrder
} from './data.js';
import {
    isLongText,
    hiraToKata,
    kataToHira,
    formatCountHumanReadable,
    isContainsLetterOrNumber,
    normalizeTagToInsert,
    normalizeTagToSearch,
    extractTagsFromTextArea,
    getCurrentTagRange,
    getViewportMargin,
    IconSvgHtmlString
} from './utils.js';
import { settingValues } from './settings.js';

// --- Autocomplete Logic ---

/**
 * Checks if a target string matches any of the query variations based on several rules.
 * @param {string} target - The target word to match.
 * @param {Set<string>} queries - Set of query variations.
 * @returns {{matched: boolean, isExactMatch: boolean}}
 */
function matchWord(target, queries) {
    let matched = false;
    let isExactMatch = false;
    for (const variation of queries) {
        if (target === variation) {
            isExactMatch = true;
            matched = true;
            break;
        }
    }

    if (!isExactMatch) {
        for (const variation of queries) {
            const hasWildcardPrefix = variation.startsWith('__');
            if (hasWildcardPrefix) {
                // If variation has wildcard prefix, only attempt a direct partial match. (e.g. "__wildcard__")
                if (target.includes(variation)) {
                    matched = true;
                    break;
                }
            } else if (!isContainsLetterOrNumber(variation)) {
                // If the query variation contains only symbols,
                // match if the target also contains only symbols and includes the variation. (e.g. "^_^", "^^^")
                if (!isContainsLetterOrNumber(target) && target.includes(variation)) {
                    matched = true;
                    break;
                }
            } else {
                // If the query variation contains letters or numbers, attempt a partial match.
                if (target.includes(variation)) {
                    matched = true;
                    break;
                }
                // If direct partial match fails, try matching after removing
                // common symbols from both target and variation.
                else if (target.replace(/[-_\s']/g, '').includes(variation.replace(/[-_\s']/g, ''))) {
                    matched = true;
                    break;
                }
            }
        }
    }

    return { matched, isExactMatch };
}

/**
 * Search tag completion candidates based on the current input and cursor position in the textarea.
 * @param {HTMLTextAreaElement} textareaElement The partial tag input.
 * @returns {Array<TagData>} The list of matching candidates.
 */
function searchCompletionCandidates(textareaElement) {
    const startTime = performance.now(); // Record start time for performance measurement

    const ESCAPE_SEQUENCE = ["#", "/"]; // If the first string is that character, autocomplete will not be displayed.
    const partialTag = getCurrentPartialTag(textareaElement);
    if (!partialTag || partialTag.length <= 0 || 
        ESCAPE_SEQUENCE.some(seq => partialTag.startsWith(seq)) || 
        isLongText(partialTag)) {
        return []; // No valid input for autocomplete
    }

    const exactMatches = [];
    const partialMatches = [];
    const addedTags = new Set();

    // Generate Hiragana/Katakana variations if applicable
    const queryVariations = new Set([partialTag, normalizeTagToSearch(partialTag)]);
    const kataQuery = hiraToKata(partialTag);
    if (kataQuery !== partialTag) {
        queryVariations.add(kataQuery);
    }
    const hiraQuery = kataToHira(partialTag);
    if (hiraQuery !== partialTag) {
        queryVariations.add(hiraQuery);
    }

    const sources = getEnabledTagSourceInPriorityOrder();
    for (const source of sources) {
        if (settingValues.useFastSearch && autoCompleteData[source].flexSearchIndex) {
            const searchResults = autoCompleteData[source].flexSearchIndex.search(partialTag, {
                limit: settingValues.maxSuggestions * autoCompleteData[source].flexSearchLimitMultiplier,
                suggest: false,
                cache: true,
            });

            let result = [];
            result = searchResults.map((index) => {
                return autoCompleteData[source].flexSearchMapping[index];
            });
            result = [...new Set(result)];
            result = result.sort((a, b) => {
                const aTag = autoCompleteData[source].sortedTags[a];
                const bTag = autoCompleteData[source].sortedTags[b];
                if (matchWord(bTag.tag, queryVariations).isExactMatch) {
                    return 999999999999;
                }
                if (matchWord(aTag.tag, queryVariations).isExactMatch) {
                    return -999999999999;
                }
                if (bTag.alias && bTag.alias.some(alias => matchWord(alias, queryVariations).isExactMatch)) {
                    return 999999999999;
                }
                if (aTag.alias && aTag.alias.some(alias => matchWord(alias, queryVariations).isExactMatch)) {
                    return -999999999999;
                }
                return a - b;
            });
            result = result.slice(0, Math.min(result.length, settingValues.maxSuggestions));
            result = result.map((index) => {
                return autoCompleteData[source].sortedTags[index];
            });

            if (settingValues._logprocessingTime) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                console.debug(`[Autocomplete-Plus] Fast Search for "${partialTag}" in ${source} took ${duration.toFixed(2)}ms. Found ${result.length} candidates within ${searchResults.length} searches with aliases.`);
            }
            return result;
        } else {
            // Search in sortedTags (already sorted by count)
            for (const tagData of autoCompleteData[source].sortedTags) {
                let matched = false;
                let isExactMatch = false;
                let matchedAlias = null;

                // Check primary tag against all variations for exact/partial match
                const tagMatch = matchWord(tagData.tag, queryVariations);
                matched = tagMatch.matched;
                isExactMatch = tagMatch.isExactMatch;

                // If primary tag didn't match, check aliases against all variations
                if (!matched && tagData.alias && Array.isArray(tagData.alias) && tagData.alias.length > 0) {
                    for (const alias of tagData.alias) {
                        const lowerAlias = alias.toLowerCase();
                        const aliasMatch = matchWord(lowerAlias, queryVariations);
                        if (aliasMatch.matched) {
                            matched = true;
                            isExactMatch = aliasMatch.isExactMatch;
                            matchedAlias = alias;
                            break;
                        }
                    }
                }

                const tagSetKey = tagData.tag;

                // Add candidate if matched and not already added
                if (matched && !addedTags.has(tagSetKey)) {
                    // Add to exact matches or partial matches based on match type
                    if (isExactMatch) {
                        exactMatches.push(tagData);
                    } else {
                        partialMatches.push(tagData);
                    }

                    addedTags.add(tagSetKey);

                    // Check if we've reached the maximum suggestions limit combining both arrays
                    if (exactMatches.length + partialMatches.length >= settingValues.maxSuggestions) {
                        // Return the combined results, prioritizing exact matches
                        const result = [...exactMatches, ...partialMatches].slice(0, settingValues.maxSuggestions);

                        if (settingValues._logprocessingTime) {
                            const endTime = performance.now();
                            const duration = endTime - startTime;
                            console.debug(`[Autocomplete-Plus] Search for "${partialTag}" took ${duration.toFixed(2)}ms. Found ${result.length} candidates (max reached).`);
                        }

                        return result; // Early exit
                    }
                }
            }
        }
    }

    // Combine results, with exact matches first
    const candidates = [...exactMatches, ...partialMatches];

    if (settingValues._logprocessingTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.debug(`[Autocomplete-Plus] Search for "${partialTag}" took ${duration.toFixed(2)}ms. Found ${candidates.length} candidates.`);
    }

    return candidates;
}

/**
 * Extracts the current tag being typed before the cursor.
 * @param {HTMLTextAreaElement} inputElement
 * @returns {string} The current partial tag.
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

    // Check if the cursor is inside a prompt weight modifier (e.g., :1.2, :.5, :1.)
    const segmentBeforeCursor = text.substring(start, cursorPos);
    const lastColon = segmentBeforeCursor.lastIndexOf(':');
    if (lastColon !== -1) {
        const partAfterColon = segmentBeforeCursor.substring(lastColon + 1);
        const weight = parseFloat(partAfterColon);

        // If weight is a valid number and less than 10, return empty string
        if (weight !== NaN && weight <= 9.9) {
            return "";
        }
    }

    // Get the tag range at the cursor position
    const tagRange = getCurrentTagRange(text, cursorPos);

    // If no tag is found or the cursor is before the start of the tag, return empty string
    if (!tagRange || cursorPos <= tagRange.start) {
        return "";
    }

    // Extract the part of the tag up to the cursor position
    const partial = text.substring(tagRange.start, cursorPos).trimStart();

    return normalizeTagToSearch(partial);
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

    const { start: tagStart, end: tagEnd, tag: currentTag } = getCurrentTagRange(text, cursorPos);
    const replaceStart = Math.min(cursorPos, tagStart);
    let replaceEnd = cursorPos;

    const normalizedTag = normalizeTagToInsert(tagToInsert);

    const currentTagAfterCursor = text.substring(cursorPos, tagEnd).trimEnd();
    if (normalizedTag.lastIndexOf(currentTagAfterCursor) !== -1) {
        replaceEnd = cursorPos + currentTagAfterCursor.length;
    }

    // Add space if the previous separator was a comma and we are not at the beginning
    const needsSpaceBefore = text[replaceStart - 1] === ',';
    const prefix = needsSpaceBefore ? ' ' : '';

    // Standard separator (comma + space)
    const needsSuffixAfter = !",:".includes(text[replaceEnd]); // TODO: If ":" is part of the emoticon, a suffix is ​​required (e.g. ":o")
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
        this.root = document.createElement('div'); // Use table instead of div
        this.root.id = 'autocomplete-plus-root';

        // Create svg icon element as definition
        this.iconSvgDef = document.createElement('div');
        this.iconSvgDef.style.position = 'absolute';
        this.iconSvgDef.style.display = 'none';
        this.iconSvgDef.innerHTML = IconSvgHtmlString;
        this.root.appendChild(this.iconSvgDef);

        this.tagsList = document.createElement('div');
        this.tagsList.id = 'autocomplete-plus-list';
        this.root.appendChild(this.tagsList);

        // Add to DOM
        document.body.appendChild(this.root);

        this.target = null;
        this.selectedIndex = -1;
        this.candidates = [];

        // Add event listener for clicks on items
        this.tagsList.addEventListener('mousedown', (e) => {
            const row = e.target.closest('.autocomplete-plus-item');
            if (row && row.dataset.tag) {
                this.#insertTag(row.dataset.tag);
                e.preventDefault(); // Prevent focus loss from input
                e.stopPropagation();
            }
        });
    }

    /** Checks if the autocomplete list is visible */
    isVisible() {
        return this.root.style.display !== 'none';
    }

    /**
     * Displays the autocomplete list under the given textarea element if there are candidates.
     * @param {HTMLTextAreaElement} textareaElement 
     * @returns 
     */
    updateDisplay(textareaElement) {
        this.candidates = searchCompletionCandidates(textareaElement);
        if (this.candidates.length <= 0) {
            this.hide();
            return;
        }

        this.target = textareaElement;

        if (this.selectedIndex == -1) {
            this.selectedIndex = 0; // Reset selection to the first item
        }

        this.#updateContent();

        // Calculate caret position using the helper function (returns viewport-relative coordinates)
        this.#updatePosition();

        this.root.style.display = 'block'; // Make it visible

        // Highlight the selected item
        // This function must be called after the route has been displayed, in order to scroll the highlighted item into view.
        this.#highlightItem();
    }

    /**
     * hides the autocomplete list.
     */
    hide() {
        this.root.style.display = 'none';
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
        this.tagsList.innerHTML = '';
        if (this.candidates.length === 0) {
            this.hide();
            return;
        }

        const existingTags = extractTagsFromTextArea(this.target);
        const currentTag = getCurrentPartialTag(this.target);

        this.candidates.forEach((tagData) => {
            const isExactMatch = tagData.tag === currentTag && (existingTags.filter(item => item === currentTag).length == 1);
            const isExistingTag = !isExactMatch && existingTags.includes(tagData.tag);
            this.#createTagElement(tagData, isExistingTag);
        });
    }

    /**
     * Creates a tag element for the autocomplete list.
     * @param {TagData} tagData
     * @param {boolean} isExisting
     */
    #createTagElement(tagData, isExisting) {
        const categoryText = TagCategory[tagData.source][tagData.category] || "unknown";

        const tagRow = document.createElement('div');
        tagRow.classList.add('autocomplete-plus-item', tagData.source);
        tagRow.dataset.tag = tagData.tag;
        tagRow.dataset.tagCategory = categoryText;

        // Tag icon and name
        const tagSourceIconHtml = `<svg class="autocomplete-plus-tag-icon-svg"><use xlink:href="#autocomplete-plus-icon-${tagData.source}"></use></svg>`;
        const tagName = document.createElement('span');
        tagName.className = 'autocomplete-plus-tag-name';
        if (settingValues.tagSourceIconPosition == 'hidden') {
            tagName.textContent = tagData.tag;
        } else {
            tagName.innerHTML = settingValues.tagSourceIconPosition == 'left'
                ? `${tagSourceIconHtml} ${tagData.tag}`
                : `${tagData.tag} ${tagSourceIconHtml}`;
        }

        // grayout tag name if it already exists
        if (isExisting) {
            tagName.classList.add('autocomplete-plus-already-exists');
        }

        // Alias
        const alias = document.createElement('span');
        alias.className = 'autocomplete-plus-alias';

        // Display alias if available
        if (tagData.alias && tagData.alias.length > 0) {
            let aliasText = tagData.alias.join(', ');
            alias.textContent = `${aliasText}`;
            alias.title = tagData.alias.join(', '); // Full alias on hover
        }

        // Category
        const category = document.createElement('span');
        category.className = `autocomplete-plus-category`;
        category.textContent = `${categoryText.substring(0, 2)}`;
        category.title = categoryText; // Full category on hover

        // Count
        const tagCount = document.createElement('span');
        tagCount.className = `autocomplete-plus-tag-count`;
        tagCount.textContent = formatCountHumanReadable(tagData.count);

        tagRow.appendChild(tagName);
        tagRow.appendChild(alias);
        tagRow.appendChild(category);
        tagRow.appendChild(tagCount);
        this.tagsList.appendChild(tagRow);
    }

    /**
     * Calculates the position of the autocomplete list based on the caret position in the input element.
     * Position calculation logic inspired by:
     * https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/common/autocomplete.js
     * License: MIT License (assumed based on repository root LICENSE file)
     * Considers ComfyUI canvas scale.
     */
    #updatePosition() {
        // Measure the element size without causing reflow
        this.root.style.visibility = 'hidden';
        this.root.style.display = 'block';
        this.root.style.maxWidth = '';
        this.tagsList.style.maxHeight = '';
        const rootRect = this.root.getBoundingClientRect();
        // Hide it again after measurement
        this.root.style.display = 'none';
        this.root.style.visibility = 'visible';

        // Get ComfyUI canvas scale if available, otherwise default to 1
        const scale = window.app?.canvas?.ds?.scale ?? 1.0;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = getViewportMargin();

        const targetElmOffset = this.#calculateElementOffset(this.target);

        const { top: caretTop, left: caretLeft, lineHeight: caretLineHeight } = this.#getCaretCoordinates(this.target);

        // Initial desired position: below the current text line where the caret is.
        let topPosition = targetElmOffset.top + ((caretTop - targetElmOffset.top) + caretLineHeight) * scale;
        let leftPosition = targetElmOffset.left + (caretLeft - targetElmOffset.left) * scale;;

        const maxWidth = Math.min(rootRect.width, viewportWidth / 2);
        const naturalHeight = rootRect.height;

        //Horizontal Collision Detection and Adjustment
        if (leftPosition + maxWidth > viewportWidth - margin.right) {
            leftPosition = viewportWidth - maxWidth - margin.right;
        }
        if (leftPosition < margin.left) {
            leftPosition = margin.left;
        }

        // Vertical Collision Detection and Adjustment
        const availableSpaceBelow = viewportHeight - topPosition - margin.bottom;
        const availableSpaceAbove = caretTop - margin.top;


        if (naturalHeight <= availableSpaceBelow) {
            // Fits perfectly below the caret
            // topPosition remains as calculated initially
        } else {
            // Doesn't fit below, check if it fits perfectly above
            if (naturalHeight <= availableSpaceAbove) {
                // Fits perfectly above
                topPosition = caretTop - naturalHeight - margin.top;
            } else {
                // Doesn't fit perfectly either below or above, needs scrolling.
                // Choose the position (above or below) that offers more space.
                if (availableSpaceBelow >= availableSpaceAbove) {
                    // Scroll below: topPosition remains as initially calculated
                    this.tagsList.style.maxHeight = `${availableSpaceBelow}px`;
                } else {
                    // Scroll above: Position near the top edge and set max-height
                    topPosition = margin.top;
                    this.tagsList.style.maxHeight = `${availableSpaceAbove}px`;
                }
            }
        }

        // Final check to prevent going off the top edge
        if (topPosition < margin.top) {
            topPosition = margin.top;
            // If pushed down, recalculate max-height if it was set based on top alignment
            if (this.tagsList.style.maxHeight && availableSpaceBelow < availableSpaceAbove) {
                // Recalculate max-height based on space from the top margin
                this.tagsList.style.maxHeight = `${viewportHeight - margin.top - margin.bottom}px`;
            }
        }

        // Apply the calculated position and display the element
        this.root.style.left = `${leftPosition}px`;
        this.root.style.top = `${topPosition}px`;
        this.root.style.maxWidth = `${maxWidth}px`;
    }

    /** Highlights the item (row) at the given index */
    #highlightItem() {
        if (!this.getSelectedTag()) return; // No valid selection

        const items = this.tagsList.children; // Get rows from tbody
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
     * Handles the selection of an item
     * @param {string} selectedTag The tag to insert.
     */
    #insertTag(selectedTag) {
        if (!this.target || !selectedTag || selectedTag.length <= 0) {
            this.hide();
            return;
        }

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

    /**
     * calculates the offset of the given element relative to the viewport.
     * @param {HTMLElement} element
     * @returns {{ top: number, left: number }}
     */
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
        this.keyDownWithModifier = new Map(); // Keep track of keydown events with modifiers
    }

    /**
     * 
     * @param {InputEvent} event 
     * @returns 
     */
    handleInput(event) {
        if (!settingValues.enabled) return;
        if (!event.isTrusted) return; // ignore synthetic events

        const partialTag = getCurrentPartialTag(event.target);
        if (partialTag.length <= 0) {
            this.autocompleteUI.hide();
        }
    }

    handleFocus(event) {

    }

    handleBlur(event) {
        if (!settingValues._hideWhenOutofFocus) return;

        // Need a slight delay because clicking the autocomplete list causes blur
        setTimeout(() => {
            if (!this.autocompleteUI.root.contains(document.activeElement)) {
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

        // Save modifier key (without shiftKey) state when a key is pressed
        this.keyDownWithModifier.set(event.key.toLowerCase(), event.ctrlKey || event.altKey || event.metaKey);

        // Handle autocomplete navigation
        if (this.autocompleteUI.isVisible()) {
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
                    const modifierKeyPressed = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
                    if (!modifierKeyPressed && this.autocompleteUI.getSelectedTag() !== null) {
                        event.preventDefault();
                        insertTagToTextArea(event.target, this.autocompleteUI.getSelectedTag());
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
    handleKeyUp(event) {
        if (!settingValues.enabled) return;

        const key = event.key.toLowerCase();

        // Check if the key was pressed with a modifier
        if (this.keyDownWithModifier.get(key)) {
            this.keyDownWithModifier.delete(key); // Remove the pressed key from the map
            return;
        }

        // Do not process keyup events if Ctrl, Alt, or Meta keys are pressed.
        // This prevents autocomplete from appearing for shortcuts like Ctrl+C, Ctrl+Z, etc.
        // It also handles the release of a modifier key itself if it wasn't part of a character-producing combination.
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        if (this.autocompleteUI.isVisible()) {
            switch (event.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                    event.preventDefault();
                    return; // Prevent redundant display updates

                // For other character keys, Backspace, Delete, we fall through to updateDisplay.
            }
        } else {
            // If UI is not visible, and the key is a non-character key (length > 1)
            // and not Delete or Backspace, then do nothing.
            // This prevents UI from appearing on ArrowUp, F1, Shift (alone), etc.
            if (event.key.length > 1 && !["Delete", "Backspace", "Process"].includes(event.key)) {
                return;
            }
        }

        // If the event was not handled by the above (e.g. Arrow keys, or ignored special keys)
        // and default action is not prevented, update the display.
        // This will typically be for character inputs, Delete, Backspace or IME composition.
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
