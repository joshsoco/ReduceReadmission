from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import pandas as pd
import joblib, io
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.backends.backend_pdf import PdfPages
import shap
from datetime import datetime
import matplotlib
matplotlib.use("Agg")

app = FastAPI(title="Readmission Risk API")

# Load models once at startup
diabetes_model = joblib.load("model_Diabetes_XGBoost_long.pkl")
pneumonia_model = joblib.load("model_Pneumonia_XGBoost_long.pkl")

# ---------------------------
# Schema validation with strict checking
# ---------------------------
def validate_schema(df: pd.DataFrame) -> tuple[str, bool, str]:
    """
    Validate if the uploaded file contains hospital readmission data.
    Returns: (disease_type, is_valid, error_message)
    """
    df_cols = set(c.lower().strip() for c in df.columns)
    
    # Required columns for Diabetes readmission
    diabetes_cols = {
        'age', 'cci', 'prior_adm', 'los', 'dispo', 'insurance', 'hematocrit', 
        'albumin', 'anemia', 'insulin_use', 'socioecon', 'visits_so_far', 
        'days_since_last', 'avg_albumin_so_far', 'avg_los_so_far', 'delta_albumin'
    }
    
    # Required columns for Pneumonia readmission
    pneumonia_cols = {
        'age', 'comorb', 'clin_instab', 'adm_type', 'hac', 'gender', 'followup', 
        'edu_support', 'los', 'avg_los_so_far', 'visits_so_far', 
        'days_since_last', 'instab_rate_so_far'
    }
    
    # Check if file contains medical/hospital-related indicators
    medical_keywords = {
        'patient', 'admission', 'discharge', 'diagnosis', 'medical', 'hospital',
        'age', 'los', 'length_of_stay', 'readmission', 'visit', 'clinical'
    }
    
    has_medical_context = any(
        keyword in col for col in df_cols for keyword in medical_keywords
    )
    
    # Check for non-medical data (supermarket, retail, etc.)
    non_medical_keywords = {
        'product', 'price', 'quantity', 'sales', 'customer', 'order', 
        'invoice', 'item', 'category', 'sku', 'discount', 'payment',
        'store', 'cashier', 'total', 'subtotal', 'tax'
    }
    
    has_non_medical = any(
        keyword in col for col in df_cols for keyword in non_medical_keywords
    )
    
    if has_non_medical:
        return "Unknown", False, "This file appears to contain non-medical data (e.g., retail/sales data). Please upload hospital readmission patient data."
    
    if not has_medical_context and len(df_cols) > 5:
        return "Unknown", False, "This file does not appear to contain hospital readmission data. Please upload a file with patient medical records."
    
    # Check for specific disease schemas
    if diabetes_cols.issubset(df_cols):
        return "Diabetes", True, ""
    
    if pneumonia_cols.issubset(df_cols):
        return "Pneumonia", True, ""
    
    # Check for partial match (at least 50% of required columns)
    diabetes_match = len(diabetes_cols & df_cols) / len(diabetes_cols)
    pneumonia_match = len(pneumonia_cols & df_cols) / len(pneumonia_cols)
    
    if diabetes_match >= 0.5:
        missing_cols = diabetes_cols - df_cols
        return "Unknown", False, f"File partially matches Diabetes schema but missing required columns: {', '.join(sorted(missing_cols))}"
    
    if pneumonia_match >= 0.5:
        missing_cols = pneumonia_cols - df_cols
        return "Unknown", False, f"File partially matches Pneumonia schema but missing required columns: {', '.join(sorted(missing_cols))}"
    
    return "Unknown", False, "File schema not recognized. Please upload a file with either Diabetes or Pneumonia readmission patient data with the required columns."

def risk_band(p):
    if p < 0.33:
        return "Low"
    elif p < 0.66:
        return "Medium"
    else:
        return "High"

