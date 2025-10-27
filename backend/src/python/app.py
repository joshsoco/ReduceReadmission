from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import numpy as np
import joblib
import io
from pathlib import Path

app = FastAPI(title="Readmission Risk API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model loading with error handling
BASE_DIR = Path(__file__).resolve().parent  
MODEL_DIR = BASE_DIR / "models"

DIABETES_MODEL_PATH = MODEL_DIR / "model_Diabetes_XGBoost_long.pkl"
PNEUMONIA_MODEL_PATH = MODEL_DIR / "model_Pneumonia_XGBoost_long.pkl"

models_loaded = False

try:
    if not DIABETES_MODEL_PATH.exists() or not PNEUMONIA_MODEL_PATH.exists():
        raise FileNotFoundError("Model files not found in src/python/models")

    diabetes_model = joblib.load(DIABETES_MODEL_PATH)
    pneumonia_model = joblib.load(PNEUMONIA_MODEL_PATH)
    models_loaded = True
    print("✅ Models loaded successfully from:", MODEL_DIR)

except Exception as e:
    print(f"❌ Error loading models: {e}")

# Routes
@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "message": "ML API is running",
        "models_loaded": models_loaded
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), format: str = Query("json")):
    if not models_loaded:
        return JSONResponse({"error": "ML models not loaded properly"}, status_code=500)

    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')

        # Mock predictions
        mock_probs = np.random.random(len(df))
        df["Predicted_Prob"] = mock_probs.round(3)
        df["Risk_Band"] = ["Low" if p < 0.33 else "Medium" if p < 0.66 else "High"
                           for p in mock_probs]

        return {
            "disease": "Diabetes",
            "records": df.to_dict(orient="records")
        }

    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return JSONResponse(
            {"error": f"Error processing file: {str(e)}"},
            status_code=500
        )
