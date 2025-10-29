from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import joblib
import io
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.backends.backend_pdf import PdfPages
from datetime import datetime
import matplotlib
from pathlib import Path
import numpy as np

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
        "aliases": ["diabetes", "type2diabetes", "type_2_diabetes", "diabetic", "t2d", "dm"]
    },
    "Pneumonia": {
        "model_file": "Pneumonia.pkl",
        "cols_file": "Pneumonia_cols.pkl",
        "categories_file": "Pneumonia_categories.pkl",
        "threshold": 0.50,
        "aliases": ["pneumonia", "lung_infection", "respiratory_infection"]
    },
    "Chronic Kidney Disease": {
        "model_file": "Chronic_Kidney_Disease.pkl",
        "cols_file": "Chronic_Kidney_Disease_cols.pkl",
        "categories_file": "Chronic_Kidney_Disease_categories.pkl",
        "threshold": 0.48,
        "aliases": ["ckd", "chronic_kidney_disease", "kidney", "renal", "chronic_kidney"]
    },
    "COPD": {
        "model_file": "COPD.pkl",
        "cols_file": "COPD_cols.pkl",
        "categories_file": "COPD_categories.pkl",
        "threshold": 0.50,
        "aliases": ["copd", "chronic_obstructive", "pulmonary", "emphysema"]
    },
    "Hypertension": {
        "model_file": "Hypertension.pkl",
        "cols_file": "Hypertension_cols.pkl",
        "categories_file": "Hypertension_categories.pkl",
        "threshold": 0.50,
        "aliases": ["hypertension", "high_blood_pressure", "htn", "blood_pressure", "bp"]
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
    
    print(f"Detecting disease from columns: {df_cols}")
    
    # Disease-specific column patterns
    disease_indicators = {
        "Type 2 Diabetes": {
            'required': {'age'},
            'indicators': {'glucose', 'hba1c', 'insulin', 'diabetes', 'albumin', 'hematocrit', 'cci'}
        },
        "Pneumonia": {
            'required': {'age'},
            'indicators': {'pneumonia', 'oxygen', 'wbc', 'temperature', 'comorb', 'followup', 'wbc_count', 'oxygen_saturation'}
        },
        "Chronic Kidney Disease": {
            'required': {'age'},
            'indicators': {'kidney', 'ckd', 'creatinine', 'bun', 'gfr', 'albumin', 'chronic_kidney'}
        },
        "COPD": {
            'required': {'age'},
            'indicators': {'copd', 'fev', 'smoking', 'oxygen', 'respiratory', 'exacerbation', 'fev1', 'smoking_status'}
        },
        "Hypertension": {
            'required': {'age'},
            'indicators': {'hypertension', 'systolic', 'diastolic', 'bp', 'blood_pressure', 'systolic_bp', 'diastolic_bp'}
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
    
    # PRIORITY 1: Check filename first for disease hints
    filename_lower = filename.lower().replace(" ", "_")
    print(f"Checking filename: {filename_lower}")
    
    for disease, config in DISEASE_REGISTRY.items():
        for alias in config["aliases"]:
            if alias in filename_lower:
                if disease in LOADED_MODELS:
                    print(f"Disease detected from filename: {disease}")
                    return disease, True, ""
    
    # PRIORITY 2: Score each disease based on column matches
    best_match = None
    best_score = 0
    
    for disease, patterns in disease_indicators.items():
        if disease not in LOADED_MODELS:
            continue
        
        # Check required columns
        required_match = len(patterns['required'] & df_cols) / len(patterns['required'])
        
        # Check indicator columns (count matches)
        indicator_matches = sum(1 for indicator in patterns['indicators'] if indicator in df_cols)
        indicator_score = indicator_matches / max(len(patterns['indicators']), 1)
        
        # Combined score (70% indicators, 30% required)
        score = (indicator_score * 0.7) + (required_match * 0.3)
        
        print(f"  {disease}: score={score:.2f} (indicators={indicator_matches}/{len(patterns['indicators'])}, required={required_match:.2f})")
        
        if score > best_score:
            best_score = score
            best_match = disease
    
    # Accept if score > 20% (lowered threshold for better detection)
    if best_match and best_score >= 0.2:
        print(f"Disease detected from columns: {best_match} (score: {best_score:.2f})")
        return best_match, True, ""
    
    # FALLBACK: If columns include obvious disease keywords
    for disease in DISEASE_REGISTRY.keys():
        disease_lower = disease.lower().replace(" ", "_")
        if any(disease_lower in col for col in df_cols):
            if disease in LOADED_MODELS:
                print(f"Disease detected from column names: {disease}")
                return disease, True, ""
    
    # If no good match found
    available_diseases = ", ".join(LOADED_MODELS.keys())
    print(f"Unable to detect disease. Best match was {best_match} with score {best_score:.2f}")
    return "Unknown", False, f"Unable to determine disease type from the uploaded data. Available models: {available_diseases}. Please ensure your file contains appropriate medical data columns or name your file with the disease type (e.g., 'hypertension_patients.xlsx')."

def risk_band(p: float) -> str:
    """Categorize probability into risk bands"""
    if p < 0.33: return "Low"
    if p < 0.66: return "Medium"
    return "High"

# Basic PDF Generation (Fallback)
def generate_basic_pdf_report(df: pd.DataFrame, disease: str, threshold: float) -> io.BytesIO:
    """Generate basic PDF report without SHAP"""
    buf = io.BytesIO()
    
    with PdfPages(buf) as pdf:
        # Cover page
        fig = plt.figure(figsize=(8.5, 11))
        plt.axis("off")
        plt.text(0.5, 0.7, f"{disease} Readmission Risk Report", 
                 ha="center", fontsize=24, weight="bold")
        plt.text(0.5, 0.6, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 
                 ha="center", fontsize=12)
        plt.text(0.5, 0.5, f"Total Patients: {len(df)}", ha="center", fontsize=14)
        plt.text(0.5, 0.45, f"Threshold: {threshold:.2f}", ha="center", fontsize=12)
        pdf.savefig()
        plt.close()
        
        # Risk distribution table
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.axis("off")
        
        high_count = len(df[df["Risk_Band"] == "High"])
        medium_count = len(df[df["Risk_Band"] == "Medium"])
        low_count = len(df[df["Risk_Band"] == "Low"])
        
        summary_data = [
            ["Risk Level", "Count", "Percentage"],
            ["High", high_count, f"{high_count/len(df)*100:.1f}%"],
            ["Medium", medium_count, f"{medium_count/len(df)*100:.1f}%"],
            ["Low", low_count, f"{low_count/len(df)*100:.1f}%"],
        ]
        
        table = ax.table(cellText=summary_data, loc="center", cellLoc="center")
        table.auto_set_font_size(False)
        table.set_fontsize(12)
        table.scale(1, 2)
        
        for i in range(1, 4):
            if summary_data[i][0] == "High":
                table[(i, 0)].set_facecolor('#ffcccc')
            elif summary_data[i][0] == "Medium":
                table[(i, 0)].set_facecolor('#fff4cc')
            else:
                table[(i, 0)].set_facecolor('#ccffcc')
        
        pdf.savefig()
        plt.close()
        
        # Risk distribution chart
        fig, ax = plt.subplots(figsize=(8.5, 6))
        risk_counts = df["Risk_Band"].value_counts()
        colors_map = {"High": "#ef4444", "Medium": "#f59e0b", "Low": "#10b981"}
        
        bars = ax.bar(
            risk_counts.index, 
            risk_counts.values, 
            color=[colors_map.get(x, '#cccccc') for x in risk_counts.index]
        )
        
        ax.set_title(f"{disease} - Risk Distribution", fontsize=16, weight="bold")
        ax.set_xlabel("Risk Level", fontsize=12)
        ax.set_ylabel("Number of Patients", fontsize=12)
        
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}',
                   ha='center', va='bottom', fontsize=10)
        
        pdf.savefig()
        plt.close()
    
    buf.seek(0)
    return buf

# ADD: Clinical interpretation rules for common features
FEATURE_INTERPRETATIONS = {
    # Vital Signs & Labs
    "wbc_count": lambda v: "Elevated WBC suggests infection or inflammation" if float(v) > 11 else "WBC within normal range",
    "oxygen_saturation": lambda v: "Low oxygen levels may indicate respiratory distress" if float(v) < 90 else "Adequate oxygen saturation",
    "temperature": lambda v: "Fever present, possible infection" if float(v) > 38 else "Temperature within normal range",
    "heart_rate": lambda v: "Tachycardia detected" if float(v) > 100 else "Heart rate normal",
    "systolic_bp": lambda v: "Hypertensive reading" if float(v) > 140 else "Blood pressure controlled",
    "respiratory_rate": lambda v: "Tachypnea present" if float(v) > 20 else "Normal respiratory rate",
    
    # Diabetes-related
    "glucose": lambda v: "Hyperglycemia detected" if float(v) > 180 else "Glucose controlled",
    "hba1c": lambda v: "Poor glycemic control (>8%)" if float(v) > 8 else "Acceptable HbA1c level",
    "insulin_use": lambda v: "Insulin-dependent diabetes" if int(v) == 1 else "Not on insulin",
    "albumin": lambda v: "Low albumin suggests malnutrition" if float(v) < 3.5 else "Albumin adequate",
    "hematocrit": lambda v: "Anemia present" if float(v) < 36 else "Normal hematocrit",
    
    # Kidney function
    "creatinine": lambda v: "Elevated creatinine indicates kidney dysfunction" if float(v) > 1.5 else "Normal kidney function",
    "bun": lambda v: "Elevated BUN suggests renal impairment" if float(v) > 20 else "BUN within range",
    "gfr": lambda v: "Severely reduced kidney function" if float(v) < 30 else "Adequate GFR",
    
    # Demographics & History
    "age": lambda v: "Advanced age increases risk" if float(v) > 70 else "Age not a major risk factor",
    "prior_adm": lambda v: "Multiple prior admissions indicate chronic condition" if int(v) > 2 else "Limited prior admissions",
    "los": lambda v: "Extended hospital stay" if int(v) > 7 else "Standard length of stay",
    
    # Pneumonia-specific
    "comorb": lambda v: "Multiple comorbidities complicate recovery" if int(v) > 2 else "Limited comorbidities",
    "clin_instab": lambda v: "Clinical instability at discharge" if int(v) == 1 else "Stable at discharge",
    "followup": lambda v: "Follow-up scheduled" if int(v) == 1 else "No follow-up arranged",
    
    # COPD-specific
    "smoking_status": lambda v: "Active smoker - high risk" if int(v) == 1 else "Non-smoker or former smoker",
    "fev1": lambda v: "Severely reduced lung function" if float(v) < 50 else "Preserved lung function",
    "exacerbations": lambda v: "Frequent exacerbations" if int(v) > 2 else "Stable COPD",
    
    # General
    "visits_so_far": lambda v: "Frequent healthcare utilization" if int(v) > 5 else "Moderate healthcare use",
    "days_since_last": lambda v: "Recent previous admission" if int(v) < 30 else "No recent admissions",
}

def get_feature_interpretation(feature_name: str, value) -> str:
    """Get clinical interpretation for a feature based on its value"""
    feature_lower = feature_name.lower().strip()
    
    # Check if we have a specific interpretation rule
    if feature_lower in FEATURE_INTERPRETATIONS:
        try:
            return FEATURE_INTERPRETATIONS[feature_lower](value)
        except:
            pass
    
    # Default interpretations based on feature name patterns
    if "age" in feature_lower:
        return "Patient age factor"
    elif "prior" in feature_lower or "previous" in feature_lower:
        return "Previous admission history"
    elif "los" in feature_lower or "length" in feature_lower:
        return "Hospital stay duration"
    elif "avg" in feature_lower:
        return "Historical average metric"
    elif "delta" in feature_lower:
        return "Change from baseline"
    elif "score" in feature_lower:
        return "Composite risk score"
    else:
        return "Clinical factor contributing to risk"

# Enhanced PDF Generation with SHAP and Interpretations
def generate_enhanced_pdf_with_shap(df: pd.DataFrame, disease: str, threshold: float, model) -> io.BytesIO:
    """Generate comprehensive PDF report with SHAP interpretations"""
    buf = io.BytesIO()
    
    with PdfPages(buf) as pdf:
        # Page 1: Cover Page
        fig = plt.figure(figsize=(8.5, 11))
        plt.axis("off")
        plt.text(0.5, 0.75, "Patient Risk Report", 
                 ha="center", fontsize=26, weight="bold", color="#1f2937")
        plt.text(0.5, 0.68, f"{disease} Readmission Risk Analysis", 
                 ha="center", fontsize=16, color="#4b5563")
        plt.text(0.5, 0.58, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 
                 ha="center", fontsize=11, color="#6b7280")
        plt.text(0.5, 0.52, f"Total Patients Analyzed: {len(df)}", 
                 ha="center", fontsize=12, weight="bold")
        plt.text(0.5, 0.47, f"Model Threshold: {threshold:.2f}", 
                 ha="center", fontsize=11, color="#6b7280")
        
        # Add disclaimer
        plt.text(0.5, 0.15, "This report is generated by AI-powered predictive models.", 
                 ha="center", fontsize=9, style="italic", color="#9ca3af")
        plt.text(0.5, 0.12, "Clinical judgment should be used in conjunction with these predictions.", 
                 ha="center", fontsize=9, style="italic", color="#9ca3af")
        
        pdf.savefig()
        plt.close()
        
        # Page 2: Risk Distribution Summary
        fig = plt.figure(figsize=(8.5, 11))
        
        # Summary statistics table
        ax1 = plt.subplot(3, 1, 1)
        ax1.axis("off")
        
        high_count = len(df[df["Risk_Band"] == "High"])
        medium_count = len(df[df["Risk_Band"] == "Medium"])
        low_count = len(df[df["Risk_Band"] == "Low"])
        
        summary_data = [
            ["Risk Level", "Count", "Percentage", "Action Required"],
            ["High Risk", high_count, f"{high_count/len(df)*100:.1f}%", "Immediate follow-up within 7 days"],
            ["Medium Risk", medium_count, f"{medium_count/len(df)*100:.1f}%", "Standard follow-up within 14 days"],
            ["Low Risk", low_count, f"{low_count/len(df)*100:.1f}%", "Routine follow-up within 30 days"],
        ]
        
        table = ax1.table(cellText=summary_data, loc="center", cellLoc="center")
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1, 2.5)
        
        # Color code the rows
        table[(0, 0)].set_facecolor('#e5e7eb')
        table[(0, 1)].set_facecolor('#e5e7eb')
        table[(0, 2)].set_facecolor('#e5e7eb')
        table[(0, 3)].set_facecolor('#e5e7eb')
        
        for i in range(1, 4):
            if summary_data[i][0] == "High Risk":
                for j in range(4):
                    table[(i, j)].set_facecolor('#fee2e2')
            elif summary_data[i][0] == "Medium Risk":
                for j in range(4):
                    table[(i, j)].set_facecolor('#fef3c7')
            else:
                for j in range(4):
                    table[(i, j)].set_facecolor('#d1fae5')
        
        ax1.set_title(f"{disease} - Risk Distribution Summary", 
                     fontsize=14, weight="bold", pad=20)
        
        # Risk distribution chart
        ax2 = plt.subplot(3, 1, 2)
        risk_counts = df["Risk_Band"].value_counts()
        colors_map = {"High": "#ef4444", "Medium": "#f59e0b", "Low": "#10b981"}
        
        bars = ax2.bar(
            risk_counts.index, 
            risk_counts.values, 
            color=[colors_map.get(x, '#cccccc') for x in risk_counts.index],
            edgecolor='black',
            linewidth=1.5
        )
        
        ax2.set_title("Risk Distribution Chart", fontsize=12, weight="bold")
        ax2.set_xlabel("Risk Level", fontsize=10)
        ax2.set_ylabel("Number of Patients", fontsize=10)
        ax2.grid(axis='y', alpha=0.3)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}\n({height/len(df)*100:.1f}%)',
                   ha='center', va='bottom', fontsize=9, weight='bold')
        
        # Probability distribution
        ax3 = plt.subplot(3, 1, 3)
        ax3.hist(df["Predicted_Prob"], bins=30, color='#3b82f6', 
                alpha=0.7, edgecolor='black')
        ax3.axvline(threshold, color='red', linestyle='--', 
                   linewidth=2, label=f'Threshold ({threshold:.2f})')
        ax3.set_title("Probability Distribution", fontsize=12, weight="bold")
        ax3.set_xlabel("Readmission Probability", fontsize=10)
        ax3.set_ylabel("Frequency", fontsize=10)
        ax3.legend()
        ax3.grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        pdf.savefig()
        plt.close()
        
        # Page 3: SHAP Feature Analysis with Interpretations
        if len(df) > 0:
            try:
                # Get SHAP values for the first patient as example
                import shap
                explainer = shap.TreeExplainer(model)
                sample_patient = df.drop(['Predicted_Prob', 'Predicted_Class', 'Risk_Band'], 
                                        axis=1, errors='ignore').iloc[0:1]
                
                shap_values = explainer.shap_values(sample_patient)
                if isinstance(shap_values, list):
                    shap_values = shap_values[1]
                
                # Create SHAP interpretation table
                feature_names = sample_patient.columns.tolist()
                feature_values = sample_patient.iloc[0].values
                shap_contribs = shap_values[0]
                
                # Sort by absolute contribution
                indices = np.argsort(np.abs(shap_contribs))[::-1][:12]  # Top 12 features
                
                # Build table with Interpretation column
                fig, ax = plt.subplots(figsize=(8.5, 11))
                ax.axis("off")
                
                table_data = [["Feature", "Value", "Contribution", "Direction", "Clinical Interpretation"]]
                
                for idx in indices:
                    feature = feature_names[idx]
                    value = feature_values[idx]
                    contrib = shap_contribs[idx]
                    direction = "Increases Risk" if contrib > 0 else "Decreases Risk"
                    
                    # Get clinical interpretation
                    interpretation = get_feature_interpretation(feature, value)
                    
                    # Format value
                    try:
                        value_str = f"{float(value):.2f}" if isinstance(value, (int, float)) else str(value)
                    except:
                        value_str = str(value)
                    
                    table_data.append([
                        feature,
                        value_str,
                        f"{contrib:+.3f}",
                        direction,
                        interpretation
                    ])
                
                # Create table
                table = ax.table(cellText=table_data, loc="center", cellLoc="left")
                table.auto_set_font_size(False)
                table.set_fontsize(8)
                table.scale(1, 2)
                
                # Style header
                for j in range(5):
                    table[(0, j)].set_facecolor('#1f2937')
                    table[(0, j)].set_text_props(weight='bold', color='white')
                
                # Color code contributions
                for i in range(1, len(table_data)):
                    contrib_val = float(table_data[i][2])
                    if contrib_val > 0:
                        table[(i, 2)].set_facecolor('#fee2e2')
                    else:
                        table[(i, 2)].set_facecolor('#d1fae5')
                
                ax.set_title("Top Contributing Factors - SHAP Analysis with Clinical Interpretations", 
                           fontsize=14, weight="bold", pad=20)
                
                plt.tight_layout()
                pdf.savefig()
                plt.close()
                
            except Exception as e:
                print(f"SHAP analysis skipped: {e}")
        
        # Page: High-Risk Patients Detail
        high_risk_patients = df[df["Risk_Band"] == "High"]
        if len(high_risk_patients) > 0:
            fig, ax = plt.subplots(figsize=(8.5, 11))
            ax.axis("off")
            
            detail_data = [["Patient ID", "Probability", "Predicted Class", "Recommendation"]]
            
            for idx, row in high_risk_patients.head(20).iterrows():
                patient_id = row.get('patient_id', f'P-{idx+1:05d}')
                prob = row['Predicted_Prob']
                pred_class = row['Predicted_Class']
                recommendation = "Urgent follow-up within 7 days. Consider home health services."
                
                detail_data.append([
                    patient_id,
                    f"{prob:.3f}",
                    str(pred_class),
                    recommendation
                ])
            
            table = ax.table(cellText=detail_data, loc="center", cellLoc="left")
            table.auto_set_font_size(False)
            table.set_fontsize(8)
            table.scale(1, 2)
            
            # Style header
            for j in range(4):
                table[(0, j)].set_facecolor('#dc2626')
                table[(0, j)].set_text_props(weight='bold', color='white')
            
            ax.set_title(f"High-Risk Patients Detail (Showing {min(20, len(high_risk_patients))} of {len(high_risk_patients)})", 
                       fontsize=14, weight="bold", pad=20, color='#dc2626')
            
            plt.tight_layout()
            pdf.savefig()
            plt.close()
    
    buf.seek(0)
    return buf

