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

        // Store original setting value to restore after tests
        const originalTrimSurroundingSpaces = settingValues.trimSurroundingSpaces;

        afterEach(() => {
            // Restore original setting after each test
            settingValues.trimSurroundingSpaces = originalTrimSurroundingSpaces;
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

        describe('blocklist priority with trimSurroundingSpaces', () => {
            test('should prioritize blocklist over trimSurroundingSpaces when disabled', () => {
                settingValues.trimSurroundingSpaces = false;

                // Blocklisted nodes should return false even with surrounding spaces
                expect(shouldAutoFormat('  some code  ', mockNodeInfo('Power Puter (rgthree)', 'code'))).toBe(false);
                expect(shouldAutoFormat('\nsome code\n', mockNodeInfo('Power Puter (rgthree)', 'code'))).toBe(false);
                expect(shouldAutoFormat('  0,0,0,1,1,1  ', mockNodeInfo('LoraLoaderBlockWeight //Inspire', 'block_vector'))).toBe(false);
            });

            test('should prioritize blocklist over trimSurroundingSpaces when enabled', () => {
                settingValues.trimSurroundingSpaces = true;

                // Blocklisted nodes should return false even with trimSurroundingSpaces enabled and surrounding spaces
                expect(shouldAutoFormat('  some code  ', mockNodeInfo('Power Puter (rgthree)', 'code'))).toBe(false);
                expect(shouldAutoFormat('\nsome code\n', mockNodeInfo('Power Puter (rgthree)', 'code'))).toBe(false);
                expect(shouldAutoFormat('  function() { }  ', mockNodeInfo('Power Puter (rgthree)', 'code'))).toBe(false);
                expect(shouldAutoFormat('  0,0,0,1,1,1  ', mockNodeInfo('LoraLoaderBlockWeight //Inspire', 'block_vector'))).toBe(false);
            });
        });

        describe('trimSurroundingSpaces with non-comma-separated text', () => {
            test('should return false for non-comma-separated text when trimSurroundingSpaces is disabled', () => {
                settingValues.trimSurroundingSpaces = false;

                // Text without word+comma pattern should return false
                expect(shouldAutoFormat('  hello world  ', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
                expect(shouldAutoFormat('\nhello world\n', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
                expect(shouldAutoFormat('  tag1 tag2  ', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            });

            test('should return true for non-comma-separated text with surrounding spaces when trimSurroundingSpaces is enabled', () => {
                settingValues.trimSurroundingSpaces = true;

                // Text with surrounding spaces should return true to format (trim them)
                expect(shouldAutoFormat('  hello world  ', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(true);
                expect(shouldAutoFormat('\nhello world\n', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(true);
                expect(shouldAutoFormat('  tag1 tag2  ', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(true);
                expect(shouldAutoFormat('  \nsome text\n  ', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(true);
            });

            test('should return false for text without surrounding spaces even when trimSurroundingSpaces is enabled', () => {
                settingValues.trimSurroundingSpaces = true;

                // Text without word+comma pattern and without surrounding spaces should return false
                expect(shouldAutoFormat('hello world', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
                expect(shouldAutoFormat('tag1 tag2', mockNodeInfo('CLIPTextEncode', 'text'))).toBe(false);
            });
        });
    });

    describe('formatPromptText', () => {
        // Store original setting value to restore after tests
        const originalUseTrailingComma = settingValues.useTrailingComma;
        const originalTrimSurroundingSpaces = settingValues.trimSurroundingSpaces;

        afterEach(() => {
            // Restore original setting after each test
            settingValues.useTrailingComma = originalUseTrailingComma;
            settingValues.trimSurroundingSpaces = originalTrimSurroundingSpaces;
        });

        describe('with useTrailingComma enabled', () => {
            beforeEach(() => {
                settingValues.useTrailingComma = true;
                settingValues.trimSurroundingSpaces = false;
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
                settingValues.trimSurroundingSpaces = false;
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

        describe('with trimSurroundingSpaces enabled', () => {
            beforeEach(() => {
                settingValues.trimSurroundingSpaces = true;
                settingValues.useTrailingComma = false;
            });

            test('should remove trailing newlines and spaces', () => {
                const input = 'tag1, tag2\n\n  ';
                const expected = 'tag1, tag2'; 
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should remove leading newlines and spaces', () => {
                const input = '  \n\ntag1, tag2';
                const expected = 'tag1, tag2';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should remove both leading and trailing whitespaces but keep middle empty lines', () => {
                const input = '  \n\ntag1\n\ntag2\n\n  ';
                const expected = 'tag1\n\ntag2'; 
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should return empty string if input is only whitespace', () => {
                const input = '   \n   ';
                expect(formatPromptText(input)).toBe('');
            });
        });

        describe('with trimSurroundingSpaces disabled', () => {
            beforeEach(() => {
                settingValues.trimSurroundingSpaces = false;
                settingValues.useTrailingComma = false;
            });

            test('should preserve trailing newlines', () => {
                const input = 'tag1, tag2\n\n';
                const expected = 'tag1, tag2\n\n';
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should preserve leading spaces (as first line content)', () => {
                const input = '   \ntag1';
                const expected = '\ntag1'; 
                expect(formatPromptText(input)).toBe(expected);
            });

            test('should handle input with only spaces', () => {
                expect(formatPromptText('   ')).toBe('   ');
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
