"""Train the three TrustLend models on SYNTHETIC data and measure them.

Run from the ml-api folder:   python -m training.train

Writes models/retrained/*.joblib and models/retrained/metadata.json (file hashes, settings,
measured quality, data source). The same seed gives the same data and the same models on the same
library versions.

Metrics here are measured on synthetic data. They show that the model learned the synthetic
rules. They are NOT evidence of accuracy on real borrowers.
"""

import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import adjusted_rand_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

from app.features import FRAUD_FEATURES, SCHEDULE_FEATURES, TRUST_FEATURES
from training.synth_data import (
    ARCHETYPES, make_fraud_attacks, make_fraud_data, make_schedule_data, make_trust_data,
)

SEED = 42
OUT_DIR = Path(__file__).resolve().parent.parent / "models" / "retrained"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def train_trust():
    X, y, p_true = make_trust_data(20_000, SEED)
    X_tr, X_te, y_tr, y_te, _, p_te = train_test_split(X, y, p_true, test_size=0.25, random_state=SEED)
    model = RandomForestClassifier(
        n_estimators=150, max_depth=10, min_samples_leaf=10, random_state=SEED, n_jobs=1,
    ).fit(X_tr, y_tr)
    proba = model.predict_proba(X_te)[:, 1]
    metrics = {
        "auc_vs_label": round(float(roc_auc_score(y_te, proba)), 4),
        "brier_vs_label": round(float(brier_score_loss(y_te, proba)), 4),
        # The generator knows the true repay chance, so we can also compare with it directly.
        "mean_abs_error_vs_true_probability": round(float(np.mean(np.abs(proba - p_te))), 4),
        "feature_importances": {
            n: round(float(v), 4) for n, v in sorted(zip(TRUST_FEATURES, model.feature_importances_), key=lambda x: -x[1])
        },
        "test_rows": int(len(X_te)),
    }
    return model, metrics


def train_fraud():
    normal = make_fraud_data(20_000, SEED)
    model = IsolationForest(n_estimators=200, contamination=0.02, random_state=SEED, n_jobs=1).fit(normal)
    test_normal = make_fraud_data(5_000, SEED + 1)
    attacks = make_fraud_attacks(1_000, SEED + 2)
    metrics = {
        "false_positive_rate_on_normal": round(float((model.predict(test_normal) == -1).mean()), 4),
        "detection_rate_on_synthetic_rings": round(float((model.predict(attacks) == -1).mean()), 4),
        "contamination": 0.02,
    }
    return model, metrics


def train_schedule():
    X, labels = make_schedule_data(6_000, SEED)
    model = KMeans(n_clusters=3, n_init=10, random_state=SEED).fit(X)

    # Name each cluster by its centre: the busiest is daily, the quietest is seasonal.
    centres = model.cluster_centers_[:, SCHEDULE_FEATURES.index("tx_per_month")]
    order = np.argsort(-centres)                    # busiest first
    mapping = {int(order[0]): ARCHETYPES[0], int(order[1]): ARCHETYPES[1], int(order[2]): ARCHETYPES[2]}

    # Check the clusters against the true archetype of each synthetic row.
    cluster_to_true = np.array([ARCHETYPES.index(mapping[int(c)]) for c in model.labels_])
    metrics = {
        "adjusted_rand_index_vs_true_archetype": round(float(adjusted_rand_score(labels, cluster_to_true)), 4),
        "accuracy_vs_true_archetype": round(float((cluster_to_true == labels).mean()), 4),
        "cluster_centres_tx_per_month_and_gap_days": {
            mapping[int(i)]: [round(float(v), 2) for v in model.cluster_centers_[i]] for i in mapping
        },
    }
    return {"model": model, "mapping": mapping}, metrics


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    jobs = {
        "trust": ("trust_score_model.joblib", train_trust, TRUST_FEATURES),
        "fraud": ("fraud_model.joblib", train_fraud, FRAUD_FEATURES),
        "schedule": ("repayment_model.joblib", train_schedule, SCHEDULE_FEATURES),
    }
    files = {}
    for key, (filename, fn, features) in jobs.items():
        obj, metrics = fn()
        path = OUT_DIR / filename
        joblib.dump(obj, path, compress=3)
        files[key] = {"file": filename, "sha256": sha256(path), "features": features, "metrics": metrics}
        print(f"{key}: {filename}  sha256={files[key]['sha256'][:12]}...")
        print("   ", json.dumps(metrics, indent=None)[:300])

    metadata = {
        "set": "retrained",
        "provenance": "Trained by training/train.py on SYNTHETIC data (training/synth_data.py).",
        "data_source": "synthetic",
        "real_world_validation": "none",
        "seed": SEED,
        "trained_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "library_versions": {
            "python": platform.python_version(),
            "scikit-learn": sklearn.__version__,
            "numpy": np.__version__,
        },
        "files": files,
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT_DIR / "metadata.json")


if __name__ == "__main__":
    sys.exit(main())
