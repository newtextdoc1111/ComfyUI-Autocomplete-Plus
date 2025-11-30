import {
    formatPromptText,
    __test__
} from "../../web/js/auto-formatter.js";
import { settingValues } from "../../web/js/settings.js";

const {
    shouldAutoFormat
} = __test__;

describe('AutoFormatter Functions', () => {

    describe('shouldAutoFormat', () => {
        const mockNodeInfo = (nodeType, inputName) => ({
            nodeType,
            inputName
        });

        test('should return false for empty text', () => {
            expect(shouldAutoFormat('', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            expect(shouldAutoFormat('   ', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
        });

        test('should return false for blocklisted nodes', () => {
            expect(shouldAutoFormat('some text,', mockNodeInfo('Power Puter (rgthree)', 'code'))).toBe(false);
            expect(shouldAutoFormat('some text,', mockNodeInfo('LoraLoaderBlockWeight //Inspire', 'block_vector'))).toBe(false);
        });

        test('should return false for numeric data or single-letter placeholders', () => {
            expect(shouldAutoFormat('0,0,0,1,1,1', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            expect(shouldAutoFormat('0.5, -1.2, 0.8', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            expect(shouldAutoFormat('A,B,R', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            expect(shouldAutoFormat('X, 1.5, Y', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
        });

        test('should return true for text with "word + comma" pattern', () => {
            expect(shouldAutoFormat('1girl, blue hair,', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(true);
            expect(shouldAutoFormat('tag1, tag2', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(true);
        });

        test('should return false if "word + comma" pattern is not found', () => {
            expect(shouldAutoFormat('hello world', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            expect(shouldAutoFormat('tag1 tag2', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
        });
    });

    describe('formatPromptText', () => {
        // Store original setting value to restore after tests
        const originalUseTrailingComma = settingValues.useTrailingComma;

        afterEach(() => {
            // Restore original setting after each test
            settingValues.useTrailingComma = originalUseTrailingComma;
        });

        describe('with useTrailingComma enabled', () => {
            beforeEach(() => {
                settingValues.useTrailingComma = true;
            });

            test('should format text by adding comma and space after tags', () => {
                const input = 'tag1,tag2,tag3';
                const expected = 'tag1, tag2, tag3, ';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should remove extra spaces around tags', () => {
                const input = '  tag1  ,  tag2  ';
                const expected = 'tag1, tag2, ';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should preserve special syntax like weights', () => {
                const input = '(tag1:1.2), [tag2]';
                // Note: The current implementation splits by comma.
                // If the input is "(tag1:1.2), [tag2]", it splits into "(tag1:1.2)" and "[tag2]".
                // Then joins with ", ".
                const expected = '(tag1:1.2), [tag2], ';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should handle multiple lines', () => {
                const input = 'tag1, tag2\ntag3, tag4';
                const expected = 'tag1, tag2, \ntag3, tag4, ';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should keep empty lines unchanged', () => {
                const input = 'tag1, tag2\n\ntag3, tag4';
                const expected = 'tag1, tag2, \n\ntag3, tag4, ';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should not modify text that already has trailing comma', () => {
                const input = 'tag1, tag2, ';
                const expected = 'tag1, tag2, ';
                expect(formatPromptText(input)).toBe(expected);
            });
        });

        describe('with useTrailingComma disabled', () => {
            beforeEach(() => {
                settingValues.useTrailingComma = false;
            });

            test('should format text by adding comma and space after tags without trailing comma', () => {
                const input = 'tag1,tag2,tag3';
                const expected = 'tag1, tag2, tag3';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should remove extra spaces around tags without trailing comma', () => {
                const input = '  tag1  ,  tag2  ';
                const expected = 'tag1, tag2';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should preserve special syntax like weights without trailing comma', () => {
                const input = '(tag1:1.2), [tag2]';
                // Note: The current implementation splits by comma.
                // If the input is "(tag1:1.2), [tag2]", it splits into "(tag1:1.2)" and "[tag2]".
                // Then joins with ", ".
                const expected = '(tag1:1.2), [tag2]';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should handle multiple lines without trailing comma', () => {
                const input = 'tag1, tag2\ntag3, tag4';
                const expected = 'tag1, tag2\ntag3, tag4';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should keep empty lines unchanged without trailing comma', () => {
                const input = 'tag1, tag2\n\ntag3, tag4';
                const expected = 'tag1, tag2\n\ntag3, tag4';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should remove existing trailing comma when disabled', () => {
                const input = 'tag1, tag2, ';
                const expected = 'tag1, tag2';
                expect(formatPromptText(input)).toBe(expected);
            });
        });

        test('should handle empty input', () => {
            expect(formatPromptText('')).toBe('');
            expect(formatPromptText(null)).toBe(null);
            expect(formatPromptText(undefined)).toBe(undefined);
        });

        test('should handle input with only spaces', () => {
            expect(formatPromptText('   ')).toBe('   ');
        });
    });
});
