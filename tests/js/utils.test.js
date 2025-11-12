import { settingValues } from '../../web/js/settings.js';
import {
    extractTagsFromTextArea,
    normalizeTagToSearch,
    normalizeTagToInsert,
    getCurrentTagRange,
    findAllTagPositions,
    addWeightToLora
} from '../../web/js/utils.js';

// filepath: web/js/utils.test.js


describe('extractTagsFromTextArea', () => {
    // Helper to create a mock textarea with given value
    function createMockTextarea(value) {
        return { value };
    }

    test('should return empty array for null or empty textarea', () => {
        expect(extractTagsFromTextArea(null)).toEqual([]);
        expect(extractTagsFromTextArea(undefined)).toEqual([]);
        expect(extractTagsFromTextArea({})).toEqual([]);
        expect(extractTagsFromTextArea(createMockTextarea(''))).toEqual([]);
    });

    test('should extract a single tag from textarea', () => {
        const textarea = createMockTextarea('blue_hair');
        expect(extractTagsFromTextArea(textarea)).toEqual(['blue_hair']);
    });

    test('should extract multiple comma-separated tags', () => {
        const textarea = createMockTextarea('blue_hair, red_eyes, smile');
        expect(extractTagsFromTextArea(textarea)).toEqual(['blue_hair', 'red_eyes', 'smile']);
    });

    test('should extract tags from multiple lines', () => {
        const textarea = createMockTextarea('blue_hair\nred_eyes\nsmile');
        expect(extractTagsFromTextArea(textarea)).toEqual(['blue_hair', 'red_eyes', 'smile']);
    });

    test('should handle mixed newlines and commas', () => {
        const textarea = createMockTextarea('blue_hair, red_eyes\nsmile, 1girl');
        expect(extractTagsFromTextArea(textarea)).toEqual(['blue_hair', 'red_eyes', 'smile', '1girl']);
    });

    test('should normalize tags by applying normalizeTagToSearch', () => {
        // Since normalizeTagToSearch replaces spaces with underscores and handles parentheses,
        // we can test that behavior here
        const textarea = createMockTextarea('blue hair, (red eyes), standing:1.2');

        // Manually apply the same normalization to verify
        const expected = [
            normalizeTagToSearch('blue hair'),
            normalizeTagToSearch('(red eyes)'),
            normalizeTagToSearch('standing:1.2')
        ];

        expect(extractTagsFromTextArea(textarea)).toEqual(expected);
    });

    test('should handle empty tags and whitespace', () => {
        const textarea = createMockTextarea('blue_hair, , red_eyes,  ,\n,smile');
        expect(extractTagsFromTextArea(textarea)).toEqual(['blue_hair', 'red_eyes', 'smile']);
    });

    test('should handle tags with special characters', () => {
        const textarea = createMockTextarea('tag\\(with\\)escaped, <lora:something:0.8>, __wildcard__');
        const expected = [
            normalizeTagToSearch('tag\\(with\\)escaped'),
            normalizeTagToSearch('<lora:something:0.8>'),
            normalizeTagToSearch('__wildcard__')
        ];
        expect(extractTagsFromTextArea(textarea)).toEqual(expected);
    });

    test('should extract tags with Asian characters', () => {
        const textarea = createMockTextarea('青い髪, 赤い目, 微笑');
        expect(extractTagsFromTextArea(textarea)).toEqual(['青い髪', '赤い目', '微笑']);
    });

    test('should extract tags with combined formatting', () => {
        const textarea = createMockTextarea('(blue hair:1.2), red_eyes, (smile)');

        const expected = [
            normalizeTagToSearch('(blue hair:1.2)'),
            normalizeTagToSearch('red_eyes'),
            normalizeTagToSearch('(smile)')
        ];

        expect(extractTagsFromTextArea(textarea)).toEqual(expected);
    });
});


