"""Load a model set. Two checks apply to every file before it is used.

1. Its SHA-256 must match models/<set>/metadata.json (stops a file that changed by accident).
2. It must pass app/safe_pickle.py, which refuses any class outside a short allowed list
   (stops a file that was swapped on purpose, even if its hash was swapped too).

joblib files are pickles, and loading a normal pickle can run code.
"""

import hashlib
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.safe_pickle import UnsafeModelFile, restricted_load

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
VALID_SETS = ("retrained", "original")


class ModelIntegrityError(RuntimeError):
    """A model file does not match its pinned hash, or asks for a class that is not allowed."""


class ModelSetMissing(ModelIntegrityError):
    """The model set is not installed in this build (for example `original`, which is not shipped)."""


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
    if not (directory / "metadata.json").exists():
        raise ModelSetMissing(f"The model set '{set_name}' is not installed in this build.")
    metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))

    loaded = {}
    for key, info in metadata["files"].items():
        path = directory / info["file"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != info["sha256"]:
            raise ModelIntegrityError(
                f"{path.name} does not match the hash in metadata.json. Refusing to load it."
            )
        try:
            loaded[key] = restricted_load(path)
        except UnsafeModelFile as exc:
            raise ModelIntegrityError(str(exc)) from exc

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
