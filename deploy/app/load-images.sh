#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_DIR="${1:-"$SCRIPT_DIR/../runtime-images"}"

if [[ ! -d "$IMAGE_DIR" ]]; then
  echo "Image directory not found: $IMAGE_DIR" >&2
  exit 1
fi

shopt -s nullglob
image_files=("$IMAGE_DIR"/*.tar)
shopt -u nullglob

if [[ ${#image_files[@]} -eq 0 ]]; then
  echo "No image tar files found in $IMAGE_DIR" >&2
  exit 1
fi

for image_file in "${image_files[@]}"; do
  echo "Loading image: $image_file"
  docker load -i "$image_file"
done

echo "Docker images loaded successfully."
