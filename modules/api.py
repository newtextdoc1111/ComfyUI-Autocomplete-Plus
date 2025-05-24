import os
import json
import server
from aiohttp import web
from . import downloader as dl

# Get the absolute path to the 'data' directory
# __file__ is the path to the current script (api.py)
# os.path.dirname(__file__) is the directory of the current script (modules)
# os.path.join(..., '..', 'data') goes up one level and then into 'data'
DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))

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

def get_last_check_time_from_metadata():
    """
    Helper function to get the last remote check timestamp from csv_meta.json.
    Returns the timestamp string if found, None otherwise.
    """
    try:
        if not os.path.exists(dl.CSV_META_FILE):
            return None
        
        with open(dl.CSV_META_FILE, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        datasets = metadata.get("hf_datasets", [])
        if datasets and len(datasets) > 0:
            return datasets[0].get("last_remote_check_timestamp")
        
        return None
        
    except (IOError, json.JSONDecodeError) as e:
        print(f"[Autocomplete-Plus] Error reading csv_meta.json: {e}")
        return None

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

@server.PromptServer.instance.routes.post('/autocomplete-plus/csv/force-check-updates')
async def force_check_csv_updates(request):
    """
    Forces a check for CSV file updates from HuggingFace, ignoring cooldown.
    This allows users to manually trigger an update check at any time.
    """
    try:
        print("[Autocomplete-Plus] Starting forced check for CSV updates from HuggingFace...")
        
        downloader = dl.Downloader()
        downloader.run_check_and_download(force_check=True)
        
        print("[Autocomplete-Plus] Forced check completed successfully.")
        
        # Get the updated last check time
        last_check_time = get_last_check_time_from_metadata()
        
        return web.json_response({
            "success": True,
            "message": "Force check completed successfully",
            "last_check_time": last_check_time
        })
        
    except Exception as e:
        print(f"[Autocomplete-Plus] Error during forced check: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

@server.PromptServer.instance.routes.get('/autocomplete-plus/csv/last-check-time')
async def get_last_check_time(_request):
    """
    Returns the last remote check timestamp from csv_meta.json.
    Returns null if the file doesn't exist or if there's an error reading it.
    """
    try:
        if not os.path.exists(dl.CSV_META_FILE):
            return web.json_response({
                "last_check_time": None,
                "message": "csv_meta.json file not found"
            })
        
        last_check_time = get_last_check_time_from_metadata()
        
        if last_check_time is not None:
            return web.json_response({
                "last_check_time": last_check_time
            })
        else:
            return web.json_response({
                "last_check_time": None,
                "message": "No datasets found in metadata"
            })
            
    except (IOError, json.JSONDecodeError) as e:
        print(f"[Autocomplete-Plus] Error reading csv_meta.json: {e}")
        return web.json_response({
            "last_check_time": None,
            "error": str(e)
        }, status=500)