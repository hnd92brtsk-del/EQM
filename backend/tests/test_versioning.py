from pathlib import Path

import pytest

from app.core.versioning import VersionError, bump_version, format_version, parse_version, read_version


def test_parse_version_accepts_expected_format():
    assert parse_version("v1.0.0") == (1, 0, 0)


def test_bump_version_build_minor_and_major(tmp_path: Path):
    version_file = tmp_path / "VERSION"
    version_file.write_text("v1.0.0\n", encoding="utf-8")

    assert bump_version("build", version_file) == "v1.0.1"
    assert read_version(version_file) == "v1.0.1"
    assert bump_version("minor", version_file) == "v1.1.0"
    assert bump_version("major", version_file) == "v2.0.0"


def test_invalid_version_raises_clear_error(tmp_path: Path):
    version_file = tmp_path / "VERSION"
    version_file.write_text("1.0.0\n", encoding="utf-8")

    with pytest.raises(VersionError, match=r"v<major>\.<minor>\.<build>"):
        read_version(version_file)


def test_format_version_round_trip():
    assert format_version(*parse_version("v12.3.456")) == "v12.3.456"
