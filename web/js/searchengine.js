import { Charset, Encoder, Document } from './thirdparty/flexsearch.bundle.module.min.js'
import { kataToHira } from './utils.js';

/**
 * Creates an encoder optimized for processing English tag names.
 * Handles tag formatting like underscores and parentheses commonly used in Danbooru tags.
 * @returns {Encoder} FlexSearch encoder for English tags
 */
function createTagEncoder() {
    return new Encoder({
        normalize: true,
        dedupe: false,
        numeric: false,
        cache: true,
        // filter: new Set(['and', 'to', 'be', 'on']),
        replacer: [/(?<=[a-zA-Z\)])_$/, ''],  // Remove trailing underscores after letters/parentheses
        split: /(?<=[a-zA-Z\)])_(?=[a-zA-Z\(])|\((?=[a-zA-Z])|(?<=[a-zA-Z\)])\)|[ \n]/  // Split on underscores between words, parentheses, spaces, and newlines
    });
}

/**
 * Creates an encoder optimized for processing CJK (Chinese, Japanese, Korean) characters.
 * Uses exact character matching and converts katakana to hiragana for better Japanese search.
 * @returns {Encoder} FlexSearch encoder for CJK text
 */
function createCJKEncoder() {
    return new Encoder(Charset.Exact, {
        dedupe: true,
        numeric: true,
        cache: true,
        filter: new Set(['(', ')']),  // Filter out parentheses characters
        finalize: (term) => {         // Convert katakana to hiragana for better Japanese matching
            return term.map(str => kataToHira(str));
        }
    });
}

/**
 * Creates an encoder optimized for processing Embedding or Lora notation.
 * @returns {Encoder} FlexSearch encoder
 */
function createModelEncoder() {
    return new Encoder({
        normalize: true,
        dedupe: false,
        numeric: true,
        cache: true,
        prepare: function (str) {
            return str.replace(/(lora:|embedding:)/g, "$1 ");
        },
        split: /[<>_./\(\)\-\s\\]+/
    });
}

/**
 * Creates a FlexSearch Document instance optimized for tag searching.
 * Configures separate encoders for English tags and CJK aliases with appropriate tokenization.
 * @returns {Document} Configured FlexSearch document for tag indexing
 */
export function createFlexSearchDocument() {
    const tagEncoder = createTagEncoder();
    const cjkEncoder = createCJKEncoder();

    // Custom encoding function for alias field that handles mixed language content
    const encodeAlias = function (term) {
        return term.split(",")
            .flatMap(str => {
                if (/[^\u0000-\u007f]/.test(str)) {
                    // Contains non-ASCII characters (CJK text)
                    return cjkEncoder.encode(str);
                } else {
                    // ASCII characters only (English text)
                    return tagEncoder.encode(str);
                }
            })
            .filter(Boolean);
    }

    // Configure the FlexSearch document with optimized indexing settings
    const document = new Document({
        document: {
            id: "id",
            index: [
                {
                    field: "tag",
                    tokenize: "bidirectional",  // Allow partial matching from both ends
                    encoder: tagEncoder,        // Use tag-optimized encoder
                },
                {
                    field: "alias",             // Index the alias field for multi-language support
                    tokenize: "full",           // Full tokenization for complete alias matching
                    encode: encodeAlias,        // Use custom multi-language encoding function
                }
            ]
        }
    });

    return document;
}

/**
 * Creates a FlexSearch Document instance optimized for lora or embedding searching.
 * @returns {Document} Configured FlexSearch document
 */
export function createFlexSearchDocumentForModel() {
    const modelEncoder = createModelEncoder();
    const cjkEncoder = createCJKEncoder();

    // Custom encoding function for alias field that handles mixed language content
    const encodeAlias = function (term) {
        return term.split(",")
            .flatMap(str => {
                if (/[^\u0000-\u007f]/.test(str)) {
                    // Contains non-ASCII characters (CJK text)
                    return cjkEncoder.encode(str);
                } else {
                    // ASCII characters only (English text)
                    return modelEncoder.encode(str);
                }
            })
            .filter(Boolean);
    }

    // Configure the FlexSearch document with optimized indexing settings
    // Note: alias field is not indexed for lora or embedding search
    const document = new Document({
        document: {
            id: "id",
            index: [
                {
                    field: "tag",
                    tokenize: "bidirectional",  // Allow partial matching from both ends
                    encoder: modelEncoder,
                },
                {
                    field: "alias",             // Index the alias field for multi-language support
                    tokenize: "full",           // Full tokenization for complete alias matching
                    encode: encodeAlias,        // Use custom multi-language encoding function
                }
            ]
        }
    });

    return document;
}

// Export functions for testing when in test environment
const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
export const __test__ = isTestEnvironment ? { createTagEncoder, createCJKEncoder, createModelEncoder } : undefined;