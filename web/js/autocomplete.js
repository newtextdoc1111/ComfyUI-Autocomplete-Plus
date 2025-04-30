
// --- Autocomplete UI Class ---

export class AutocompleteUI {
    constructor() {
        this.element = document.createElement('div');
        this.element.id = 'autocomplete-plus-list';
        this.element.style.display = 'none'; // Initially hidden
        this.element.style.position = 'absolute'; // Position near the input
        this.element.style.zIndex = '10000'; // Ensure it's on top
        this.activeInput = null;
        this.selectedIndex = -1;
        this.candidates = [];

        document.body.appendChild(this.element);

        // Add event listener for clicks on items
        this.element.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'DIV') {
                const index = parseInt(e.target.dataset.index, 10);
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
     * Position calculation logic inspired by:
     * https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/common/autocomplete.js
     * License: MIT License (assumed based on repository root LICENSE file)
     * Considers ComfyUI canvas scale.
     * Adjusts max-height and enables scrolling if the list exceeds viewport bounds.
     * @param {HTMLTextAreaElement} inputElement The textarea being typed into.
     */
    #show(inputElement) {
        this.activeInput = inputElement;
        this.selectedIndex = 0;

        // Calculate caret position using the helper function (returns viewport-relative coordinates)
        this.#updateCoordinate();

        this.element.style.overflowY = 'auto';
        this.element.style.display = 'block'; // Make it visible
        
        // Highlight the first item
        this.#highlightItem(this.selectedIndex);
    }

    #updateCoordinate() {
        const { top: caretTop, left: caretLeft, lineHeight: caretLineHeight } = this.#getCaretCoordinates(this.activeInput);

        // Reset scroll position and max-height before calculating position
        this.element.scrollTop = 0;
        this.element.style.maxHeight = ''; // Reset max-height for accurate measurement


        // Get ComfyUI canvas scale if available, otherwise default to 1
        const scale = window.app?.canvas?.ds?.scale ?? 1.0;

        // Initial desired position: below the current text line where the caret is.
        let topPosition = caretTop + (caretLineHeight * scale);
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
        this.element.innerHTML = ''; // Clear previous items
        if (candidates.length === 0) {
            this.#hide();
            return;
        }

        candidates.forEach((candidate, index) => {
            const item = document.createElement('div');
            item.classList.add('autocomplete-plus-item');
            item.dataset.index = index;
            // Display tag and count (alias if matched by alias)
            item.textContent = `${candidate.tag} (${candidate.count})${candidate.alias ? ` [${candidate.alias}]` : ''}`;
            item.style.padding = '4px 8px';
            item.style.cursor = 'pointer';
            this.element.appendChild(item);
        });
    }

    /** Highlights the item at the given index */
    #highlightItem() {
        const items = this.element.children;
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
