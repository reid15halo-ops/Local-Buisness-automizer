#!/usr/bin/env python3
"""
Download Inter Font Files for DSGVO Compliance

This script downloads the Inter font family from Google Fonts
and places them in the fonts/ directory for self-hosting.

Usage:
    python3 tools/download-fonts.py
    python tools/download-fonts.py
    ./tools/download-fonts.py (if executable)

Requirements:
    Python 3.6+
    No external dependencies (uses stdlib urllib)
"""

import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def get_project_root():
    """Get the project root directory."""
    script_dir = Path(__file__).parent
    return script_dir.parent

def download_fonts():
    """Download all Inter font files."""
    project_root = get_project_root()
    fonts_dir = project_root / 'fonts'

    # Create fonts directory if it doesn't exist
    fonts_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{BOLD}{'='*50}")
    print("Inter Font Download for DSGVO Compliance")
    print(f"{'='*50}{RESET}\n")

    print(f"Downloading fonts to: {BLUE}{fonts_dir}{RESET}\n")

    # Font URLs from Google Fonts (Inter v13)
    fonts = {
        "Inter-300.woff2": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPMtVVFtXRa8TVwTIOUfqWrZdx5U.woff2",
        "Inter-400.woff2": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPMtVVGhUWcazsTfltoggM_vsFBE.woff2",
        "Inter-500.woff2": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPMtVVGdcxLBLNe5WlqdOaWA-5ZI.woff2",
        "Inter-600.woff2": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPMtVVGR7Ye-c8fwVYlU0EYlI0Ng.woff2",
        "Inter-700.woff2": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPMtVVEr0n23_CFXsntqgIAoHJ50.woff2",
    }

    # Track download results
    successful = []
    failed = []

    # Download each font
    for filename, url in fonts.items():
        filepath = fonts_dir / filename

        print(f"Downloading {YELLOW}{filename}{RESET}...", end=" ", flush=True)

        try:
            # Set a user agent to avoid being blocked
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            )

            with urllib.request.urlopen(req, timeout=30) as response:
                with open(filepath, 'wb') as f:
                    f.write(response.read())

            # Get file size
            file_size = filepath.stat().st_size
            print(f"{GREEN}OK{RESET} ({file_size:,} bytes)")
            successful.append((filename, file_size))

        except urllib.error.URLError as e:
            print(f"{RED}FAILED{RESET}: {e.reason}")
            failed.append(filename)
        except Exception as e:
            print(f"{RED}FAILED{RESET}: {str(e)}")
            failed.append(filename)

    # Print summary
    print(f"\n{BOLD}{'='*50}")
    print("Download Summary")
    print(f"{'='*50}{RESET}\n")

    # List downloaded files
    print("Font files in directory:")
    for f in sorted(fonts_dir.glob('*.woff2')):
        size = f.stat().st_size
        print(f"  {GREEN}✓{RESET} {f.name}: {size:,} bytes")

    print()

    # Print results
    if not failed:
        print(f"{GREEN}{BOLD}✓ All fonts downloaded successfully!{RESET}\n")
        print("Your application is now DSGVO-compliant.")
        print("Fonts are self-hosted and no longer depend on Google's CDN.\n")
        return 0
    else:
        print(f"{RED}{BOLD}✗ Failed to download {len(failed)} font file(s):{RESET}\n")
        for font in failed:
            print(f"  - {font}")

        print(f"\n{YELLOW}Troubleshooting:{RESET}")
        print("1. Check your internet connection")
        print("2. Verify Python can access external URLs")
        print("3. Try running with: python3 -V")
        print("4. Check if your firewall is blocking downloads")
        print("5. Try running the bash script instead: bash tools/download-fonts.sh\n")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(download_fonts())
    except KeyboardInterrupt:
        print(f"\n{RED}Download interrupted by user.{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}Error: {str(e)}{RESET}")
        sys.exit(1)
