import { TagCategory, TagData, TagSource, autoCompleteData } from './data.js';
import { settingValues } from './settings.js';
import {
    extractTagsFromTextArea,
    findAllTagPositions,
    getCurrentTagRange,
    getScrollbarWidth,
    getViewportMargin,
    isLongText,
    isValidTag,
    normalizeTagToInsert,
    normalizeTagToSearch,
} from './utils.js';

// --- RelatedTags Logic ---

/**
 * Calculates the Jaccard similarity between two tags.
 * Jaccard similarity = (A ∩ B) / (A ∪ B) = (A ∩ B) / (|A| + |B| - |A ∩ B|)
 * @param {string} tagSource The name of the site (e.g., 'danbooru', 'e621')
 * @param {string} tagA The first tag
 * @param {string} tagB The second tag
 * @returns {number} Similarity score between 0 and 1
 */
function calculateJaccardSimilarity(tagSource, tagA, tagB) {
    // Get the count of tagA and tagB individually
    const countA = autoCompleteData[tagSource].tagMap.get(tagA)?.count || 0;
    const countB = autoCompleteData[tagSource].tagMap.get(tagB)?.count || 0;

    if (countA === 0 || countB === 0) return 0;

    // Get the cooccurrence count
    const cooccurrenceAB = autoCompleteData[tagSource].cooccurrenceMap.get(tagA)?.get(tagB) || 0;

    // Calculate Jaccard similarity
    // (A ∩ B) / (A ∪ B) = (A ∩ B) / (|A| + |B| - |A ∩ B|)
    const intersection = cooccurrenceAB;
    const union = countA + countB - cooccurrenceAB;

    return union > 0 ? intersection / union : 0;
}

/**
 * Extracts the tag at the current cursor position.
 * Utilizes getCurrentTagRange to properly handle tags with weights and parentheses.
 * @param {HTMLTextAreaElement} inputElement The textarea element
 * @returns {string|null} The tag at cursor or null
 */
export function getTagFromCursorPosition(inputElement) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Use getCurrentTagRange to get the tag at the cursor position
    const tagRange = getCurrentTagRange(text, cursorPos);

    // If no tag was found at the cursor position
    if (!tagRange) return null;

    // Return the normalized tag for searching
    return normalizeTagToSearch(tagRange.tag);
}

/**
 * Finds related tags for a given tag.
 * @param {string} tag The tag to find related tags for
 */
