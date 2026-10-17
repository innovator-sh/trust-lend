"""Load a joblib model file only when it asks for a short, fixed list of classes.

A joblib file is a pickle. Loading a normal pickle can run any code the file names, so a swapped
file would run on the server. This loader raises an error as soon as a file asks for anything
that is not in ALLOWED_GLOBALS. The list holds the scikit-learn model classes this service uses
and the numpy and joblib helpers that rebuild arrays. It holds no function that runs code.

The list comes from reading every shipped model file (see tests/test_safe_pickle.py). If a
retrained file needs one more class, add that exact class here and say why in the pull request.
"""

import threading
from pathlib import Path

import joblib
from joblib import numpy_pickle

ALLOWED_GLOBALS = frozenset({
    # joblib and numpy: rebuild arrays
    ("joblib.numpy_pickle", "NumpyArrayWrapper"),
    ("numpy", "dtype"),
    ("numpy", "ndarray"),
    ("numpy._core.multiarray", "_reconstruct"),   # numpy 2
    ("numpy._core.multiarray", "scalar"),
    ("numpy.core.multiarray", "_reconstruct"),    # numpy 1
    ("numpy.core.multiarray", "scalar"),
    # scikit-learn: the models this service uses
    ("sklearn.cluster._kmeans", "KMeans"),
    ("sklearn.ensemble._forest", "RandomForestClassifier"),
    ("sklearn.ensemble._iforest", "IsolationForest"),
    ("sklearn.tree._classes", "DecisionTreeClassifier"),
    ("sklearn.tree._classes", "ExtraTreeRegressor"),
    ("sklearn.tree._tree", "Tree"),
})


class UnsafeModelFile(RuntimeError):
    """A model file asked for a class that is not on the allowed list."""


_lock = threading.Lock()


def restricted_load(path: Path):
    """joblib.load, but any class outside ALLOWED_GLOBALS stops the load before it is created."""

    class _Strict(numpy_pickle.NumpyUnpickler):
        def find_class(self, module, name):
            if (module, name) not in ALLOWED_GLOBALS:
                raise UnsafeModelFile(
                    f"{Path(path).name} asks for {module}.{name}, which is not allowed in a model file."
                )
            return super().find_class(module, name)

    # joblib builds its unpickler from a module-level name, so swap it for the one call.
    with _lock:
        original = numpy_pickle.NumpyUnpickler
        numpy_pickle.NumpyUnpickler = _Strict
        try:
            return joblib.load(path)
        finally:
            numpy_pickle.NumpyUnpickler = original