describe('normalizeTagToSearch', () => {
    test('should return null or empty string for invalid inputs', () => {
        expect(normalizeTagToSearch(null)).toBeNull();
        expect(normalizeTagToSearch(undefined)).toBeUndefined();
        expect(normalizeTagToSearch('')).toBe('');
    });

    test('should replace spaces with underscores for tags with letters/numbers', () => {
        expect(normalizeTagToSearch('blue hair')).toBe('blue_hair');
        expect(normalizeTagToSearch('1girl')).toBe('1girl');
        expect(normalizeTagToSearch('blue hair red eyes')).toBe('blue_hair_red_eyes');
    });

    test('should remove prompt weights but preserve complex tag names with colons', () => {
        expect(normalizeTagToSearch('blue hair:1.2')).toBe('blue_hair');
        expect(normalizeTagToSearch('standing:0.8')).toBe('standing');
        expect(normalizeTagToSearch('year:2000')).toBe('year:2000');
        expect(normalizeTagToSearch('foo:bar')).toBe('foo:bar');
        expect(normalizeTagToSearch('428:foo')).toBe('428:foo');
    });

    test('should unescape parentheses', () => {
        expect(normalizeTagToSearch('blue\\(hair\\)')).toBe('blue(hair)');
        expect(normalizeTagToSearch('\\(tag\\)')).toBe('(tag)');
    });

    test('should not modify symbol-only tags', () => {
        expect(normalizeTagToSearch(';)')).toBe(';)');
        expect(normalizeTagToSearch('^_^')).toBe('^_^');
    });

    test('should handle Asian characters', () => {
        expect(normalizeTagToSearch('青い髪')).toBe('青い髪');
        expect(normalizeTagToSearch('青い 髪')).toBe('青い_髪');
    });

    test('should handle combined cases', () => {
        expect(normalizeTagToSearch('blue\\(hair\\):1.2')).toBe('blue(hair)');
        expect(normalizeTagToSearch('(blue hair):0.9')).toBe('blue_hair');
        expect(normalizeTagToSearch('year:2000\\(future\\)')).toBe('year:2000(future)');
    });
});