# UPDATED: Upload endpoint with enhanced PDF generation
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
        
        # Validate schema and detect disease
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
        
        # Prepare data for prediction
        try:
            X = prepare_X(df, train_cols, cat_levels)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error preparing data for {disease} model: {str(e)}"
            )
        
        # Predict
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
        
        # JSON output
        if format == "json":
            return {
                "disease": disease,
                "records": df.to_dict(orient="records"),
                "total_records": len(df),
                "high_risk_count": len([r for r in df["Risk_Band"] if r == "High"]),
                "medium_risk_count": len([r for r in df["Risk_Band"] if r == "Medium"]),
                "low_risk_count": len([r for r in df["Risk_Band"] if r == "Low"]),
                "threshold": threshold
            }
        
        # PDF output - Fixed function call
        elif format == "pdf":
            try:
                # Try enhanced PDF with SHAP first
                buf = generate_enhanced_pdf_with_shap(df, disease, threshold, model)
                print(f"Generated enhanced PDF with SHAP for {disease}")
            except Exception as e:
                print(f"Enhanced PDF generation failed: {e}")
                print(f"Falling back to basic PDF report...")
                # Fallback to basic PDF if SHAP fails
                buf = generate_basic_pdf_report(df, disease, threshold)
                print(f"Generated basic PDF for {disease}")
            
            return StreamingResponse(
                buf,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={disease.replace(' ', '_')}_Risk_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
                    "Content-Type": "application/pdf"
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Upload endpoint error: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )