// filepath: v:\Programs\StabilityMatrix-win-x64\Data\Packages\ComfyUI-New\custom_nodes\ComfyUI-Autocomplete-Plus\web\js\similar-tags.js
import { settingValues } from './settings.js';

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
        this.header.textContent = `Similar to: ${this.currentTag}`;
        
        if (!similarTags || similarTags.length === 0) {
            const noTags = document.createElement('div');
            noTags.className = 'similar-tags-empty';
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
     * Position is calculated based on the input element and available space.
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
        
        // Get ComfyUI canvas scale if available
        const scale = window.app?.canvas?.ds?.scale ?? 1.0;
        
        // Make element briefly visible for measurement but not actually showing
        this.element.style.visibility = 'hidden';
        this.element.style.display = 'block';
        const elemRect = this.element.getBoundingClientRect();
        this.element.style.display = 'none';
        this.element.style.visibility = 'visible';
        
        // Calculate dimensions
        const elemWidth = elemRect.width;
        const elemHeight = elemRect.height;
        
        // Set initial position to be to the right of the textarea
        let left = inputRect.right + 10;
        let top = inputRect.top;
        
        // Check if we have enough space to the right
        const rightSpace = viewportWidth - left;
        if (rightSpace < elemWidth) {
            // Not enough space to the right, try placing it to the left
            left = inputRect.left - elemWidth - 10;
            
            // If still not enough space, place it below the textarea
            if (left < 0) {
                left = inputRect.left;
                top = inputRect.bottom + 10;
                
                // If not enough space below either, place it above
                const bottomSpace = viewportHeight - top;
                if (bottomSpace < elemHeight) {
                    top = inputRect.top - elemHeight - 10;
                    
                    // If still not enough space, just center it on screen
                    if (top < 0) {
                        left = Math.max(10, (viewportWidth - elemWidth) / 2);
                        top = Math.max(10, (viewportHeight - elemHeight) / 2);
                    }
                }
            }
        }
        
        // Ensure the element stays within viewport
        left = Math.max(10, Math.min(viewportWidth - elemWidth - 10, left));
        top = Math.max(10, Math.min(viewportHeight - elemHeight - 10, top));
        
        // Update element position
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        
        // Set max dimensions to ensure scrolling if content is too large
        const maxHeight = viewportHeight - top - 20;
        this.element.style.maxHeight = `${maxHeight}px`;
        this.element.style.maxWidth = '300px';
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
function calculateJaccardSimilarity(tagA, tagB, cooccurrenceMap, tagMap) {
    // Get the count of tagA and tagB individually
    const countA = tagMap.get(tagA)?.count || 0;
    const countB = tagMap.get(tagB)?.count || 0;
    
    if (countA === 0 || countB === 0) return 0;
    
    // Get the cooccurrence count
    const cooccurrenceAB = cooccurrenceMap.get(tagA)?.get(tagB) || 0;
    
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
export function findSimilarTags(tag, cooccurrenceMap, tagMap) {
    if (!tag || !cooccurrenceMap.has(tag)) {
        return [];
    }
    
    const cooccurrences = cooccurrenceMap.get(tag);
    const similarTags = [];
    
    // Convert to array for sorting
    cooccurrences.forEach((count, coTag) => {
        // Skip the tag itself
        if (coTag === tag) return;
        
        // Get tag data
        const tagData = tagMap.get(coTag);
        if (!tagData) return;
        
        // Calculate similarity
        const similarity = calculateJaccardSimilarity(tag, coTag, cooccurrenceMap, tagMap);
        
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
 * @param {HTMLTextAreaElement} inputElement The textarea element
 * @returns {string|null} The tag at cursor or null
 */
export function getCurrentTag(inputElement) {
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;
    
    // Find boundaries (commas or start/end of text)
    let startPos = text.lastIndexOf(',', cursorPos - 1);
    startPos = startPos === -1 ? 0 : startPos + 1;
    
    let endPos = text.indexOf(',', cursorPos);
    endPos = endPos === -1 ? text.length : endPos;
    
    // Extract and trim the tag
    const tag = text.substring(startPos, endPos).trim();
    
    // If no tag found, return null
    if (!tag) return null;
    
    // Convert space-separated tag to underscore-separated format
    // This is important for matching with the database and finding similar tags
    const normalizedTag = tag.replace(/\s+/g, '_').replace(/\\\(/g, '(').replace(/\\\)/g, ')')
   
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

    // Prepare the tag to be inserted (escape parentheses, replace underscores)
    const actualTag = tagToInsert
        .replace(/_/g, " ")
        .replace(/\\\(/g, "\\\\(") // Escape backslashes before parentheses first
        .replace(/\\\)/g, "\\\\)")
        .replace(/\(/g, "\\(") // Escape opening parenthesis
        .replace(/\)/g, "\\)"); // Escape closing parenthesis


    // Text before the insertion point (end of the current tag)
    const textBefore = text.substring(0, effectiveEndPos);

    // Text after the insertion point
    const textAfter = text.substring(effectiveEndPos);

    // Standard separator (comma + space)
    const separator = ', ';

    // Construct the new value: keep existing tag, add separator and new tag
    const newValue = textBefore + separator + actualTag + textAfter;

    // Set the new value
    inputElement.value = newValue;

    // Set cursor position after the newly inserted tag and separator
    const newCursorPos = textBefore.length + separator.length + actualTag.length;
    inputElement.selectionStart = inputElement.selectionEnd = newCursorPos;

    // Trigger input event to notify ComfyUI about the change
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- Main Exports ---

// Create a singleton instance
const similarTagsUI = new SimilarTagsUI();

/**
 * Shows similar tags for the tag at the current cursor position.
 * @param {HTMLTextAreaElement} inputElement The textarea element
 * @param {string} tag The tag to find similarities for
 * @param {Array<{tag: string, similarity: number, count: number, alias?: string[]}>} similarTags List of similar tags
 */
export function showSimilarTags(inputElement, tag, similarTags) {
    similarTagsUI.show(inputElement, tag, similarTags);
}

/**
 * Hides the similar tags UI.
 */
export function hideSimilarTags() {
    similarTagsUI.hide();
}

/**
 * Checks if the similar tags UI is currently visible.
 * @returns {boolean} True if visible
 */
export function isSimilarTagsVisible() {
    return similarTagsUI.isVisible();
}