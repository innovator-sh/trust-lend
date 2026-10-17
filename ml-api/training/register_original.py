"""Register the ORIGINAL model files (from the team's first prototype) with pinned hashes.

Run from the ml-api folder:
    python -m training.register_original "<folder with trust_score_model.joblib, fraud_model.joblib, repayment_model.joblib>"

What it does
- Copies the three files to models/original/.
- Reads each one with app/safe_pickle.py, which allows only a short list of scikit-learn and
  numpy classes, so the file cannot run other code while it is inspected. A file that needs
  any other class is refused.
- Writes models/original/metadata.json with the SHA-256 of every file and the model settings.

The server only loads a model file when its hash matches this metadata and it passes the same
strict loader.
The original training script and data are NOT available, so the provenance says so.
These files are NOT shipped in the public repository (models/original/ is gitignored). Run this
script only on a copy of the files that you trust.
"""

import hashlib
import json
import shutil
import sys
import warnings
from pathlib import Path

import numpy as np
from app.features import FRAUD_FEATURES, SCHEDULE_FEATURES, TRUST_FEATURES
from app.safe_pickle import restricted_load

OUT_DIR = Path(__file__).resolve().parent.parent / "models" / "original"
FILES = {
    "trust": ("trust_score_model.joblib", TRUST_FEATURES),
    "fraud": ("fraud_model.joblib", FRAUD_FEATURES),
    "schedule": ("repayment_model.joblib", SCHEDULE_FEATURES),
}

def describe(obj):
    if isinstance(obj, dict) and "model" in obj:
        out = describe(obj["model"])
        out["cluster_to_archetype"] = {str(k): v for k, v in obj["mapping"].items()}
        return out
    info = {"class": f"{type(obj).__module__}.{type(obj).__name__}"}
    for attr in ("n_estimators", "max_depth", "contamination", "n_clusters", "random_state"):
        if hasattr(obj, attr):
            value = getattr(obj, attr)
            info[attr] = value if isinstance(value, (int, float, str, type(None))) else str(value)
    if hasattr(obj, "feature_importances_"):
        info["feature_importances"] = {
            n: round(float(v), 4)
            for n, v in sorted(zip(obj.feature_names_in_, obj.feature_importances_), key=lambda x: -x[1])
        }
    if hasattr(obj, "cluster_centers_"):
        info["cluster_centres"] = np.round(obj.cluster_centers_, 2).tolist()
    return info


def main(source: str):
    warnings.simplefilter("ignore")
    src = Path(source)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = {}
    for key, (filename, features) in FILES.items():
        shutil.copyfile(src / filename, OUT_DIR / filename)
        path = OUT_DIR / filename
        files[key] = {
            "file": filename,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "features": features,
            "model": describe(restricted_load(path)),
        }
        print(f"{key}: {files[key]['model']['class']}  sha256={files[key]['sha256'][:12]}...")

    metadata = {
        "set": "original",
        "provenance": (
            "Models from the team's first prototype. The training script and the training data "
            "are NOT available, so how they were trained cannot be checked."
        ),
        "data_source": "unknown",
        "real_world_validation": "none",
        "known_limits": [
            "The trust model was trained on features with these scales: voucher_quality 20-100, "
            "loan_to_repayment_ratio 0.5-1.5, vouch_network_balance 0-2, transaction_frequency 1-100. "
            "Other scales give wrong scores.",
            "The anomaly model was trained with contamination 0.1, so it flags about 10% of its own "
            "training wallets as anomalies by design.",
        ],
        "files": files,
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT_DIR / "metadata.json")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
