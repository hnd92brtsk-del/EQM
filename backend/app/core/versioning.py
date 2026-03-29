from __future__ import annotations

import re
from pathlib import Path

from app.core.config import BASE_DIR

VERSION_FILE = BASE_DIR.parent / "VERSION"
VERSION_PATTERN = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")


class VersionError(ValueError):
    pass


def parse_version(value: str) -> tuple[int, int, int]:
    match = VERSION_PATTERN.fullmatch(value.strip())
    if not match:
        raise VersionError("Version must match v<major>.<minor>.<build>.")
    return tuple(int(part) for part in match.groups())


def format_version(major: int, minor: int, build: int) -> str:
    return f"v{major}.{minor}.{build}"


def read_version(version_file: Path = VERSION_FILE) -> str:
    try:
        raw_value = version_file.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise VersionError(f"Version file not found: {version_file}") from exc
    parse_version(raw_value)
    return raw_value


def bump_version(kind: str = "build", version_file: Path = VERSION_FILE) -> str:
    major, minor, build = parse_version(read_version(version_file))

    if kind == "build":
        build += 1
    elif kind == "minor":
        minor += 1
        build = 0
    elif kind == "major":
        major += 1
        minor = 0
        build = 0
    else:
        raise VersionError("Bump kind must be one of: build, minor, major.")

    next_version = format_version(major, minor, build)
    version_file.write_text(f"{next_version}\n", encoding="utf-8")
    return next_version