function searchRelatedTags(tag) {
    const startTime = performance.now(); // Record start time for performance measurement

    const tagSource = TagSource.Danbooru; // TODO: Leave the tag source as Danbooru until e621_tags_cooccurrence.csv is ready

    if (!tag || !autoCompleteData[tagSource].initialized || !autoCompleteData[tagSource].cooccurrenceMap.has(tag)) {
        return [];
    }

    const cooccurrences = autoCompleteData[tagSource].cooccurrenceMap.get(tag);
    const relatedTags = [];

    // Convert to array for sorting
    cooccurrences.forEach((count, coTag) => {
        // Skip the tag itself
        if (coTag === tag) return;

        // Get tag data
        const tagData = autoCompleteData[tagSource].tagMap.get(coTag);
        if (!tagData) return;

        // Calculate similarity
        const similarity = calculateJaccardSimilarity(tagSource, tag, coTag);

        relatedTags.push({
            tag: coTag,
            similarity: similarity,
            alias: tagData.alias,
            category: tagData.category,
            source: tagData.source,
            count: tagData.count,
        });
    });

    // Sort by similarity (highest first)
    relatedTags.sort((a, b) => b.similarity - a.similarity);

    // Limit to max number of suggestions
    const result = relatedTags.slice(0, settingValues.maxRelatedTags);

    if (settingValues._logprocessingTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.debug(`[Autocomplete-Plus] Find tags to related "${tag}" took ${duration.toFixed(2)}ms.`);
    }

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

    // First check if the tag exists anywhere in the textarea and select it if found
    const tagPositions = findAllTagPositions(text);
    for (const { start, end, tag } of tagPositions) {
        const existingTag = tag.trim();
        if (existingTag === normalizeTagToInsert(tagToInsert)) {
            // Tag already exists, select it and exit
            inputElement.focus();
            inputElement.setSelectionRange(start, end);
            return;
        }
    }

    // Find the current tag boundaries
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    const lastNewLine = text.lastIndexOf('\n', cursorPos - 1);
    const lastSeparator = Math.max(lastComma, lastNewLine);
    const startPos = lastSeparator === -1 ? 0 : lastSeparator + 1;

    // Find the end of the current tag
    let endPosComma = text.indexOf(',', startPos);
    let endPosNewline = text.indexOf('\n', startPos);

    if (endPosComma === -1) endPosComma = text.length;
    if (endPosNewline === -1) endPosNewline = text.length;

    const endPos = Math.min(endPosComma, endPosNewline);

    const prefix = startPos != endPos ? ', ' : ' ';
    // Prepare the text to insert
    const normalizedTag = normalizeTagToInsert(tagToInsert);
    let textToInsert = prefix + normalizedTag;

    // --- Use execCommand for Undo support ---
    // 1. Select the range where the tag will be inserted
    inputElement.focus();
    inputElement.setSelectionRange(endPos, endPos);

    // 2. Execute the insertText command to add the tag
    const insertTextSuccess = document.execCommand('insertText', false, textToInsert);

    // Fallback for browsers where execCommand might not be supported or might fail
    if (!insertTextSuccess) {
        console.warn('[Autocomplete-Plus] execCommand("insertText") failed. Falling back to direct value manipulation (Undo might not work).');

        const textBefore = text.substring(0, endPos);
        const textAfter = text.substring(endPos);

        // Insert the tag directly into the value
        inputElement.value = textBefore + textToInsert + textAfter;

        // Set cursor position after the newly inserted tag
        const newCursorPos = endPos + textToInsert.length;
        inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;

        // Trigger input event to notify ComfyUI about the change
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
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
        this.root.id = 'related-tags-root';

        // Create header row
        this.header = document.createElement('div');
        this.header.id = 'related-tags-header';

        this.headerTextContainer = document.createElement('div');
        this.headerTextContainer.className = 'related-tags-header-text-container';
        this.header.appendChild(this.headerTextContainer);

        // Create header text div for the left side
        this.headerText = document.createElement('div');
        this.headerText.className = 'related-tags-header-tag-text';
        this.headerText.textContent = 'Related Tags';
        this.headerTextContainer.appendChild(this.headerText);

        // Create header alias div for the 2nd line
        this.headerAlias = document.createElement('div');
        this.headerAlias.className = 'related-tags-header-tag-alias';
        this.headerTextContainer.appendChild(this.headerAlias);

        // Create header controls for the right side
        this.headerControls = document.createElement('div');
        this.headerControls.className = 'related-tags-header-controls';

        // Create layout toggle button
        this.toggleLayoutBtn = document.createElement('button');
        this.toggleLayoutBtn.className = 'related-tags-layout-toggle';
        this.toggleLayoutBtn.title = 'Toggle between vertical and horizontal layout';

        // Add click handler for layout toggle
        this.toggleLayoutBtn.addEventListener('click', (e) => {
            // Toggle the layout setting
            settingValues.relatedTagsDisplayPosition =
                settingValues.relatedTagsDisplayPosition === 'vertical'
                    ? 'horizontal'
                    : 'vertical';

            this.#updateHeader();
            this.#updatePosition();
            this.root.style.display = 'block';

            // Prevent default behavior
            e.preventDefault();
            e.stopPropagation();
        });
        this.headerControls.appendChild(this.toggleLayoutBtn);

        // Create pin button
        this.isPinned = false;
        this.pinBtn = document.createElement('button');
        this.pinBtn.className = 'related-tags-pin-toggle';

        this.pinBtn.addEventListener('click', (e) => {
            this.isPinned = !this.isPinned;
            this.pinBtn.classList.toggle('active', this.isPinned); // For styling
            this.#updateHeader();

            // Prevent default behavior
            e.preventDefault();
            e.stopPropagation();
        });
        this.headerControls.appendChild(this.pinBtn);

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
    show(textareaElement) {
        if (!settingValues.enableRelatedTags) {
            this.hide();
            return;
        }

        // Get the tag at current cursor position
        const currentTag = getTagFromCursorPosition(textareaElement);

        if (!this.isPinned) {
            if (!isLongText(currentTag) && isValidTag(currentTag)) {
                this.currentTag = currentTag
            } else {
                this.hide();
                return;
            }
        }

        this.target = textareaElement;

        this.relatedTags = searchRelatedTags(this.currentTag);
        if (this.selectedIndex == -1) {
            this.selectedIndex = 0; // Reset selection to the first item
        }

        this.#updateHeader();
        this.#updateContent();
        this.#updatePosition();

        // Make visible
        this.root.style.display = 'block';

        // This function must be called after the content is updated and the root is displayed.
        this.#highlightItem();

        // Update initialization status if not already done
        if (!autoCompleteData[TagSource.Danbooru].initialized) {
            if (this.autoRefreshTimerId) {
                clearTimeout(this.autoRefreshTimerId);
            }
            this.autoRefreshTimerId = setTimeout(() => {
                this.#refresh();
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
        // Reset pinned state when hiding, unless hide was called by escape key while pinned
        if (document.activeElement !== this.pinBtn) { // Avoid unpinning if pin button was just clicked to hide
            this.isPinned = false;
            this.pinBtn.classList.remove('active');
        }
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
     * Refresh the displayed content
     */
    #refresh() {
        if (this.target) {
            this.show(this.target);
        }
    }

    /**
     * Updates header content
     */
    #updateHeader() {
        // Find the tag data for the current tag
        let tagData = Object.values(TagSource)
            .map((source) => {
                if (source in autoCompleteData && autoCompleteData[source].tagMap.has(this.currentTag)) {
                    return autoCompleteData[source].tagMap.get(this.currentTag);
                }
            })
            .find((tagData) => tagData !== undefined);

        if (!tagData) {
            // Create a dummy TagData if not found
            tagData = new TagData(this.currentTag, null, 0, [], TagSource.Danbooru);
        }

        const categoryText = TagCategory[tagData.source][tagData.category] || "unknown";
        const aliasText = tagData.alias.join(', ');

        // Update header text with current tag
        this.headerText.innerHTML = ''; // Clear previous content
        this.headerText.textContent = 'Tags related to: ';

        const tagName = document.createElement('span');
        tagName.classList.add('related-tags-header-tag-name', tagData.source);
        tagName.title = `Count: ${tagData.count}\nCategory: ${categoryText}\nAlias: ${aliasText}`;
        tagName.dataset.tagCategory = categoryText;
        if (tagData.source && ['left', 'right'].includes(settingValues.tagSourceIconPosition)) {
            const tagSourceIconHtml = `<svg class="autocomplete-plus-tag-icon-svg"><use xlink:href="#autocomplete-plus-icon-${tagData.source}"></use></svg>`;
            tagName.innerHTML = settingValues.tagSourceIconPosition == 'left'
                ? `${tagSourceIconHtml} ${tagData.tag}`
                : `${tagData.tag} ${tagSourceIconHtml}`;
        } else {
            tagName.textContent += tagData.tag;
        }


        this.headerText.appendChild(tagName);

        // Clear previous alias
        this.headerAlias.style.display = 'none';
        this.headerAlias.innerHTML = '';

        // Add alias if available
        if (aliasText.length > 0 && !settingValues.hideAlias) {
            this.headerAlias.textContent = aliasText;
            this.headerAlias.style.display = 'block';
        }

        // Update pin button
        this.pinBtn.textContent = this.isPinned ? '🎯' : '📌';

        // Update the button icon
        this.toggleLayoutBtn.innerHTML = settingValues.relatedTagsDisplayPosition === 'vertical'
            ? '↔️' // Click to change display horizontally
            : '↕️'; // Click to change display vertically
    }

    /**
     * Updates the content of the related tags panel with the provided tags.
     */
    #updateContent() {
        this.tagsContainer.innerHTML = '';

        if (!autoCompleteData[TagSource.Danbooru].initialized) {
            // Show loading message
            const messageDiv = document.createElement('div');
            messageDiv.className = 'related-tags-message';
            messageDiv.textContent = `Initializing cooccurrence data... [${autoCompleteData[TagSource.Danbooru].baseLoadingProgress.cooccurrence}%]`;
            this.tagsContainer.appendChild(messageDiv);
            return;
        }

        if (!this.relatedTags || this.relatedTags.length === 0) {
            // Show no related tags message
            const messageDiv = document.createElement('div');
            messageDiv.className = 'related-tags-message';
            messageDiv.textContent = 'No related tags found';
            this.tagsContainer.appendChild(messageDiv);
            return;
        }

        // Toggle column class based on settings
        this.tagsContainer.classList.toggle('no-alias', settingValues.hideAlias);

        const existingTags = extractTagsFromTextArea(this.target);

        // Create tag rows
        this.relatedTags.forEach(tagData => {
            const isExisting = existingTags.includes(tagData.tag);
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
        const categoryText = TagCategory[tagData.source][tagData.category] || "unknown";
        const aliasText = tagData.alias.join(', ');

        const tagRow = document.createElement('div');
        tagRow.classList.add('related-tag-item', tagData.source);
        tagRow.dataset.tag = tagData.tag;
        tagRow.dataset.tagCategory = categoryText;

        // Tag name
        const tagName = document.createElement('span');
        tagName.className = 'related-tag-name';
        tagName.textContent = tagData.tag;

        // grayout tag name if it already exists
        if (isExisting) {
            tagName.classList.add('related-tag-already-exists');
        }

        // Alias
        const alias = document.createElement('span');
        alias.className = 'related-tag-alias';

        // Display alias if available
        if (aliasText.length > 0) {
            alias.textContent = `${aliasText}`;
            alias.title = aliasText; // Full alias on hover
        }

        // Similarity
        const similarity = document.createElement('span');
        similarity.className = 'related-tag-similarity';
        similarity.textContent = `${(tagData.similarity * 100).toFixed(2)}%`;

        // Create tooltip with more info
        let tooltipText = `Similarity: ${(tagData.similarity * 100).toFixed(2)}%\nCount: ${tagData.count}\nCategory: ${categoryText}`;
        if (aliasText.length > 0) {
            tooltipText += `\nAlias: ${aliasText}`;
        }
        tagRow.title = tooltipText;

        // Add cells to row
        tagRow.appendChild(tagName);

        if (!settingValues.hideAlias) {
            tagRow.appendChild(alias);
        }

        tagRow.appendChild(similarity);

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
        this.root.style.display = 'block';
        this.root.style.maxWidth = '';
        this.tagsContainer.style.maxHeight = '';
        const rootRect = this.root.getBoundingClientRect();

        // Get the optimal placement area
        const placementArea = this.#getOptimalPlacementArea(rootRect.width, rootRect.height);

        // Apply position and size
        this.root.style.left = `${placementArea.x}px`;
        this.root.style.top = `${placementArea.y}px`;
        this.root.style.maxWidth = `${placementArea.width}px`;

        const newHeaderRect = this.header.getBoundingClientRect();

        if (this.relatedTags.length > 0) {
            this.tagsContainer.style.maxHeight = `${placementArea.height - newHeaderRect.height}px`;
        }

        // Hide it again after measurement
        this.root.style.display = 'none';
        this.root.style.visibility = 'visible';
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

        // Hide the panel after selection, unless pinned
        if (!this.isPinned) {
            this.hide();
        } else {
            this.#highlightItem();
        }
    }

    insertSelectedTag() {
        const selectedTag = this.getSelectedTag();
        if (selectedTag) {
            this.#insertTag(selectedTag);
        }
    }

    /**
     * Calculates the optimal placement area for the panel based on available space.
     * @param {number} elemWidth - Width of the panel element.
     * @param {number} elemHeight - Height of the panel element.
     * @returns {{ x: number, y: number, width: number, height: number }} The calculated placement area.
     */
    #getOptimalPlacementArea(elemWidth, elemHeight) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = getViewportMargin();
        const targetRect = this.target.getBoundingClientRect();

        // Find optimal max width baesd on viewport and textarea element
        const maxWidth = Math.max(
            Math.min(targetRect.right, viewportWidth - margin.right) - targetRect.left,
            (viewportWidth - margin.left - margin.right) / 2
        );

        const area = {
            x: Math.max(targetRect.x, margin.left),
            y: Math.max(targetRect.y, margin.top),
            width: Math.min(elemWidth, maxWidth),
            height: Math.min(elemHeight, viewportHeight - margin.top - margin.bottom)
        };

        if (settingValues.relatedTagsDisplayPosition === 'vertical') {
            // Vertical placement
            const topSpace = targetRect.top - margin.top;
            const bottomSpace = viewportHeight - targetRect.bottom - margin.bottom;
            if (topSpace > bottomSpace) {
                // Place above
                area.height = Math.min(area.height, topSpace);
                area.y = Math.max(targetRect.y - area.height, margin.top);
            } else {
                // Place below
                area.height = Math.min(area.height, bottomSpace);
                area.y = targetRect.bottom;
            }

            // Calculate width considering scrollbar width if vertical scrolling is needed
            const scrollbarWidth = area.height < elemHeight ? getScrollbarWidth() : 0;
            area.width = Math.min(elemWidth + scrollbarWidth, maxWidth);

            // Adjust x position to avoid overflow
            area.x = Math.min(area.x, viewportWidth - area.width - margin.right);
        } else {
            // Horizontal placement
            const leftSpace = targetRect.x - margin.left;
            const rightSpace = viewportWidth - targetRect.right - margin.right;
            if (leftSpace > rightSpace) {
                // Place left
                area.width = Math.min(area.width, leftSpace);
                area.x = Math.max(targetRect.x - area.width, margin.left);
            } else {
                // Place right
                area.width = Math.min(area.width, rightSpace);
                area.x = targetRect.right;
            }

            // Calculate width considering scrollbar width if vertical scrolling is needed
            const scrollbarWidth = area.height < elemHeight ? getScrollbarWidth() : 0;
            area.width = Math.min(area.width + scrollbarWidth, viewportWidth - margin.left - margin.right);

            // Adjust y position to avoid overflow
            area.y = Math.min(area.y, viewportHeight - area.height - margin.bottom);
        }

        return area;
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
            if (this.relatedTagsUI.isVisible() && !this.relatedTagsUI.isPinned) {
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

        // Need a slight delay because clicking the related tags list causes blur
        setTimeout(() => {
            if (!this.relatedTagsUI.root.contains(document.activeElement) && !this.relatedTagsUI.isPinned) {
                this.relatedTagsUI.hide();
            }
        }, 150);
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    handleKeyDown(event) {
        // If related tags UI is pinned, don't handle key events except for Escape
        if (this.relatedTagsUI.isPinned) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.relatedTagsUI.hide();
            }
            return;
        }

        // Handle key events for related tags UI
        if (this.relatedTagsUI.isVisible()) {
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
                        event.preventDefault(); // Prevent Tab from changing focus
                        this.relatedTagsUI.insertSelectedTag();
                    } else if (!this.relatedTagsUI.isPinned) { // If nothing selected and not pinned, hide the panel
                        this.relatedTagsUI.hide();
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.relatedTagsUI.hide();
                    break;
            }
        }

        // Show related tags on Ctrl+Shift+Space
        if (settingValues.enableRelatedTags) {
            if (event.key === ' ' && event.ctrlKey && event.shiftKey) {
                event.preventDefault();
                this.relatedTagsUI.show(event.target);
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
        // Hide related tags UI if not Ctrl+Click and not pinned when trigger mode is 'ctrl+Click'
        if (settingValues.relatedTagsTriggerMode === 'ctrl+Click' && !event.ctrlKey && !this.relatedTagsUI.isPinned) {
            this.relatedTagsUI.hide();
            return;
        }

        const textareaElement = event.target;
        this.relatedTagsUI.show(textareaElement);
    }
}