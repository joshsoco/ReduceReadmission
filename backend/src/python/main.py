from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import joblib
import io
import matplotlib
from pathlib import Path
import os
import re

matplotlib.use("Agg")

app = FastAPI(title="Readmission Risk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

# Disease Registry with model file patterns and thresholds
DISEASE_REGISTRY = {
    "Type 2 Diabetes": {
        "model_file": "Type_2_Diabetes.pkl",
        "cols_file": "Type_2_Diabetes_cols.pkl",
        "categories_file": "Type_2_Diabetes_categories.pkl",
        "threshold": 0.45,
        "aliases": ["diabetes", "type2diabetes", "type_2_diabetes"]
    },
    "Pneumonia": {
        "model_file": "Pneumonia.pkl",
        "cols_file": "Pneumonia_cols.pkl",
        "categories_file": "Pneumonia_categories.pkl",
        "threshold": 0.50,
        "aliases": ["pneumonia"]
    },
    "Chronic Kidney Disease": {
        "model_file": "Chronic_Kidney_Disease.pkl",
        "cols_file": "Chronic_Kidney_Disease_cols.pkl",
        "categories_file": "Chronic_Kidney_Disease_categories.pkl",
        "threshold": 0.48,
        "aliases": ["ckd", "chronic_kidney_disease", "kidney"]
    },
    "COPD": {
        "model_file": "COPD.pkl",
        "cols_file": "COPD_cols.pkl",
        "categories_file": "COPD_categories.pkl",
        "threshold": 0.50,
        "aliases": ["copd", "chronic_obstructive"]
    },
    "Hypertension": {
        "model_file": "Hypertension.pkl",
        "cols_file": "Hypertension_cols.pkl",
        "categories_file": "Hypertension_categories.pkl",
        "threshold": 0.50,
        "aliases": ["hypertension", "high_blood_pressure"]
    }
}

# Load all available models with metadata
LOADED_MODELS = {}

for disease, config in DISEASE_REGISTRY.items():
    model_path = MODEL_DIR / config["model_file"]
    cols_path = MODEL_DIR / config["cols_file"]
    categories_path = MODEL_DIR / config["categories_file"]
    
    if model_path.exists() and cols_path.exists() and categories_path.exists():
        try:
            model = joblib.load(model_path)
            train_cols = joblib.load(cols_path)
            cat_levels = joblib.load(categories_path)
            
            LOADED_MODELS[disease] = {
                "model": model,
                "train_cols": train_cols,
                "cat_levels": cat_levels,
                "threshold": config["threshold"]
            }
            print(f"Loaded {disease} model")
        except Exception as e:
            print(f"Failed to load {disease} model: {e}")
    else:
        missing = []
        if not model_path.exists(): missing.append("model")
        if not cols_path.exists(): missing.append("columns")
        if not categories_path.exists(): missing.append("categories")
        print(f"{disease}: Missing {', '.join(missing)} file(s)")

if not LOADED_MODELS:
    raise FileNotFoundError("No models loaded! Check models directory.")

print(f"Successfully loaded {len(LOADED_MODELS)} models: {list(LOADED_MODELS.keys())}")

# Root endpoint for health checks
@app.get("/")
async def root():
    """Root endpoint for health checks"""
    return {
        "status": "healthy",
        "message": "ML API is running",
        "available_diseases": list(LOADED_MODELS.keys()),
        "total_models": len(LOADED_MODELS)
    }

# Helper function to prepare data
def prepare_X(df: pd.DataFrame, train_cols: list, cat_levels: dict) -> pd.DataFrame:
    """Prepare input data for prediction"""
    X = df.copy()
    
    # Remove outcome columns if present
    outcome_cols = [c for c in ["outcome_readmitted_30d", "disease", "readmitted"] if c in X.columns]
    if outcome_cols:
        X = X.drop(columns=outcome_cols, errors='ignore')
    
    # Add missing columns with zeros
    for c in train_cols:
        if c not in X.columns:
            X[c] = 0
    
    # Reorder columns to match training
    X = X[train_cols]
    
    # Handle categorical variables
    for col, cats in cat_levels.items():
        if col in X.columns:
            X[col] = pd.Categorical(X[col], categories=cats)
    
    return X

# Schema validation with disease detection
def validate_schema(df: pd.DataFrame, filename: str = "") -> tuple[str, bool, str]:
    """
    Validate if the uploaded file contains hospital readmission data.
    Returns: (disease_type, is_valid, error_message)
    """
    df_cols = set(c.lower().strip().replace(" ", "_") for c in df.columns)
    
    # Disease-specific column patterns
    disease_indicators = {
        "Type 2 Diabetes": {
            'required': {'age', 'cci', 'los'},
            'indicators': {'glucose', 'hba1c', 'insulin', 'diabetes', 'albumin', 'hematocrit'}
        },
        "Pneumonia": {
            'required': {'age', 'los'},
            'indicators': {'pneumonia', 'oxygen', 'wbc', 'temperature', 'comorb', 'followup'}
        },
        "Chronic Kidney Disease": {
            'required': {'age', 'creatinine'},
            'indicators': {'kidney', 'ckd', 'gfr', 'bun', 'albumin', 'dialysis'}
        },
        "COPD": {
            'required': {'age'},
            'indicators': {'copd', 'fev', 'smoking', 'oxygen', 'respiratory', 'exacerbation'}
        },
        "Hypertension": {
            'required': {'age'},
            'indicators': {'hypertension', 'systolic', 'diastolic', 'bp', 'blood_pressure'}
        }
    }
    
    # Check for non-medical data
    non_medical_keywords = [
        'product', 'price', 'quantity', 'sales', 'customer', 'order',
        'invoice', 'item', 'category', 'sku', 'discount'
    ]
    
    has_non_medical = any(
        any(keyword in col for keyword in non_medical_keywords)
        for col in df_cols
    )
    
    if has_non_medical:
        return "Unknown", False, "This file appears to contain non-medical data. Please upload hospital readmission patient data."
    
    # Check medical context
    medical_keywords = [
        'patient', 'age', 'admission', 'diagnosis', 'medical', 'hospital',
        'los', 'length_of_stay', 'readmission', 'visit', 'discharge'
    ]
    
    has_medical_context = any(
        any(keyword in col for keyword in medical_keywords)
        for col in df_cols
    )
    
    if not has_medical_context and len(df_cols) > 5:
        return "Unknown", False, "This file does not appear to contain hospital readmission data."
    
    # Check filename first for disease hints
    filename_lower = filename.lower().replace(" ", "_")
    for disease, config in DISEASE_REGISTRY.items():
        for alias in config["aliases"]:
            if alias in filename_lower:
                if disease in LOADED_MODELS:
                    print(f"Disease detected from filename: {disease}")
                    return disease, True, ""
    
    # Score each disease based on column matches
    best_match = None
    best_score = 0
    
    for disease, patterns in disease_indicators.items():
        if disease not in LOADED_MODELS:
            continue
        
        required_match = len(patterns['required'] & df_cols) / len(patterns['required'])
        indicator_match = len(patterns['indicators'] & df_cols) / max(len(patterns['indicators']), 1)
        
        score = (required_match * 0.6) + (indicator_match * 0.4)
        
        if score > best_score:
            best_score = score
            best_match = disease
    
    if best_match and best_score >= 0.4:
        print(f"Disease detected from columns: {best_match} (score: {best_score:.2f})")
        return best_match, True, ""
    
    available_diseases = ", ".join(LOADED_MODELS.keys())
    return "Unknown", False, f"Unable to determine disease type. Available models: {available_diseases}. Please ensure your file contains appropriate medical data columns."

def risk_band(p: float) -> str:
    """Categorize probability into risk bands"""
    if p < 0.33: return "Low"
    if p < 0.66: return "Medium"
    return "High"

# Upload endpoint with validation
@app.post("/upload")
async def upload_file(file: UploadFile = File(...), format: str = Query("json")):
    try:
        contents = await file.read()
        
        try:
            if file.filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(contents))
            else:
                df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error reading file: {str(e)}. Please ensure the file is a valid CSV or Excel file."
            )
        
        if df.empty or len(df) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty. Please upload a file with patient data."
            )
        
        disease, is_valid, error_message = validate_schema(df, file.filename)
        
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=error_message
            )
        
        if disease not in LOADED_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Model for {disease} is not loaded. Available models: {', '.join(LOADED_MODELS.keys())}"
            )
        
        model_config = LOADED_MODELS[disease]
        model = model_config["model"]
        train_cols = model_config["train_cols"]
        cat_levels = model_config["cat_levels"]
        threshold = model_config["threshold"]
        
        try:
            X = prepare_X(df, train_cols, cat_levels)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error preparing data for {disease} model: {str(e)}"
            )
        
        try:
            if hasattr(model, 'predict_proba'):
                probs = model.predict_proba(X)[:, 1]
            else:
                import numpy as np
                predictions = model.predict(X)
                probs = 1 / (1 + np.exp(-predictions.ravel()))
            
            preds = (probs >= threshold).astype(int)
            
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error generating predictions for {disease}: {str(e)}"
            )
        
        df["Predicted_Prob"] = probs.round(3)
        df["Predicted_Class"] = preds
        df["Risk_Band"] = [risk_band(p) for p in probs]
        
        return {
            "disease": disease,
            "records": df.to_dict(orient="records"),
            "total_records": len(df),
            "high_risk_count": len([r for r in df["Risk_Band"] if r == "High"]),
            "medium_risk_count": len([r for r in df["Risk_Band"] if r == "Medium"]),
            "low_risk_count": len([r for r in df["Risk_Band"] if r == "Low"]),
            "threshold": threshold
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )
