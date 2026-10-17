"""The model loader must refuse any file that asks for a class outside the allowed list.

The "attack" files below call a harmless function that only sets a flag. If the loader were
unsafe, the flag would be set. A real attack would call something dangerous in the same way.
"""

import collections
import hashlib
import json
import warnings
from pathlib import Path

import joblib
import pytest
from joblib import numpy_pickle

from app import model_store
from app.safe_pickle import ALLOWED_GLOBALS, UnsafeModelFile, restricted_load

warnings.simplefilter("ignore")

RAN = []


def mark_ran():
    RAN.append(True)


class Evil:
    """Unpickling this calls mark_ran(). It stands in for a file that would run code."""

    def __reduce__(self):
        return (mark_ran, ())


@pytest.fixture(autouse=True)
def _reset():
    RAN.clear()
    model_store.load_bundle.cache_clear()
    yield
    model_store.load_bundle.cache_clear()


def test_a_file_that_calls_a_function_is_refused_and_does_not_run(tmp_path):
    path = tmp_path / "evil.joblib"
    joblib.dump(Evil(), path)
    with pytest.raises(UnsafeModelFile):
        restricted_load(path)
    assert RAN == [], "the loader ran code from the file"


def test_the_loader_restores_joblib_after_a_refusal(tmp_path):
    original = numpy_pickle.NumpyUnpickler
    path = tmp_path / "evil.joblib"
    joblib.dump(Evil(), path)
    with pytest.raises(UnsafeModelFile):
        restricted_load(path)
    assert numpy_pickle.NumpyUnpickler is original


def test_a_swapped_file_with_a_matching_hash_is_still_refused(tmp_path, monkeypatch):
    """The attack the hash check cannot stop: change the file and the hash in metadata.json together."""
    evil = tmp_path / "retrained"
    evil.mkdir()
    joblib.dump(Evil(), evil / "model.joblib")
    digest = hashlib.sha256((evil / "model.joblib").read_bytes()).hexdigest()
    files = {k: {"file": "model.joblib", "sha256": digest} for k in ("trust", "fraud", "schedule")}
    (evil / "metadata.json").write_text(json.dumps({"files": files}), encoding="utf-8")
    monkeypatch.setattr(model_store, "MODELS_DIR", tmp_path)
    with pytest.raises(model_store.ModelIntegrityError):
        model_store.load_bundle("retrained")
    assert RAN == []


def test_a_missing_set_gives_a_clear_error(tmp_path, monkeypatch):
    monkeypatch.setattr(model_store, "MODELS_DIR", tmp_path)
    with pytest.raises(model_store.ModelSetMissing):
        model_store.load_bundle("original")


def test_every_shipped_model_file_loads_with_only_the_allowed_classes():
    """If this fails after retraining, a new class appeared. Check it, then add that exact class."""
    seen = collections.Counter()
    original_find = numpy_pickle.NumpyUnpickler.find_class

    def record(self, module, name):
        seen[(module, name)] += 1
        return original_find(self, module, name)

    numpy_pickle.NumpyUnpickler.find_class = record
    try:
        files = sorted((Path(model_store.MODELS_DIR)).glob("*/*.joblib"))
        assert files, "no model files found"
        for f in files:
            joblib.load(f)
    finally:
        numpy_pickle.NumpyUnpickler.find_class = original_find
    not_allowed = sorted(f"{m}.{n}" for (m, n) in seen if (m, n) not in ALLOWED_GLOBALS)
    assert not_allowed == [], f"model files ask for classes that are not allowed: {not_allowed}"
    # and the strict loader accepts every file
    for f in files:
        restricted_load(f)


def test_the_allowed_list_has_no_function_that_runs_code():
    banned = {"eval", "exec", "system", "popen", "run", "Popen", "getattr", "setattr", "open", "__import__",
              "call", "check_output", "loads", "load", "runstring"}
    assert not [g for g in ALLOWED_GLOBALS if g[1] in banned]
