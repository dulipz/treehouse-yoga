#!/usr/bin/env bash
# Renames images inside ~/Documents/treehouse-yoga/site/temp/images_new
# according to their folder name:
#
#   iris/                      -> iris_001.ext, iris_002.ext, ...
#   chantal/                   -> chantal_001.ext, chantal_002.ext, ...
#   iris&chantal_togehter/     -> iris_chantal_001.ext, iris_chantal_002.ext, ...
#   villa/                     -> villa_001.ext, villa_002.ext, ...
#
# Usage:
#   bash scripts/rename-people-images.sh           # dry run, prints what it would do
#   bash scripts/rename-people-images.sh --apply   # actually renames
#
# Files are renamed in place. Numbering is by sorted filename so the order is
# stable across runs. Extensions are kept as-is and lowercased.

set -euo pipefail

ROOT="${ROOT:-$HOME/Documents/treehouse-yoga/site/temp/images_new}"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

if [[ ! -d "$ROOT" ]]; then
  echo "Folder not found: $ROOT" >&2
  exit 1
fi

# Map each source folder name to the target prefix
declare -a MAPPING=(
  "iris|iris"
  "chantal|chantal"
  "iris&chantal_togehter|iris_chantal"
  "iris&chantal_together|iris_chantal"   # in case the typo gets fixed
  "villa|villa"
)

run_one() {
  local folder="$1"
  local prefix="$2"
  local dir="$ROOT/$folder"
  [[ -d "$dir" ]] || return 0

  echo "==> $folder/  ->  ${prefix}_NNN.ext"

  # Stable order: sort by filename
  local i=0
  # Use globbing that handles spaces; only consider files (skip subdirs)
  while IFS= read -r -d '' f; do
    i=$((i + 1))
    local base ext lower_ext num newname
    base="$(basename "$f")"
    ext="${base##*.}"
    # If there is no dot, fall back to "jpg" guess; otherwise lowercase the extension.
    if [[ "$ext" == "$base" ]]; then
      lower_ext="jpg"
    else
      lower_ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
    fi
    num="$(printf '%03d' "$i")"
    newname="${prefix}_${num}.${lower_ext}"

    if [[ "$base" == "$newname" ]]; then
      echo "    skip   $base  (already correct)"
      continue
    fi

    if [[ $APPLY -eq 1 ]]; then
      mv -n -- "$f" "$dir/$newname"
      echo "    mv     $base  ->  $newname"
    else
      echo "    would  $base  ->  $newname"
    fi
  done < <(find "$dir" -maxdepth 1 -type f \
             ! -name '.*' \
             \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \
                -o -iname '*.webp' -o -iname '*.avif' -o -iname '*.gif' \
                -o -iname '*.heic' -o -iname '*.tif' -o -iname '*.tiff' \) \
             -print0 | sort -z)
}

for entry in "${MAPPING[@]}"; do
  IFS="|" read -r folder prefix <<< "$entry"
  run_one "$folder" "$prefix"
done

if [[ $APPLY -eq 0 ]]; then
  echo
  echo "Dry run complete. Re-run with --apply to actually rename."
fi
