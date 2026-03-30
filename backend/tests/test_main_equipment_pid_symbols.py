from app.routers.main_equipment import extract_pid_symbol, replace_uploaded_pid_symbol, reset_pid_symbol_to_library


class DummyItem:
    def __init__(self, meta_data):
        self.meta_data = meta_data


def test_extract_pid_symbol_supports_iso_14617():
    assert extract_pid_symbol(
        {
            "shapeKey": "crusher_jaw",
            "pidSymbol": {
                "source": "library",
                "libraryKey": "crusher_jaw",
                "standard": "ISO-14617",
            },
        }
    ) == {
        "source": "library",
        "libraryKey": "crusher_jaw",
        "standard": "ISO-14617",
    }


def test_extract_pid_symbol_keeps_legacy_isa_default():
    assert extract_pid_symbol({"shapeKey": "generic"}) == {
        "source": "library",
        "libraryKey": "generic",
        "standard": "ISA-5.1",
    }


def test_reset_pid_symbol_to_library_defaults_to_iso_for_new_library_state():
    item = DummyItem({"shapeKey": "crusher_cone"})
    reset_pid_symbol_to_library(item)

    assert item.meta_data["pidSymbol"] == {
        "source": "library",
        "libraryKey": "crusher_cone",
        "standard": "ISO-14617",
    }


def test_replace_uploaded_pid_symbol_preserves_iso_standard():
    item = DummyItem(
        {
            "shapeKey": "pump_centrifugal",
            "pidSymbol": {
                "source": "library",
                "libraryKey": "pump_centrifugal",
                "standard": "ISO-14617",
            },
        }
    )

    replace_uploaded_pid_symbol(item, "/api/v1/pid-storage/images/demo.svg")

    assert item.meta_data["pidSymbol"] == {
        "source": "upload",
        "libraryKey": "pump_centrifugal",
        "assetUrl": "/api/v1/pid-storage/images/demo.svg",
        "standard": "ISO-14617",
    }
