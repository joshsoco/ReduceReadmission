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
    Generate a professional 3-page patient PDF report.
    Page 1: Patient Overview & Clinical Management
    Page 2: Medication Recommendations
    Page 3: Disease Progression & Related Conditions
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
        PageBreak, Frame, PageTemplate
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from datetime import datetime
    import numpy as np
    import os
    
    from interpretation_rules import (
        interpret_feature,
        generate_summary,
        generate_medication_recommendations,
        generate_related_disease_predictions
    )

    path = os.path.join(OUT_DIR, f"{patient_id}_{disease.replace(' ', '_')}_report.pdf")
    
    # Create document with custom page template
    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch,
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=6,
        alignment=TA_LEFT
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=16,
        textColor=colors.HexColor('#34495e'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=8,
        spaceBefore=12,
        fontName='Helvetica-Bold',
        borderWidth=0,
        borderColor=colors.HexColor('#3498db'),
        borderPadding=0,
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=8,
        alignment=TA_LEFT
    )
    
    small_style = ParagraphStyle(
        'SmallText',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#2c3e50')
    )
    
    # Helper function to safely get patient data with N/A fallback
    def get_patient_value(column, default="N/A", formatter=None):
        try:
            if column in patient_df.columns:
                val = patient_df[column].iloc[0]
                if pd.isna(val) or val == "" or val is None:
                    return default
                if formatter:
                    return formatter(val)
                return str(val)
            return default
        except Exception:
            return default
    
    # Extract patient demographics
    patient_name = get_patient_value('patient_name', 'N/A', lambda x: str(x).upper())
    patient_age = get_patient_value('age', 'N/A', lambda x: f"{int(x)} years")
    patient_sex = get_patient_value('sex', 'N/A', lambda x: str(x).title())
    
    # Story for PDF content
    story = []
    
    # ===========================================
    # PAGE 1: PATIENT OVERVIEW & CLINICAL MANAGEMENT
    # ===========================================
    
    # Header
    story.append(Paragraph("City General Hospital", title_style))
    story.append(Paragraph("30-Day Readmission Risk Assessment", subtitle_style))
    story.append(Spacer(1, 12))
    
    # Patient Info Box
    patient_info_data = [
        ["Patient ID:", patient_id, "Generated:", datetime.now().strftime("%B %d, %Y %H:%M")],
        ["Patient Name:", patient_name, "Age:", patient_age],
        ["Sex:", patient_sex, "Disease:", disease]
    ]
    
    patient_info_table = Table(patient_info_data, colWidths=[1.2*inch, 2.3*inch, 1.2*inch, 2.3*inch])
    patient_info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ecf0f1')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
        ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#3498db')),
    ]))
    story.append(patient_info_table)
    story.append(Spacer(1, 15))
    
    # Risk Banner - Thinner with all white text
    risk_color = colors.HexColor('#e74c3c') if decision == 1 else colors.HexColor('#27ae60')
    risk_text = "HIGH RISK" if decision == 1 else "LOW RISK"
    
    risk_banner_text = (f"<para align=center>"
                       f"<font size=10 color='white'>30-Day Readmission Risk: </font>"
                       f"<font size=18 color='white'><b>{proba:.1%}</b></font>"
                       f"<font size=10 color='white'> | Classification: <b>{risk_text}</b> (Threshold: {threshold:.0%})</font>"
                       f"</para>")
    
    risk_table = Table([[Paragraph(risk_banner_text, body_style)]], colWidths=[7*inch])
    risk_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), risk_color),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(risk_table)
    story.append(Spacer(1, 15))
    
    # Index Admission Summary
    story.append(Paragraph("Index Admission Summary", heading_style))
    story.append(Spacer(1, 6))
    
    admission_data = [
        ["Length of Stay:", get_patient_value('length_of_stay', 'N/A', lambda x: f"{int(x)} days"),
         "Discharge Destination:", get_patient_value('discharge_destination', 'N/A', str)],
        ["Prior Admissions (90d):", get_patient_value('prior_admissions_90d', 'N/A', int),
         "Comorbidities Count:", get_patient_value('comorbidities_count', 'N/A', int)],
        ["Follow-up Scheduled:", get_patient_value('followup_scheduled', 'N/A', lambda x: "Yes" if int(x) == 1 else "No"),
         "Admission Type:", get_patient_value('admission_type', 'N/A', str)],
    ]
    
    admission_table = Table(admission_data, colWidths=[1.8*inch, 1.7*inch, 1.8*inch, 1.7*inch])
    admission_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ecf0f1')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(admission_table)
    story.append(Spacer(1, 15))
    
    # Top Contributing Factors
    story.append(Paragraph("Top Contributing Risk Factors (SHAP Analysis)", heading_style))
    story.append(Spacer(1, 6))
    
    # Format contribution data
    def fmt_value(v):
        if isinstance(v, (int, float, np.number)):
            return f"{v:.2f}"
        try:
            return f"{float(v):.2f}"
        except:
            return str(v)
    
    top_features = contrib_df.head(8).copy()
    feature_values = contrib_df.set_index("Feature")["Value"].to_dict()
    
    contrib_table_data = [["Feature", "Value", "Contribution", "Impact", "Interpretation"]]
    
    for _, row in top_features.iterrows():
        feature = str(row["Feature"])
        value = fmt_value(row["Value"])
        contrib = float(row["Contribution"])
        direction = "↑ Higher Risk" if contrib > 0 else "↓ Lower Risk"
        
        interpretation = interpret_feature(disease, feature, contrib, row["Value"])
        # Clean interpretation - remove HTML and shorten
        interpretation = interpretation.replace("<b>", "").replace("</b>", "")
        if len(interpretation) > 150:
            interpretation = interpretation[:147] + "..."
        
        contrib_str = f"{contrib:+.3f}"
        
        contrib_table_data.append([
            Paragraph(feature, small_style),
            Paragraph(value, small_style),
            Paragraph(f"<font color='{'red' if contrib > 0 else 'green'}'><b>{contrib_str}</b></font>", small_style),
            Paragraph(f"<font color='{'red' if contrib > 0 else 'green'}'>{direction}</font>", small_style),
            Paragraph(interpretation, small_style)
        ])
    
    contrib_table = Table(contrib_table_data, colWidths=[0.9*inch, 0.7*inch, 0.8*inch, 0.9*inch, 3.7*inch])
    contrib_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
    ]))
    story.append(contrib_table)
    story.append(Spacer(1, 15))
    
    # Clinical Summary
    story.append(Paragraph("Clinical Summary", heading_style))
    story.append(Spacer(1, 6))
    
    summary_paragraphs = [
        f"This {patient_age} {patient_sex.lower()} patient presents with a <b>{risk_text.lower()} 30-day readmission risk ({proba:.1%})</b> following discharge for {disease} management. The risk assessment threshold for this condition is {threshold:.0%}, placing this patient {'significantly above' if decision == 1 else 'below'} the high-risk threshold.",
        
        f"<b>Primary Risk Drivers:</b> {', '.join(top_features.head(3)['Feature'].tolist())} are identified as major contributing factors.",
        
        "<b>Recommendation:</b> Close follow-up and aggressive management of identified risk factors is recommended to prevent readmission."
    ]
    
    for para in summary_paragraphs:
        story.append(Paragraph(para, body_style))
    
    story.append(Spacer(1, 12))
    
    # Clinical Management Recommendations
    story.append(Paragraph("Clinical Management Recommendations", heading_style))
    story.append(Spacer(1, 6))
    
    recommendations = [
        f"<b>Primary Disease Management:</b> Review and optimize current treatment plan for {disease}. Consider consultation with appropriate specialists.",
        
        "<b>Medication Reconciliation:</b> Complete medication review at discharge. Ensure patient understands all medications, dosing, and timing.",
        
        "<b>Care Coordination:</b> Schedule follow-up appointment within 7 days of discharge. Consider home health services for high-risk patients.",
        
        "<b>Patient Education:</b> Reinforce medication adherence, warning signs requiring immediate attention, and lifestyle modifications.",
        
        "<b>Laboratory Monitoring:</b> Schedule appropriate lab work based on disease-specific guidelines and medication monitoring requirements.",
    ]
    
    for rec in recommendations:
        story.append(Paragraph(f"• {rec}", body_style))
    
    # Ensure consistent spacing before page break
    story.append(Spacer(1, 0.3*inch))  # Fixed spacing to end of page
    
    # Page footer - positioned consistently
    story.append(Paragraph("<para align=right><font size=9 color='#7f8c8d'>Page 1 of 3</font></para>", body_style))
    
    # PAGE BREAK - Force new page
    story.append(PageBreak())
    
    # ===========================================
    # PAGE 2: MEDICATION RECOMMENDATIONS
    # ===========================================
    
    # Header for page 2
    story.append(Paragraph("City General Hospital", title_style))
    story.append(Paragraph("Medication Recommendations", subtitle_style))
    story.append(Spacer(1, 12))
    
    # Patient info header (compact)
    patient_info_data_p2 = [
        ["Patient ID:", patient_id, "Patient Name:", patient_name],
        ["Age / Sex:", f"{patient_age} / {patient_sex}", "Disease:", disease]
    ]
    
    patient_info_table_p2 = Table(patient_info_data_p2, colWidths=[1.2*inch, 2.3*inch, 1.2*inch, 2.3*inch])
    patient_info_table_p2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ecf0f1')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(patient_info_table_p2)
    story.append(Spacer(1, 15))
    
    # Alert box
    alert_text = ("<b>Important:</b> The following medication recommendations are based on current clinical "
                  "guidelines and the patient's risk profile. All medications must be reviewed, prescribed, "
                  "and adjusted by the attending physician based on individual patient factors, allergies, "
                  "drug interactions, and institutional protocols.")
    
    alert_table = Table([[Paragraph(alert_text, body_style)]], colWidths=[7*inch])
    alert_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff3cd')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#ffc107')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(alert_table)
    story.append(Spacer(1, 15))
    
    # Medication recommendations
    med_text = generate_medication_recommendations(disease, contrib_df, feature_values)
    
    # Convert HTML to paragraphs (clean version for PDF)
    med_text_clean = med_text.replace("<br/>", "\n").replace("<br>", "\n")
    med_text_clean = med_text_clean.replace("<b>", "<b>").replace("</b>", "</b>")
    med_text_clean = med_text_clean.replace("<i>", "<i>").replace("</i>", "</i>")
    
    for line in med_text_clean.split("\n"):
        if line.strip():
            story.append(Paragraph(line, body_style))
    
    # Page footer
    story.append(Spacer(1, 15))
    story.append(Paragraph("<para align=right><font size=9 color='#7f8c8d'>Page 2 of 3</font></para>", body_style))
    
    # PAGE BREAK
    story.append(PageBreak())
    
    # ===========================================
    # PAGE 3: DISEASE PROGRESSION & RELATED CONDITIONS
    # ===========================================
    
    # Header for page 3
    story.append(Paragraph("City General Hospital", title_style))
    story.append(Paragraph("Potential Disease Progression & Related Conditions", subtitle_style))
    story.append(Spacer(1, 12))
    
    # Patient info header (compact)
    story.append(patient_info_table_p2)
    story.append(Spacer(1, 15))
    
    # Related disease predictions
    disease_text = generate_related_disease_predictions(disease, contrib_df, feature_values)
    
    # Convert HTML to paragraphs (clean version for PDF)
    disease_text_clean = disease_text.replace("<br/>", "\n").replace("<br>", "\n")
    disease_text_clean = disease_text_clean.replace("<b>", "<b>").replace("</b>", "</b>")
    disease_text_clean = disease_text_clean.replace("<i>", "<i>").replace("</i>", "</i>")
    # Fix special characters that appear as black boxes
    disease_text_clean = disease_text_clean.replace("⚠️", "[HIGH RISK]")
    disease_text_clean = disease_text_clean.replace("⚡", "[MODERATE RISK]")
    disease_text_clean = disease_text_clean.replace("•", "-")
    
    for line in disease_text_clean.split("\n"):
        if line.strip():
            story.append(Paragraph(line, body_style))
    
    story.append(Spacer(1, 20))
    
    # Disclaimer
    disclaimer_text = ("<b>Disclaimer:</b> This report is generated by a machine learning model for clinical "
                      "decision support. All recommendations should be reviewed and approved by qualified "
                      "healthcare professionals. Medication dosages and treatment plans must be individualized "
                      "based on patient-specific factors, comorbidities, and current clinical guidelines.")
    
    disclaimer_table = Table([[Paragraph(disclaimer_text, small_style)]], colWidths=[7*inch])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(disclaimer_table)
    
    # Page footer
    story.append(Spacer(1, 15))
    story.append(Paragraph("<para align=right><font size=9 color='#7f8c8d'>Page 3 of 3</font></para>", body_style))
    
    # Build PDF
    doc.build(story)
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
