from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
import pandas as pd
import os
import tempfile
from pathlib import Path

from interpretation_rules import (
    generate_summary,
    generate_clinical_recommendations,
)
from report_generator import export_pdf  # your existing PDF export function

app = FastAPI(title="Readmission Risk Analysis API")

# -----------------------------
# 1️⃣ Analyze and return JSON
# -----------------------------
@app.post("/analyze")
async def analyze_file(
    disease: str = Form(...),
    file: UploadFile = File(...),
):
    """Analyze patient data and return risk, summary, and feature interpretations."""
    # Read uploaded file
    if file.filename.endswith(".csv"):
        df = pd.read_csv(file.file)
    elif file.filename.endswith((".xls", ".xlsx")):
        df = pd.read_excel(file.file)
    else:
        return JSONResponse({"error": "Only CSV or Excel files are supported."}, status_code=400)

    # ✅ Example placeholder for prediction model
    proba = 0.82  # Simulated probability output from your ML model
    decision = "High" if proba > 0.5 else "Low"

    # ✅ Example placeholder contribution dataframe
    contrib_df = pd.DataFrame({
        "Feature": ["HbA1c", "BMI", "Creatinine"],
        "Contribution": [0.23, 0.12, 0.08],
        "Value": [8.1, 31.2, 1.05],
    })

    # Generate textual summaries
    feature_values = contrib_df.set_index("Feature")["Value"].to_dict()

    summary_text = generate_summary(contrib_df, disease, proba, decision)
    rec_text, corr_text = generate_clinical_recommendations(contrib_df, disease, feature_values)

    # Prepare JSON output
    result = {
        "disease": disease,
        "probability": round(proba, 3),
        "decision": decision,
        "summary": summary_text,
        "recommendations": rec_text,
        "correlations": corr_text,
        "top_features": contrib_df.to_dict(orient="records"),
    }

    return JSONResponse(result)


# -----------------------------
# 2️⃣ PDF Download Endpoint
# -----------------------------
@app.post("/download_pdf")
async def download_pdf(
    disease: str = Form(...),
    probability: float = Form(...),
    decision: int = Form(...),
    threshold: float = Form(...),
    feature_values: str = Form(...),
):
    try:
        import json
        import numpy as np

        print("🧩 DEBUG: Received POST /download_pdf")

        # --- parse feature values safely ---
        feature_values = json.loads(feature_values)
        print("📊 Parsed feature_values:", feature_values)

        # --- create fake patient_df from those values ---
        patient_df = pd.DataFrame([feature_values])

        # --- create fake contrib_df (just a demo structure) ---
        contrib_df = pd.DataFrame({
            "Feature": list(feature_values.keys()),
            "Contribution": np.random.uniform(-0.3, 0.5, len(feature_values))
        })

        # --- generate patient_id ---
        import datetime
        patient_id = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

        print("🧠 ABOUT TO CALL export_pdf()")
        print("  contrib_df type:", type(contrib_df))
        print("  contrib_df value:", contrib_df)

        # --- call your working export_pdf function ---
        pdf_path = export_pdf(
            patient_id=patient_id,
            disease=disease,
            patient_df=patient_df,
            proba=float(probability),
            decision=int(decision),
            threshold=float(threshold),
            contrib_df=contrib_df
        )

        print(f"✅ PDF successfully generated at {pdf_path}")

        # --- return file to client ---
        if os.path.exists(pdf_path):
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=os.path.basename(pdf_path)
            )
        else:
            raise FileNotFoundError(f"PDF not found at {pdf_path}")

    except Exception as e:
        import traceback
        print("❌ ERROR in /download_pdf:", e)
        traceback.print_exc()
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )


# -----------------------------
# 3️⃣ Excel Download Endpoint
# -----------------------------
@app.post("/download/excel")
async def download_excel(
    disease: str = Form(...),
    file: UploadFile = File(...),
):
    """Generate Excel file with results."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmpfile:
        excel_path = tmpfile.name

    # Read file
    if file.filename.endswith(".csv"):
        df = pd.read_csv(file.file)
    elif file.filename.endswith((".xls", ".xlsx")):
        df = pd.read_excel(file.file)
    else:
        return JSONResponse({"error": "Only CSV or Excel files are supported."}, status_code=400)

    # Dummy model results
    proba = 0.82
    decision = "High" if proba > 0.5 else "Low"
    contrib_df = pd.DataFrame({
        "Feature": ["HbA1c", "BMI", "Creatinine"],
        "Contribution": [0.23, 0.12, 0.08],
        "Value": [8.1, 31.2, 1.05],
    })

    contrib_df.to_excel(excel_path, index=False)

    return FileResponse(excel_path, filename=f"{disease}_results.xlsx")