describe('normalizeTagToInsert', () => {
    const originalValue = settingValues.replaceUnderscoreWithSpace;
    afterEach(() => {
        settingValues.replaceUnderscoreWithSpace = originalValue;
    });

    test('should return null or empty string for invalid inputs', () => {
        expect(normalizeTagToInsert(null)).toBeNull();
        expect(normalizeTagToInsert(undefined)).toBeUndefined();
        expect(normalizeTagToInsert('')).toBe('');
    });

    test('should replace underscores with spaces for tags with letters/numbers', () => {
        expect(normalizeTagToInsert('blue_hair')).toBe('blue hair');
        expect(normalizeTagToInsert('1girl')).toBe('1girl');
        expect(normalizeTagToInsert('blue_hair_red_eyes')).toBe('blue hair red eyes');
    });

    test('should escape parentheses', () => {
        expect(normalizeTagToInsert('blue(hair)')).toBe('blue\\(hair\\)');
        expect(normalizeTagToInsert('(tag)')).toBe('\\(tag\\)');
    });

    test('should not replace underscores in symbol-only tags', () => {
        expect(normalizeTagToInsert('^_^')).toBe('^_^');
        expect(normalizeTagToInsert(':)')).toBe(':\\)');
    });

    test('should handle Asian characters', () => {
        expect(normalizeTagToInsert('青い髪')).toBe('青い髪');
        expect(normalizeTagToInsert('青い_髪')).toBe('青い 髪');
    });

    test('should handle combined cases', () => {
        expect(normalizeTagToInsert('blue_hair(style)')).toBe('blue hair\\(style\\)');
        expect(normalizeTagToInsert('year:2000')).toBe('year:2000');
        expect(normalizeTagToInsert('foo:bar')).toBe('foo:bar');
    });

    test('should respect replaceUnderscoreWithSpace setting when true', () => {
        settingValues.replaceUnderscoreWithSpace = true;

        expect(normalizeTagToInsert('blue_hair')).toBe('blue hair');
        expect(normalizeTagToInsert('red_eyes')).toBe('red eyes');
        expect(normalizeTagToInsert('long_curly_hair')).toBe('long curly hair');
    });

    test('should respect replaceUnderscoreWithSpace setting when false', () => {
        settingValues.replaceUnderscoreWithSpace = false;

        expect(normalizeTagToInsert('blue_hair')).toBe('blue_hair');
        expect(normalizeTagToInsert('red_eyes')).toBe('red_eyes');
        expect(normalizeTagToInsert('long_curly_hair')).toBe('long_curly_hair');
    });

    test('should respect replaceUnderscoreWithSpace setting with parentheses', () => {
        settingValues.replaceUnderscoreWithSpace = true;
        expect(normalizeTagToInsert('blue_hair(style)')).toBe('blue hair\\(style\\)');

        settingValues.replaceUnderscoreWithSpace = false;
        expect(normalizeTagToInsert('blue_hair(style)')).toBe('blue_hair\\(style\\)');
    });

    test('should not replace underscores in wildcard syntax regardless of setting', () => {
        // Wildcard syntax should preserve underscores regardless of setting
        settingValues.replaceUnderscoreWithSpace = true;
        expect(normalizeTagToInsert('__wildcard__')).toBe('__wildcard__');

        settingValues.replaceUnderscoreWithSpace = false;
        expect(normalizeTagToInsert('__wildcard__')).toBe('__wildcard__');
    });

    test('should not replace underscores in symbol-only tags regardless of setting', () => {
        // Symbol-only tags should not be affected by the setting
        settingValues.replaceUnderscoreWithSpace = true;
        expect(normalizeTagToInsert('^_^')).toBe('^_^');

        settingValues.replaceUnderscoreWithSpace = false;
        expect(normalizeTagToInsert('^_^')).toBe('^_^');
    });

    test('should not escape parentheses when tag contains commas (multi-tags)', () => {
        const multiTag = 'masterpiece, best quality, (high quality), ultra-detailed';
        expect(normalizeTagToInsert(multiTag)).toBe('masterpiece, best quality, (high quality), ultra-detailed');
    });

    test('should not escape parentheses in multi-tag strings with parentheses', () => {
        const multiTag = '(worst quality, low quality, normal quality), bad anatomy';
        expect(normalizeTagToInsert(multiTag)).toBe('(worst quality, low quality, normal quality), bad anatomy');
    });

    test('should handle multi-tags with both underscores and parentheses correctly', () => {
        settingValues.replaceUnderscoreWithSpace = true;
        const multiTag = 'best_quality, (high_quality:1.2), ultra_detailed';
        expect(normalizeTagToInsert(multiTag)).toBe('best quality, (high quality:1.2), ultra detailed');

        settingValues.replaceUnderscoreWithSpace = false;
        expect(normalizeTagToInsert(multiTag)).toBe('best_quality, (high_quality:1.2), ultra_detailed');
    });

    test('should still escape parentheses for single tags without commas', () => {
        // Single tags (not multi-tags) should still have parentheses escaped
        expect(normalizeTagToInsert('blue(hair)')).toBe('blue\\(hair\\)');
        expect(normalizeTagToInsert('(tag)')).toBe('\\(tag\\)');
    });
});

