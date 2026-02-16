# Local Font Setup Instructions

This directory contains self-hosted fonts to comply with GDPR/DSGVO requirements.

## Font Status

The Inter font family (weights 300, 400, 500, 600, 700) needs to be downloaded and placed in this directory.

## Quick Setup - Automated Download

The easiest way to download all fonts at once is to use one of the provided scripts:

### Option 1: Bash Script (Linux/Mac/WSL)

```bash
cd /path/to/local-business-automizer
bash tools/download-fonts.sh
```

Or if the script is executable:

```bash
./tools/download-fonts.sh
```

### Option 2: Python Script (Cross-platform)

```bash
cd /path/to/local-business-automizer
python3 tools/download-fonts.py
```

Or if the script is executable:

```bash
./tools/download-fonts.py
```

Both scripts will:
- Download all 5 Inter font weights from Google Fonts
- Place them in the `fonts/` directory with correct names
- Display a summary of downloaded files
- Verify download integrity

## Manual Download (if scripts fail)

If the automated scripts don't work for your environment:

1. Visit https://fonts.google.com/download?family=Inter
2. Download the .zip file containing all Inter font weights
3. Extract only the woff2 files for weights 300, 400, 500, 600, 700
4. Place them in this directory (`fonts/`) with names:
   - `Inter-300.woff2`
   - `Inter-400.woff2`
   - `Inter-500.woff2`
   - `Inter-600.woff2`
   - `Inter-700.woff2`

## Expected Font Files

After setup, you should have these files in this directory:

```
fonts/
├── Inter-300.woff2  (Light)
├── Inter-400.woff2  (Regular)
├── Inter-500.woff2  (Medium)
├── Inter-600.woff2  (SemiBold)
├── Inter-700.woff2  (Bold)
└── FONTS_SETUP.md   (this file)
```

Each file should be approximately 30-50 KB.

## CSS Configuration

The `css/fonts.css` file contains @font-face declarations that reference these local files:

```css
@font-face {
  font-family: 'Inter';
  font-weight: 400;
  src: url('/fonts/Inter-400.woff2') format('woff2');
}
```

The relative path `/fonts/Inter-400.woff2` assumes:
- The fonts are in the same directory as this file
- The web server serves them correctly
- No CDN or external references

## GDPR/DSGVO Compliance

By self-hosting fonts locally, we ensure:

✓ No direct data transfer to Google's USA servers
✓ No IP address logging by Google Fonts
✓ Full compliance with German DSGVO requirements
✓ No dependency on external CDN availability
✓ Improved page load performance with local hosting
✓ Better offline support and reliability

## Verification

To verify fonts are properly configured:

1. Check that `fonts/*.woff2` files exist and are not empty
2. Open the application in a browser
3. Inspect the font loading in DevTools (Network tab)
4. Fonts should load from `/fonts/` not from `fonts.googleapis.com` or `fonts.gstatic.com`
5. Page text should use Inter font family

## Troubleshooting

### Script Download Fails

**Issue**: "Tunnel connection failed" or network errors

**Solutions**:
- Check your internet connection
- Try the other script format (bash vs python)
- Use manual download method
- Check firewall/proxy settings

### Fonts Don't Load in Browser

**Issue**: Text appears in different font or serif fallback

**Solutions**:
1. Verify files exist: `ls -la fonts/*.woff2`
2. Check file sizes (should be 30-50 KB each)
3. Clear browser cache
4. Check browser console for 404 errors
5. Verify `css/fonts.css` is being loaded
6. Check web server has correct MIME types configured for .woff2

### Web Server MIME Type Configuration

For `.woff2` files, the server should return:
```
Content-Type: font/woff2
```

For Apache (.htaccess):
```apache
<FilesMatch "\.woff2$">
    AddType font/woff2 .woff2
    Header set Access-Control-Allow-Origin "*"
</FilesMatch>
```

For Nginx:
```nginx
location ~* \.woff2$ {
    add_header Content-Type font/woff2;
    add_header Access-Control-Allow-Origin "*";
}
```

## References

- [Inter Font on Google Fonts](https://fonts.google.com/specimen/Inter)
- [WOFF2 Format Specification](https://www.w3.org/TR/WOFF2/)
- [GDPR/DSGVO Compliance Guide](https://gdpr.eu/)
- [Font Loading Best Practices](https://web.dev/font-loading-optimization/)
