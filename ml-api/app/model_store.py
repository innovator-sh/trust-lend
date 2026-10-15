"""Load a model set. A file loads only when its SHA-256 matches models/<set>/metadata.json.

joblib files are pickles, and loading a pickle can run code. The hash check means the server
only loads the exact files that were reviewed and committed with that metadata.
"""

import hashlib
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
VALID_SETS = ("retrained", "original")


class ModelIntegrityError(RuntimeError):
    """A model file does not match its pinned hash."""


@dataclass(frozen=True)
class ModelBundle:
    set_name: str
    metadata: dict
    trust: Any        # RandomForestClassifier
    fraud: Any        # IsolationForest
    schedule: Any     # KMeans
    cluster_to_archetype: dict


def default_set() -> str:
    name = os.environ.get("ML_MODEL_SET", "retrained").strip().lower()
    if name not in VALID_SETS:
        raise ValueError(f"ML_MODEL_SET must be one of {VALID_SETS}, got '{name}'")
    return name


@lru_cache(maxsize=4)
def load_bundle(set_name: str) -> ModelBundle:
    if set_name not in VALID_SETS:
        raise ValueError(f"Unknown model set '{set_name}'")
    directory = MODELS_DIR / set_name
    metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))

    loaded = {}
    for key, info in metadata["files"].items():
        path = directory / info["file"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != info["sha256"]:
            raise ModelIntegrityError(
                f"{path.name} does not match the hash in metadata.json. Refusing to load it."
            )
        loaded[key] = joblib.load(path)

    schedule = loaded["schedule"]  # a dict: {"model": KMeans, "mapping": {cluster: name}}
    return ModelBundle(
        set_name=set_name,
        metadata=metadata,
        trust=loaded["trust"],
        fraud=loaded["fraud"],
        schedule=schedule["model"],
        cluster_to_archetype={int(k): v for k, v in schedule["mapping"].items()},
    )


def get_bundle() -> ModelBundle:
    return load_bundle(default_set())
