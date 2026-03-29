from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.versioning import VERSION_FILE, bump_version, read_version  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Bump EQM project version.")
    parser.add_argument(
        "kind",
        nargs="?",
        choices=("build", "minor", "major"),
        default="build",
        help="Version component to increment. Defaults to build.",
    )
    parser.add_argument(
        "--print-current",
        action="store_true",
        help="Print the current version without modifying the version file.",
    )
    args = parser.parse_args()

    if args.print_current:
        print(read_version(VERSION_FILE))
        return 0

    print(bump_version(args.kind, VERSION_FILE))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
