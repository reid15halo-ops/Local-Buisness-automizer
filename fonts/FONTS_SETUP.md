# Local Font Setup Instructions

This directory contains self-hosted fonts to comply with GDPR/DSGVO requirements.

## Downloaded Fonts

The Inter font family (weights 300, 400, 500, 600, 700) needs to be downloaded from Google Fonts:

### Manual Download Instructions

1. Visit https://fonts.google.com/download?family=Inter
2. Download the .zip file containing all Inter font weights
3. Extract only the woff2 files for weights 300, 400, 500, 600, 700
4. Place them in this directory with names:
   - Inter-300.woff2
   - Inter-400.woff2
   - Inter-500.woff2
   - Inter-600.woff2
   - Inter-700.woff2

### Automated Download (Linux/Mac)

Run this script from the fonts directory:

```bash
#!/bin/bash
# Define base URL
BASE_URL="https://fonts.gstatic.com/s/inter/v13"

# Download font files
curl -L "${BASE_URL}/UcCO3FwrK3iLTeHAPMtVVFtXRa8TVwTIOUfqWrZdx5U.woff2" -o "Inter-300.woff2"
curl -L "${BASE_URL}/UcCO3FwrK3iLTeHAPMtVVGhUWcazsTfltoggM_vsFBE.woff2" -o "Inter-400.woff2"
curl -L "${BASE_URL}/UcCO3FwrK3iLTeHAPMtVVGdcxLBLNe5WlqdOaWA-5ZI.woff2" -o "Inter-500.woff2"
curl -L "${BASE_URL}/UcCO3FwrK3iLTeHAPMtVVGR7Ye-c8fwVYlU0EYlI0Ng.woff2" -o "Inter-600.woff2"
curl -L "${BASE_URL}/UcCO3FwrK3iLTeHAPMtVVEr0n23_CFXsntqgIAoHJ50.woff2" -o "Inter-700.woff2"
```

## GDPR/DSGVO Compliance

By self-hosting fonts locally, we ensure:
- No direct data transfer to Google's USA servers
- No IP address logging by Google Fonts
- Full compliance with German DSGVO requirements
- No dependency on external CDN availability
- Improved page load performance with local hosting

## SRI Hashing

The fonts.css file includes all necessary @font-face declarations.
