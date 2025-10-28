# report_generator.py
import os
import joblib
import numpy as np
import pandas as pd
import re
from datetime import datetime

from interpretation_rules import interpret_feature, generate_summary, generate_clinical_recommendations


# Optional SHAP for feature contributions
try:
    import shap
    SHAP_AVAILABLE = True
except Exception:
    SHAP_AVAILABLE = False

# PDF + Excel
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, LongTable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import xlsxwriter

# -----------------------------------------------------
# Configuration
# -----------------------------------------------------
MODEL_DIR = "models"
OUT_DIR = "reports"
os.makedirs(OUT_DIR, exist_ok=True)

REGISTRY = {
    "Type 2 Diabetes": {"threshold": 0.45},
    "Hypertension": {"threshold": 0.50},
    "Pneumonia": {"threshold": 0.50},
    "Chronic Kidney Disease": {"threshold": 0.48},
    "COPD": {"threshold": 0.50},
}


# -----------------------------------------------------
# Core model loading and prep
# -----------------------------------------------------
def load_model_and_metadata(disease):
    base = os.path.join(MODEL_DIR, disease.replace(" ", "_"))
    model = joblib.load(f"{base}.pkl")
    train_cols = joblib.load(f"{base}_cols.pkl")
    cat_levels = joblib.load(f"{base}_categories.pkl")
    return model, train_cols, cat_levels


def prepare_X(df, train_cols, cat_levels):
    X = df.drop(columns=[c for c in ["outcome_readmitted_30d", "disease"] if c in df.columns], errors="ignore").copy()

    for c in train_cols:
        if c not in X.columns:
            X[c] = 0
    X = X[train_cols]

    for col, cats in cat_levels.items():
        if col in X.columns:
            X[col] = pd.Categorical(X[col], categories=cats)

    return X


def predict(model, X, threshold):
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)[:, 1]
    else:
        proba = 1 / (1 + np.exp(-model.predict(X).ravel()))
    decision = int(proba[0] >= threshold)
    return float(proba[0]), decision


def compute_contributions(model, X, feature_names):
    x_row = X.iloc[[0]]
    values = x_row.iloc[0].to_dict()

    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(x_row)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        shap_contrib = shap_values[0]
        df = pd.DataFrame({
            "Feature": feature_names,
            "Value": [values[f] for f in feature_names],
            "Contribution": shap_contrib
        }).sort_values(by="Contribution", key=np.abs, ascending=False)
        print("✅ SHAP used for contribution analysis.")
        return df
    except Exception as e:
        print(f"⚠️ SHAP failed ({type(e).__name__}: {e}) → using proxy contributions.")
        proxy = []
        for f in feature_names:
            val = values[f]
            score = float(val) if isinstance(val, (int, float, np.number)) else (1.0 if str(val) not in ["0", "False", "home", "none"] else 0.0)
            proxy.append((f, val, score))
        return pd.DataFrame(proxy, columns=["Feature", "Value", "Contribution"]).sort_values(by="Contribution", key=np.abs, ascending=False)

def detect_disease_from_columns(df: pd.DataFrame) -> str:
    """Infer disease name based on columns present in the uploaded data."""
    cols = [c.lower() for c in df.columns]

    if any(c in cols for c in ["glucose", "hba1c", "insulin"]):
        return "Diabetes"
    elif any(c in cols for c in ["wbc_count", "oxygen_saturation", "temperature"]):
        return "Pneumonia"
    elif any(c in cols for c in ["creatinine", "bun", "gfr", "albumin"]):
        return "Chronic Kidney Disease"
    else:
        return "Unknown"

