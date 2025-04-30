
import os
import csv
import json
from aiohttp import web
import server # ComfyUIのサーバーインスタンス

# --- Helper Function for CSV Parsing ---

def parse_aliases(alias_str):
    """
    Parses a comma-separated string.
    Example: 'alias1,alias 2, alias3'
    """
    aliases = []
    if not alias_str:
        return aliases
    
    return [word.strip() for word in alias_str.split(',')]

# --- API Endpoints ---

@server.PromptServer.instance.routes.get('/autocomplete-plus/tags')
async def get_tags(request):
    csv_path = os.path.join(os.path.dirname(__file__), '../', 'user', 'danbooru_tags.csv')
    tags_data = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader) # Skip header
            try:
                tag_index = header.index('tag')
                alias_index = header.index('alias')
                count_index = header.index('count')
            except ValueError:
                 print(f"[Autocomplete-Plus] Error: Invalid header in {csv_path}: {header}")
                 return web.Response(status=500, text=f"Invalid CSV header in {csv_path}")

            for row in reader:
                try:
                    tag = row[tag_index]
                    aliases = parse_aliases(row[alias_index])
                    count = int(row[count_index])
                    if tag: # Ensure tag is not empty
                        tags_data.append({'tag': tag, 'alias': aliases, 'count': count})
                except (IndexError, ValueError) as e:
                    print(f"[Autocomplete-Plus] Warning: Skipping invalid row in {csv_path}: {row} - Error: {e}")
                    continue # Skip malformed rows

        # Sort by count descending before sending
        tags_data.sort(key=lambda x: x['count'], reverse=True)
        return web.json_response(tags_data)
    except FileNotFoundError:
        print(f"[Autocomplete-Plus] Error: Tags file not found at {csv_path}")
        return web.Response(status=404, text="Tags file not found.")
    except Exception as e:
        print(f"[Autocomplete-Plus] Error reading tags file: {e}")
        return web.Response(status=500, text=f"Error reading tags file: {e}")

@server.PromptServer.instance.routes.get('/autocomplete-plus/cooccurrence')
async def get_cooccurrence(request):
    csv_path = os.path.join(os.path.dirname(__file__), '../', 'user', 'danbooru_tags_cooccurrence.csv')
    cooccurrence_data = {}
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader) # Skip header
            try:
                tag_a_index = header.index('tag_a')
                tag_b_index = header.index('tag_b')
                count_index = header.index('count')
            except ValueError:
                 print(f"[Autocomplete-Plus] Error: Invalid header in {csv_path}: {header}")
                 return web.Response(status=500, text=f"Invalid CSV header in {csv_path}")

            processed_count = 0
            for row in reader:
                try:
                    tag_a = row[tag_a_index]
                    tag_b = row[tag_b_index]
                    count = int(row[count_index])
                    if tag_a and tag_b: # Ensure tags are not empty
                        if tag_a not in cooccurrence_data:
                            cooccurrence_data[tag_a] = {}
                        cooccurrence_data[tag_a][tag_b] = count
                        processed_count += 1
                except (IndexError, ValueError) as e:
                    print(f"[Autocomplete-Plus] Warning: Skipping invalid row in {csv_path}: {row} - Error: {e}")
                    continue # Skip malformed rows
            print(f"[Autocomplete-Plus] Processed {processed_count} cooccurrence pairs for API.")
        return web.json_response(cooccurrence_data)
    except FileNotFoundError:
        print(f"[Autocomplete-Plus] Error: Cooccurrence file not found at {csv_path}")
        return web.Response(status=404, text="Cooccurrence file not found.")
    except Exception as e:
        print(f"[Autocomplete-Plus] Error reading cooccurrence file: {e}")
        return web.Response(status=500, text=f"Error reading cooccurrence file: {e}")
