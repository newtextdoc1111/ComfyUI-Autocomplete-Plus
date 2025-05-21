import os
import json
import urllib.request
import urllib.error
import shutil
import sys
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from tqdm import tqdm

# --- File Definitions ---

# Get the absolute path to the "data" directory
DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
TEMP_DOWNLOAD_DIR = os.path.join(DATA_DIR, ".download")

# --- Metadata Constants ---
CSV_META_FILE_NAME = "csv_meta.json"
CSV_META_FILE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", CSV_META_FILE_NAME))

DEFAULT_CSV_METADATA = {
    "version": 1,
    "hf_datasets" : [
        {
            "hf_dataset_id": "newtextdoc1111/danbooru-tag-csv",
            "last_remote_check_timestamp": None,
            "csv_files": [
                {
                    "file_name": "danbooru_tags.csv",
                    "last_download": None,
                    "last_modified_on_hf": None,
                },
                {
                    "file_name": "danbooru_tags_cooccurrence.csv",
                    "last_download": None,
                    "last_modified_on_hf": None,
                }
            ]
        }
    ]
}


# --- Helper Functions ---
def get_file_path(file_name: str) -> str:
    """Returns the full local path for a given file_name."""
    return os.path.join(DATA_DIR, file_name)


def get_temp_download_path(file_name: str) -> str:
    """Returns the full temporary download path for a given file_name."""
    return os.path.join(TEMP_DOWNLOAD_DIR, file_name)


def check_file_valid(file_path):
    """Checks if a file is valid by verifying its existence and size."""
    return os.path.exists(file_path) and os.path.getsize(file_path) > 0