# ---------------------------
# Upload endpoint with validation
# ---------------------------
@app.post("/upload")
async def upload_file(file: UploadFile = File(...), format: str = Query("json")):
    try:
        # Read file
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
        
        # Validate empty file
        if df.empty or len(df) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty. Please upload a file with patient data."
            )
        
        # Validate schema
        disease, is_valid, error_message = validate_schema(df)
        
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=error_message
            )
        
        # Select model
        model = diabetes_model if disease == "Diabetes" else pneumonia_model
        
        # Predict
        try:
            probs = model.predict_proba(df)[:, 1]
            preds = model.predict(df)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error generating predictions. The data may not match the expected format: {str(e)}"
            )
        
        df["Predicted_Prob"] = probs.round(3)
        df["Predicted_Class"] = preds
        df["Risk_Band"] = [risk_band(p) for p in probs]
        
        # JSON output
        if format == "json":
            return {
                "disease": disease,
                "records": df.to_dict(orient="records"),
                "total_records": len(df),
                "high_risk_count": len([r for r in df["Risk_Band"] if r == "High"]),
                "medium_risk_count": len([r for r in df["Risk_Band"] if r == "Medium"]),
                "low_risk_count": len([r for r in df["Risk_Band"] if r == "Low"])
            }
        
        # PDF output
        elif format == "pdf":
            buf = generate_pdf_report(df, disease, model)
            return StreamingResponse(
                buf,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={disease}_report.pdf"}
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )

# ---------------------------
# PDF helpers
# ---------------------------
def add_cover_page(pdf, df, disease):
    patient_name = df.get("patient_name", ["Unknown"]).iloc[0]
    patient_id = df.get("patient_id", ["Unknown"]).iloc[0]
    room_id = df.get("room_id", ["Unknown"]).iloc[0]
    today = datetime.today().strftime("%Y-%m-%d")

    plt.figure(figsize=(8.5, 11))
    plt.axis("off")
    plt.text(0.5, 0.9, "Readmission Risk Report", ha="center", fontsize=20, weight="bold")
    plt.text(0.1, 0.75, f"Patient Name: {patient_name}", fontsize=14)
    plt.text(0.1, 0.70, f"Patient ID: {patient_id}", fontsize=14)
    plt.text(0.1, 0.65, f"Room ID: {room_id}", fontsize=14)
    plt.text(0.1, 0.60, f"Disease Type: {disease}", fontsize=14)
    plt.text(0.1, 0.55, f"Report Date: {today}", fontsize=14)
    pdf.savefig(); plt.close()

def add_summary_table(pdf, df, disease):
    counts = df["Risk_Band"].value_counts().reindex(["Low","Medium","High"], fill_value=0)
    fig, ax = plt.subplots(figsize=(6,3))
    ax.axis("off")
    table_data = [["Risk Band", "Count"]] + [[band, count] for band, count in counts.items()]
    table = ax.table(cellText=table_data, loc="center", cellLoc="center", colWidths=[0.5,0.3])
    table.auto_set_font_size(False); table.set_fontsize(12); table.scale(1.2, 1.2)
    ax.set_title(f"{disease} – Risk Band Summary", fontsize=14, weight="bold", pad=20)
    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)

# --- Helper: Cover Page ---
def add_cover_page(pdf, df, disease):
    today = datetime.today().strftime("%Y-%m-%d")
    plt.figure(figsize=(8.5, 11))
    plt.axis("off")
    plt.text(0.5, 0.9, "Readmission Risk Report", ha="center", fontsize=24, weight="bold")
    plt.axhline(0.85, color="black", linewidth=1)
    plt.text(0.1, 0.75, f"Patient Name: {df.get('patient_name', ['Unknown']).iloc[0]}", fontsize=14)
    plt.text(0.1, 0.70, f"Patient ID: {df.get('patient_id', ['Unknown']).iloc[0]}", fontsize=14)
    plt.text(0.1, 0.65, f"Room ID: {df.get('room_id', ['Unknown']).iloc[0]}", fontsize=14)
    plt.text(0.1, 0.60, f"Disease Type: {disease}", fontsize=14)
    plt.text(0.1, 0.55, f"Report Date: {today}", fontsize=14)
    pdf.savefig(); plt.close()

def add_patient_metadata(pdf, df):
    fig, ax = plt.subplots(figsize=(8.5, 11))
    ax.axis("off")

    # Prepare table data
    columns = df.columns.tolist()
    table_data = [columns] + df.astype(str).values.tolist()

    # Create table
    table = ax.table(cellText=table_data, loc="center", cellLoc="center",
                     colWidths=[1.0/len(columns)]*len(columns))

    # Style header
    for i in range(len(columns)):
        cell = table[0, i]
        cell.set_text_props(weight="bold", ha="center", color="white")
        cell.set_facecolor("#4CAF50")

    # Style rows
    for row in range(1, len(table_data)):
        for col in range(len(columns)):
            cell = table[row, col]
            cell.set_facecolor("#f9f9f9" if row % 2 == 0 else "#ffffff")
            cell.set_text_props(ha="center")

    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.0, 1.2)

    ax.set_title("Patient Metadata", fontsize=16, weight="bold", pad=20)
    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# --- Helper: Key Findings ---
