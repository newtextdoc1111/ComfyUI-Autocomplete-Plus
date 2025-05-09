// --- Constants ---

import { settingValues } from "./settings.js";

// Tag categories for display
export const TagCategory = [
    'general',
    'artist',
    'unused',
    'copyright',
    'character',
    'meta',
]

/**
 * Class representing a tag and its metadata
 */
export class TagData {
    /**
     * Create a tag data object
     * @param {string} tag - The tag name
     * @param {string[]} [alias=[]] - Array of aliases for the tag
     * @param {string} [category='general'] - Category of the tag
     * @param {number} [count=0] - Frequency count/popularity of the tag
     */
    constructor(tag, alias = [], category = 'general', count = 0) {
        /** @type {string} */
        this.tag = tag;
        
        /** @type {string[]} */
        this.alias = alias;
        
        /** @type {string} */
        this.category = category;
        
        /** @type {number} */
        this.count = count;
    }

    /**
     * Get display label for the tag
     * @returns {string} Formatted tag label
     */
    getLabel() {
        return `${this.tag} (${this.count})`;
    }

    /**
     * Check if this tag matches a search query
     * @param {string} query - The search query
     * @returns {boolean} True if this tag or any of its aliases match the query
     */
    matches(query) {
        if (!query) return false;
        
        const lowerQuery = query.toLowerCase();
        if (this.tag.toLowerCase().includes(lowerQuery)) return true;
        
        return this.alias.some(a => a.toLowerCase().includes(lowerQuery));
    }
}

// Data storage
export const autoCompleteData = {
    /** @type {TagData[]} */
    sortedTags: [],

    /** @type {Map<string, TagData>} */
    tagMap: new Map(), // Stores tag data, mapping tag names to TagData objects
    /** @type {Map<string, TagData>} */
    aliasMap: new Map(), // Maps aliases to their main tag names
    
    /** @type {Map<string, Map<string, number>>} */
    cooccurrenceMap: new Map(), // Stores co-occurrence data for related tags
    
    isInitializing: false,
    initialized: false,

     // Progress of "base" csv loading
    baseLoadingProgress: {
        // tags: 0, // Commented out because tags csv aren't loaded in chunks
        cooccurrence: 0
    }
};

// --- Data Loading Functions ---

/**
 * Loads tag data from a single CSV file.
 * @param {string} csvUrl - The URL of the CSV file to load.
 * @returns {Promise<void>}
 */
async function loadTags(csvUrl) {
    try {
        const response = await fetch(csvUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim().length > 0);
        const totalLines = lines.length;

        const startIndex = lines[0].startsWith('tag,alias,category,count') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const columns = parseCSVLine(line);

            if (columns.length == 4) {
                const tag = columns[0].trim();
                const aliasStr = columns[1].trim();
                const category = columns[2].trim();
                const count = parseInt(columns[3].trim(), 10);

                if (!tag || isNaN(count)) continue;

                // Parse aliases - might be comma-separated list inside quotes
                const aliases = aliasStr ? aliasStr.split(',').map(a => a.trim()).filter(a => a.length > 0) : [];

                // Create a TagData instance instead of a plain object
                const tagData = new TagData(tag, aliases, category, count);
                autoCompleteData.sortedTags.push(tagData);
            }else{
                console.warn(`[Autocomplete-Plus] Invalid CSV format in line ${i + 1} of ${csvUrl}: ${line}`);
                continue;
            }
        }
        
        // Sort by count in descending order
        autoCompleteData.sortedTags.sort((a, b) => b.count - a.count);

        // Build maps as before
        autoCompleteData.sortedTags.forEach(tagData => {
            autoCompleteData.tagMap.set(tagData.tag, tagData);
            if (tagData.alias && Array.isArray(tagData.alias)) {
                tagData.alias.forEach(alias => {
                    if (!autoCompleteData.aliasMap.has(alias)) {
                        autoCompleteData.aliasMap.set(alias, tagData.tag); // Map alias back to the main tag
                    }
                });
            }
        });

    } catch (error) {
        console.error(`[Autocomplete-Plus] Failed to fetch or process tags from ${csvUrl}:`, error);
    }
}

/**
 * Loads co-occurrence data from a single CSV file.
 * @param {string} csvUrl - The URL of the CSV file to load.
 * @returns {Promise<void>}
 */
async function loadCooccurrence(csvUrl) {
    try {
        const response = await fetch(csvUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim().length > 0);

        const startIndex = lines[0].startsWith('tag_a,tag_b,count') ? 1 : 0;

        await processInChunks(lines, startIndex, autoCompleteData.cooccurrenceMap, csvUrl);
    } catch (error) {
        console.error(`[Autocomplete-Plus] Failed to fetch or process cooccurrence data from ${csvUrl}:`, error);
    }
}

