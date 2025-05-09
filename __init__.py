from .modules.api import *  
from .modules import downloader

# check and download necessary csv files
downloader.check_and_download_csv_files()

# --- Original Node Mappings (Keep or modify as needed) ---
WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
__all__ = []