describe('getCurrentTagRange', () => {
    test('should return null for invalid inputs', () => {
        expect(getCurrentTagRange(null, 0)).toBeNull();
        expect(getCurrentTagRange(undefined, 0)).toBeNull();
        expect(getCurrentTagRange('', -1)).toBeNull();
    });

    test('should last tag if cursorPos exceeds text length', () => {
        const text = 'blue_hair, red_eyes, smile';
        const cursorPos = text.length + 5; // Cursor position beyond text length
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 21, end: 26, tag: 'smile' });
    });

    test('should return last tag if cursorPos is exactly at the end of the text', () => {
        const text = 'blue_hair, red_eyes, smile';
        const cursorPos = text.length; // Cursor position at the end of the text
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 21, end: 26, tag: 'smile' });
    });

    test('should return the correct tag range for a single tag', () => {
        const text = 'blue_hair';
        const cursorPos = 5; // Cursor inside the tag
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 9, tag: 'blue_hair' });
    });

    test('should return the correct tag range for multiple tags', () => {
        const text = 'blue_hair, red_eyes, smile';
        const cursorPos = 12; // Cursor inside "red_eyes"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 11, end: 19, tag: 'red_eyes' });
    });

    test('should handle tags with parentheses', () => {
        const text = '(blue hair), (red eyes), smile';
        const cursorPos = 5; // Cursor inside "(blue hair)"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 1, end: 10, tag: 'blue hair' });
    });

    test('should handle tags with prompt weights', () => {
        const text = 'blue_hair:1.2, red_eyes:0.8';
        const cursorPos = 5; // Cursor inside "blue_hair:1.2"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 9, tag: 'blue_hair' });
    });

    test('should handle tags with escaped parentheses', () => {
        const text = 'tag\\(with\\)escaped, smile';
        const cursorPos = 5; // Cursor inside "tag\\(with\\)escaped"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 18, tag: 'tag\\(with\\)escaped' });
    });

    test('should handle tags with only symbols', () => {
        const text = ';), >:)';
        const cursorPos = 1; // Cursor inside ";)"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 2, tag: ';)' });
    });

    test('should handle Asian characters in tags', () => {
        const text = '青い髪, 赤い目, 微笑';
        const cursorPos = 2; // Cursor inside "青い髪"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 3, tag: '青い髪' });
    });

    test('should handle nested parentheses', () => {
        const text = '((blue hair)), smile';
        const cursorPos = 5; // Cursor inside "((blue hair))"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 2, end: 11, tag: 'blue hair' });
    });

    test('should handle empty tags or invalid ranges', () => {
        const text = 'blue_hair, , red_eyes';
        const cursorPos = 10; // Cursor inside empty tag
        expect(getCurrentTagRange(text, cursorPos)).toBeNull();
    });

    test('should handle tags with colons in names', () => {
        const text = 'foo:bar, standing:1.0';
        const cursorPos = 5; // Cursor inside "foo:bar"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 7, tag: 'foo:bar' });
    });

    test('should properly handle tags with numeric values after colon', () => {
        const text = 'year:2000, normal_tag';
        const cursorPos = 7; // Cursor inside "foobar:2000"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 9, tag: 'year:2000' });
    });

    test('should properly handle tags with numeric values before colon', () => {
        const text = '428:bar, normal_tag';
        const cursorPos = 2; // Cursor inside "foobar:2000"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 7, tag: '428:bar' });
    });

    test('should properly handle if cursor position on prompt weight', () => {
        const text = 'blue_hair:1.2, red_eyes:0.8';
        const cursorPos = 11; // Cursor on ":1.2"
        expect(getCurrentTagRange(text, cursorPos)).toEqual({ start: 0, end: 9, tag: 'blue_hair' });
    });

    // Wildcard syntax tests
    test('should correctly identify a tag within a wildcard', () => {
        const text = '{short|medium|long}, other_tag';
        const cursorPos = 3; // Cursor inside "short" part of the wildcard
        const result = getCurrentTagRange(text, cursorPos);
        expect(result).not.toBeNull();
        expect(result.tag).toBe('short');
    });

    test('should correctly identify a tag with weight notation in a wildcard', () => {
        const text = '{20::from above|30::from behind}, other_tag';
        const cursorPos = 21; // Cursor inside "from behind" part
        const result = getCurrentTagRange(text, cursorPos);
        expect(result).not.toBeNull();
        expect(result.tag).toBe('from behind');
    });
});