def add_key_findings(pdf, df, disease):
    total = len(df)
    high_pct = round((df["Risk_Band"].eq("High").mean() * 100), 1)
    avg_prob = round(df["Predicted_Prob"].mean(), 3)
    last_risk = df["Risk_Band"].iloc[-1]

    plt.figure(figsize=(8.5, 11))
    plt.axis("off")
    plt.text(0.5, 0.9, f"{disease} – Key Findings", ha="center", fontsize=20, weight="bold")
    plt.text(0.1, 0.75, f"Total Visits: {total}", fontsize=14)
    plt.text(0.1, 0.70, f"High Risk Visits: {high_pct}%", fontsize=14)
    plt.text(0.1, 0.65, f"Average Predicted Probability: {avg_prob}", fontsize=14)
    plt.text(0.1, 0.60, f"Most Recent Visit Risk: {last_risk}", fontsize=14)
    pdf.savefig(); plt.close()

# --- Helper: Summary Table ---
def add_summary_table(pdf, df):
    counts = df["Risk_Band"].value_counts().reindex(["Low","Medium","High"], fill_value=0)
    fig, ax = plt.subplots(figsize=(6,3))
    ax.axis("off")
    table_data = [["Risk Band", "Count"]] + [[band, count] for band, count in counts.items()]
    table = ax.table(cellText=table_data, loc="center", cellLoc="center", colWidths=[0.5,0.3])
    table.auto_set_font_size(False); table.set_fontsize(12); table.scale(1.2, 1.2)
    for i, key in enumerate(table.get_celld()):
        cell = table.get_celld()[key]
        if key[0] == 0:  # header row
            cell.set_facecolor("#f0f0f0")
            cell.set_text_props(weight="bold")
        elif key[0] % 2 == 0:
            cell.set_facecolor("#ffffff")
        else:
            cell.set_facecolor("#f9f9f9")
    ax.set_title("Risk Band Summary", fontsize=14, weight="bold", pad=20)
    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)

# --- Helper: Risk Trajectory ---
def add_risk_trajectory(pdf, df):
    plt.figure(figsize=(8,4))
    sns.lineplot(x=range(len(df)), y=df["Predicted_Prob"], marker="o", color="#2196F3")
    plt.title("Risk Trajectory Over Time", fontsize=16)
    plt.xlabel("Visit Index"); plt.ylabel("Predicted Probability")
    plt.grid(True)
    pdf.savefig(); plt.close()

# --- Helper: Risk Distribution ---
def add_risk_distribution(pdf, df):
    risk_colors = {"Low":"#4CAF50","Medium":"#FFC107","High":"#F44336"}
    plt.figure(figsize=(6,4))
    sns.countplot(x="Risk_Band", data=df, order=["Low","Medium","High"], palette=risk_colors)
    plt.title("Risk Band Distribution", fontsize=16)
    plt.xlabel("Risk Band"); plt.ylabel("Count")
    plt.grid(True)
    pdf.savefig(); plt.close()

# --- Helper: SHAP Summary (optional) ---
def add_shap_summary(pdf, df, model):
    try:
        X = df.drop(columns=["Predicted_Prob","Predicted_Class","Risk_Band",
                             "patient_name","patient_id","room_id"], errors="ignore")
        # Clean numeric
        for col in X.columns:
            X[col] = (X[col].astype(str)
                      .str.replace("[","",regex=False)
                      .str.replace("]","",regex=False))
            X[col] = pd.to_numeric(X[col], errors="coerce")
        X = X.fillna(0)

        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)
        shap.summary_plot(shap_values, X, show=False)
        pdf.savefig(bbox_inches="tight"); plt.close()
    except Exception as e:
        plt.figure(figsize=(8.5, 11))
        plt.axis("off")
        plt.text(0.5, 0.5, f"SHAP Summary Plot Unavailable\n{e}", 
                 ha="center", va="center", fontsize=14, color="red")
        pdf.savefig(); plt.close()

# --- Main PDF Generator ---
def generate_pdf_report(df, disease, model):
    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        add_cover_page(pdf, df, disease)
        add_patient_metadata(pdf, df)
        add_key_findings(pdf, df, disease)
        add_summary_table(pdf, df)
        add_risk_trajectory(pdf, df)
        add_risk_distribution(pdf, df)
        add_shap_summary(pdf, df, model)
    buf.seek(0)
    return buf
