import os
import server
from aiohttp import web

# Get the absolute path to the 'data' directory
# __file__ is the path to the current script (api.py)
# os.path.dirname(__file__) is the directory of the current script (modules)
# os.path.join(..., '..', 'data') goes up one level and then into 'data'
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

BASE_URL = '/autocomplete-plus/csv'

TAGS_BASE_FILE = 'danbooru_tags.csv'
COOCCURRENCE_BASE_FILE = 'danbooru_tags_cooccurrence.csv'

def get_csv_file_status():
    """
    Returns a dictionary of csv file statuses.
    """
    tags_base_exists = os.path.exists(os.path.join(DATA_DIR, TAGS_BASE_FILE))
    cooccurrence_base_exists = os.path.exists(os.path.join(DATA_DIR, COOCCURRENCE_BASE_FILE))

    tags_extra_files = []
    cooccurrence_extra_files = []

    all_csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
    if len(all_csv_files) == 0:
        print("[Autocomplete-Plus] No CSV files found in the data directory.")

    # Create extra CSV files list
    for filename in all_csv_files:
        if filename in [TAGS_BASE_FILE, COOCCURRENCE_BASE_FILE]:
            continue # Skip base files
        if 'cooccurrence' in filename.lower():
            cooccurrence_extra_files.append(filename)
        elif 'tag' in filename.lower():
            tags_extra_files.append(filename)

    # Return the lists of extra files
    return {
        'danbooru':{
            'base_tags': tags_base_exists, # exists
            'extra_tags': tags_extra_files,
            'base_cooccurrence': cooccurrence_base_exists,
            'extra_cooccurrence': cooccurrence_extra_files,
        }
    }

# --- API Endpoints ---

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv')
async def get_csv_list(_request):
    """
    Returns CSV file status.
    base files: file exists boolean
    extra files: count of extra files
    """
    extra_csv_files = get_csv_file_status()

    response = {
        'danbooru': {
            'base_tags': extra_csv_files['danbooru']['base_tags'],
            'extra_tags': len(extra_csv_files['danbooru']['extra_tags']),
            'base_cooccurrence': extra_csv_files['danbooru']['base_cooccurrence'],
            'extra_cooccurrence': len(extra_csv_files['danbooru']['extra_cooccurrence']),
        }
    }
    return web.json_response(response)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/tags/base')
async def get_base_tags_file(_request):
    """
    Returns the base tags CSV file.
    """
    file_path = os.path.join(DATA_DIR, TAGS_BASE_FILE)
    if not os.path.exists(file_path):
        return web.json_response({"error": "Base tags file not found"}, status=404)
    return web.FileResponse(file_path)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/tags/extra/{index}')
async def get_extra_tags_file(request):
    """
    Returns the extra tags CSV file at the specified index.
    """
    try:
        extra_csv_files = get_csv_file_status()

        index = int(request.match_info['index'])
        if index < 0 or index >= len(extra_csv_files['danbooru']['extra_tags']):
            return web.json_response({"error": "Invalid index"}, status=404)

        file_path = os.path.join(DATA_DIR, extra_csv_files['danbooru']['extra_tags'][index])
        if not os.path.exists(file_path):
            return web.json_response({"error": "Extra tags file not found"}, status=404)

        return web.FileResponse(file_path)

    except ValueError:
        return web.json_response({"error": "Invalid index format"}, status=400)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/cooccurrence/base')
async def get_base_cooccurrence_file(_request):
    """
    Returns the base cooccurrence CSV file.
    """
    file_path = os.path.join(DATA_DIR, COOCCURRENCE_BASE_FILE)
    if not os.path.exists(file_path):
        return web.json_response({"error": "Base cooccurrence file not found"}, status=404)
    return web.FileResponse(file_path)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/cooccurrence/extra/{index}')
async def get_extra_cooccurrence_file(request):
    """
    Returns the extra cooccurrence CSV file at the specified index.
    """
    try:
        extra_csv_files = get_csv_file_status()

        index = int(request.match_info['index'])
        if index < 0 or index >= len(extra_csv_files['cooccurrence']):
            return web.json_response({"error": "Invalid index"}, status=404)

        file_path = os.path.join(DATA_DIR, extra_csv_files['danbooru']['extra_cooccurrence'][index])
        if not os.path.exists(file_path):
            return web.json_response({"error": "Extra cooccurrence file not found"}, status=404)

        return web.FileResponse(file_path)

    except ValueError:
        return web.json_response({"error": "Invalid index format"}, status=400)
