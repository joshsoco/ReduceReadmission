from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import pandas as pd
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

# Import your existing functions
from report_generator import (
    load_model_and_metadata,
    prepare_X,
    predict,
    compute_contributions,
    export_pdf,
    export_excel,
    REGISTRY
)
from interpretation_rules import (
    generate_summary,
    generate_clinical_recommendations,
    interpret_feature
)

app = FastAPI(title="Readmission Risk Analysis API")

# Store generated files temporarily with unique IDs
TEMP_FILES = {}
REPORTS_DIR = "temp_reports"
os.makedirs(REPORTS_DIR, exist_ok=True)

# -----------------------------
# 1️⃣ Analyze and Generate Reports
# -----------------------------
@app.post("/analyze")
async def analyze_file(
    disease: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Analyze patient data and return risk analysis with download links for PDF/Excel.
    """
    try:
        # Validate disease
        if disease not in REGISTRY:
            return JSONResponse(
                {"error": f"Disease must be one of: {list(REGISTRY.keys())}"},
                status_code=400
            )
        
        # Read uploaded file into DataFrame
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif file.filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(file.file)
        else:
            return JSONResponse(
                {"error": "Only CSV or Excel files are supported."},
                status_code=400
            )
        
        if df.shape[0] == 0:
            return JSONResponse(
                {"error": "No data found in the file."},
                status_code=400
            )
        
        # Load model and predict
        model, train_cols, cat_levels = load_model_and_metadata(disease)
        threshold = REGISTRY[disease]["threshold"]
        
        X = prepare_X(df, train_cols, cat_levels)
        proba, decision = predict(model, X, threshold)
        
        # Compute feature contributions
        contrib_df = compute_contributions(model, X, train_cols)
        
        # Generate unique patient ID and session ID
        patient_id = f"{datetime.now().strftime('%Y%m%d')}-{disease.split()[0]}-{uuid.uuid4().hex[:6]}"
        session_id = uuid.uuid4().hex
        
        # Generate PDF and Excel reports
        pdf_path = export_pdf(patient_id, disease, df, proba, decision, threshold, contrib_df)
        excel_path = export_excel(patient_id, disease, df, proba, decision, threshold, contrib_df)
        
        # Store file paths with session ID
        TEMP_FILES[session_id] = {
            "pdf": pdf_path,
            "excel": excel_path,
            "timestamp": datetime.now(),
            "patient_id": patient_id
        }
        
        # Generate textual summaries
        feature_values = contrib_df.set_index("Feature")["Value"].to_dict()
        summary_text = generate_summary(contrib_df, disease, proba, decision)
        clinical_text = generate_clinical_recommendations(contrib_df, disease, feature_values)
        
        # Prepare top features with interpretations
        top_features = contrib_df.head(10).copy()
        top_features["Interpretation"] = top_features.apply(
            lambda row: interpret_feature(disease, row["Feature"], row["Contribution"], row["Value"]),
            axis=1
        )
        
        # Prepare JSON response
        result = {
            "session_id": session_id,
            "patient_id": patient_id,
            "disease": disease,
            "probability": round(float(proba), 3),
            "decision": "High Risk" if decision == 1 else "Low Risk",
            "threshold": threshold,
            "summary": summary_text,
            "clinical_recommendations": clinical_text,
            "top_features": top_features.to_dict(orient="records"),
            "download_links": {
                "pdf": f"/download/pdf/{session_id}",
                "excel": f"/download/excel/{session_id}"
            }
        }
        
        return JSONResponse(result)
    
    except Exception as e:
        return JSONResponse(
            {"error": f"Analysis failed: {str(e)}"},
            status_code=500
        )

# -----------------------------
# 2️⃣ PDF Download Endpoint
# -----------------------------
@app.get("/download/pdf/{session_id}")
async def download_pdf(session_id: str):
    """Download generated PDF report using session ID."""
    if session_id not in TEMP_FILES:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    pdf_path = TEMP_FILES[session_id]["pdf"]
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    
    patient_id = TEMP_FILES[session_id]["patient_id"]
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{patient_id}_report.pdf"
    )

# -----------------------------
# 3️⃣ Excel Download Endpoint
# -----------------------------
@app.get("/download/excel/{session_id}")
async def download_excel(session_id: str):
    """Download generated Excel report using session ID."""
    if session_id not in TEMP_FILES:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    excel_path = TEMP_FILES[session_id]["excel"]
    
    if not os.path.exists(excel_path):
        raise HTTPException(status_code=404, detail="Excel file not found")
    
    patient_id = TEMP_FILES[session_id]["patient_id"]
    return FileResponse(
        excel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"{patient_id}_report.xlsx"
    )

# -----------------------------
# 4️⃣ Health Check
# -----------------------------
@app.get("/health")
async def health_check():
    """Check if API is running and models are loaded."""
    return {
        "status": "healthy",
        "available_diseases": list(REGISTRY.keys()),
        "timestamp": datetime.now().isoformat()
    }

# -----------------------------
# 5️⃣ Cleanup old files (optional background task)
# -----------------------------
@app.on_event("startup")
async def cleanup_old_files():
    """Clean up temp files older than 24 hours on startup."""
    from datetime import timedelta
    
    cutoff = datetime.now() - timedelta(hours=24)
    expired_sessions = []
    
    for session_id, data in TEMP_FILES.items():
        if data["timestamp"] < cutoff:
            expired_sessions.append(session_id)
            # Delete files
            try:
                if os.path.exists(data["pdf"]):
                    os.remove(data["pdf"])
                if os.path.exists(data["excel"]):
                    os.remove(data["excel"])
            except Exception as e:
                print(f"Error cleaning up {session_id}: {e}")
    
    for session_id in expired_sessions:
        del TEMP_FILES[session_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)