# -----------------------------------------------------
# Report generation (Excel / PDF / JSON)
# -----------------------------------------------------
def export_excel(patient_id, disease, patient_df, proba, decision, threshold, contrib_df):
    path = os.path.join(OUT_DIR, f"{patient_id}_{disease.replace(' ', '_')}.xlsx")
    with pd.ExcelWriter(path, engine="xlsxwriter") as writer:
        summary = pd.DataFrame({
            "Field": ["Patient ID", "Disease", "Predicted Risk", "Threshold", "Flagged High Risk", "Generated At"],
            "Value": [patient_id, disease, f"{proba:.2f}", f"{threshold:.2f}", "Yes" if decision else "No", datetime.now().isoformat(timespec="seconds")]
        })
        summary.to_excel(writer, sheet_name="Summary", index=False)

        contrib_df["Interpretation"] = contrib_df.apply(
            lambda row: interpret_feature(disease, row["Feature"], row["Contribution"], row["Value"]),
            axis=1
        )
        contrib_df.head(12).to_excel(writer, sheet_name="Top Factors", index=False)
        patient_df.to_excel(writer, sheet_name="Patient Data", index=False)

    print(f"✅ Excel report saved: {path}")
    return path


def export_pdf(patient_id, disease, patient_df, proba, decision, threshold, contrib_df):
    """
    Generate a patient PDF report (formatted version).
    Keeps original visual layout and wraps long text correctly.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, LongTable
    )
    from reportlab.lib.enums import TA_CENTER
    from datetime import datetime
    import numpy as np
    import os

    path = os.path.join(OUT_DIR, f"{patient_id}_{disease.replace(' ', '_')}_report.pdf")
    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    # Smaller text for dense tables
    wrap_style = ParagraphStyle(
        name="WrapSmall", fontName="Helvetica", fontSize=8, leading=10
    )

    elems = []

    # -------------------------
    # Header section
    # -------------------------
    elems.append(Paragraph("Patient Risk Report", styles["Title"]))
    elems.append(Spacer(1, 8))
    elems.append(Paragraph(f"Patient ID: {patient_id}", styles["Normal"]))
    elems.append(Paragraph(f"Disease: {disease}", styles["Normal"]))
    elems.append(Paragraph(f"Generated: {datetime.now().isoformat(timespec='minutes')}", styles["Normal"]))
    elems.append(Spacer(1, 10))

    # Risk summary
    risk_text = f"Predicted 30-day Readmission Risk: <b>{proba:.2f}</b> (Threshold {threshold:.2f}) → <b>{'Flagged High Risk' if decision==1 else 'Not Flagged'}</b>"
    elems.append(Paragraph(risk_text, styles["Heading2"]))
    elems.append(Spacer(1, 6))

    # Optional: index admission section (only if those columns exist)
    index_fields = [
        ("length_of_stay", "Index admission (LOS)", lambda v: f"{int(v)} days"),
        ("discharge_destination", "Discharge destination", str),
        ("prior_admissions_90d", "Prior admissions (90d)", lambda v: str(int(v))),
        ("comorbidities_count", "Comorbidities count", lambda v: str(int(v))),
        ("followup_scheduled", "Follow-up scheduled", lambda v: "Yes" if int(v) == 1 else "No"),
    ]
    idx_data = []
    for col, label, fmt in index_fields:
        if col in patient_df.columns:
            try:
                idx_data.append([label, fmt(patient_df[col].iloc[0])])
            except Exception:
                idx_data.append([label, "N/A"])
    if idx_data:
        t1 = Table(idx_data, colWidths=[220, 300])
        t1.setStyle(TableStyle([
            ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
            ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ]))
        elems.append(t1)
        elems.append(Spacer(1, 12))

    # -------------------------
    # Top contributing factors
    # -------------------------
    elems.append(Paragraph("Top contributing factors (SHAP)", styles["Heading2"]))

    # Format contributions
    def fmt_value(v):
        if isinstance(v, (int, float, np.number)):
            return f"{v:.2f}"
        try:
            f = float(v)
            return f"{f:.2f}"
        except Exception:
            return str(v)

    top = contrib_df.copy()
    top["Value"] = top["Value"].apply(fmt_value)
    top["Contribution"] = top["Contribution"].astype(float).round(3)
    top["Direction"] = top["Contribution"].apply(lambda x: "↑ Higher risk" if x > 0 else "↓ Lower risk")
    top["Interpretation"] = top.apply(
        lambda row: interpret_feature(
            disease,
            row["Feature"],
            row["Contribution"],
            row["Value"]
        ),
        axis=1
    )

    # Display top 8 only
    top = top.head(8)

    table_data = [["Feature", "Value", "Contribution", "Direction", "Interpretation"]]
    for _, row in top.iterrows():
        contrib_str = f"<font color='{'red' if row['Contribution'] > 0 else 'green'}'>{row['Contribution']:+.3f}</font>"
        dir_str = f"<font color='{'red' if 'Higher' in row['Direction'] else 'green'}'>{row['Direction']}</font>"
        table_data.append([
            Paragraph(str(row["Feature"]), wrap_style),
            Paragraph(str(row["Value"]), wrap_style),
            Paragraph(contrib_str, wrap_style),
            Paragraph(dir_str, wrap_style),
            Paragraph(row["Interpretation"], wrap_style)
        ])

    t2 = LongTable(table_data, colWidths=[80, 60, 70, 80, 220])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
    ]))
    elems.append(t2)
    elems.append(Spacer(1, 12))

    feature_values = (
    contrib_df.set_index("Feature")["Value"].to_dict()
    if "Value" in contrib_df.columns
    else {}
)


    # -------------------------
    # Summary section
    # -------------------------
    summary_text = generate_summary(contrib_df, disease, proba, decision)
    elems.append(Paragraph(summary_text, styles["Normal"]))
    elems.append(Spacer(1, 8))

    clinical_text = generate_clinical_recommendations(contrib_df, disease, feature_values)
    elems.append(Paragraph(clinical_text, styles["Normal"]))
    elems.append(Spacer(1, 12))

    doc.build(elems)
    print(f"✅ PDF report saved: {path}")
    return path


def infer_disease_from_filename(file_path: str):
    """
    Infer disease name from file name based on REGISTRY keys.
    Example:
        'patient_Type_2_Diabetes.csv' → 'Type 2 Diabetes'
        'CKD_sample.xlsx' → 'Chronic Kidney Disease'
    """
    file_name = os.path.basename(file_path).lower()
    for disease in REGISTRY.keys():
        norm = re.sub(r'[^a-z0-9]', '', disease.lower())
        if norm in re.sub(r'[^a-z0-9]', '', file_name):
            return disease
    raise ValueError(f"❌ Unable to infer disease name from file: {file_path}")

# -----------------------------------------------------
# Main process (load CSV/Excel → predict → report)
# -----------------------------------------------------
def generate_report_from_file(file_path: str, disease: str = None):
    # --- auto-detect disease from file name if not given ---
    if disease is None:
        disease = infer_disease_from_filename(file_path)
        print(f"🧠 Auto-detected disease: {disease}")

    # --- read file ---
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    elif file_path.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format. Use .csv or .xlsx")

    if df.shape[0] == 0:
        raise ValueError("No data found in the file.")

    # --- load model & predict ---
    model, train_cols, cat_levels = load_model_and_metadata(disease)
    threshold = REGISTRY[disease]["threshold"]

    X = prepare_X(df, train_cols, cat_levels)
    proba, decision = predict(model, X, threshold)
    contrib_df = compute_contributions(model, X, train_cols)

    patient_id = f"{datetime.now().strftime('%Y%m%d')}-{disease.split()[0]}-{np.random.randint(100,999)}"
    pdf_path = export_pdf(patient_id, disease, df, proba, decision, threshold, contrib_df)
    excel_path = export_excel(patient_id, disease, df, proba, decision, threshold, contrib_df)

    natural_summary = generate_summary(contrib_df, disease, proba, decision)
    result = {
        "patient_id": patient_id,
        "disease": disease,
        "probability": round(proba, 3),
        "decision": "High Risk" if decision else "Low Risk",
        "threshold": threshold,
        "interpretation": natural_summary,
        "excel_path": excel_path,
        "pdf_path": pdf_path
    }

    print(f"\n✅ Finished report for {disease}\n")
    return result


# -----------------------------------------------------
# Example manual usage
# -----------------------------------------------------
if __name__ == "__main__":
    FILE = "test/Type_2_Diabetes_patient.xlsx"  # or 'record_Pneumonia.csv'
    result = generate_report_from_file(FILE)  # disease auto-detected
    print(result)
