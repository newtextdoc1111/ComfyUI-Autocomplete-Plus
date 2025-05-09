// filepath: v:\Programs\StabilityMatrix-win-x64\Data\Packages\ComfyUI-New\custom_nodes\ComfyUI-Autocomplete-Plus\web\js\related-tags.js
import { settingValues } from './settings.js';
import { TagCategory, TagData, autoCompleteData } from './data.js';
import {
    normalizeTagToInsert,
    normalizeTagToSearch,
    isValidTag,
    getViewportMargin
} from './utils.js';

// --- RelatedTags Logic ---

/**
 * Calculates the Jaccard similarity between two tags.
 * Jaccard similarity = (A ∩ B) / (A ∪ B) = (A ∩ B) / (|A| + |B| - |A ∩ B|)
 * @param {string} tagA The first tag
 * @param {string} tagB The second tag
 * @returns {number} Similarity score between 0 and 1
 */
function calculateJaccardSimilarity(tagA, tagB) {
    // Get the count of tagA and tagB individually
    const countA = autoCompleteData.tagMap.get(tagA)?.count || 0;
    const countB = autoCompleteData.tagMap.get(tagB)?.count || 0;

    if (countA === 0 || countB === 0) return 0;

    // Get the cooccurrence count
    const cooccurrenceAB = autoCompleteData.cooccurrenceMap.get(tagA)?.get(tagB) || 0;

    // Calculate Jaccard similarity
    // (A ∩ B) / (A ∪ B) = (A ∩ B) / (|A| + |B| - |A ∩ B|)
    const intersection = cooccurrenceAB;
    const union = countA + countB - cooccurrenceAB;

    return union > 0 ? intersection / union : 0;
}

/**
 * Extracts the tag at the current cursor position.
 * Handles tags separated by commas or newlines.
 * @param {HTMLTextAreaElement} inputElement The textarea element
 * @returns {string|null} The tag at cursor or null
 */