describe('findAllTagPositions', () => {
    test('should find positions for basic comma-separated tags', () => {
        const text = 'blue_hair, red_eyes, smile';
        const positions = findAllTagPositions(text);

        expect(positions).toHaveLength(3);
        expect(positions[0]).toEqual({ start: 0, end: 9, tag: 'blue_hair' });
        expect(positions[1]).toEqual({ start: 11, end: 19, tag: 'red_eyes' });
        expect(positions[2]).toEqual({ start: 21, end: 26, tag: 'smile' });
    });

    test('should find positions for tags separated by newlines', () => {
        const text = 'blue_hair\nred_eyes\nsmile';
        const positions = findAllTagPositions(text);

        expect(positions).toHaveLength(3);
        expect(positions[0]).toEqual({ start: 0, end: 9, tag: 'blue_hair' });
        expect(positions[1]).toEqual({ start: 10, end: 18, tag: 'red_eyes' });
        expect(positions[2]).toEqual({ start: 19, end: 24, tag: 'smile' });
    });

    test('should handle wildcard syntax and expand all options', () => {
        const text = 'normal tag, {short hair|medium hair|long hair}, another tag';
        const positions = findAllTagPositions(text);

        expect(positions).toHaveLength(5); // 1 normal + 3 from wildcard + 1 normal

        // Normal tag
        expect(positions[0]).toEqual({ start: 0, end: 10, tag: 'normal tag' });

        // Wildcard tags with correct positions inside the wildcard
        expect(positions[1].tag).toBe('short hair');
        expect(positions[2].tag).toBe('medium hair');
        expect(positions[3].tag).toBe('long hair');

        // Check positions are within the original wildcard
        expect(positions[1].start).toBeGreaterThanOrEqual(12);
        expect(positions[1].end).toBeLessThanOrEqual(31);
        expect(positions[3].end).toBeLessThanOrEqual(45);

        // Last normal tag
        expect(positions[4]).toEqual({ start: 48, end: 59, tag: 'another tag' });
    });

    test('should handle weighted wildcard syntax', () => {
        const text = '{20::from above|20::from side|30::from up|30::from behind}';
        const positions = findAllTagPositions(text);

        expect(positions).toHaveLength(4);
        expect(positions[0].tag).toBe('from above');
        expect(positions[1].tag).toBe('from side');
        expect(positions[2].tag).toBe('from up');
        expect(positions[3].tag).toBe('from behind');

        // Check relative positions
        expect(positions[0].start).toBeLessThan(positions[1].start);
        expect(positions[1].start).toBeLessThan(positions[2].start);
        expect(positions[2].start).toBeLessThan(positions[3].start);
    });

    test('should skip empty parts in weighted wildcard syntax', () => {
        const text = '{40::white|40::black|20::}';
        const positions = findAllTagPositions(text);

        expect(positions).toHaveLength(2);
        expect(positions[0].tag).toBe('white');
        expect(positions[1].tag).toBe('black');
    });

    test('should handle nested wildcards and complex patterns', () => {
        const text = 'normal, {nested {option|choice}|simple}, last';
        const positions = findAllTagPositions(text);

        // Should extract all words from nested wildcards
        expect(positions).toHaveLength(6);
        expect(positions[0].tag).toBe('normal');
        expect(positions[1].tag).toBe('nested');
        expect(positions[2].tag).toBe('option');
        expect(positions[3].tag).toBe('choice');
        expect(positions[4].tag).toBe('simple');
        expect(positions[5].tag).toBe('last');
    });
});

