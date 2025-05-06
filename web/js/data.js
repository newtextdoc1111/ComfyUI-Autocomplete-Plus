// Constants
export const TagCategory = [
    'general',
    'artist',
    'unused',
    'copyright',
    'character',
    'meta',
]

// Data storage

class AutoCompleteData {
    tagsLoaded = false;
    tagMap = new Map();
    aliasMap = new Map();
    sortedTags = [];

    cooccurrenceLoaded = false;
    cooccurrenceMap = new Map();
}

export const autoCompleteData = new AutoCompleteData();

// --- Data Loading Functions ---

/**
 * Loads and processes tag data from the CSV file.
 */
async function loadTags(rootPath) {
    const startTime = performance.now(); // 処理開始時間を記録
    const url = rootPath + 'data/danbooru_tags.csv';
    try {
        const response = await fetch(url); //TODO: ignore browser cache
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text(); // Get raw CSV text
        const lines = csvText.split('\n').filter(line => line.trim().length > 0);

        // Skip header row if present (tag,alias,count)
        const startIndex = lines[0].startsWith('tag,alias,category,count') ? 1 : 0;

        const parsedData = [];

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];

            // Handle CSV parsing properly (consider quotes and commas in values)
            const columns = parseCSVLine(line);

            if (columns.length >= 3) {
                const tag = columns[0].trim();
                const aliasStr = columns[1].trim();
                const category = columns[2].trim();
                const count = parseInt(columns[3].trim(), 10);

                // Skip invalid entries
                if (!tag || isNaN(count)) continue;

                // Parse aliases - might be comma-separated list inside quotes
                const aliases = aliasStr ? aliasStr.split(',').map(a => a.trim()).filter(a => a.length > 0) : [];

                parsedData.push({
                    tag,
                    alias: aliases,
                    category,
                    count
                });
            }
        }

        // Sort by count in descending order
        parsedData.sort((a, b) => b.count - a.count);
        autoCompleteData.sortedTags = parsedData;

        // Build maps as before
        autoCompleteData.sortedTags.forEach(tagData => {
            autoCompleteData.tagMap.set(tagData.tag, tagData);
            if (autoCompleteData.alias && Array.isArray(autoCompleteData.alias)) {
                autoCompleteData.alias.forEach(alias => {
                    if (!autoCompleteData.aliasMap.has(alias)) {
                        autoCompleteData.aliasMap.set(alias, autoCompleteData.tag); // Map alias back to the main tag
                    }
                });
            }
        });

        autoCompleteData.tagsLoaded = true;
        // 処理終了時間を記録し、パフォーマンスログを出力
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`[Autocomplete-Plus] Processed ${autoCompleteData.sortedTags.length} tags from CSV in ${duration.toFixed(2)}ms.`);

    } catch (error) {
        console.error(`[Autocomplete-Plus] Failed to fetch or process tags from ${url}:`, error);
        autoCompleteData.tagsLoaded = false;
    }
}

/**
 * Loads and processes cooccurrence data from the CSV file using chunked processing.
 */
async function loadCooccurrence(rootPath) {
    const url = rootPath + 'data/danbooru_tags_cooccurrence.csv';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim().length > 0);

        // Skip header row if present (tag_a,tag_b,count)
        const startIndex = lines[0].startsWith('tag_a,tag_b,count') ? 1 : 0;

        // Create a new Map to store the bidirectional relationships
        const bidirectionalMap = new Map();

        // Process CSV data in chunks
        await processInChunks(lines, startIndex, bidirectionalMap);

        // Assign the bidirectional map to the cooccurrenceMap
        let actualPairCount = 0;
        let primaryTagCount = 0;
        autoCompleteData.cooccurrenceMap.clear();

        for (const [tag, relatedTags] of bidirectionalMap) {
            autoCompleteData.cooccurrenceMap.set(tag, relatedTags);
            actualPairCount += relatedTags.size;
            primaryTagCount++;
        }

        autoCompleteData.cooccurrenceLoaded = true;
        console.log(`[Autocomplete-Plus] Processed bidirectional relationships for ${primaryTagCount} tags from CSV.`);

    } catch (error) {
        console.error(`[Autocomplete-Plus] Failed to fetch or process cooccurrence data from ${url}:`, error);
        autoCompleteData.cooccurrenceLoaded = false;
    }
}

/**
 * Process CSV data in chunks to avoid blocking the UI
 */
function processInChunks(lines, startIndex, bidirectionalMap) {
    return new Promise((resolve) => {
        const CHUNK_SIZE = 10000; // Process 10,000 lines at a time
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

                    // Skip invalid entries
                    if (!tagA || !tagB || isNaN(count)) continue;

                    // Add tagA -> tagB relationship
                    if (!bidirectionalMap.has(tagA)) {
                        bidirectionalMap.set(tagA, new Map());
                    }
                    bidirectionalMap.get(tagA).set(tagB, count);

                    // Add tagB -> tagA relationship (bidirectional)
                    if (!bidirectionalMap.has(tagB)) {
                        bidirectionalMap.set(tagB, new Map());
                    }
                    bidirectionalMap.get(tagB).set(tagA, count);

                    pairCount++;
                }
            }

            if (i < lines.length) {
                // Report progress
                const progress = Math.round((i / lines.length) * 100);
                if (progress % 10 === 0) {
                    console.log(`[Autocomplete-Plus] Processing: ${progress}% complete (${pairCount} pairs processed)`);
                }

                // Schedule next chunk with setTimeout to allow UI updates
                setTimeout(processChunk, 0);
            } else {
                console.log(`[Autocomplete-Plus] Finished processing ${pairCount} one-way cooccurrence pairs`);
                resolve();
            }
        }

        // Start processing the first chunk
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
                // Escaped quote (double quote inside quotes)
                current += '"';
                i++; // Skip the next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of column
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    // Don't forget to add the last column
    result.push(current);

    return result;
}

export function loadAllData(rootPath) {
    return Promise.all([
        loadTags(rootPath),
        loadCooccurrence(rootPath)
    ]).catch(error => {
        console.error("[Autocomplete-Plus] Error loading data:", error);
    });
}
