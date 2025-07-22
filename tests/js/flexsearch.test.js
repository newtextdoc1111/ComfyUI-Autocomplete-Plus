
import { Document, Charset, Encoder } from '../../web/js/thirdparty/flexsearch.bundle.module.min.js'

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

describe('FlexSearch Integration', () => {

    const commonCSV = `
1girl,0,6008644,"1girls,sole_female"
highres,5,5256195,"high_res,high_resolution,hires"
solo,0,5000954,"alone,female_solo,single,solo_female,solo_in_panel"
long_hair,0,4350743,"/lh,longhair,very_long_hair"
`;

    const cjkAliasCSV = `
blue_hair,0,676176,"青髪,青い髪,水色髪"
red_hair,0,413261,"赤髪,紅髪,红发,빨강머리,빨간머리"
smile,0,2294308,"笑い,スマイル,笑顔,笑顏,守りたい、この笑顔,笑,笑容,微笑み,微笑,微笑む,미소,守りたいこの笑顔"
gloves,0,1105296,"手袋,裸手袋,手袋コキ,てぶくろ,장갑,手套"
dragon_girl,0,37930,"竜娘,ドラゴン娘,龍娘,龙娘,メスドラ,辰娘"
double_bun,0,103538,"お団子頭,お団子"
sanshoku_dango,0,2061,"三色団子,三色团子,花見団子,花见团子"
`;

    const specialCharCSV = `
:d,0,436700,
>:),0,11041,
year:1999,0,1999,
d.d.,0,1999,
copyright_(series),2,1298,"copyright,コピーライト (シリーズ),コピーライト名,コピーライト,著作"
`;

    const ControlCSV = `
__wildcard__,0,1000,
<lora:my_lora1:1.0>,0,1000,
Embedding: my_embedding,0,1000,
`;

    const mockCSV = [commonCSV, cjkAliasCSV, specialCharCSV, ControlCSV].map(csv => csv.trim()).join('\n');
    let mockTags = [];

    let tagEncoder, cjkEncoder, customEncoder
    let index;

    let performSearch = function (query, limit = null) {
        const results = index.search(query, { field: ["tag", "alias"], limit: limit, suggest: false });

        const ids = results.map(r => r.result).flat();

        return mockTags.filter(tag => ids.includes(tag.id)).map(tag => tag.tag);;
    }

    beforeEach(() => {
        mockTags = mockCSV.split('\n').map((line, id) => {
            const [tag, category, count, alias] = parseCSVLine(line);
            return { id, tag, category: parseInt(category), count: parseInt(count), alias };
        });

        tagEncoder = new Encoder({
            normalize: true,
            dedupe: false,
            numeric: false,
            cache: true,
            split: /(?<=[a-zA-Z\)])_(?=[a-zA-Z\(])|\((?=[a-zA-Z])|(?<=[a-zA-Z\)])\)|[ \n]/
        });

        cjkEncoder = new Encoder(Charset.CJK, {
            dedupe: true,
            numeric: true,
            cache: false,
            filter: new Set(['_', '(', ')']),
            finalize: (term) => {
                return term.map(str => str.replace(/[\u30a1-\u30f6]/g, function (match) {
                    const chr = match.charCodeAt(0) - 0x60;
                    return String.fromCharCode(chr);
                }));
            }
        });

        customEncoder = function (term) {
            return term.split(",")
                .flatMap(str => {
                    if (/[^\u0000-\u007f]/.test(str)) {
                        // Contains non-ASCII characters
                        return cjkEncoder.encode(str);
                    } else {
                        // ASCII characters only
                        return tagEncoder.encode(str);
                    }
                })
                .filter(Boolean);
        }

        index = new Document({
            document: {
                id: "id",
                index: [
                    {
                        field: "tag",
                        tokenize: "bidirectional",
                        encoder: tagEncoder,
                    },
                    {
                        field: "alias",
                        tokenize: "default",
                        encode: customEncoder,
                    }
                ]
            }
        });

        mockTags.forEach(data => index.add(data));
    });

    describe('Encoder', () => {
        test('should be encoded 1', () => {
            const encoded = tagEncoder.encode('sanshoku_dango');
            expect(encoded).toEqual(['sanshoku', 'dango']);
        });

        test('should be encoded 2', () => {
            const encoded = tagEncoder.encode('copyright_(series)');
            expect(encoded).toEqual(['copyright', 'series']);
        });
        test('should be encoded 3', () => {
            const encoded = tagEncoder.encode('year:1234');
            expect(encoded).toEqual(['year:1234']);
        });
        test('should be encoded 4', () => {
            const encoded = tagEncoder.encode('d.d.');
            expect(encoded).toEqual(['d.d.']);
        });
        test('should be encoded 5', () => {
            const encoded = tagEncoder.encode('__wildcard__');
            expect(encoded).toEqual(['__wildcard__']);
        });
    });

    describe('Basic Search', () => {
        test('should find a tag by exact match', () => {
            const results = performSearch('1girl');
            expect(results.length).toBeGreaterThan(0);
            expect(results).toContain('1girl');
        });

        test('should find a tag by partial match (substring)', () => {
            const results = performSearch('blue');
            expect(results.length).toBeGreaterThan(0);
            expect(results).toContain('blue_hair');
        });

        test('should be case-insensitive', () => {
            const results = performSearch('BLUE_HAIR');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('blue_hair');
        });

        test('should find a tag by backward', () => {
            const results = performSearch('gon');
            expect(results.length).toEqual(1);

            expect(results).toContain('dragon_girl');
        });
    });

    describe('Alias Search', () => {
        test('should find a tag by its Japanese alias', () => {
            const results = performSearch('髪');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('blue_hair');
        });

        test('should find a tag by one of its multiple aliases', () => {
            const results = performSearch('笑顔');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('smile');
        });

        test('should find a tag by its partial Japanese alias', () => {
            const results = performSearch('青い');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('blue_hair');
        });

        test('should find a tag by katakana', () => {
            const results = performSearch('テブクロ');
            expect(results.length).toEqual(1);

            expect(results).toContain('gloves');
        });

        test('should find a tag by hiragana', () => {
            const results = performSearch('すまいる');
            expect(results.length).toEqual(1);

            expect(results).toContain('smile');
        });

        test('should not find a tag by english alias substring', () => {
            const results = performSearch('meg');
            expect(results.length).toEqual(0);
        });

        test('should find a tag by japanese alias substring', () => {
            const results = performSearch('団子');
            expect(results.length).toEqual(2);

            expect(results).toContain('sanshoku_dango');
            expect(results).toContain('double_bun');
        });
    });

    describe('Special Characters and Edge Cases', () => {
        test('should find a tag with parentheses', () => {
            const results = performSearch('copyright_(series)');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('copyright_(series)');
        });

        test('should find a tag by searching for content inside parentheses', () => {
            const results = performSearch('series');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('copyright_(series)');
        });

        test('should find a tag by partial word', () => {
            const results = performSearch('right');
            expect(results.length).toBeGreaterThan(0);

            expect(results).toContain('copyright_(series)');
        });

        test('should return an empty array for a non-existent tag', () => {
            const results = performSearch('non_existent_tag_xyz');
            expect(results).toEqual([]);
        });

        test('should match to special character only tag', () => {
            const tag = '>:)';
            const results = performSearch(tag);
            expect(results.length).toEqual(1);

            expect(results).toContain(tag);
        });

        test('should match to contain special character tag', () => {
            const tag = ':d';
            const results = performSearch(tag);
            expect(results.length).toEqual(1);

            expect(results).toContain(tag);
        });

        test('should match to contain special character tag2', () => {
            const tag = 'year:1999';
            const results = performSearch(tag);
            expect(results.length).toEqual(1);

            expect(results).toContain(tag);
        });

        test('should match to contain special character tag3', () => {
            const tag = 'd.d.';
            const results = performSearch(tag);
            expect(results.length).toEqual(1);

            expect(results).toContain(tag);
        });

        test('should match to wildcard tag', () => {
            const tag = '__';
            const results = performSearch(tag);
            expect(results.length).toEqual(1);

            expect(results).toContain('__wildcard__');
        });

        test('should match to lora tag', () => {
            const tag = '<lora';
            const results = performSearch(tag);
            expect(results.length).toEqual(1);

            expect(results).toContain("<lora:my_lora1:1.0>");
        });
    });

    describe('Search Options', () => {
        test('should respect the limit option', () => {
            const results = performSearch('hair', 1);

            expect(results.length).toEqual(1);
        });

        test('should return all matches when limit is higher than results', () => {
            const results = performSearch('hair', 5);
            expect(results.length).toBeGreaterThan(0);

            expect(results).toHaveLength(3);
            expect(results).toContain('long_hair');
            expect(results).toContain('blue_hair');
            expect(results).toContain('red_hair');
        });
    });
});
