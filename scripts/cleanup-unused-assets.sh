#!/usr/bin/env bash
# Removes assets that aren't referenced anywhere in src/ or public/css/js/.
# These are mostly originals, alternate takes, and old placeholder photos
# that ship to Cloudflare for no reason.
#
# Usage:
#   bash scripts/cleanup-unused-assets.sh           # dry run — lists what would be deleted, with sizes
#   bash scripts/cleanup-unused-assets.sh --apply   # actually delete
#
# After running with --apply:
#   git add -A
#   git commit -m "Clean up unused/heavy assets"
#   git push origin master

set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

cd "$ROOT/public/assets"

# Targets — folders + individual files we can safely delete because nothing
# in the code references them. Patterns are evaluated relative to public/assets.
TARGETS=(
  # Source material — should never have been in /public, lives outside the deploy
  "Original Images"
  "Unconfirmed 515911.crdownload"
  "Payments lyon.pdf"

  # Old placeholder logos — current logos are logo.png + logo-mark.png
  "Logo-Treehouse-Villa.gif"
  "Logo-Treehouse-Villa_Logo.png"
  "145-scaled.jpg"

  # Old / alternate takes that aren't referenced
  "culture_001.jpg"            # only culture_001.jpeg is used
  "culture_002.jpg" "culture_003.jpg" "culture_004.jpg"
  "culture_005.jpg" "culture_005.jpeg"
  "galle_002.jpg" "galle_003.jpg" "galle_004.jpg"
  "die_villa_002.gif" "die_villa_004.gif" "die_villa_005.gif"
  "die_villa_008.gif" "die_villa_008.jpg" "die_villa_0011.gif"
  "getting_there.webp" "gettingthere.jpg"
  "gettingthere_002.jpg" "gettingthere_005.jpeg"
  "maduganga_002.jpg" "maduganga_003.jpg" "maduganga_004.jpg"
  "ort_hikkaduwa_02.avif" "ort_hikkaduwa_03.jpg"
  "ort_hikkaduwa_04.jpg" "ort_hikkaduwa_05.jpg"
  "reefandsurf_003.jpg"
  "retreat-group-6.jpg" "retreat-group-7.jpg" "retreat-group-8.jpg"
  "retreat-group-11.jpg" "retreat-group-15.jpg" "retreat-group-16.jpg"

  # Unused portraits in images_new — only the ones referenced by about.astro stay
  "images_new/iris/iris_001.jpeg" "images_new/iris/iris_003.jpeg"
  "images_new/iris/iris_004.jpeg" "images_new/iris/iris_005.jpeg"
  "images_new/chantal/chantal_001.jpeg" "images_new/chantal/chantal_002.jpeg"
  "images_new/chantal/chantal_007.jpeg"
  "images_new/iris_chantal_together/iris_chantal_001.jpeg"
  "images_new/iris_chantal_together/iris_chantal_002.jpeg"
  "images_new/iris_chantal_together/iris_chantal_004.jpeg"
  "images_new/iris_chantal_together/iris_chantal_005.jpeg"
  "images_new/iris_chantal_together/iris_chantal_008.jpeg"
  "images_new/villa/villa_001.jpeg" "images_new/villa/villa_002.jpeg"
  "images_new/villa/villa_003.jpeg" "images_new/villa/villq_004.jpeg"

  # Replaced by a/b/c variants
  "masks/painted-edge.svg"
)

total_bytes=0
deleted_count=0
missing_count=0

for t in "${TARGETS[@]}"; do
  if [[ -e "$t" ]]; then
    size_bytes="$(du -sb "$t" 2>/dev/null | awk '{print $1}')"
    size_human="$(du -sh "$t" 2>/dev/null | awk '{print $1}')"
    if [[ $APPLY -eq 1 ]]; then
      rm -rf -- "$t"
      printf '  rm   %-9s  %s\n' "$size_human" "$t"
    else
      printf '  would rm   %-9s  %s\n' "$size_human" "$t"
    fi
    total_bytes=$((total_bytes + size_bytes))
    deleted_count=$((deleted_count + 1))
  else
    printf '  skip       %s  (already gone)\n' "$t"
    missing_count=$((missing_count + 1))
  fi
done

# Pretty total
total_mb=$(awk -v b="$total_bytes" 'BEGIN { printf "%.1f", b/1024/1024 }')
echo
if [[ $APPLY -eq 1 ]]; then
  echo "Removed $deleted_count items, ${total_mb} MB freed."
  [[ $missing_count -gt 0 ]] && echo "($missing_count were already gone.)"
  echo
  echo "Next:"
  echo "  git add -A"
  echo "  git commit -m \"Clean up unused/heavy assets (-${total_mb} MB)\""
  echo "  git push origin master"
else
  echo "Dry run — would remove $deleted_count items, ~${total_mb} MB."
  [[ $missing_count -gt 0 ]] && echo "($missing_count are already gone.)"
  echo
  echo "Re-run with --apply to actually delete."
fi