export function getTagFromCursorPosition(inputElement) {
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

/**
 * Finds related tags for a given tag.
 * @param {string} tag The tag to find related tags for
 */
function searchRelatedTags(tag) {
    const startTime = performance.now(); // Record start time for performance measurement

    if (!tag || !autoCompleteData.cooccurrenceMap.has(tag)) {
        return [];
    }

    const cooccurrences = autoCompleteData.cooccurrenceMap.get(tag);
    const relatedTags = [];

    // Convert to array for sorting
    cooccurrences.forEach((count, coTag) => {
        // Skip the tag itself
        if (coTag === tag) return;

        // Get tag data
        const tagData = autoCompleteData.tagMap.get(coTag);
        if (!tagData) return;

        // Calculate similarity
        const similarity = calculateJaccardSimilarity(tag, coTag);

        relatedTags.push({
            tag: coTag,
            similarity: similarity,
            alias: tagData.alias,
            category: tagData.category,
            count: tagData.count,
        });
    });

    // Sort by similarity (highest first)
    relatedTags.sort((a, b) => b.similarity - a.similarity);

    // Limit to max number of suggestions
    const result = relatedTags.slice(0, settingValues.maxRelatedTags);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.debug(`[Related-Tags] Find tags to related "${tag}" took ${duration.toFixed(2)}ms.`);

    return result;
}

/**
 * Function to insert a tag into the textarea.
 * Appends the selected tag after the current tag.
 * Supports undo by using document.execCommand.
 * Checks if the tag already exists in the next position.
 * If the tag already exists anywhere in the input, it selects that tag instead.
 * @param {HTMLTextAreaElement} inputElement
 * @param {string} tagToInsert
 */
function insertTagToTextArea(inputElement, tagToInsert) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Normalize the tag to insert for consistent comparison
    const normalizedTagToInsert = normalizeTagToSearch(tagToInsert);

    // First check if the tag exists anywhere in the textarea and select it if found
    const tagPositions = findAllTagPositions(text);
    for (const { start, end, tag } of tagPositions) {
        const normalizedExistingTag = normalizeTagToSearch(tag.trim());
        if (normalizedExistingTag === normalizedTagToInsert) {
            // Tag already exists, select it and exit
            inputElement.focus();
            inputElement.setSelectionRange(start, end);
            return;
        }
    }

    // Find the current tag boundaries
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    const lastNewline = text.lastIndexOf('\n', cursorPos - 1);
    let startPos = Math.max(lastComma, lastNewline);
    startPos = startPos === -1 ? 0 : startPos + 1;

    // Find the end of the current tag
    let endPosComma = text.indexOf(',', startPos);
    let endPosNewline = text.indexOf('\n', startPos);

    if (endPosComma === -1) endPosComma = text.length;
    if (endPosNewline === -1) endPosNewline = text.length;

    const endPos = Math.min(endPosComma, endPosNewline);

    // Find the start of the next tag (if any)
    let nextTagStartPos = endPos;
    if (nextTagStartPos < text.length) {
        // Skip the separator (comma or newline)
        nextTagStartPos += 1;
    }

    // Find the end of the next tag (if any)
    let nextTagEndPosComma = text.indexOf(',', nextTagStartPos);
    let nextTagEndPosNewline = text.indexOf('\n', nextTagStartPos);

    if (nextTagEndPosComma === -1) nextTagEndPosComma = text.length;
    if (nextTagEndPosNewline === -1) nextTagEndPosNewline = text.length;

    const nextTagEndPos = Math.min(nextTagEndPosComma, nextTagEndPosNewline);

    // Extract the next tag and check if it matches the tag to insert
    if (nextTagStartPos < text.length && nextTagStartPos < nextTagEndPos) {
        const nextTag = text.substring(nextTagStartPos, nextTagEndPos).trim();
        // Check if the next tag is the same as what we want to insert
        if (nextTag && normalizeTagToSearch(nextTag) === normalizedTagToInsert) {
            // The tag already exists as the next tag, so select it and exit
            inputElement.focus();
            inputElement.setSelectionRange(nextTagStartPos, nextTagEndPos);
            return;
        }
    }

    // Set effective insertion position to the end of current tag
    let effectiveEndPos = endPos;

    // Prepare the text to insert
    const normalizedTag = normalizeTagToInsert(tagToInsert);
    let textToInsert = ", " + normalizedTag;

    // --- Use execCommand for Undo support ---
    // 1. Select the range where the tag will be inserted
    inputElement.focus();
    inputElement.setSelectionRange(effectiveEndPos, effectiveEndPos);

    // 2. Execute the insertText command to add the tag
    const insertTextSuccess = document.execCommand('insertText', false, textToInsert);

    // Fallback for browsers where execCommand might not be supported or might fail
    if (!insertTextSuccess) {
        console.warn('[Autocomplete-Plus] execCommand("insertText") failed. Falling back to direct value manipulation (Undo might not work).');

        const textBefore = text.substring(0, effectiveEndPos);
        const textAfter = text.substring(effectiveEndPos);

        // Insert the tag directly into the value
        inputElement.value = textBefore + textToInsert + textAfter;

        // Set cursor position after the newly inserted tag
        const newCursorPos = effectiveEndPos + textToInsert.length;
        inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;

        // Trigger input event to notify ComfyUI about the change
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/**
 * Finds all tag positions in the given text.
 * Searches for tags separated by commas or newlines.
 * @param {string} text The text to search in
 * @returns {Array<{start: number, end: number, tag: string}>} Array of tag positions and content
 */
function findAllTagPositions(text) {
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

// --- RelatedTags UI Class ---

/**
 * Class that manages the UI for displaying related tags.
 * Shows a panel with tags related to the current tag under cursor.
 */
class RelatedTagsUI {
    constructor() {
        // Create the main container
        this.root = document.createElement('div');
        this.root.id = 'related-tags-container';

        // Create header row
        this.header = document.createElement('div');
        this.header.id = 'related-tags-header';

        // Create header text div for the left side
        this.headerText = document.createElement('div');
        this.headerText.className = 'related-tags-header-text';
        this.headerText.textContent = 'Related Tags';
        this.header.appendChild(this.headerText);

        // Create header controls for the right side
        this.headerControls = document.createElement('div');
        this.headerControls.className = 'related-tags-header-controls';

        // Create layout toggle button
        this.toggleLayoutBtn = document.createElement('button');
        this.toggleLayoutBtn.className = 'related-tags-layout-toggle';
        this.toggleLayoutBtn.title = 'Toggle between vertical and horizontal layout';
        this.toggleLayoutBtn.innerHTML = settingValues.relatedTagsDisplayPosition === 'vertical'
            ? '↔️' // Click to change display horizontally
            : '↕️'; // Click to change display vertically

        // Add click handler for layout toggle
        this.toggleLayoutBtn.addEventListener('click', (e) => {
            // Toggle the layout setting
            settingValues.relatedTagsDisplayPosition =
                settingValues.relatedTagsDisplayPosition === 'vertical' ? 'horizontal' : 'vertical';

            // Update the button icon
            this.toggleLayoutBtn.innerHTML = settingValues.relatedTagsDisplayPosition === 'vertical'
                ? '↔️' // Click to change display horizontally
                : '↕️'; // Click to change display vertically

            // Update the panel position
            this.#updatePosition();
            this.root.style.display = 'block';

            // Prevent default behavior
            e.preventDefault();
            e.stopPropagation();
        });

        this.headerControls.appendChild(this.toggleLayoutBtn);
        this.header.appendChild(this.headerControls);

        this.root.appendChild(this.header);

        // Create a tbody for the tags
        this.tagsContainer = document.createElement('div');
        this.tagsContainer.id = 'related-tags-list';
        this.root.appendChild(this.tagsContainer);

        // Add to DOM
        document.body.appendChild(this.root);

        this.target = null;
        this.selectedIndex = -1;
        this.relatedTags = [];

        // Timer ID for auto-refresh
        this.autoRefreshTimerId = null;

        // Add click handler for tag selection
        this.tagsContainer.addEventListener('mousedown', (e) => {
            const row = e.target.closest('.related-tag-item');
            if (row && row.dataset.tag) {
                this.#insertTag(row.dataset.tag);
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    /**
     * Checks if the related tags UI is currently visible.
     * @returns {boolean}
     */
    isVisible() {
        return this.root.style.display !== 'none';
    }

    /**
     * Display
     * @param {HTMLTextAreaElement} textareaElement The textarea being used
     */
    updateDisplay(textareaElement) {
        if (!settingValues.enableRelatedTags) {
            this.hide();
            return;
        }

        // Get the tag at current cursor position
        this.currentTag = normalizeTagToSearch(getTagFromCursorPosition(textareaElement));

        // If no valid tag or tag is too short, hide the panel
        if (!isValidTag(this.currentTag)) {
            this.hide();
            return;
        }

        this.target = textareaElement;

        this.relatedTags = searchRelatedTags(this.currentTag);
        if (this.selectedIndex == -1) {
            this.selectedIndex = 0; // Reset selection to the first item
        }

        // Update content (even if there are no related tags, we'll show a message)
        this.#updateContent();

        this.#updatePosition();

        // Highlight the first item if available
        this.#highlightItem();

        // Make visible
        this.root.style.display = 'block';

        // Update initialization status if not already done
        if (!autoCompleteData.initialized) {
            if (this.autoRefreshTimerId) {
                clearTimeout(this.autoRefreshTimerId);
            }
            const self = this;
            this.autoRefreshTimerId = setTimeout(() => {
                self.updateDisplay(textareaElement);
            }, 500);
        }
    }

    /**
     * Hides the related tags UI.
     */
    hide() {
        if (this.autoRefreshTimerId) {
            clearTimeout(this.autoRefreshTimerId);
        }

        this.root.style.display = 'none';
        this.selectedIndex = -1;
        this.relatedTags = null;
        this.target = null;
    }

    /** Moves the selection up or down */
    navigate(direction) {
        if (this.relatedTags.length === 0) return;
        this.selectedIndex += direction;

        if (this.selectedIndex < 0) {
            this.selectedIndex = this.relatedTags.length - 1; // Wrap around to bottom
        } else if (this.selectedIndex >= this.relatedTags.length) {
            this.selectedIndex = 0; // Wrap around to top
        }
        this.#highlightItem();
    }

    /** Selects the currently highlighted item */
    getSelectedTag() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.relatedTags.length) {
            return this.relatedTags[this.selectedIndex].tag;
        }

        return null; // No valid selection
    }

    /**
     * Updates the content of the related tags panel with the provided tags.
     */
    #updateContent() {
        this.tagsContainer.innerHTML = '';

        // Update header with current tag
        this.headerText.innerHTML = ''; // Clear previous content
        this.headerText.textContent = 'Tags related to: ';
        const tagNameSpan = document.createElement('span');
        tagNameSpan.className = 'related-tags-header-tag-name';
        tagNameSpan.textContent = this.currentTag;
        this.headerText.appendChild(tagNameSpan);

        if (!autoCompleteData.initialized) {
            // Show loading message
            const messageDiv = document.createElement('div');
            messageDiv.className = 'related-tags-loading-message';
            messageDiv.textContent = `Initializing cooccurrence data... [${autoCompleteData.baseLoadingProgress.cooccurrence}%]`;
            this.tagsContainer.appendChild(messageDiv);
            return;
        }

        if (!this.relatedTags || this.relatedTags.length === 0) {
            // Show no related tags message
            const messageCell = document.createElement('div');
            messageCell.textContent = 'No related tags found';
            this.tagsContainer.appendChild(messageCell);
            return;
        }

        const existingTagsInTextarea = this.#extractTagsFromTextArea();

        // Create tag rows
        this.relatedTags.forEach(tagData => {
            const isExisting = existingTagsInTextarea.has(normalizeTagToSearch(tagData.tag));
            const tagRow = this.#createTagElement(tagData, isExisting);
            this.tagsContainer.appendChild(tagRow);
        });
    }

    /**
     * Creates an HTML table row for a related tag.
     * @param {TagData} tagData The tag data to display
     * @param {boolean} isExisting Whether the tag already exists in the textarea
     * @returns {HTMLTableRowElement} The tag row element
     */
    #createTagElement(tagData, isExisting) {
        const categoryText = TagCategory[tagData.category] || "unknown";

        const tagRow = document.createElement('div');
        tagRow.className = 'related-tag-item';
        tagRow.dataset.tag = tagData.tag;
        tagRow.dataset.tagCategory = categoryText;

        // Tag name cell
        const tagNameCell = document.createElement('span');
        tagNameCell.className = 'related-tag-name';
        tagNameCell.textContent = tagData.tag;

        // grayout tag name if it already exists
        if (isExisting) {
            tagNameCell.classList.add('related-tag-already-exists');
        }

        // Alias cell (middle column)
        const aliasCell = document.createElement('span');
        aliasCell.className = 'related-tag-alias';

        // Display alias if available
        if (tagData.alias && tagData.alias.length > 0) {
            let aliasText = tagData.alias.join(', ');
            aliasCell.textContent = `${aliasText}`;
            aliasCell.title = tagData.alias.join(', '); // Full alias on hover
        }

        // Category cell
        const categoryCell = document.createElement('span');
        categoryCell.className = `related-tag-category`;
        categoryCell.textContent = `${categoryText.substring(0, 2)}`;

        // Similarity cell
        const similarityCell = document.createElement('span');
        similarityCell.className = 'related-tag-similarity';
        similarityCell.textContent = `${(tagData.similarity * 100).toFixed(2)}%`;

        // Create tooltip with more info
        let tooltipText = `Tag: ${tagData.tag}\nSimilarity: ${(tagData.similarity * 100).toFixed(2)}%\nCount: ${tagData.count}`;
        if (tagData.alias && tagData.alias.length > 0) {
            tooltipText += `\nAlias: ${tagData.alias.join(', ')}`;
        }
        tagRow.title = tooltipText;

        // Add cells to row
        tagRow.appendChild(tagNameCell);
        tagRow.appendChild(aliasCell);
        tagRow.appendChild(categoryCell);
        tagRow.appendChild(similarityCell);

        return tagRow;
    }

    /**
     * Updates the position of the related tags panel.
     * Position is calculated based on the input element, available space,
     * and the setting `relatedTagsDisplayPosition`.
     * @param {HTMLElement} inputElement The input element to position
     */
    #updatePosition() {
        // Measure the element size without causing reflow
        this.root.style.visibility = 'hidden';
        this.root.style.position = 'absolute'; // Ensure position is absolute for measurement
        this.root.style.display = 'block';
        this.root.style.left = '-9999px';
        this.root.style.top = '-9999px';
        this.root.style.maxWidth = '';
        this.tagsContainer.style.maxHeight = '';
        const elemRect = this.root.getBoundingClientRect();
        const headerRect = this.header.getBoundingClientRect();
        // Hide it again after measurement
        this.root.style.display = 'none';
        this.root.style.visibility = 'visible';
        this.root.style.position = '';
        this.root.style.left = '';
        this.root.style.top = '';


        // Get the optimal placement area
        const placementArea = this.#getOptimalPlacementArea(this.target.getBoundingClientRect(), elemRect.width, elemRect.height);

        // Apply Styles
        this.root.style.left = `${placementArea.x}px`;
        this.root.style.top = `${placementArea.y}px`;
        this.root.style.maxWidth = `${placementArea.width}px`;

        this.tagsContainer.style.maxHeight = `${placementArea.height - headerRect.height}px`;
    }

    /** Highlights the item (row) at the given index */
    #highlightItem() {
        if (this.getSelectedTag() === null) return; // No valid selection

        const items = this.tagsContainer.children; // Get rows
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
     * Handles the selection of a related tag.
     * Inserts the tag into the active input.
     * @param {string} tag
     */
    #insertTag(tag) {
        if (!this.target) return;

        // Use the same insertTag function from autocomplete.js
        insertTagToTextArea(this.target, tag);

        // Hide the panel after selection
        this.hide();
    }

    /**
     * Calculates the optimal placement area for the panel based on available space.
     * @param {DOMRect} inputRect - Bounding rectangle of the input element.
     * @param {number} elemWidth - Width of the panel element.
     * @param {number} elemHeight - Height of the panel element.
     * @returns {{ x: number, y: number, width: number, height: number }} The calculated placement area.
     */
    #getOptimalPlacementArea(inputRect, elemWidth, elemHeight) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let margin = getViewportMargin();

        // Find optimal max width baesd on viewport and input element
        const maxWidth = Math.max(
            Math.min(inputRect.right, viewportWidth - margin.right) - inputRect.left,
            (viewportWidth - margin.left - margin.right) / 2
        );

        const area = {
            x: Math.max(inputRect.x, margin.left),
            y: Math.max(inputRect.y, margin.top),
            width: Math.min(elemWidth, maxWidth),
            height: Math.min(elemHeight, viewportHeight - margin.top - margin.bottom)
        };

        if (settingValues.relatedTagsDisplayPosition === 'vertical') {
            // Vertical placement
            const topSpace = inputRect.top - margin.top;
            const bottomSpace = viewportHeight - inputRect.bottom - margin.bottom;
            if (topSpace > bottomSpace) {
                // Place above
                area.height = Math.min(area.height, topSpace);
                area.y = Math.max(inputRect.y - area.height, margin.top);
            } else {
                // Place below
                area.height = Math.min(area.height, bottomSpace);
                area.y = inputRect.bottom;
            }

            // Adjust x position to avoid overflow
            area.x = Math.min(area.x, viewportWidth - area.width - margin.right);
        } else {
            // Horizontal placement
            const leftSpace = inputRect.x - margin.left;
            const rightSpace = viewportWidth - inputRect.right - margin.right;
            if (leftSpace > rightSpace) {
                // Place left
                area.width = Math.min(area.width, leftSpace);
                area.x = Math.max(inputRect.x - area.width, margin.left);
            } else {
                // Place right
                area.width = Math.min(area.width, rightSpace);
                area.x = inputRect.right;
            }

            // Adjust y position to avoid overflow
            area.y = Math.min(area.y, viewportHeight - area.height - margin.bottom);
        }

        return area;
    }

    /**
     * Extracts existing tags from the textarea.
     * @returns {Set<string>} Set of existing tags in the textarea
     */
    #extractTagsFromTextArea() {
        const existingTagsInTextarea = new Set();
        if (this.target && this.target.value) {
            const tagPositions = findAllTagPositions(this.target.value);
            tagPositions.forEach(pos => {
                existingTagsInTextarea.add(normalizeTagToSearch(pos.tag));
            });
        }
        return existingTagsInTextarea;
    }

}