describe('addWeightToModel', () => {
    test('should return null or empty string for invalid inputs', () => {
        expect(addWeightToLora(null)).toBeNull();
        expect(addWeightToLora(undefined)).toBeUndefined();
        expect(addWeightToLora('')).toBe('');
    });

    // LoRA format tests
    test('should add default weight to LoRA without weight', () => {
        expect(addWeightToLora('<lora:my_style01>')).toBe('<lora:my_style01:1.0>');
        expect(addWeightToLora('<lora:anime_style>')).toBe('<lora:anime_style:1.0>');
        expect(addWeightToLora('<lora:character_lora>')).toBe('<lora:character_lora:1.0>');
    });

    test('should preserve existing weight in LoRA', () => {
        expect(addWeightToLora('<lora:my_style01:0.8>')).toBe('<lora:my_style01:0.8>');
        expect(addWeightToLora('<lora:anime_style:1.2>')).toBe('<lora:anime_style:1.2>');
        expect(addWeightToLora('<lora:character_lora:0.5>')).toBe('<lora:character_lora:0.5>');
    });

    test('should handle LoRA with path separators', () => {
        expect(addWeightToLora('<lora:folder/my_style01>')).toBe('<lora:folder/my_style01:1.0>');
        expect(addWeightToLora('<lora:folder/subfolder/style>')).toBe('<lora:folder/subfolder/style:1.0>');
        expect(addWeightToLora('<lora:folder/my_style01:0.7>')).toBe('<lora:folder/my_style01:0.7>');
    });

    test('should handle LoRA with symbols', () => {
        expect(addWeightToLora('<lora:folder/myLora style>')).toBe('<lora:folder/myLora style:1.0>');
        expect(addWeightToLora('<lora:folder/myLora-style>')).toBe('<lora:folder/myLora-style:1.0>');
        expect(addWeightToLora('<lora:folder/myLora[style]>')).toBe('<lora:folder/myLora[style]:1.0>');
        expect(addWeightToLora('<lora:folder/myLora v1.0>')).toBe('<lora:folder/myLora v1.0:1.0>');
        expect(addWeightToLora('<lora:folder/myLora v1.0:0.75>')).toBe('<lora:folder/myLora v1.0:0.75>');
    });

    test('should handle case-insensitive LoRA tags', () => {
        expect(addWeightToLora('<LORA:my_style01>')).toBe('<LORA:my_style01:1.0>');
        expect(addWeightToLora('<LoRa:anime_style>')).toBe('<LoRa:anime_style:1.0>');
        expect(addWeightToLora('<Lora:character_lora:0.9>')).toBe('<Lora:character_lora:0.9>');
    });

    // Custom default weight tests
    test('should use custom default weight for LoRA', () => {
        expect(addWeightToLora('<lora:my_style01>', 0.5)).toBe('<lora:my_style01:0.5>');
        expect(addWeightToLora('<lora:anime_style>', 1.5)).toBe('<lora:anime_style:1.5>');
        expect(addWeightToLora('<lora:character_lora>', 2.0)).toBe('<lora:character_lora:2.0>');
    });

    test('should not override existing weight even with custom default', () => {
        expect(addWeightToLora('<lora:my_style01:0.8>', 2.0)).toBe('<lora:my_style01:0.8>');
    });

    // Non-model format tests
    test('should return non-model tags as-is', () => {
        expect(addWeightToLora('blue_hair')).toBe('blue_hair');
        expect(addWeightToLora('1girl')).toBe('1girl');
        expect(addWeightToLora('standing:1.2')).toBe('standing:1.2');
        expect(addWeightToLora('<other:tag>')).toBe('<other:tag>');
        expect(addWeightToLora('random:text:format')).toBe('random:text:format');
    });

    // Edge cases
    test('should handle malformed LoRA tags', () => {
        expect(addWeightToLora('<lora:>')).toBe('<lora:>');
        expect(addWeightToLora('<lora>')).toBe('<lora>');
        expect(addWeightToLora('lora:my_style01')).toBe('lora:my_style01');
    });

    test('should handle decimal weights correctly', () => {
        expect(addWeightToLora('<lora:style:0.123>')).toBe('<lora:style:0.123>');
        expect(addWeightToLora('<lora:style:1.999>')).toBe('<lora:style:1.999>');
    });

    test('should handle special characters in model names', () => {
        expect(addWeightToLora('<lora:my-style_01>')).toBe('<lora:my-style_01:1.0>');
        expect(addWeightToLora('<lora:style.v2>')).toBe('<lora:style.v2:1.0>');
    });

    // Embedding format tests - should not be modified
    test('should not modify embedding tags without weight', () => {
        expect(addWeightToLora('embedding:my_embedding')).toBe('embedding:my_embedding');
        expect(addWeightToLora('embedding:character_emb')).toBe('embedding:character_emb');
        expect(addWeightToLora('embedding:style_embedding')).toBe('embedding:style_embedding');
    });

    test('should not modify embedding tags with existing weight', () => {
        expect(addWeightToLora('embedding:my_embedding:0.8')).toBe('embedding:my_embedding:0.8');
        expect(addWeightToLora('embedding:character_emb:1.2')).toBe('embedding:character_emb:1.2');
        expect(addWeightToLora('embedding:style_embedding:0.5')).toBe('embedding:style_embedding:0.5');
    });

    test('should not modify embedding tags regardless of case', () => {
        expect(addWeightToLora('EMBEDDING:my_embedding')).toBe('EMBEDDING:my_embedding');
        expect(addWeightToLora('Embedding:character_emb')).toBe('Embedding:character_emb');
        expect(addWeightToLora('EmBeDdInG:style_emb')).toBe('EmBeDdInG:style_emb');
        expect(addWeightToLora('EMBEDDING:my_embedding:0.9')).toBe('EMBEDDING:my_embedding:0.9');
    });
});