class Downloader:
    """
    Downloader class to manage downloading and checking of CSV files from HuggingFace.
    """

    def __init__(self):
        """Initializes the Downloader."""
        self.csv_meta_file_exists_at_start = False

        self._ensure_directories_exist()
        self.metadata = self._load_metadata()

    def get_default_csv_metadata(self):
        """Returns the default CSV metadata."""
        return json.loads(json.dumps(DEFAULT_CSV_METADATA))

    def _load_metadata(self) -> list:
        """Loads metadata from CSV_META_FILE. Returns default if not found or error."""
        default_metadata = self.get_default_csv_metadata()

        if not os.path.exists(CSV_META_FILE):
            print(f"[Autocomplete-Plus] Metadata file not found: {CSV_META_FILE}. Using default metadata.")
            return default_metadata

        try:
            with open(CSV_META_FILE, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

                if not isinstance(metadata, dict) or metadata.get("version") != DEFAULT_CSV_METADATA["version"]:
                    print(f"[Autocomplete-Plus] Metadata version mismatch. Expected {DEFAULT_CSV_METADATA['version']}, "
                          f"found {metadata.get('version')}. Using default metadata.")
                    return default_metadata
                else:
                    self.csv_meta_file_exists_at_start = True
                    return metadata

        except (IOError, json.JSONDecodeError) as e:
            print(f"[Autocomplete-Plus] Error loading metadata from {CSV_META_FILE}: {e}. Using default metadata.")
            return default_metadata

    def _save_metadata(self):
        """Saves metadata to CSV_META_FILE."""
        try:
            os.makedirs(os.path.dirname(CSV_META_FILE), exist_ok=True)
            with open(CSV_META_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, indent=2)
        except IOError as e:
            print(f"[Autocomplete-Plus] Error saving metadata to {CSV_META_FILE}: {e}")

    def _get_hf_file_last_modified(self, dataset_repo_id: str, hf_filename: str) -> str | None:
        """
        Retrieves the Last-Modified header for a file on HuggingFace and returns it as an ISO 8601 string.
        hf_filename should be the full filename, e.g., "danbooru_tags.csv".
        """
        url = f"https://huggingface.co/datasets/{dataset_repo_id}/resolve/main/{hf_filename}"
        try:
            req = urllib.request.Request(url, method='HEAD',
                                         headers={"User-Agent": "ComfyUI-Autocomplete-Plus (Python urllib)"})
            with urllib.request.urlopen(req, timeout=10) as response:
                last_modified_http = response.getheader('Last-Modified')
                if last_modified_http:
                    dt_object = parsedate_to_datetime(last_modified_http)
                    if dt_object.tzinfo is None or dt_object.tzinfo.utcoffset(dt_object) is None:
                        dt_object = dt_object.replace(tzinfo=timezone.utc)
                    else:
                        dt_object = dt_object.astimezone(timezone.utc)
                    return dt_object.isoformat()
                else:
                    print(f"[Autocomplete-Plus] 'Last-Modified' header not found for {hf_filename} at {url}")
                    return None
        except urllib.error.HTTPError as e:
            print(f"[Autocomplete-Plus] HTTP error when checking last modified for {hf_filename}: {e.code} {e.reason}")
            return None
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"[Autocomplete-Plus] URL or network error when checking last modified for {hf_filename}: {e}")
            return None
        except Exception as e:
            print(f"[Autocomplete-Plus] Unexpected error when checking last modified for {hf_filename}: {e}")
            return None

    def _download_file_with_progress_sync(self, hf_dataset_id, file_name: str, metadata_entry: dict):
        """
        Downloads a file synchronously with progress display to a temporary location.
        """
        download_url = f"https://huggingface.co/datasets/{hf_dataset_id}/resolve/main/{file_name}"
        final_path = get_file_path(file_name)
        temp_path = get_temp_download_path(file_name)
        now_utc = datetime.now(timezone.utc).isoformat()

        print(f"[Autocomplete-Plus] Attempting to download {file_name} from {download_url}")

        downloaded_size = 0
        total_size = 0

        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)

            req = urllib.request.Request(download_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 11.0; Win64)"})

            with urllib.request.urlopen(req) as response:
                total_size_str = response.getheader("Content-Length")
                total_size = int(total_size_str) if total_size_str else None
                chunk_size = 8192

                with open(temp_path, "wb") as f_out, \
                        tqdm(total=total_size, unit='B', unit_scale=True, unit_divisor=1024,
                             desc=f"[Autocomplete-Plus] Downloading {file_name}", leave=False,
                             bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}{postfix}]'
                             ) as pbar:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break

                        f_out.write(chunk)
                        downloaded_size += len(chunk)
                        pbar.update(len(chunk))

            sys.stdout.write("\r" + " " * 100 + "\r")
            sys.stdout.flush()

            shutil.move(temp_path, final_path)
            print(f"[Autocomplete-Plus] Successfully downloaded and moved {file_name} to {final_path}.")
            metadata_entry["last_download"] = now_utc

        except (urllib.error.URLError, OSError, TimeoutError) as e:
            sys.stdout.write("\n")
            sys.stdout.flush()
            print(f"[Autocomplete-Plus] Error downloading {file_name}: {e}")
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                    print(f"[Autocomplete-Plus] Removed partially downloaded file from temp: {temp_path}")
                except OSError as rm_e:
                    print(f"[Autocomplete-Plus] Error removing temporary file {temp_path}: {rm_e}")

            if os.path.exists(final_path):
                try:
                    file_size_at_final = os.path.getsize(final_path)
                    if file_size_at_final == 0 or \
                            (total_size and total_size > 0 and file_size_at_final < total_size) or \
                            (not total_size and downloaded_size > 0 and file_size_at_final < downloaded_size):
                        os.remove(final_path)
                        print(
                            f"[Autocomplete-Plus] Removed potentially corrupted file at final destination: {final_path}")
                except OSError as rm_e:
                    print(f"[Autocomplete-Plus] Error removing potentially corrupted file {final_path}: {rm_e}")

    def _ensure_directories_exist(self):
        """Ensures that DATA_DIR and TEMP_DOWNLOAD_DIR exist."""
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(TEMP_DOWNLOAD_DIR, exist_ok=True)

    def _check_new_csv_from_hf_dataset(self, dataset_meta: dict, now_utc: datetime):
        """Checks HuggingFace for file updates and updates metadata."""
        perform_hf_check = True
        if dataset_meta.get("last_remote_check_timestamp"):
            try:
                last_check_dt = datetime.fromisoformat(dataset_meta["last_remote_check_timestamp"])
                if now_utc - last_check_dt < timedelta(days=7):
                    perform_hf_check = False
            except (ValueError, KeyError, TypeError):
                print(
                    "[Autocomplete-Plus] Invalid or missing timestamp for last_remote_check_timestamp. Will perform remote check.")

        if perform_hf_check:
            huggingface_dataset_id = dataset_meta["hf_dataset_id"]

            print(f"[Autocomplete-Plus] Checking HuggingFace dataset {huggingface_dataset_id} for file updates...")
            updated_all_hf_timestamps_successfully = True
            for file_meta_info in dataset_meta["csv_files"]:
                file_name_from_meta = file_meta_info.get("file_name")
                if not file_name_from_meta:
                    print("[Autocomplete-Plus] Warning: file_name missing in csv_files metadata entry.")
                    updated_all_hf_timestamps_successfully = False
                    continue

                last_modified = self._get_hf_file_last_modified(huggingface_dataset_id, file_name_from_meta)
                if last_modified:
                    file_meta_info["last_modified_on_hf"] = last_modified
                else:
                    updated_all_hf_timestamps_successfully = False
                    print(f"[Autocomplete-Plus] Failed to get remote last modified time for {file_name_from_meta}.")

            if updated_all_hf_timestamps_successfully:
                dataset_meta["last_remote_check_timestamp"] = now_utc.isoformat()
            else:
                print(
                    "[Autocomplete-Plus] Could not update all remote timestamps from HuggingFace. Will try again later.")

    def _download_csv_files_if_needed(self, dataset_meta: dict):
        """Downloads CSV files if they are missing, outdated, or previously failed."""

        for file_meta_entry in dataset_meta["csv_files"]:
            file_name = file_meta_entry.get("file_name")
            if not file_name:
                print("[Autocomplete-Plus] Warning: file_name missing in file_meta_entry during download check.")
                continue

            reason_for_download = self.check_csv_file_should_download(file_meta_entry, file_name)

            if reason_for_download:
                print(f"[Autocomplete-Plus] Queuing download for {file_name}: {reason_for_download}")
                self._download_file_with_progress_sync(dataset_meta["hf_dataset_id"], file_name, file_meta_entry)

    def check_csv_file_should_download(self, file_meta_entry, file_name):
        """
        Determines if a file should be downloaded based on its metadata and local status.
        Returns a reason string if a download is needed, or None if no action is required.
        """
        local_file_path = get_file_path(file_name)

        # If the CSV_META_FILE was not found initially, we need to download the file.
        if not self.csv_meta_file_exists_at_start:
            return f"{CSV_META_FILE_NAME} was not found initially. Forcing download of {file_name}."

        # If the file is empty or missing, we need to download it.
        if not check_file_valid(local_file_path):
            return f"File {file_name} is missing or empty locally."

        # Check if the last modified date on HuggingFace is newer than the last download date
        try:
            last_download_dt = datetime.fromisoformat(file_meta_entry["last_download"])
            hf_modified_dt = datetime.fromisoformat(file_meta_entry["last_modified_on_hf"])
            if hf_modified_dt > last_download_dt:
                return f"Remote file {file_name} is newer (HF: {last_download_dt}, Local Download: {hf_modified_dt})."
        except (ValueError, TypeError):
            file_meta_entry["last_download"] = None
            file_meta_entry["last_modified_on_hf"] = None
            return f"Invalid timestamp format for {file_name}. Forcing download to ensure integrity."

        # If the file is missing or empty, but the last download timestamp exists, we need to retry.
        if not check_file_valid(local_file_path) and file_meta_entry.get("last_download") is not None:
            return f"File {file_name} is missing or empty locally, but last download timestamp exists. Retrying."

        return None

    def run_check_and_download(self):
        """
        Orchestrates the process of checking for updates and downloading CSV files.
        This is the main entry point for the downloader logic.
        """

        now_utc = datetime.now(timezone.utc)

        datasets_meta = self.metadata.get("hf_datasets", [])
        for dataset_meta in datasets_meta:
            self._check_new_csv_from_hf_dataset(dataset_meta, now_utc)
            self._download_csv_files_if_needed(dataset_meta)

        self._save_metadata()
