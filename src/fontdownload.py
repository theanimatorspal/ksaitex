# Here make a automatic font downloading system that will download fonts automatically (google fonts)
# unzip then and put in the folder in fonts/ in the current directory

import os
import io
import zipfile
from pathlib import Path
from typing import List, Optional, Union, Any, Dict

# External dependency: You must run 'pip install requests'
import requests

# --- Type Aliases ---
DownloadData = Optional[bytes]
FontFamilyList = List[str]
RequestResponse = Any

class GoogleFontDownloader:
    """
    Handles downloading ZIP archives using a stable API and extracting font files.
    """

    def __init__(self, output_dir_name: str) -> None:
        # Base URL for the stable Webfonts Helper API
        self.base_url: str = "https://gwfh.mranftl.com/api/fonts/{font_slug}?download=zip"
        self.output_dir: Path = Path(output_dir_name)
        
        if not self.output_dir.exists():
            self.output_dir.mkdir(parents=True, exist_ok=True)

    def _create_font_slug(self, font_family: str) -> str:
        """
        Converts a font family name (e.g., 'Open Sans') into a URL-safe slug (e.g., 'open-sans').
        """
        slug: str = font_family.lower().replace(' ', '-')
        return slug

    def _download_zip(self, font_family: str) -> DownloadData:
        """
        Fetches the font ZIP file content using the stable API URL.
        """
        font_slug: str = self._create_font_slug(font_family)
        download_url: str = self.base_url.format(font_slug=font_slug)
        
        try:
            response: RequestResponse = requests.get(download_url, stream=True, timeout=30)
            
            if response.status_code == 200:
                # Check for content type to ensure a zip file was returned
                if 'application/zip' in response.headers.get('content-type', '').lower():
                    zip_data: bytes = response.content
                    return zip_data
                else:
                    print(f"Failed to find ZIP link for {font_family}. Check the name.")
                    return None
            else:
                print(f"Failed to download {font_family}. Status: {response.status_code}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Error downloading {font_family}: {e}")
            return None

    def _unzip_and_save(self, zip_data: bytes) -> None:
        """
        Unzips the binary data and saves the font files to the output directory.
        """
        zip_io: io.BytesIO = io.BytesIO(zip_data)
        
        try:
            with zipfile.ZipFile(zip_io, 'r') as zip_ref:
                member: str
                for member in zip_ref.namelist():
                    is_font_file: bool = member.lower().endswith(('.ttf', '.otf', '.woff', '.woff2'))
                    
                    if is_font_file:
                        target_file_name: str = Path(member).name
                        target_file_path: Path = self.output_dir / target_file_name
                        file_content: bytes = zip_ref.read(member)
                        
                        try:
                            with open(target_file_path, 'xb') as target_file:
                                target_file.write(file_content)
                            print(f"Saved: {target_file_name}")
                        except FileExistsError:
                            print(f"Skipped: {target_file_name} (already exists)")

        except zipfile.BadZipFile:
            print("Error: Downloaded file is not a valid ZIP file.")

    def download_font(self, font_family: str) -> None:
        """
        Main logic for a single font family download process.
        """
        font_family_clean: str = font_family.strip()
        
        print(f"\nAttempting to download: {font_family_clean}")
        zip_data: DownloadData = self._download_zip(font_family_clean)
        
        if zip_data is not None:
            self._unzip_and_save(zip_data)

def Run(font_families: FontFamilyList) -> None:
    """
    Main entry point to initiate the font downloading system.
    """
    output_directory_name: str = "fonts"
    
    downloader: GoogleFontDownloader = GoogleFontDownloader(output_directory_name)
    
    font_family: str
    for font_family in font_families:
        downloader.download_font(font_family)

if __name__ == "__main__":
    
    fonts_to_download: FontFamilyList = [
        "Roboto",
        "Open Sans",
        "Source Code Pro"
    ]
    
    Run(fonts_to_download)