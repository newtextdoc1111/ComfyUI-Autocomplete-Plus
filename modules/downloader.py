import os
import shutil  # Required for moving files
import sys  # Required for sys.stdout for progress bar
import urllib.error
import urllib.request

from tqdm import tqdm

# --- Constants for Status ---
STATUS_NOT_STARTED = "not_started"
STATUS_DOWNLOADING = "downloading" # This status will be very brief for synchronous downloads
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"

# --- File Definitions ---
TAGS_FILE_ID = "danbooru_tags"
TAGS_FILE = "danbooru_tags.csv"

COOCCURRENCE_FILE_ID = "danbooru_tags_cooccurrence"
COOCCURRENCE_FILE = "danbooru_tags_cooccurrence.csv"

# Get the absolute path to the "data" directory
DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
TEMP_DOWNLOAD_DIR = os.path.join(DATA_DIR, ".download")

HUGGINGFACE_REPO_URL = "https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv/resolve/main/"

# --- State Management ---
# Stores the status of each file download
_download_states = {
    TAGS_FILE_ID: {
        "filename": TAGS_FILE,
        "url": HUGGINGFACE_REPO_URL + TAGS_FILE,
        "path": os.path.join(DATA_DIR, TAGS_FILE),
        "status": STATUS_NOT_STARTED,
    },
    COOCCURRENCE_FILE_ID: {
        "filename": COOCCURRENCE_FILE,
        "url": HUGGINGFACE_REPO_URL + COOCCURRENCE_FILE,
        "path": os.path.join(DATA_DIR, COOCCURRENCE_FILE),
        "status": STATUS_NOT_STARTED,
    }
}

# --- Helper Functions ---
def get_file_path(file_id: str) -> str:
    """Returns the full local path for a given file_id."""
    return _download_states[file_id]["path"]

def get_temp_download_path(file_id: str) -> str:
    """Returns the full temporary download path for a given file_id."""
    state = _download_states[file_id]
    return os.path.join(TEMP_DOWNLOAD_DIR, state["filename"])

def get_file_status(file_id: str) -> str:
    """Gets the current download status of a file. Checks if file exists if status is not_started."""
    state = _download_states[file_id]
    # If file exists and status is "not_started", it might have been placed manually or from a previous run.
    # Update status to "completed" if the file is already there.
    if os.path.exists(state["path"]) and state["status"] == STATUS_NOT_STARTED:
        state["status"] = STATUS_COMPLETED
    return state["status"]

def _download_file_with_progress_sync(file_id: str):
    """Downloads a file synchronously with progress display to a temporary location."""
    state = _download_states[file_id]
    final_path = state["path"]
    temp_path = get_temp_download_path(file_id)

    # This check is somewhat redundant if ensure_file_is_downloaded_sync calls it,
    # but good for direct calls or safety.
    if state["status"] == STATUS_COMPLETED and os.path.exists(final_path) and os.path.getsize(final_path) > 0:
        return

    state["status"] = STATUS_DOWNLOADING
    print(f"[Autocomplete-Plus] Attempting to download {state['filename']} from {state['url']} to {temp_path}")

    downloaded_size = 0
    total_size = 0

    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(TEMP_DOWNLOAD_DIR, exist_ok=True)

        # Remove temporary file if it exists from a previous failed attempt
        if os.path.exists(temp_path):
            os.remove(temp_path)

        req = urllib.request.Request(state["url"], headers={"User-Agent": "Mozilla/5.0 (Windows NT 11.0; Win64)"})

        with urllib.request.urlopen(req) as response:
            total_size_str = response.getheader("Content-Length")
            total_size = int(total_size_str) if total_size_str else None # Use None for tqdm if unknown
            chunk_size = 8192

            with open(temp_path, "wb") as f_out, \
                 tqdm(total=total_size, unit='B', unit_scale=True, unit_divisor=1024,
                      desc=f"[Autocomplete-Plus] Downloading {state['filename']}", leave=False,
                      bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}{postfix}]'
                      ) as pbar:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        if total_size is None and downloaded_size > 0: # Content-Length was unknown
                            sys.stdout.write(f"\n[Autocomplete-Plus] Downloaded {state['filename']}: {downloaded_size / 1024:.2f} KiB (Content-Length unknown).\n")
                            sys.stdout.flush()
                        elif total_size is not None and downloaded_size < total_size:
                            # This case might indicate an incomplete download if loop breaks unexpectedly
                            print(f"\n[Autocomplete-Plus] Warning: Download of {state['filename']} may be incomplete. "
                                  f"Expected {total_size} bytes, got {downloaded_size} bytes.")
                        break

                    f_out.write(chunk)
                    downloaded_size += len(chunk)
                    pbar.update(len(chunk))
        
        # Ensure the progress bar is cleared and a new line is printed if necessary
        sys.stdout.write("\r" + " " * 100 + "\r") # Clear the tqdm line
        sys.stdout.flush()

        shutil.move(temp_path, final_path)
        print(f"[Autocomplete-Plus] Successfully downloaded and moved {state['filename']} to {final_path}.")
        state["status"] = STATUS_COMPLETED

    except (urllib.error.URLError, OSError) as e: # Catch specific exceptions for network/file issues
        sys.stdout.write("\n") # Ensure newline after any tqdm output
        sys.stdout.flush()
        print(f"[Autocomplete-Plus] Error downloading {state['filename']}: {e}")
        state["status"] = STATUS_FAILED
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                print(f"[Autocomplete-Plus] Removed partially downloaded file from temp: {temp_path}")
            except OSError as rm_e:
                print(f"[Autocomplete-Plus] Error removing temporary file {temp_path}: {rm_e}")

        # If the final file exists and might be corrupted (e.g. 0 bytes or smaller than expected)
        if os.path.exists(final_path):
            try:
                file_size_at_final = os.path.getsize(final_path)
                # Conditions for removal: 0 bytes, or smaller than total known size, 
                # or (if total size unknown but we downloaded something) smaller than what we downloaded.
                if file_size_at_final == 0 or \
                   (total_size > 0 and file_size_at_final < total_size) or \
                   (total_size == 0 and downloaded_size > 0 and file_size_at_final < downloaded_size):
                    os.remove(final_path)
                    print(f"[Autocomplete-Plus] Removed potentially corrupted file at final destination: {final_path}")
            except OSError as rm_e:
                print(f"[Autocomplete-Plus] Error removing potentially corrupted file {final_path}: {rm_e}")

def ensure_file_is_downloaded_sync(file_id: str):
    """Checks if a file needs downloading and initiates synchronous download if so."""
    state = _download_states[file_id]
    file_path = state["path"] # Final destination path

    # Check if the file already exists at the final destination and is valid (size > 0)
    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        if state["status"] != STATUS_COMPLETED:
            state["status"] = STATUS_COMPLETED
        return # Skip download

    # If file doesn't exist, is empty, or previous download failed / not started, then attempt download.
    _download_file_with_progress_sync(file_id)

def check_and_download_csv_files():
    """Checks and downloads CSV files."""
    # print("[Autocomplete-Plus] --- Starting check and download for all necessary CSV files... ---")

    # Ensure data and temp directories exist
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(TEMP_DOWNLOAD_DIR, exist_ok=True)

    ensure_file_is_downloaded_sync(TAGS_FILE_ID)
    ensure_file_is_downloaded_sync(COOCCURRENCE_FILE_ID)
    # print("[Autocomplete-Plus] --- Finished check and download for all necessary CSV files. ---")
