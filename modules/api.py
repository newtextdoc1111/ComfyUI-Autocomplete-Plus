import os
import server
from aiohttp import web

# Get the absolute path to the 'data' directory
# __file__ is the path to the current script (api.py)
# os.path.dirname(__file__) is the directory of the current script (modules)
# os.path.join(..., '..', 'data') goes up one level and then into 'data'
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

DANBOORU_PREFIX = 'danbooru'
E621_PREFIX = 'e621'

TAGS_SUFFIX = 'tags'
COOCCURRENCE_SUFFIX = 'tags_cooccurrence'

def get_csv_file_status():
    """
    Returns a dictionary of csv file statuses.
    """

    data = {
        DANBOORU_PREFIX: {
            'base_tags': False,
            'extra_tags': [],
            'base_cooccurrence': False,
            'extra_cooccurrence': [],
        },
        E621_PREFIX: {
            'base_tags': False,
            'extra_tags': [],
            'base_cooccurrence': False,
            'extra_cooccurrence': [],
        }
    }

    for prefix in [DANBOORU_PREFIX, E621_PREFIX]:
        base_tags_file = f"{prefix}_{TAGS_SUFFIX}.csv"
        base_cooccurrence_file = f"{prefix}_{COOCCURRENCE_SUFFIX}.csv"

        tags_base_exists = os.path.exists(os.path.join(DATA_DIR, base_tags_file))
        cooccurrence_base_exists = os.path.exists(os.path.join(DATA_DIR, base_cooccurrence_file))

        tags_extra_files = []
        cooccurrence_extra_files = []

        all_csv_files = [f for f in os.listdir(DATA_DIR) if f.startswith(prefix) and f.endswith('.csv')]
        if len(all_csv_files) == 0:
            print("[Autocomplete-Plus] No CSV files found in the data directory.")

        # Create extra CSV files list
        for filename in all_csv_files:
            if filename in [base_tags_file, base_cooccurrence_file]:
                continue # Skip base files
            if COOCCURRENCE_SUFFIX in filename.lower():
                cooccurrence_extra_files.append(filename)
            elif TAGS_SUFFIX in filename.lower():
                tags_extra_files.append(filename)

        data[prefix] = {
            'base_tags': tags_base_exists,
            'extra_tags': tags_extra_files,
            'base_cooccurrence': cooccurrence_base_exists,
            'extra_cooccurrence': cooccurrence_extra_files,
        }

    # Return the lists of extra files
    return data

# --- API Endpoints ---

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv')
async def get_csv_list(_request):
    """
    Returns CSV file status.
    base files: file exists boolean
    extra files: count of extra files
    """
    csv_file_status = get_csv_file_status()

    response = {
        DANBOORU_PREFIX: {
            'base_tags': csv_file_status[DANBOORU_PREFIX]['base_tags'],
            'extra_tags': len(csv_file_status[DANBOORU_PREFIX]['extra_tags']),
            'base_cooccurrence': csv_file_status[DANBOORU_PREFIX]['base_cooccurrence'],
            'extra_cooccurrence': len(csv_file_status[DANBOORU_PREFIX]['extra_cooccurrence']),
        },
        E621_PREFIX: {
            'base_tags': csv_file_status[E621_PREFIX]['base_tags'],
            'extra_tags': len(csv_file_status[E621_PREFIX]['extra_tags']),
            'base_cooccurrence': csv_file_status[E621_PREFIX]['base_cooccurrence'],
            'extra_cooccurrence': len(csv_file_status[E621_PREFIX]['extra_cooccurrence']),
        }
    }
    return web.json_response(response)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/{source}/{suffix}/base')
async def get_base_tags_file(request):
    """
    Returns the base tags CSV file.
    """
    source = str(request.match_info['source'])
    suffix = str(request.match_info['suffix'])
    if source not in [DANBOORU_PREFIX, E621_PREFIX] or suffix not in [TAGS_SUFFIX, COOCCURRENCE_SUFFIX]:
        return web.json_response({"error": "Invalid tag source or suffix"}, status=400)
    
    file_path = os.path.join(DATA_DIR, f"{source}_{suffix}.csv")
    if not os.path.exists(file_path):
        return web.json_response({"error": "Base tags file not found"}, status=404)

    return web.FileResponse(file_path)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/{source}/{suffix}/extra/{index}')
async def get_extra_tags_file(request):
    """
    Returns the extra tags CSV file at the specified index.
    """
    try:
        csv_file_status = get_csv_file_status()

        source = str(request.match_info['source'])
        suffix = str(request.match_info['suffix'])
        if source not in [DANBOORU_PREFIX, E621_PREFIX] or suffix not in [TAGS_SUFFIX, COOCCURRENCE_SUFFIX]:
            return web.json_response({"error": "Invalid tag source or suffix"}, status=400)
    
        index = int(request.match_info['index'])
        if index < 0 or index >= len(csv_file_status[source][f'extra_{suffix}']):
            return web.json_response({"error": "Invalid index"}, status=404)

        file_path = os.path.join(DATA_DIR, csv_file_status[source][f'extra_{suffix}'][index])
        if not os.path.exists(file_path):
            return web.json_response({"error": "Extra tags file not found"}, status=404)

        return web.FileResponse(file_path)

    except ValueError:
        return web.json_response({"error": "Invalid index format"}, status=400)
