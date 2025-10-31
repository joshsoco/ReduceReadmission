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
    """
    Generate comprehensive Excel medical report with multiple formatted sheets:
    - Executive Summary
    - Patient Demographics
    - Clinical Measurements
    - Risk Analysis (SHAP)
    - Medication Protocol
    - Disease Progression Risk
    - Trending Data (if available)
    - Reference Ranges
    """
    import pandas as pd
    import numpy as np
    from datetime import datetime
    import os
    
    from interpretation_rules import (
        interpret_feature,
        generate_medication_recommendations,
        generate_related_disease_predictions,
        REFERENCE_RANGES,
        MEDICATION_PROTOCOLS,
        DISEASE_PROGRESSION_MAP
    )
    
    path = os.path.join(OUT_DIR, f"{patient_id}_{disease.replace(' ', '_')}.xlsx")
    
    # Helper function to safely get patient data
    def get_value(column, default="N/A"):
        try:
            if column in patient_df.columns:
                val = patient_df[column].iloc[0]
                if pd.isna(val) or val == "" or val is None:
                    return default
                return val
            return default
        except Exception:
            return default
    
    with pd.ExcelWriter(path, engine="xlsxwriter") as writer:
        workbook = writer.book
        
        # Define formats
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#2c3e50',
            'font_color': 'white',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        title_format = workbook.add_format({
            'bold': True,
            'font_size': 16,
            'bg_color': '#3498db',
            'font_color': 'white',
            'align': 'center',
            'valign': 'vcenter'
        })
        
        high_risk_format = workbook.add_format({
            'bg_color': '#ffebee',
            'font_color': '#c62828',
            'bold': True,
            'border': 1
        })
        
        low_risk_format = workbook.add_format({
            'bg_color': '#e8f5e9',
            'font_color': '#2e7d32',
            'bold': True,
            'border': 1
        })
        
        normal_format = workbook.add_format({
            'bg_color': '#e8f5e9',
            'border': 1
        })
        
        abnormal_high_format = workbook.add_format({
            'bg_color': '#ffebee',
            'font_color': '#c62828',
            'border': 1
        })
        
        abnormal_low_format = workbook.add_format({
            'bg_color': '#fff3e0',
            'font_color': '#e65100',
            'border': 1
        })
        
        label_format = workbook.add_format({
            'bold': True,
            'bg_color': '#ecf0f1',
            'border': 1
        })
        
        data_format = workbook.add_format({
            'border': 1
        })
        
        percent_format = workbook.add_format({
            'num_format': '0.00%',
            'border': 1
        })
        
        number_format = workbook.add_format({
            'num_format': '0.00',
            'border': 1
        })
        
        # ===========================================
        # SHEET 1: EXECUTIVE SUMMARY
        # ===========================================
        summary_data = {
            'Report Information': ['', '', '', '', '', ''],
            'Field': ['Patient ID', 'Patient Name', 'Age', 'Sex', 'Disease', 'Report Generated'],
            'Value': [
                patient_id,
                get_value('patient_name', 'N/A'),
                get_value('age', 'N/A'),
                get_value('sex', 'N/A'),
                disease,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ]
        }
        
        risk_data = {
            'Risk Assessment': ['', '', '', ''],
            'Metric': ['Predicted Risk Probability', 'Risk Threshold', 'Risk Classification', 'Recommendation'],
            'Value': [
                f"{proba:.2%}",
                f"{threshold:.2%}",
                "HIGH RISK" if decision else "LOW RISK",
                "Immediate intervention required" if decision else "Continue monitoring"
            ]
        }
        
        summary_df = pd.DataFrame(summary_data)
        risk_df = pd.DataFrame(risk_data)
        
        # Write to sheet
        summary_df.to_excel(writer, sheet_name='Executive Summary', index=False, startrow=1)
        risk_df.to_excel(writer, sheet_name='Executive Summary', index=False, startrow=len(summary_df) + 4)
        
        worksheet = writer.sheets['Executive Summary']
        worksheet.set_column('A:A', 20)
        worksheet.set_column('B:B', 25)
        worksheet.set_column('C:C', 40)
        
        # Add title
        worksheet.merge_range('A1:C1', f'READMISSION RISK REPORT - {disease.upper()}', title_format)
        
        # Format risk classification
        risk_row = len(summary_df) + 6
        if decision:
            worksheet.write(risk_row, 2, "HIGH RISK", high_risk_format)
        else:
            worksheet.write(risk_row, 2, "LOW RISK", low_risk_format)
        
        # ===========================================
        # SHEET 2: PATIENT DEMOGRAPHICS & VITALS
        # ===========================================
        demographics_data = []
        demographics_data.append(['PATIENT DEMOGRAPHICS', '', ''])
        demographics_data.append(['Field', 'Value', 'Notes'])
        demographics_data.append(['Patient Name', get_value('patient_name', 'N/A'), ''])
        demographics_data.append(['Age', get_value('age', 'N/A'), ''])
        demographics_data.append(['Sex', get_value('sex', 'N/A'), ''])
        demographics_data.append(['', '', ''])
        
        demographics_data.append(['ADMISSION DETAILS', '', ''])
        demographics_data.append(['Field', 'Value', 'Notes'])
        demographics_data.append(['Length of Stay', get_value('length_of_stay', 'N/A'), 'days'])
        demographics_data.append(['Discharge Destination', get_value('discharge_destination', 'N/A'), ''])
        demographics_data.append(['Admission Type', get_value('admission_type', 'N/A'), ''])
        demographics_data.append(['Prior Admissions (90d)', get_value('prior_admissions_90d', 'N/A'), ''])
        demographics_data.append(['Comorbidities Count', get_value('comorbidities_count', 'N/A'), ''])
        demographics_data.append(['Follow-up Scheduled', 'Yes' if get_value('followup_scheduled', 0) == 1 else 'No', ''])
        
        demographics_df = pd.DataFrame(demographics_data)
        demographics_df.to_excel(writer, sheet_name='Patient Demographics', index=False, header=False)
        
        worksheet = writer.sheets['Patient Demographics']
        worksheet.set_column('A:A', 25)
        worksheet.set_column('B:B', 25)
        worksheet.set_column('C:C', 30)
        
        # ===========================================
        # SHEET 3: CLINICAL MEASUREMENTS WITH FLAGS
        # ===========================================
        clinical_data = []
        clinical_data.append(['CLINICAL MEASUREMENTS', '', '', '', ''])
        clinical_data.append(['Parameter', 'Value', 'Unit', 'Reference Range', 'Status'])
        
        # Get all numeric columns
        for col in patient_df.columns:
            if col.lower() in REFERENCE_RANGES:
                ref = REFERENCE_RANGES[col.lower()]
                value = get_value(col, None)
                
                if value is not None and value != 'N/A':
                    try:
                        numeric_value = float(value)
                        ref_range = f"{ref['low']} - {ref['high']}"
                        
                        if numeric_value > ref['high']:
                            status = "HIGH"
                        elif numeric_value < ref['low']:
                            status = "LOW"
                        else:
                            status = "NORMAL"
                        
                        clinical_data.append([
                            col.replace('_', ' ').title(),
                            numeric_value,
                            ref['unit'],
                            ref_range,
                            status
                        ])
                    except:
                        clinical_data.append([col.replace('_', ' ').title(), value, '', '', 'N/A'])
        
        clinical_df = pd.DataFrame(clinical_data)
        clinical_df.to_excel(writer, sheet_name='Clinical Measurements', index=False, header=False)
        
        worksheet = writer.sheets['Clinical Measurements']
        worksheet.set_column('A:A', 25)
        worksheet.set_column('B:B', 15)
        worksheet.set_column('C:C', 15)
        worksheet.set_column('D:D', 20)
        worksheet.set_column('E:E', 15)
        
        # Apply conditional formatting
        for idx, row in enumerate(clinical_data[2:], start=2):  # Skip header rows
            if len(row) > 4:
                if row[4] == "HIGH":
                    worksheet.write(idx, 4, "HIGH", abnormal_high_format)
                elif row[4] == "LOW":
                    worksheet.write(idx, 4, "LOW", abnormal_low_format)
                elif row[4] == "NORMAL":
                    worksheet.write(idx, 4, "NORMAL", normal_format)
        
        # ===========================================
        # SHEET 4: RISK ANALYSIS (SHAP VALUES)
        # ===========================================
        feature_values = contrib_df.set_index("Feature")["Value"].to_dict()
        
        risk_analysis_data = []
        risk_analysis_data.append(['SHAP RISK FACTOR ANALYSIS', '', '', '', '', ''])
        risk_analysis_data.append(['Rank', 'Feature', 'Value', 'SHAP Contribution', 'Impact', 'Clinical Interpretation'])
        
        for idx, (_, row) in enumerate(contrib_df.head(15).iterrows(), start=1):
            interpretation = interpret_feature(disease, row['Feature'], row['Contribution'], row['Value'])
            # Clean interpretation
            interpretation = interpretation.replace('<b>', '').replace('</b>', '')
            interpretation = interpretation[:200] + '...' if len(interpretation) > 200 else interpretation
            
            impact = "Increases Risk" if row['Contribution'] > 0 else "Decreases Risk"
            
            risk_analysis_data.append([
                idx,
                row['Feature'],
                row['Value'],
                row['Contribution'],
                impact,
                interpretation
            ])
        
        risk_df = pd.DataFrame(risk_analysis_data)
        risk_df.to_excel(writer, sheet_name='Risk Analysis', index=False, header=False)
        
        worksheet = writer.sheets['Risk Analysis']
        worksheet.set_column('A:A', 8)
        worksheet.set_column('B:B', 25)
        worksheet.set_column('C:C', 15)
        worksheet.set_column('D:D', 18)
        worksheet.set_column('E:E', 18)
        worksheet.set_column('F:F', 60)
        
        # Color code contributions
        for idx, row in enumerate(risk_analysis_data[2:], start=2):
            if len(row) > 3 and isinstance(row[3], (int, float)):
                if row[3] > 0:
                    worksheet.write(idx, 3, row[3], abnormal_high_format)
                    worksheet.write(idx, 4, row[4], abnormal_high_format)
                else:
                    worksheet.write(idx, 3, row[3], normal_format)
                    worksheet.write(idx, 4, row[4], normal_format)
        
        # ===========================================
        # SHEET 5: MEDICATION PROTOCOL
        # ===========================================
        med_protocol = MEDICATION_PROTOCOLS.get(disease, {})
        
        med_data = []
        med_data.append(['MEDICATION RECOMMENDATIONS', '', '', ''])
        med_data.append(['Category', 'Medication', 'Dosage/Instructions', 'Notes'])
        
        if med_protocol:
            for category, medications in med_protocol.items():
                if category == 'monitoring':
                    continue
                
                category_name = category.replace('_', ' ').title()
                
                if isinstance(medications, list):
                    for idx, med in enumerate(medications):
                        if idx == 0:
                            med_data.append([category_name, med, '', ''])
                        else:
                            med_data.append(['', med, '', ''])
                else:
                    med_data.append([category_name, medications, '', ''])
            
            # Add monitoring
            if 'monitoring' in med_protocol:
                med_data.append(['', '', '', ''])
                med_data.append(['MONITORING REQUIREMENTS', '', '', ''])
                med_data.append(['', med_protocol['monitoring'], '', ''])
        else:
            med_data.append(['General', 'Consult attending physician for disease-specific protocol', '', ''])
        
        med_df = pd.DataFrame(med_data)
        med_df.to_excel(writer, sheet_name='Medication Protocol', index=False, header=False)
        
        worksheet = writer.sheets['Medication Protocol']
        worksheet.set_column('A:A', 25)
        worksheet.set_column('B:B', 50)
        worksheet.set_column('C:C', 30)
        worksheet.set_column('D:D', 30)
        
        # ===========================================
        # SHEET 6: DISEASE PROGRESSION RISK
        # ===========================================
        progression_map = DISEASE_PROGRESSION_MAP.get(disease, {})
        
        progression_data = []
        progression_data.append(['DISEASE PROGRESSION RISK ASSESSMENT', '', '', '', ''])
        progression_data.append(['Risk Level', 'Disease', 'Time Frame', 'Risk Factors', 'Prevention Strategy'])
        
        if progression_map:
            # High-risk conditions
            if 'high_risk' in progression_map:
                for condition in progression_map['high_risk']:
                    progression_data.append([
                        'HIGH',
                        condition['disease'],
                        condition.get('time_frame', 'Variable'),
                        ', '.join(condition.get('risk_factors', [])),
                        condition.get('prevention', '')
                    ])
            
            # Moderate-risk conditions
            if 'moderate_risk' in progression_map:
                for condition in progression_map['moderate_risk']:
                    progression_data.append([
                        'MODERATE',
                        condition['disease'],
                        condition.get('time_frame', 'Variable'),
                        ', '.join(condition.get('risk_factors', [])),
                        condition.get('prevention', '')
                    ])
        else:
            progression_data.append(['', 'No specific progression data available', '', '', ''])
        
        progression_df = pd.DataFrame(progression_data)
        progression_df.to_excel(writer, sheet_name='Disease Progression', index=False, header=False)
        
        worksheet = writer.sheets['Disease Progression']
        worksheet.set_column('A:A', 15)
        worksheet.set_column('B:B', 30)
        worksheet.set_column('C:C', 20)
        worksheet.set_column('D:D', 40)
        worksheet.set_column('E:E', 50)
        
        # Color code risk levels
        for idx, row in enumerate(progression_data[2:], start=2):
            if len(row) > 0:
                if row[0] == 'HIGH':
                    worksheet.write(idx, 0, 'HIGH', high_risk_format)
                elif row[0] == 'MODERATE':
                    worksheet.write(idx, 0, 'MODERATE', abnormal_low_format)
        
        # ===========================================
        # SHEET 7: COMPLETE RAW DATA
        # ===========================================
        patient_df.to_excel(writer, sheet_name='Raw Patient Data', index=False)
        
        worksheet = writer.sheets['Raw Patient Data']
        for idx, col in enumerate(patient_df.columns):
            worksheet.set_column(idx, idx, 20)
        
        # ===========================================
        # SHEET 8: REFERENCE RANGES
        # ===========================================
        ref_data = []
        ref_data.append(['CLINICAL REFERENCE RANGES', '', '', ''])
        ref_data.append(['Parameter', 'Low', 'High', 'Unit'])
        
        for param, ranges in REFERENCE_RANGES.items():
            ref_data.append([
                param.replace('_', ' ').title(),
                ranges['low'],
                ranges['high'],
                ranges['unit']
            ])
        
        ref_df = pd.DataFrame(ref_data)
        ref_df.to_excel(writer, sheet_name='Reference Ranges', index=False, header=False)
        
        worksheet = writer.sheets['Reference Ranges']
        worksheet.set_column('A:A', 25)
        worksheet.set_column('B:B', 15)
        worksheet.set_column('C:C', 15)
        worksheet.set_column('D:D', 15)
        
        # ===========================================
        # SHEET 9: CALCULATION SUMMARY
        # ===========================================
        calc_data = []
        calc_data.append(['MODEL CALCULATION DETAILS', '', ''])
        calc_data.append(['Metric', 'Value', 'Explanation'])
        calc_data.append(['Model Type', 'Machine Learning (SHAP-based)', 'Tree-based ensemble model'])
        calc_data.append(['Risk Threshold', f"{threshold:.2%}", 'Classification cutoff for high/low risk'])
        calc_data.append(['Predicted Probability', f"{proba:.2%}", 'Raw model output probability'])
        calc_data.append(['Risk Classification', "HIGH RISK" if decision else "LOW RISK", 
                         f"Probability {'≥' if decision else '<'} Threshold"])
        calc_data.append(['Number of Features', len(contrib_df), 'Total features analyzed'])
        calc_data.append(['Top Risk Factors', len(contrib_df[contrib_df['Contribution'] > 0]), 
                         'Features increasing risk'])
        calc_data.append(['Protective Factors', len(contrib_df[contrib_df['Contribution'] < 0]), 
                         'Features decreasing risk'])
        calc_data.append(['Strongest Risk Factor', contrib_df.iloc[0]['Feature'], 
                         f"Contribution: {contrib_df.iloc[0]['Contribution']:.3f}"])
        
        calc_df = pd.DataFrame(calc_data)
        calc_df.to_excel(writer, sheet_name='Calculations', index=False, header=False)
        
        worksheet = writer.sheets['Calculations']
        worksheet.set_column('A:A', 30)
        worksheet.set_column('B:B', 30)
        worksheet.set_column('C:C', 50)
    
    print(f"✅ Excel report saved: {path}")
    print(f"   📊 Sheets created: 9 (Executive Summary, Demographics, Clinical Measurements, " 
          "Risk Analysis, Medications, Disease Progression, Raw Data, Reference Ranges, Calculations)")
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