/**
 * Process CSV data in chunks to avoid blocking the UI.
 * Modifies the targetMap directly.
 */
function processInChunks(lines, startIndex, targetMap, sourceFileName = "CSV") {
    return new Promise((resolve) => {
        const CHUNK_SIZE = 10000;
        let i = startIndex;
        let pairCount = 0;

        function processChunk() {
            const endIndex = Math.min(i + CHUNK_SIZE, lines.length);

            for (; i < endIndex; i++) {
                const line = lines[i];
                const columns = parseCSVLine(line);

                if (columns.length >= 3) {
                    const tagA = columns[0].trim();
                    const tagB = columns[1].trim();
                    const count = parseInt(columns[2].trim(), 10);

                    if (!tagA || !tagB || isNaN(count)) continue;

                    // Add tagA -> tagB relationship
                    if (!targetMap.has(tagA)) {
                        targetMap.set(tagA, new Map());
                    }
                    targetMap.get(tagA).set(tagB, count);

                    
                    // Add tagB -> tagA relationship (bidirectional)
                    if (!targetMap.has(tagB)) {
                        targetMap.set(tagB, new Map());
                    }
                    targetMap.get(tagB).set(tagA, count);

                    pairCount++;
                }
            }

            if (i < lines.length) {
                autoCompleteData.baseLoadingProgress.cooccurrence = Math.round((i / lines.length) * 100);
                setTimeout(processChunk, 0);
            } else {
                resolve();
            }
        }

        processChunk();
    });
}

/**
 * Parse a CSV line properly, handling quoted values that may contain commas.
 * @param {string} line A single CSV line
 * @returns {string[]} Array of column values
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);

    return result;
}

/**
 * Initializes the autocomplete data by fetching the list of CSV files and loading them.
 * This function is called when the extension is initialized.
 */
export async function initializeData() {
    if (autoCompleteData.isInitializing || autoCompleteData.initialized) {
        return;
    }
    
    const startTime = performance.now();
    autoCompleteData.isInitializing = true;
    // console.log("[Autocomplete-Plus] Initializing autocomplete data...");

    try {
        const response = await fetch('/autocomplete-plus/csv');
        if (!response.ok) {
            throw new Error(`[Autocomplete-Plus] Failed to fetch CSV list: ${response.status} ${response.statusText}`);
        }
        const csvListData = await response.json();

        const extraTagsCount = csvListData.danbooru.extra_tags || 0;
        const extraCooccurrenceCount = csvListData.danbooru.extra_cooccurrence || 0;

        const tagsUrl = '/autocomplete-plus/csv/tags';
        const tagsLoadPromises = csvListData.danbooru.base_tags ? [loadTags(`${tagsUrl}/base`)] : [];

        let currentTagPromise = tagsLoadPromises[0] || Promise.resolve();
        for (let i = 0; i < extraTagsCount; i++) {
            currentTagPromise = currentTagPromise.then(loadTags(`${tagsUrl}/extra/${i}`));
            tagsLoadPromises.push(currentTagPromise);
        }

        const cooccurrenceUrl = '/autocomplete-plus/csv/cooccurrence';
        const cooccurrenceLoadPromises = csvListData.danbooru.base_cooccurrence ? [loadCooccurrence(`${cooccurrenceUrl}/base`)] : [];
       
        let cooccurrencePromiseChain = cooccurrenceLoadPromises[0] || Promise.resolve();
        for (let i = 0; i < extraCooccurrenceCount; i++) {
            cooccurrencePromiseChain = cooccurrencePromiseChain.then(loadCooccurrence(`${cooccurrenceUrl}/extra/${i}`));
            cooccurrenceLoadPromises.push(cooccurrencePromiseChain);
        }

        await Promise.all([
            Promise.all(tagsLoadPromises).then(() => {
                const endTime = performance.now();
                console.log(`[Autocomplete-Plus] Tags loading complete in ${(endTime - startTime).toFixed(2)}ms. Extra file count: ${extraTagsCount}`);

            }),
            Promise.all(cooccurrenceLoadPromises).then(() => {
                const endTime = performance.now();
                console.log(`[Autocomplete-Plus] Co-occurrence loading complete in ${(endTime - startTime).toFixed(2)}ms. Extra file count: ${extraCooccurrenceCount}`);
            })
        ]);

        autoCompleteData.initialized = true;
    } catch (error) {
        console.error("[Autocomplete-Plus] Error initializing autocomplete data:", error);
    } finally {
        autoCompleteData.isInitializing = false;
    }
}
