import { settingValues } from '../../web/js/settings.js';
import {
    extractTagsFromTextArea,
    normalizeTagToSearch,
    normalizeTagToInsert,
    getCurrentTagRange,
    findAllTagPositions
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
