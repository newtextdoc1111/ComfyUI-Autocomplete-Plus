import {
    __test__
} from "../../web/js/autocomplete.js";
import {
    TagData,
    TagSource,
    ModelTagSource,
    autoCompleteData
} from "../../web/js/data.js";
import {
    createFlexSearchDocument,
    createFlexSearchDocumentForModel
} from "../../web/js/searchengine.js"

const {
    searchCompletionCandidates,
    sequentialSearch,
    searchWithFlexSearch,
    matchWord,
    getCurrentPartialTag,
    insertTagToTextArea
} = __test__;


// Helper function to create mock textarea element
function createMockTextarea(value, selectionStart, selectionEnd = -1) {
    return {
        value: value,
        selectionStart: selectionStart,
        selectionEnd: selectionEnd > selectionStart ? selectionEnd : selectionStart,
        nodeName: 'TEXTAREA',
        focus() { document.setFocus(this); },
        setSelectionRange: () => { },
        getBoundingClientRect: () => ({
            top: 0,
            left: 0,
            width: 300,
            height: 100
        }),
        scrollTop: 0,
        scrollLeft: 0,
        ownerDocument: {
            defaultView: typeof window !== 'undefined' ? window : {},
            documentElement: typeof document !== 'undefined' ? document.documentElement : {}
        },
        dispatchEvent: () => { }
    };
}

// Test data setup function
function setupTestData() {
    // Clear existing data
    Object.keys(autoCompleteData).forEach(key => delete autoCompleteData[key]);

    // Create mock AutocompleteData structure for each source
    const sources = [...Object.values(TagSource), ...Object.values(ModelTagSource)];

    sources.forEach(source => {
        autoCompleteData[source] = {
            flexSearchDocument: null,
            sortedTags: [],
            tagMap: new Map(),
            aliasMap: new Map(),
            cooccurrenceMap: new Map(),
            isInitializing: false,
            initialized: true,
            baseLoadingProgress: {
                cooccurrence: 0
            }
        };
    });

    // Add sample tag data for testing
    const sampleTags = [
        new TagData('1girl', 0, 1000000, ['one_girl'], TagSource.Danbooru),
        new TagData('blue_hair', 0, 500000, ['blue hair'], TagSource.Danbooru),
        new TagData('long_hair', 0, 800000, [], TagSource.Danbooru),
        new TagData('__wildcard__', 0, 100, [], TagSource.Danbooru),
        new TagData(':d', 0, 50000, [], TagSource.Danbooru),
        new TagData('test_tag', 0, 1000, ['test'], TagSource.E621),
        new TagData('<lora:test_model>', 0, 0, [], ModelTagSource.Lora),
        new TagData('embedding:test_embedding', 0, 0, [], ModelTagSource.Embeddings)
    ];

    // Distribute tags across sources
    sampleTags.forEach(tagData => {
        const source = tagData.source;
        autoCompleteData[source].sortedTags.push(tagData);
        autoCompleteData[source].tagMap.set(tagData.tag, tagData);

        // Add aliases to alias map
        if (tagData.alias && Array.isArray(tagData.alias)) {
            tagData.alias.forEach(alias => {
                autoCompleteData[source].aliasMap.set(alias, tagData.tag);
            });
        }
    });

    // Sort tags and build flexsearch index
    sources.forEach(source => {
        autoCompleteData[source].sortedTags.sort((a, b) => b.count - a.count);

        const isModelSrc = Object.values(ModelTagSource).includes(source);
        const doc = isModelSrc ? createFlexSearchDocumentForModel() : createFlexSearchDocument();
        autoCompleteData[source].sortedTags.forEach((tagData, i) => {
            doc.add(i, tagData);
        });

        autoCompleteData[source].flexSearchDocument = doc;
    });
}

