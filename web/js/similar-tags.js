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
        this.root = document.createElement('div');
        this.root.id = 'similar-tags-container';

        // Create header row
        this.header = document.createElement('div');
        this.header.id = 'similar-tags-header';
        this.header.textContent = 'Similar Tags';
        this.root.appendChild(this.header);

        // Create a tbody for the tags
        this.tagsContainer = document.createElement('ul');
        this.tagsContainer.id = 'similar-tags-list';
        this.root.appendChild(this.tagsContainer);

        // Add to DOM
        document.body.appendChild(this.root);

        // Track the active input and current tag
        this.activeInput = null;
        this.currentTag = null;

        // Add click handler for tag selection
        this.tagsContainer.addEventListener('mousedown', (e) => {
            const row = e.target.closest('.similar-tag-item');
            if (row && row.dataset.tag) {
                this.selectTag(row.dataset.tag);
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
        this.root.style.display = 'block';
    }

    /**
     * Hides the similar tags UI.
     */
    hide() {
        this.root.style.display = 'none';
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
        this.header.innerHTML = ''; // Clear previous content
        this.header.textContent = 'Similar Tags: ';
        const tagNameSpan = document.createElement('span');
        tagNameSpan.className = 'similar-tags-header-tag-name';
        tagNameSpan.textContent = this.currentTag;
        this.header.appendChild(tagNameSpan);

        if (!autoCompleteData.cooccurrenceLoaded) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'similar-tags-loading-message';
            messageDiv.textContent = 'Initializing cooccurrence data...';
            this.tagsContainer.appendChild(messageDiv);
            return;
        }

        if (!similarTags || similarTags.length === 0) {
            const messageCell = document.createElement('div');
            messageCell.textContent = 'No similar tags found';
            this.tagsContainer.appendChild(messageCell);
            return;
        }

        // Create tag rows
        similarTags.forEach(tagData => {
            const tagRow = this.createTagElement(tagData);
            this.tagsContainer.appendChild(tagRow);
        });
    }

    /**
     * Creates an HTML table row for a similar tag.
     * @param {{tag: string, similarity: number, count: number, alias?: string[]}} tagData
     * @returns {HTMLTableRowElement} The tag row element
     */
    createTagElement(tagData) {
        const tagRow = document.createElement('li');
        tagRow.className = 'similar-tag-item';
        tagRow.dataset.tag = tagData.tag;
        tagRow.style.cursor = 'pointer';

        // Tag name cell
        const tagNameCell = document.createElement('span');
        tagNameCell.className = 'similar-tag-name';
        tagNameCell.textContent = tagData.tag;

        // Alias cell (middle column)
        const aliasCell = document.createElement('span');
        aliasCell.className = 'similar-tag-alias';
        
        // Display alias if available
        if (tagData.alias && tagData.alias.length > 0) {
            let aliasText = tagData.alias.join(', ');
            aliasCell.textContent = aliasText;
            aliasCell.title = tagData.alias.join(', '); // Full alias on hover
        }

        // Similarity cell
        const similarityCell = document.createElement('span');
        similarityCell.className = 'similar-tag-similarity';
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
        tagRow.appendChild(similarityCell);

        return tagRow;
    }

    /**
     * Updates the position of the similar tags panel.
     * Position is calculated based on the input element, available space,
     * and the setting `similarTagsDisplayPosition`.
     * @param {HTMLElement} inputElement The input element to position
     */
    updatePosition(inputElement) {
        // Reset position for accurate measurement
        this.root.style.maxHeight = '';
        this.root.style.maxWidth = '';

        // Get the bounds of the input element
        const inputRect = inputElement.getBoundingClientRect();

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const mergin = 10;

        // Get ComfyUI canvas scale if available
        const scale = window.app?.canvas?.ds?.scale ?? 1.0; // Note: scale is not currently used in positioning logic

        // Make element briefly visible for measurement but not actually showing
        this.root.style.visibility = 'hidden';
        this.root.style.display = 'block';
        const elemRect = this.root.getBoundingClientRect();
        this.root.style.display = 'none';
        this.root.style.visibility = 'visible';

        let [left, top] = [0, 0];

        // Determine initial position based on setting
        if (settingValues.similarTagsDisplayPosition === 'vertical') {
            // --- Vertical Positioning ---
            // Calculate available space above and below the input
            const spaceAbove = inputRect.top;
            const spaceBelow = viewportHeight - inputRect.bottom;
            
            // Determine if we should place above or below based on which has more space
            const placeAbove = spaceAbove > spaceBelow;
            
            if (placeAbove) {
                // Place above the input with appropriate margin
                top = inputRect.top - elemRect.height - mergin;
                // Adjust max height to not exceed available space
                this.root.style.maxHeight = `${spaceAbove - (mergin * 2)}px`;
            } else {
                // Place below the input with appropriate margin
                top = inputRect.bottom + mergin;
                // Adjust max height to not exceed available space
                this.root.style.maxHeight = `${spaceBelow - (mergin * 2)}px`;
            }

            // Ensure horizontal alignment within viewport if placed vertically
            left = Math.max(mergin, Math.min(viewportWidth - elemRect.width - mergin, left));
            // Align left edge with input where possible
            left = inputRect.left;

        } else {
            // --- Horizontal Positioning (Default) ---
            // Initial position: to the right of the textarea
            left = inputRect.right + mergin;
            top = inputRect.top;

            // Check if we have enough space to the right
            const rightSpace = viewportWidth - left;
            if (rightSpace < elemRect.width && left > viewportWidth / 2) { // Only move left if it fits better
                // Not enough space to the right, try placing it to the left
                left = inputRect.left - elemRect.width - mergin;
            }

            // Fallback to vertical if horizontal doesn't fit well (e.g., goes off left)
            if (left < 0) {
                left = inputRect.left;
                top = inputRect.bottom + mergin;
                const bottomSpace = viewportHeight - top;
                if (bottomSpace < elemRect.height) {
                    top = inputRect.top - elemRect.height - mergin;
                }
            }
            // Ensure vertical alignment within viewport if placed horizontally
            top = Math.max(mergin, Math.min(viewportHeight - elemRect.height - mergin, top));
        }

        // Ensure the element stays within viewport (final check for both cases)
        // left = Math.max(mergin, Math.min(viewportWidth - elw - mergin, left));
        // top = Math.max(mergin, Math.min(viewportHeight - elemHeight - mergin, top));

        // Update element position
        this.root.style.left = `${left}px`;
        this.root.style.top = `${top}px`;

        // Set max dimensions to ensure scrolling if content is too large
        // Adjust max height based on final top position
        const maxHeight = viewportHeight - top - 20;
        this.root.style.maxHeight = `${maxHeight}px`;
        // Adjust max width based on final left position (less critical usually)
        const maxWidth = Math.min(elemRect.width, viewportWidth - left - 20); 
        this.root.style.maxWidth = `${maxWidth}px`;
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
        return this.root.style.display !== 'none';
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
        // Use setTimeout to delay hiding. This allows clicks on the similar tags UI
        // to be processed before the UI is hidden.
        setTimeout(() => {
            // Check if the new focused element is part of the similar tags UI.
            // document.activeElement refers to the currently focused element.
            const activeElement = document.activeElement;
            const similarTagsElement = similarTagsUI.root;

            // If the focus is not within the similar tags UI, hide it.
            if (similarTagsUI && !similarTagsElement.contains(activeElement)) {
                // similarTagsUI.hide();
            }
        }, 150); // Delay in milliseconds (adjust if necessary)
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