from .modules.api import *
from .modules import downloader

# check and download necessary csv files
dl = downloader.Downloader()
dl.run_check_and_download()

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
__all__ = []
