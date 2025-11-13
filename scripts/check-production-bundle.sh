#!/bin/bash

# Check what Supabase URLs are in the production bundle
echo "Checking production bundle for Supabase URLs..."
echo ""

# Fetch the main page
echo "Fetching main page HTML..."
curl -s https://sonance-360-review.vercel.app/ > /tmp/prod-page.html

# Extract all JS chunk URLs
echo "Extracting JavaScript chunks..."
grep -o '/_next/static/chunks/[^"]*\.js' /tmp/prod-page.html | head -10 > /tmp/chunk-urls.txt

echo "Found $(wc -l < /tmp/chunk-urls.txt) chunks"
echo ""

# Check each chunk for Supabase URLs
echo "Searching for Supabase URLs in chunks..."
while read chunk; do
    url="https://sonance-360-review.vercel.app${chunk}"
    echo "Checking: $chunk"
    curl -s "$url" | grep -o 'https://[a-z]*\.supabase\.co' | sort | uniq
done < /tmp/chunk-urls.txt

echo ""
echo "Complete!"