// --- RelatedTags Event Handling Class ---
export class RelatedTagsEventHandler {
    constructor() {
        // Singleton instance of RelatedTagsUI
        this.relatedTagsUI = new RelatedTagsUI();
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    handleInput(event) {
        if (settingValues.enableRelatedTags) {
            if (this.relatedTagsUI && this.relatedTagsUI.isVisible()) {
                this.relatedTagsUI.hide();
            }
        }
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    handleFocus(event) {
        // Handle focus event
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    handleBlur(event) {
        if (!settingValues._hideWhenOutofFocus) {
            return;
        }

        // Use setTimeout to delay hiding. This allows clicks on the related tags UI
        // to be processed before the UI is hidden.
        setTimeout(() => {
            // Check if the new focused element is part of the related tags UI.
            // document.activeElement refers to the currently focused element.
            const activeElement = document.activeElement;
            const relatedTagsElement = this.relatedTagsUI.root;

            // If the focus is not within the related tags UI, hide it.
            if (this.relatedTagsUI && !relatedTagsElement.contains(activeElement)) {
                this.relatedTagsUI.hide();
            }
        }, 150);
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    handleKeyDown(event) {
        const textareaElement = event.target;

        // For related tags panel, handle Escape key
        if (this.relatedTagsUI && this.relatedTagsUI.isVisible()) {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.relatedTagsUI.navigate(1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.relatedTagsUI.navigate(-1);
                    break;
                case 'Enter':
                case 'Tab':
                    if (this.relatedTagsUI.getSelectedTag() !== null) {
                        event.preventDefault();
                        insertTagToTextArea(textareaElement, this.relatedTagsUI.getSelectedTag());
                    }
                    this.relatedTagsUI.hide();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.relatedTagsUI.hide();
                    break;
            }
        }

        // Show related tags on Ctrl+Space
        if (settingValues.enableRelatedTags) {
            if (event.key === ' ' && event.ctrlKey && event.shiftKey) {
                event.preventDefault();
                this.relatedTagsUI.updateDisplay(textareaElement);
            }
        }
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    handleKeyUp(event) {

    }

    /**
     * 
     * @param {MouseEvent} event 
     * @returns 
     */
    handleMouseMove(event) {

    }

    /**
     * Show related tags based on the current tag under the cursor.
     * @param {MouseEvent} event 
     * @returns 
     */
    handleClick(event) {
        // Check trigger mode from settings
        if (settingValues.relatedTagsTriggerMode === 'ctrl+Click' && !event.ctrlKey) {
            return; // Only respond to Ctrl+Click when in ctrlClick mode
        }

        const textareaElement = event.target;
        this.relatedTagsUI.updateDisplay(textareaElement);
    }
}