describe('Autocomplete Functions', () => {
    beforeEach(() => {
        setupTestData();

        // Mock global document
        global.document = {
            execCommand: (commandId, showUI, value) => {
                switch (commandId) {
                    case "insertText":
                        if (document.focusedElement) {
                            document.focusedElement.value += value;
                        }
                        break;
                    default:
                        throw new Error('Not implemented!');
                }
            },
            createElement: () => ({
                id: '',
                style: {},
                innerHTML: '',
                appendChild: () => { },
                getBoundingClientRect: () => ({
                    top: 0,
                    left: 0,
                    width: 300,
                    height: 100
                })
            }),
            setFocus: (element) => {
                document.focusedElement = element;
            },
            body: {
                appendChild: () => { },
                removeChild: () => { }
            },
            focusedElement: null
        };

        // Mock global window
        global.window = {
            getComputedStyle: () => ({
                lineHeight: '20px',
                fontSize: '14px',
                fontFamily: 'Arial'
            })
        };
    });

    describe('matchWord', () => {

        test('should match exact queries', () => {
            const queries = new Set(['1girl', '1girls']);
            const result = matchWord('1girl', queries);

            expect(result.matched).toBe(true);
            expect(result.isExactMatch).toBe(true);
        });

        test('should match partial queries', () => {
            const queries = new Set(['girl']);
            const result = matchWord('1girl', queries);

            expect(result.matched).toBe(true);
            expect(result.isExactMatch).toBe(false);
        });

        test('should handle wildcard prefixes', () => {
            const queries = new Set(['__wild']);
            const result = matchWord('__wildcard__', queries);

            expect(result.matched).toBe(true);
            expect(result.isExactMatch).toBe(false);
        });

        test('should handle symbol-only queries', () => {
            const queries = new Set([':d']);
            const result = matchWord(':d', queries);

            expect(result.matched).toBe(true);
            expect(result.isExactMatch).toBe(true);
        });

        test('should match after removing common symbols', () => {
            const queries = new Set(['blue hair']);
            const result = matchWord('blue_hair', queries);

            expect(result.matched).toBe(true);
            expect(result.isExactMatch).toBe(false);
        });

        test('should not match unrelated queries', () => {
            const queries = new Set(['test']);
            const result = matchWord('1girl', queries);

            expect(result.matched).toBe(false);
            expect(result.isExactMatch).toBe(false);
        });

    });

    describe('getCurrentPartialTag', () => {

        test('should extract partial tag before cursor', () => {
            const textarea = createMockTextarea('1girl, blue_hair', 14);
            const result = getCurrentPartialTag(textarea);

            expect(typeof result).toBe('string');
            expect(result).toBe('blue_ha');
        });

        test('should return full tag when cursor is at the end', () => {
            const textarea = createMockTextarea('1girl', 5);
            const result = getCurrentPartialTag(textarea);

            expect(typeof result).toBe('string');
            expect(result).toBe('1girl');
        });

        test('should handle empty textarea', () => {
            const textarea = createMockTextarea('', 0);
            const result = getCurrentPartialTag(textarea);

            expect(typeof result).toBe('string');
            expect(result).toBe('');
        });

        test('should handle newline separators', () => {
            const textarea = createMockTextarea('1girl\nblue_h', 12);
            const result = getCurrentPartialTag(textarea);

            expect(typeof result).toBe('string');
            expect(result).toBe('blue_h');
        });

    });

    describe('searchCompletionCandidates', () => {
        test('should return an empty array for empty input', () => {
            const textarea = createMockTextarea('', 0);
            const results = searchCompletionCandidates(textarea);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });

        test('should return an empty array for null input', () => {
            const results = searchCompletionCandidates(null);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });

        test('should return an empty array for undefined input', () => {
            const results = searchCompletionCandidates(undefined);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });

        test('should return multiple candidates for valid input', () => {
            const textarea = createMockTextarea('test', 4);
            const results = searchCompletionCandidates(textarea);

            expect(Array.isArray(results)).toBe(true);
            expect(results.map(tagData => tagData.tag))
                .toEqual(expect.arrayContaining([
                    'test_tag', '<lora:test_model>', 'embedding:test_embedding'
                ]));
        });

        test('should find wildcard tag', () => {
            const textarea = createMockTextarea('__wild', 6);
            const results = searchCompletionCandidates(textarea);

            expect(Array.isArray(results)).toBe(true);
            expect(results.map(tagData => tagData.tag))
                .toEqual(expect.arrayContaining(['__wildcard__']));
        });

        test('should find emoticon tag', () => {
            const textarea = createMockTextarea(':d', 2);
            const results = searchCompletionCandidates(textarea);

            expect(Array.isArray(results)).toBe(true);
            expect(results.map(tagData => tagData.tag))
                .toEqual(expect.arrayContaining([':d']));
        });
    });

    describe('sequentialSearch', () => {

        test('should find and return matching tags', () => {
            const partialTag = 'test';
            const queryVariations = new Set([partialTag.toLowerCase()]);

            const results = sequentialSearch(partialTag, queryVariations);

            expect(Array.isArray(results)).toBe(true);
            expect(results.map(tagData => tagData.tag))
                .toEqual(expect.arrayContaining([
                    'test_tag', '<lora:test_model>', 'embedding:test_embedding'
                ]));
        });

    });

    describe('searchWithFlexSearch', () => {

        test('should find and return matching tags using FlexSearch', () => {
            const partialTag = 'test';
            const queryVariations = new Set([partialTag.toLowerCase()]);

            const results = searchWithFlexSearch(partialTag, queryVariations);

            expect(Array.isArray(results)).toBe(true);
            expect(results.map(tagData => tagData.tag))
                .toEqual(expect.arrayContaining([
                    'test_tag', '<lora:test_model>', 'embedding:test_embedding'
                ]));
        });

    });

    describe('insertTagToTextArea', () => {

        test('should insert tag and replace underscore with space', () => {
            const textarea = createMockTextarea('1girl, ', 7);
            const tagData = { tag: 'blue_hair', source: 'danbooru' };

            expect(() => {
                insertTagToTextArea(textarea, tagData);
            }).not.toThrow();

            expect(textarea.value).toBe('1girl, blue hair, ');
        });

        test('should complete model tag and add trailing comma', () => {
            const textarea = createMockTextarea('<lora:', 6);
            const tagData = { tag: '<lora:my_model>', source: 'lora' };

            expect(() => {
                insertTagToTextArea(textarea, tagData);
            }).not.toThrow();

            expect(textarea.value).toBe('<lora:my_model>, ');
        });

        test('should handle wildcard tag insertion', () => {
            const textarea = createMockTextarea('__wild', 6);
            const tagData = { tag: '__wildcard__', source: 'danbooru' };

            insertTagToTextArea(textarea, tagData);

            expect(textarea.value).toBe('__wildcard__, ');
        });

        test('should handle emoticon tag insertion', () => {
            const textarea = createMockTextarea(':d', 2);
            const tagData = { tag: ':d', source: 'danbooru' };

            insertTagToTextArea(textarea, tagData);

            expect(textarea.value).toBe(':d, ');
        });

    });
});