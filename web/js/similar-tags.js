// filepath: v:\Programs\StabilityMatrix-win-x64\Data\Packages\ComfyUI-New\custom_nodes\ComfyUI-Autocomplete-Plus\web\js\similar-tags.js
import { settingValues } from './settings.js';
import { autoCompleteData } from './data.js';
import {
    normalizeTagToSearch,
    normalizeTagToInsert
} from './utils.js';

// --- SimilarTags UI Class ---

/**
 * Class that manages the UI for displaying similar tags.
 * Shows a panel with tags similar to the current tag under cursor.
 */
class SimilarTagsUI {
    constructor() {
        // Create the main container
        this.element = document.createElement('div');
        this.element.id = 'similar-tags-container';
        this.element.style.display = 'none'; // Initially hidden
        this.element.style.position = 'absolute';
        this.element.style.zIndex = '10000';

        // Header with title
        this.header = document.createElement('div');
        this.header.id = 'similar-tags-header';
        this.header.textContent = 'Similar Tags';
        this.element.appendChild(this.header);

        // Container for tags list
        this.tagsContainer = document.createElement('div');
        this.tagsContainer.id = 'similar-tags-list';
        this.element.appendChild(this.tagsContainer);

        // Add to DOM
        document.body.appendChild(this.element);

        // Track the active input and current tag
        this.activeInput = null;
        this.currentTag = null;

        // Add click handler for tag selection
        this.tagsContainer.addEventListener('click', (e) => {
            const tagElement = e.target.closest('.similar-tag-item');
            if (tagElement && tagElement.dataset.tag) {
                this.selectTag(tagElement.dataset.tag);
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    /**
     * Shows the similar tags UI for a specific tag and text input element.
     * @param {HTMLTextAreaElement} inputElement The textarea being used
     * @param {string} tag The tag to find similarities for
     * @param {Array<{tag: string, similarity: number, count: number, alias?: string[]}>} similarTags List of similar tags
     */
    show(inputElement, tag, similarTags) {
        if (!settingValues.enableSimilarTags) {
            this.hide();
            return;
        }

        this.activeInput = inputElement;
        this.currentTag = tag;

        // Update content (even if there are no similar tags, we'll show a message)
        this.updateContent(similarTags);

        // Calculate and update position
        this.updatePosition(inputElement);

        // Make visible
        this.element.style.display = 'block';
    }

    /**
     * Hides the similar tags UI.
     */
    hide() {
        this.element.style.display = 'none';
        this.activeInput = null;
        this.currentTag = null;
        this.tagsContainer.innerHTML = '';
    }

    /**
     * Updates the content of the similar tags panel with the provided tags.
     * @param {Array<{tag: string, similarity: number, count: number, alias?: string[]}>} similarTags
     */
    updateContent(similarTags) {
        this.tagsContainer.innerHTML = '';

        // Update header with current tag
        this.header.innerHTML = '';
        const tagName = document.createElement('span');
        tagName.textContent = this.currentTag;
        this.header.appendChild(tagName);

        if(!autoCompleteData.cooccurrenceLoaded){
            const noTags = document.createElement('div');
            // noTags.className = 'similar-tags-empty';
            noTags.textContent = 'Initializing cooccurrence data...';
            this.tagsContainer.appendChild(noTags);
            return;
        }

        if (!similarTags || similarTags.length === 0) {
            const noTags = document.createElement('div');
            // noTags.className = 'similar-tags-empty';
            noTags.textContent = 'No similar tags found';
            this.tagsContainer.appendChild(noTags);
            return;
        }

        // Create tag items
        similarTags.forEach(tagData => {
            const tagElement = this.createTagElement(tagData);
            this.tagsContainer.appendChild(tagElement);
        });
    }

    /**
     * Creates an HTML element for a similar tag.
     * @param {{tag: string, similarity: number, count: number, alias?: string[]}} tagData
     * @returns {HTMLElement} The tag element
     */
    createTagElement(tagData) {
        const tagElement = document.createElement('div');
        tagElement.className = 'similar-tag-item';
        tagElement.dataset.tag = tagData.tag;

        // Tag name
        const tagName = document.createElement('span');
        tagName.className = 'similar-tag-name';
        tagName.textContent = tagData.tag;
        tagElement.appendChild(tagName);

        // Tag similarity (as percentage)
        const similarity = document.createElement('span');
        similarity.className = 'similar-tag-similarity';
        similarity.textContent = `${(tagData.similarity * 100).toFixed(2)}%`;
        tagElement.appendChild(similarity);

        // Create tooltip with more info
        let tooltipText = `Tag: ${tagData.tag}\nSimilarity: ${tagData.similarity}\nCount: ${tagData.count}`;
        if (tagData.alias && tagData.alias.length > 0) {
            tooltipText += `\nAlias: ${tagData.alias.join(', ')}`;
        }
        tagElement.title = tooltipText;

        return tagElement;
    }

    /**
     * Updates the position of the similar tags panel.
     * Position is calculated based on the input element, available space,
     * and the setting `similarTagsDisplayPosition`.
     * @param {HTMLElement} inputElement
     */
    updatePosition(inputElement) {

        // Reset position for accurate measurement
        this.element.style.maxHeight = '';
        this.element.style.maxWidth = '';

        // Get the bounds of the input element
        const inputRect = inputElement.getBoundingClientRect();

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const mergin = 10; // Margin around the element

        // Get ComfyUI canvas scale if available
        const scale = window.app?.canvas?.ds?.scale ?? 1.0; // Note: scale is not currently used in positioning logic

        // Make element briefly visible for measurement but not actually showing
        this.element.style.visibility = 'hidden';
        this.element.style.display = 'block';
        const elemRect = this.element.getBoundingClientRect();
        this.element.style.display = 'none';
        this.element.style.visibility = 'visible';

        // Calculate dimensions
        const elemWidth = elemRect.width;
        const elemHeight = elemRect.height;

        let left, top;

        // Determine initial position based on setting
        if (settingValues.similarTagsDisplayPosition === 'vertical') {
            // --- Vertical Positioning ---
            // Initial position: below the textarea
            left = inputRect.left;
            top = inputRect.bottom + mergin;

            // Check if enough space below
            const bottomSpace = viewportHeight - top;
            if (bottomSpace < elemHeight && top > viewportHeight / 2) { // Only move above if it fits better
                // Not enough space below, try placing it above
                top = inputRect.top - elemHeight - mergin;
            }

            // Fallback to horizontal if vertical doesn't fit well (e.g., goes off top)
            if (top < 0) {
                left = inputRect.right + mergin;
                top = inputRect.top;
                const rightSpace = viewportWidth - left;
                if (rightSpace < elemWidth) {
                    left = inputRect.left - elemWidth - mergin;
                }
            }
             // Ensure horizontal alignment within viewport if placed vertically
            left = Math.max(mergin, Math.min(viewportWidth - elemWidth - mergin, left));

        } else {
            // --- Horizontal Positioning (Default) ---
            // Initial position: to the right of the textarea
            left = inputRect.right + mergin;
            top = inputRect.top;

            // Check if we have enough space to the right
            const rightSpace = viewportWidth - left;
            if (rightSpace < elemWidth && left > viewportWidth / 2) { // Only move left if it fits better
                // Not enough space to the right, try placing it to the left
                left = inputRect.left - elemWidth - mergin;
            }

            // Fallback to vertical if horizontal doesn't fit well (e.g., goes off left)
            if (left < 0) {
                left = inputRect.left;
                top = inputRect.bottom + mergin;
                const bottomSpace = viewportHeight - top;
                if (bottomSpace < elemHeight) {
                    top = inputRect.top - elemHeight - mergin;
                }
            }
            // Ensure vertical alignment within viewport if placed horizontally
            top = Math.max(mergin, Math.min(viewportHeight - elemHeight - mergin, top));
        }


        // Ensure the element stays within viewport (final check for both cases)
        left = Math.max(mergin, Math.min(viewportWidth - elemWidth - mergin, left));
        top = Math.max(mergin, Math.min(viewportHeight - elemHeight - mergin, top));

        // Update element position
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;

        // Set max dimensions to ensure scrolling if content is too large
        // Adjust max height based on final top position
        const maxHeight = viewportHeight - top - 20;
        this.element.style.maxHeight = `${maxHeight}px`;
        // Adjust max width based on final left position (less critical usually)
        const maxWidth = Math.min(300, viewportWidth - left - 20); // Example: limit width and ensure it fits
        this.element.style.maxWidth = `${maxWidth}px`;
    }

    /**
     * Handles the selection of a similar tag.
     * Inserts the tag into the active input.
     * @param {string} tag 
     */
    selectTag(tag) {
        if (!this.activeInput) return;

        // Use the same insertTag function from autocomplete.js
        insertTag(this.activeInput, tag);

        // Hide the panel after selection
        this.hide();
    }

    /**
     * Checks if the similar tags UI is currently visible.
     * @returns {boolean}
     */
    isVisible() {
        return this.element.style.display !== 'none';
    }
}

// --- Helper Functions ---

/**
 * Calculates the Jaccard similarity between two tags.
 * Jaccard similarity = (A ∩ B) / (A ∪ B) = (A ∩ B) / (|A| + |B| - |A ∩ B|)
 * @param {string} tagA The first tag
 * @param {string} tagB The second tag
 * @param {Map<string, Map<string, number>>} cooccurrenceMap The cooccurrence data
 * @param {Map<string, {tag: string, count: number}>} tagMap The tag data map
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
 * Finds similar tags for a given tag.
 * @param {string} tag The tag to find similar tags for
 * @param {Map<string, Map<string, number>>} cooccurrenceMap Map of cooccurrence data
 * @param {Map<string, {tag: string, count: number, alias?: string[]}>} tagMap Map of tag data
 * @returns {Array<{tag: string, similarity: number, count: number, alias?: string[]}>}
 */
function findSimilarTags(tag) {
    if (!tag || !autoCompleteData.cooccurrenceMap.has(tag)) {
        return [];
    }

    const cooccurrences = autoCompleteData.cooccurrenceMap.get(tag);
    const similarTags = [];

    // Convert to array for sorting
    cooccurrences.forEach((count, coTag) => {
        // Skip the tag itself
        if (coTag === tag) return;

        // Get tag data
        const tagData = autoCompleteData.tagMap.get(coTag);
        if (!tagData) return;

        // Calculate similarity
        const similarity = calculateJaccardSimilarity(tag, coTag);

        similarTags.push({
            tag: coTag,
            similarity: similarity,
            count: tagData.count,
            alias: tagData.alias
        });
    });

    // Sort by similarity (highest first)
    similarTags.sort((a, b) => b.similarity - a.similarity);

    // Limit to max number of suggestions
    return similarTags.slice(0, settingValues.maxSimilarTags);
}

/**
 * Extracts the tag at the current cursor position.
 * Handles tags separated by commas or newlines.
 * @param {HTMLTextAreaElement} inputElement The textarea element
 * @returns {string|null} The tag at cursor or null
 */
function getCurrentTag(inputElement) {
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
    const normalizedTag = normalizeTagToSearch(tag);

    return normalizedTag;
}

/**
 * Function to insert a tag into the textarea.
 * Appends the selected tag after the current tag.
 * @param {HTMLTextAreaElement} inputElement
 * @param {string} tagToInsert
 */
function insertTag(inputElement, tagToInsert) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Find the boundaries of the current tag the cursor is in or near
    let startPos = text.lastIndexOf(',', cursorPos - 1);
    startPos = startPos === -1 ? 0 : startPos + 1;

    let endPos = text.indexOf(',', cursorPos);
    endPos = endPos === -1 ? text.length : endPos;

    // Find the end of the word/tag at the cursor position, even if there's no comma after it
    // This helps find the true end of the tag we want to append after
    // Search for the next comma, newline, or end of string after the start position
    let potentialEndComma = text.indexOf(',', startPos);
    let potentialEndNewline = text.indexOf('\n', startPos);

    if (potentialEndComma === -1) potentialEndComma = text.length;
    if (potentialEndNewline === -1) potentialEndNewline = text.length;

    let currentTagEndPos = Math.min(potentialEndComma, potentialEndNewline);

    // Ensure the end position is not before the cursor if the cursor is within the tag
    currentTagEndPos = Math.max(cursorPos, currentTagEndPos);

    // Find the actual end of the tag by trimming trailing whitespace before the determined end position
    // Adjust endPos based on the actual content boundary, not just separators
    let boundarySearchStart = startPos;
    let firstSeparatorAfterStart = text.substring(boundarySearchStart).search(/[,\n]/);
    if (firstSeparatorAfterStart !== -1) {
        currentTagEndPos = boundarySearchStart + firstSeparatorAfterStart;
    } else {
        currentTagEndPos = text.length; // If no separator found, tag goes to the end
    }

    // Trim trailing spaces from the identified tag segment to find the precise end
    let effectiveEndPos = currentTagEndPos;
    while (effectiveEndPos > startPos && /\s/.test(text[effectiveEndPos - 1])) {
        effectiveEndPos--;
    }

    const normalizedTag = normalizeTagToInsert(tagToInsert);

    // Text before the insertion point (end of the current tag)
    const textBefore = text.substring(0, effectiveEndPos);

    // Text after the insertion point
    const textAfter = text.substring(effectiveEndPos);

    // Standard separator (comma + space)
    const separator = ', ';

    // Construct the new value: keep existing tag, add separator and new tag
    const newValue = textBefore + separator + normalizedTag + textAfter;

    // Set the new value
    inputElement.value = newValue;

    // Set cursor position after the newly inserted tag and separator
    const newCursorPos = textBefore.length + separator.length + normalizedTag.length;
    inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;

    // Trigger input event to notify ComfyUI about the change
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- Main Exports ---

// Create a singleton instance
const similarTagsUI = new SimilarTagsUI();

// Helper function to show similar tags based on cursor position
function showSimilarTagsForCurrentPosition(textareaElement) {
    // Get the tag at current cursor position
    const currentTag = getCurrentTag(textareaElement);

    // If no valid tag or tag is too short, hide the panel
    if (!currentTag || currentTag.length < 2) {
        similarTagsUI.hide();
        return;
    }

    // Find similar tags
    const similarTagsResults = findSimilarTags(currentTag);

    // Always show the panel with current tag, even if there are no similar tags
    similarTagsUI.show(textareaElement, currentTag, similarTagsResults);
}

export class SimilarTagsEventHandler {
    constructor() {

    }

    handleInput(event) {
        if (settingValues.enableSimilarTags && settingValues.similarTagsDisplayMode !== 'hover') {
            if (similarTagsUI && similarTagsUI.isVisible()) {
                similarTagsUI.hide();
            }
        }
    }

    handleFocus(event) {
        // Handle focus event
    }

    handleBlur(event) {
        // Handle blur event
    }

    handleKeyDown(event) {
        const textareaElement = event.target;

        // For similar tags panel, handle Escape key
        if (similarTagsUI && similarTagsUI.isVisible()) {
            if (event.key === 'Escape') {
                event.preventDefault();
                similarTagsUI.hide();
            }
        }
        
        // Show similar tags on Ctrl+Space
        if (settingValues.enableSimilarTags) {
            if (event.key === ' ' && event.ctrlKey) {
                event.preventDefault();
                showSimilarTagsForCurrentPosition(textareaElement);
            }
        }
    }

    handleMouseMove(event) {
        if (!settingValues.enabled || !settingValues.enableSimilarTags ||
            settingValues.similarTagsDisplayMode !== 'hover') return;

        const textareaElement = event.target;

        // Throttle the mousemove event to avoid too many calculations
        if (!textareaElement.dataset.lastMoveTime ||
            Date.now() - textareaElement.dataset.lastMoveTime > 200) {

            textareaElement.dataset.lastMoveTime = Date.now();
            showSimilarTagsForCurrentPosition(textareaElement);
        }
    }

    handleClick(event) {
        const textareaElement = event.target;
        showSimilarTagsForCurrentPosition(textareaElement);
    }
}

export function initializeSimilarTags() {

}