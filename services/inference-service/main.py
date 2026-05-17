"""
MoodLens Inference Service
==========================
FastAPI microservice that serves the trained ML models from Phase 2.5.

Endpoints:
- GET  /health                    Service status + model metadata
- POST /predict/wellness          XGBoost personalized wellness score + SHAP explanation
- POST /detect/anomaly            Per-user Isolation Forest anomaly detection
- POST /assign/cluster            User archetype assignment
- POST /analyze                   All of the above in one call (preferred by Node.js)

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Trained artifacts expected:
    ./artifacts/moodlens_models_v2.pkl
    ./artifacts/moodlens_schemas_v2.json
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── Logging ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
log = logging.getLogger("moodlens")

# ─── Load artifacts at startup ──────────────────────────────
ARTIFACTS_DIR = os.environ.get("MOODLENS_ARTIFACTS", "./artifacts")
MODELS_PATH = os.path.join(ARTIFACTS_DIR, "moodlens_models_v2.pkl")
SCHEMAS_PATH = os.path.join(ARTIFACTS_DIR, "moodlens_schemas_v2.json")

if not os.path.exists(MODELS_PATH):
    raise RuntimeError(
        f"Model file not found at {MODELS_PATH}. "
        f"Set MOODLENS_ARTIFACTS env var or copy moodlens_models_v2.pkl into ./artifacts/"
    )

log.info(f"Loading models from {MODELS_PATH}...")
artifacts = joblib.load(MODELS_PATH)

with open(SCHEMAS_PATH) as f:
    schemas = json.load(f)

# Unpack
WELLNESS_MODEL    = artifacts['wellness']['model']
WELLNESS_IMPUTER  = artifacts['wellness']['imputer']
WELLNESS_FEATURES = artifacts['wellness']['feature_names']
SHAP_EXPLAINER    = artifacts['wellness']['shap_explainer']

ANOMALY_FEATURES   = artifacts['anomaly']['feature_names']
ANOMALY_PRETRAINED = artifacts['anomaly']['pretrained_per_user']  # {user_id: IsolationForest}

CLUSTER_KMEANS     = artifacts['clusterer']['kmeans']
CLUSTER_SCALER     = artifacts['clusterer']['scaler']
CLUSTER_FEATURES   = artifacts['clusterer']['feature_names']
CLUSTER_ARCHETYPES = artifacts['clusterer']['archetypes']  # {0: "label", 1: "label", ...}

log.info(f"  - Wellness model: {len(WELLNESS_FEATURES)} features")
log.info(f"  - Anomaly detectors pre-trained for {len(ANOMALY_PRETRAINED)} users")
log.info(f"  - Cluster archetypes: {CLUSTER_ARCHETYPES}")

# ─── DASS-21 → baseline mapping ─────────────────────────────
# Our model was trained on PANAS + STAI labels (baseline_pos, baseline_neg, baseline_anxiety).
# Production users take DASS-21. We map DASS → baseline using linear calibration based on
# the empirical relationships in the LifeSnaps dataset.
#
# Empirical calibration (from LifeSnaps cross-correlations):
#   PANAS positive ↘ as depression ↗ (r ≈ -0.45)
#   PANAS negative ↗ as anxiety+stress ↗ (r ≈ 0.55)
#   STAI anxiety ≈ DASS anxiety × 1.4 + baseline (r ≈ 0.70)
#
# DASS scaled ranges: depression 0-42, anxiety 0-42, stress 0-42
def dass_to_baseline(dass_depression: float, dass_anxiety: float, dass_stress: float) -> dict:
    """
    Convert DASS-21 scaled scores to the baseline features the model expects.
    Returns: {baseline_pos, baseline_neg, baseline_anxiety}
    """
    # PANAS positive: 10-50, inversely related to depression
    # Healthy person: depression=0 → pos≈38; severe depression=42 → pos≈18
    baseline_pos = max(10.0, min(50.0, 38.0 - (dass_depression / 42.0) * 20.0))

    # PANAS negative: 10-50, positively related to anxiety + stress
    # Healthy: anxiety+stress=0 → neg≈14; severe both → neg≈42
    avg_neg_load = (dass_anxiety + dass_stress) / 2.0
    baseline_neg = max(10.0, min(50.0, 14.0 + (avg_neg_load / 42.0) * 28.0))

    # STAI anxiety: 20-80, related to DASS anxiety + stress
    baseline_anxiety = max(20.0, min(80.0, 30.0 + (avg_neg_load / 42.0) * 40.0))

    return {
        'baseline_pos': round(baseline_pos, 1),
        'baseline_neg': round(baseline_neg, 1),
        'baseline_anxiety': round(baseline_anxiety, 1),
    }

# ─── Pydantic request/response models ───────────────────────
class DASSScores(BaseModel):
    depression_scaled: float = Field(..., ge=0, le=42)
    anxiety_scaled:    float = Field(..., ge=0, le=42)
    stress_scaled:     float = Field(..., ge=0, le=42)

class DailyHealthDay(BaseModel):
    date:          str
    sleep_hours:   Optional[float] = None
    steps:         Optional[float] = None
    active_energy: Optional[float] = None

class AnalyzeRequest(BaseModel):
    user_id:    str
    dass:       DASSScores
    daily_data: list[DailyHealthDay] = Field(..., min_length=3)

class WellnessResponse(BaseModel):
    score:          float
    category:       str
    color:          str
    description:    str
    confidence:     str
    top_drivers:    list[dict]  # SHAP-driven explanations

class AnomalyResponse(BaseModel):
    is_anomaly:        bool
    anomaly_score:     float
    days_in_history:   int
    interpretation:    str

class ClusterResponse(BaseModel):
    cluster_id:        int
    archetype_label:   str
    silhouette_match:  float

class AnalyzeResponse(BaseModel):
    wellness:    WellnessResponse
    anomaly:     Optional[AnomalyResponse]
    cluster:     Optional[ClusterResponse]
    metadata:    dict

# ─── Feature engineering (mirrors training pipeline) ────────
def engineer_features(daily_data: list[DailyHealthDay], baseline: dict) -> pd.DataFrame:
    """
    Build the feature row the wellness model expects.
    Mirrors the build_features_for_window logic from Phase 1.
    """
    df = pd.DataFrame([d.model_dump() for d in daily_data])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    # Use last 7 days (or all available)
    window = df.tail(7).copy()
    feats = {'n_days_in_window': len(window)}

    # Sleep
    sleep_vals = window['sleep_hours'].dropna()
    if len(sleep_vals) >= 2:
        feats['sleep_mean']  = float(sleep_vals.mean())
        feats['sleep_std']   = float(sleep_vals.std())
        feats['sleep_min']   = float(sleep_vals.min())
        feats['sleep_max']   = float(sleep_vals.max())
        feats['sleep_debt']  = float(np.maximum(0, 8 - sleep_vals).sum())
        feats['sleep_trend'] = float(np.polyfit(range(len(sleep_vals)), sleep_vals.values, 1)[0])
    else:
        for k in ['sleep_mean','sleep_std','sleep_min','sleep_max','sleep_debt','sleep_trend']:
            feats[k] = np.nan

    # Steps
    step_vals = window['steps'].dropna()
    if len(step_vals) >= 2:
        feats['steps_mean']  = float(step_vals.mean())
        feats['steps_std']   = float(step_vals.std())
        feats['steps_min']   = float(step_vals.min())
        feats['steps_max']   = float(step_vals.max())
        feats['steps_trend'] = float(np.polyfit(range(len(step_vals)), step_vals.values, 1)[0])
        feats['days_under_5000_steps'] = int((step_vals < 5000).sum())
        feats['days_over_10000_steps'] = int((step_vals > 10000).sum())
    else:
        for k in ['steps_mean','steps_std','steps_min','steps_max','steps_trend',
                  'days_under_5000_steps','days_over_10000_steps']:
            feats[k] = np.nan

    # Energy
    cal_vals = window['active_energy'].dropna()
    if len(cal_vals) >= 2:
        feats['energy_mean'] = float(cal_vals.mean())
        feats['energy_std']  = float(cal_vals.std())
    else:
        feats['energy_mean'] = np.nan
        feats['energy_std']  = np.nan

    # Recovery ratio
    if not np.isnan(feats.get('sleep_mean', np.nan)) and not np.isnan(feats.get('steps_mean', np.nan)):
        feats['recovery_ratio'] = feats['sleep_mean'] / max(1, feats['steps_mean'] / 10000)
    else:
        feats['recovery_ratio'] = np.nan

    # Baseline (from DASS)
    feats['baseline_pos']     = baseline['baseline_pos']
    feats['baseline_neg']     = baseline['baseline_neg']
    feats['baseline_anxiety'] = baseline['baseline_anxiety']

    # days_since_baseline is approximated by the number of days of history
    feats['days_since_baseline'] = len(df)

    # Build row in correct column order
    row = pd.DataFrame([feats])
    # Add any features missing in our feature row (with NaN), drop any extras
    for f in WELLNESS_FEATURES:
        if f not in row.columns:
            row[f] = np.nan
    row = row[WELLNESS_FEATURES]
    return row

# ─── Wellness prediction with SHAP ──────────────────────────
def predict_wellness(daily_data: list[DailyHealthDay], baseline: dict) -> WellnessResponse:
    feature_row = engineer_features(daily_data, baseline)
    X = WELLNESS_IMPUTER.transform(feature_row.values)
    pred = float(np.clip(WELLNESS_MODEL.predict(X)[0], 0, 100))

    # Categorize
    if pred >= 80:
        category, color = 'Excellent', '#34D399'
        desc = 'Your mental and physical wellbeing are in strong alignment.'
    elif pred >= 60:
        category, color = 'Good', '#0BEFC4'
        desc = "You're maintaining solid wellness with room for refinement."
    elif pred >= 40:
        category, color = 'Moderate Risk', '#F5C842'
        desc = 'Some signals suggest your wellbeing needs attention.'
    elif pred >= 20:
        category, color = 'High Risk', '#FB923C'
        desc = 'Multiple indicators suggest you may benefit from support.'
    else:
        category, color = 'Critical Risk', '#F87171'
        desc = 'Please consider reaching out to a mental health professional.'

    # SHAP explanation — top features pulling the score up or down
    shap_values = SHAP_EXPLAINER(X)
    contributions = shap_values.values[0]  # array of per-feature contributions

    feature_contributions = sorted(
        zip(WELLNESS_FEATURES, contributions, feature_row.values[0]),
        key=lambda x: abs(x[1]),
        reverse=True,
    )

    top_drivers = []
    for feat_name, contrib, value in feature_contributions[:5]:
        if abs(contrib) < 0.1:
            continue
        top_drivers.append({
            'feature':       feat_name,
            'display_name':  _humanize_feature(feat_name),
            'contribution':  round(float(contrib), 2),
            'value':         round(float(value), 2) if not np.isnan(value) else None,
            'direction':     'positive' if contrib > 0 else 'negative',
        })

    # Confidence (based on how much data we had)
    n_days = int(feature_row['n_days_in_window'].iloc[0])
    if n_days >= 7:    confidence = 'high'
    elif n_days >= 5:  confidence = 'medium'
    else:              confidence = 'low'

    return WellnessResponse(
        score=round(pred, 1),
        category=category,
        color=color,
        description=desc,
        confidence=confidence,
        top_drivers=top_drivers,
    )

def _humanize_feature(name: str) -> str:
    mapping = {
        'sleep_mean':              'Average sleep',
        'sleep_std':               'Sleep consistency',
        'sleep_min':               'Shortest night',
        'sleep_max':               'Longest night',
        'sleep_debt':              'Sleep debt',
        'sleep_trend':             'Sleep trend',
        'steps_mean':              'Average steps',
        'steps_std':               'Activity variability',
        'steps_trend':             'Activity trend',
        'days_under_5000_steps':   'Low-activity days',
        'days_over_10000_steps':   'High-activity days',
        'energy_mean':             'Average energy burned',
        'energy_std':              'Energy variability',
        'recovery_ratio':          'Recovery ratio',
        'baseline_pos':            'Positive affect baseline',
        'baseline_neg':            'Negative affect baseline',
        'baseline_anxiety':        'Anxiety baseline',
        'days_since_baseline':     'Time in app',
        'n_days_in_window':        'Days of data',
    }
    return mapping.get(name, name.replace('_', ' ').capitalize())

# ─── Anomaly detection ──────────────────────────────────────
def detect_anomaly(user_id: str, daily_data: list[DailyHealthDay]) -> Optional[AnomalyResponse]:
    """
    If we have a pre-trained anomaly model for this user, use it.
    Otherwise, train one on-the-fly if user has 14+ days of data.
    Returns None if insufficient data.
    """
    from sklearn.ensemble import IsolationForest

    df = pd.DataFrame([d.model_dump() for d in daily_data])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    # Build rolling features matching training
    df['sleep_roll7_mean'] = df['sleep_hours'].rolling(7, min_periods=3).mean()
    df['sleep_roll7_std']  = df['sleep_hours'].rolling(7, min_periods=3).std()
    df['sleep_roll7_debt'] = (8 - df['sleep_hours']).clip(lower=0).rolling(7, min_periods=3).sum()
    df['steps_roll7_mean'] = df['steps'].rolling(7, min_periods=3).mean()
    df['steps_roll7_std']  = df['steps'].rolling(7, min_periods=3).std()
    df['energy_roll7_mean']= df['active_energy'].rolling(7, min_periods=3).mean()

    df_feat = df.dropna(subset=ANOMALY_FEATURES).copy()
    if len(df_feat) < 14:
        return None  # Not enough history

    X = df_feat[ANOMALY_FEATURES].values

    # Use pretrained model if available, otherwise train new
    if user_id in ANOMALY_PRETRAINED:
        model = ANOMALY_PRETRAINED[user_id]
    else:
        model = IsolationForest(n_estimators=100, contamination=0.10, random_state=42)
        model.fit(X)

    # Score the most recent day
    today_features = X[-1:].copy()
    score = float(model.decision_function(today_features)[0])
    is_anom = bool(model.predict(today_features)[0] == -1)

    if is_anom:
        interpretation = "Today's pattern is unusual compared to your typical days. Worth checking in with yourself."
    elif score > 0.1:
        interpretation = "Today fits your typical pattern."
    else:
        interpretation = "Today is slightly atypical for you, but within normal variation."

    return AnomalyResponse(
        is_anomaly=is_anom,
        anomaly_score=round(score, 3),
        days_in_history=len(df_feat),
        interpretation=interpretation,
    )

# ─── Cluster assignment ─────────────────────────────────────
def assign_cluster(daily_data: list[DailyHealthDay], baseline: dict) -> Optional[ClusterResponse]:
    df = pd.DataFrame([d.model_dump() for d in daily_data])
    df = df.dropna(subset=['sleep_hours', 'steps'])
    if len(df) < 7:
        return None

    sleep_mean  = float(df['sleep_hours'].mean())
    sleep_std   = float(df['sleep_hours'].std()) if len(df) > 1 else 0.0
    sleep_debt  = float(np.maximum(0, 8 - df['sleep_hours']).sum())
    steps_mean  = float(df['steps'].mean())

    feature_vec = [
        sleep_mean, sleep_std, sleep_debt, steps_mean,
        baseline['baseline_pos'], baseline['baseline_neg'], baseline['baseline_anxiety']
    ]

    X = np.array([feature_vec])
    X_scaled = CLUSTER_SCALER.transform(X)
    cluster_id = int(CLUSTER_KMEANS.predict(X_scaled)[0])

    # Distance to assigned cluster center vs nearest other (silhouette-style proxy)
    distances = CLUSTER_KMEANS.transform(X_scaled)[0]
    assigned_dist = distances[cluster_id]
    other_distances = np.delete(distances, cluster_id)
    nearest_other = float(other_distances.min())
    match_quality = max(0.0, min(1.0, 1 - (assigned_dist / nearest_other) if nearest_other > 0 else 0.5))

    return ClusterResponse(
        cluster_id=cluster_id,
        archetype_label=CLUSTER_ARCHETYPES.get(str(cluster_id), CLUSTER_ARCHETYPES.get(cluster_id, "Unknown")),
        silhouette_match=round(match_quality, 3),
    )

# ─── FastAPI app ────────────────────────────────────────────
app = FastAPI(
    title="MoodLens Inference Service",
    description="ML inference service for MoodLens — XGBoost + SHAP + IsolationForest + KMeans",
    version="2.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "moodlens-inference",
        "version": "2.5.0",
        "models_loaded": {
            "wellness": True,
            "anomaly_pretrained_users": len(ANOMALY_PRETRAINED),
            "clusterer": True,
        },
        "metrics_at_training": schemas.get("meta", {}),
    }

@app.post("/predict/wellness", response_model=WellnessResponse)
def predict_wellness_endpoint(req: AnalyzeRequest):
    try:
        baseline = dass_to_baseline(
            req.dass.depression_scaled,
            req.dass.anxiety_scaled,
            req.dass.stress_scaled,
        )
        return predict_wellness(req.daily_data, baseline)
    except Exception as e:
        log.exception("Wellness prediction failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/anomaly")
def detect_anomaly_endpoint(req: AnalyzeRequest):
    try:
        result = detect_anomaly(req.user_id, req.daily_data)
        if result is None:
            return {"available": False, "reason": "Need at least 14 days of history"}
        return {"available": True, **result.model_dump()}
    except Exception as e:
        log.exception("Anomaly detection failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/assign/cluster")
def cluster_endpoint(req: AnalyzeRequest):
    try:
        baseline = dass_to_baseline(
            req.dass.depression_scaled,
            req.dass.anxiety_scaled,
            req.dass.stress_scaled,
        )
        result = assign_cluster(req.daily_data, baseline)
        if result is None:
            return {"available": False, "reason": "Need at least 7 days of data"}
        return {"available": True, **result.model_dump()}
    except Exception as e:
        log.exception("Cluster assignment failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(req: AnalyzeRequest):
    """The endpoint your Node.js backend will primarily call.
    Returns wellness + anomaly + cluster in one round trip."""
    try:
        baseline = dass_to_baseline(
            req.dass.depression_scaled,
            req.dass.anxiety_scaled,
            req.dass.stress_scaled,
        )
        wellness = predict_wellness(req.daily_data, baseline)

        anomaly = None
        try:
            anomaly = detect_anomaly(req.user_id, req.daily_data)
        except Exception:
            log.warning("Anomaly detection skipped (likely insufficient data)")

        cluster = None
        try:
            cluster = assign_cluster(req.daily_data, baseline)
        except Exception:
            log.warning("Cluster assignment skipped")

        return AnalyzeResponse(
            wellness=wellness,
            anomaly=anomaly,
            cluster=cluster,
            metadata={
                "computed_at": datetime.utcnow().isoformat(),
                "days_provided": len(req.daily_data),
                "model_version": "2.5-personalized",
                "baseline_derived": baseline,
            }
        )
    except Exception as e:
        log.exception("Full analysis failed")
        raise HTTPException(status_code=500, detail=str(e))
    
if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
    )

