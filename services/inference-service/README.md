# MoodLens Inference Service

FastAPI microservice that serves the trained ML models from Phase 2.5.

## Architecture

```
React Frontend
     ↓ HTTP
Node.js Backend  (api-server/)
     ↓ HTTP (POST /analyze)
Python Inference Service  (this folder)
     ↓ in-memory
Trained Models  (.pkl artifacts)
```

The Node.js backend calls this service for users with 14+ days of data. New users keep using the rule-based formulas in `wellnessCalculator.js`.

## Setup

### 1. Copy your trained artifacts

After running Phase 2.5 in Colab, download these two files and place them here:

```
inference-service/
├── artifacts/
│   ├── moodlens_models_v2.pkl       ← from Colab
│   └── moodlens_schemas_v2.json     ← from Colab
├── main.py
├── requirements.txt
└── README.md
```

### 2. Install dependencies

```bash
cd inference-service
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Visit http://localhost:8000/docs for the interactive Swagger UI.

## Endpoints

### `GET /health`

Returns service status, models loaded, and the benchmark metrics from training.

```bash
curl http://192.168.100.92/:8000/health
```

### `POST /analyze` (main endpoint)

Returns wellness + anomaly + cluster in one call. This is what the Node.js backend uses.

Request:
```json
{
  "user_id": "6a05fc953f36164e0263c4c7",
  "dass": {
    "depression_scaled": 20,
    "anxiety_scaled": 24,
    "stress_scaled": 22
  },
  "daily_data": [
    {"date": "2026-05-09", "sleep_hours": 7.5, "steps": 8200, "active_energy": 420},
    {"date": "2026-05-10", "sleep_hours": 6.8, "steps": 9100, "active_energy": 480},
    {"date": "2026-05-11", "sleep_hours": 8.1, "steps": 7500, "active_energy": 390}
  ]
}
```

Response:
```json
{
  "wellness": {
    "score": 62.4,
    "category": "Good",
    "color": "#0BEFC4",
    "description": "You're maintaining solid wellness with room for refinement.",
    "confidence": "medium",
    "top_drivers": [
      {"display_name": "Average sleep", "contribution": +4.2, "direction": "positive", "value": 7.47},
      {"display_name": "Sleep debt", "contribution": -2.1, "direction": "negative", "value": 1.6}
    ]
  },
  "anomaly": {
    "available": true,
    "is_anomaly": false,
    "anomaly_score": 0.087,
    "days_in_history": 18,
    "interpretation": "Today fits your typical pattern."
  },
  "cluster": {
    "available": true,
    "cluster_id": 1,
    "archetype_label": "Sedentary / Poor sleeper / Low anxiety",
    "silhouette_match": 0.42
  },
  "metadata": {
    "computed_at": "2026-05-16T12:34:56",
    "days_provided": 14,
    "model_version": "2.5-personalized",
    "baseline_derived": {
      "baseline_pos": 28.5, "baseline_neg": 27.3, "baseline_anxiety": 51.9
    }
  }
}
```

### Other endpoints

- `POST /predict/wellness` — only wellness + SHAP explanation
- `POST /detect/anomaly` — only the anomaly check (needs 14+ days)
- `POST /assign/cluster` — only the archetype assignment

## Troubleshooting

**"Model file not found"** — make sure `artifacts/moodlens_models_v2.pkl` exists. The `MOODLENS_ARTIFACTS` env var overrides the default location.

**"Need at least 14 days of history" for anomaly** — expected. The Node.js backend falls back to rule-based output for newer users.

**Port 8000 already in use** — `uvicorn main:app --port 8001` and update `INFERENCE_URL` in your Node.js `.env` to match.
