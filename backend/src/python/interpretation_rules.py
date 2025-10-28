# interpretation_rules.py
import numpy as np
import re
from collections import Counter

# ------------------------------
# 1. Base interpretive rules
# ------------------------------
INTERPRETATION_RULES = {
    "pneumonia": {
        "wbc_count": "Elevated WBC suggests ongoing infection or inflammation.",
        "oxygen_saturation": "Low oxygen levels may indicate unresolved pneumonia or respiratory distress.",
        "temperature": "Persistent fever reflects ongoing infection or poor response to therapy.",
    },
    "diabetes": {
        "glucose": "Elevated glucose reflects poor glycemic control and delayed healing.",
        "hba1c": "High HbA1c shows chronic hyperglycemia and poor disease management.",
        "bmi": "High BMI increases metabolic stress and risk of complications.",
        "systolic_bp": "Uncontrolled blood pressure worsens diabetes outcomes.",
    },
    "copd": {
        "oxygen_saturation": "Low oxygen indicates inadequate ventilation or exacerbation.",
        "fev1": "Reduced FEV1 shows obstructed airflow or poor lung function.",
        "smoking_status": "Smoking history increases frequency of exacerbations.",
    },
    "hypertension": {
        "systolic_bp": "Elevated blood pressure indicates inadequate antihypertensive control.",
        "bmi": "Obesity contributes to poor BP control.",
        "creatinine": "Rising creatinine can suggest renal strain or damage from hypertension.",
    },
    "ckd": {
        "creatinine": "High creatinine indicates renal function decline.",
        "bun": "Elevated BUN may indicate renal impairment or dehydration.",
        "albumin": "Low albumin suggests protein loss due to kidney damage.",
    },
}

# ------------------------------
# 2. Reference ranges
# ------------------------------
REFERENCE_RANGES = {
    "glucose": {"low": 70, "high": 180, "unit": "mg/dL"},
    "hba1c": {"low": 4.0, "high": 6.5, "unit": "%"},
    "creatinine": {"low": 0.6, "high": 1.3, "unit": "mg/dL"},
    "bun": {"low": 7, "high": 25, "unit": "mg/dL"},
    "wbc_count": {"low": 4.0, "high": 11.0, "unit": "×10⁹/L"},
    "oxygen_saturation": {"low": 92, "high": 100, "unit": "%"},
    "systolic_bp": {"low": 90, "high": 140, "unit": "mmHg"},
    "bmi": {"low": 18.5, "high": 25, "unit": "kg/m²"},
    "albumin": {"low": 3.5, "high": 5.0, "unit": "g/dL"},
    "fev1": {"low": 1.8, "high": 4.0, "unit": "L"},
}

# ------------------------------
# 3. Medicine recommendations (non-prescriptive)
# ------------------------------
MED_RECOMMENDATIONS = {
    "glucose": "Review glycemic control; adjust insulin or oral hypoglycemics under supervision.",
    "hba1c": "Optimize long-term glycemic control; reinforce adherence and lifestyle management.",
    "creatinine": "Adjust renally cleared medications; consider nephrology consult.",
    "bun": "Assess hydration and renal perfusion; review medications for nephrotoxicity.",
    "wbc_count": "Review infection status; consider antibiotic adjustment if infection persists.",
    "oxygen_saturation": "Ensure adequate oxygen therapy; assess for exacerbation or infection.",
    "systolic_bp": "Reassess antihypertensive therapy; encourage adherence and salt restriction.",
    "bmi": "Reinforce weight management, nutrition counseling, and physical activity.",
    "albumin": "Assess nutritional intake and protein loss; consider dietitian referral.",
    "fev1": "Ensure proper inhaler technique; review bronchodilator and steroid regimen.",
}

# ------------------------------
# 4. Correlated conditions
# ------------------------------
CORRELATED_CONDITIONS = {
    "glucose": ["Diabetes mellitus", "Metabolic syndrome"],
    "hba1c": ["Chronic hyperglycemia", "Microvascular complications"],
    "creatinine": ["Chronic kidney disease", "Acute kidney injury"],
    "bun": ["Renal impairment", "Dehydration"],
    "wbc_count": ["Infection", "Inflammation", "Sepsis"],
    "oxygen_saturation": ["COPD", "Pneumonia", "Respiratory failure"],
    "systolic_bp": ["Hypertension", "Cardiac hypertrophy"],
    "bmi": ["Obesity", "Insulin resistance"],
    "albumin": ["Malnutrition", "Nephrotic syndrome"],
    "fev1": ["COPD", "Asthma", "Airflow obstruction"],
}

# ------------------------------
# 5. NEW: Disease-specific medication protocols
# ------------------------------
MEDICATION_PROTOCOLS = {
    "Type 2 Diabetes": {
        "first_line": [
            "Metformin 500-1000mg twice daily (adjust for renal function)",
            "SGLT2 inhibitors (e.g., Empagliflozin 10-25mg daily) if GFR >45",
            "GLP-1 agonists (e.g., Semaglutide) for cardiovascular benefit"
        ],
        "glucose_control": [
            "Insulin therapy if HbA1c >9% or symptomatic hyperglycemia",
            "DPP-4 inhibitors (e.g., Sitagliptin 100mg daily) as add-on",
            "Basal insulin (e.g., Glargine) starting 10 units at bedtime"
        ],
        "complications": [
            "ACE inhibitors/ARBs for nephroprotection (e.g., Lisinopril 10-40mg)",
            "Statin therapy (e.g., Atorvastatin 20-40mg) for cardiovascular risk",
            "Aspirin 81mg daily if cardiovascular disease present"
        ],
        "monitoring": "Check HbA1c every 3 months, annual kidney function, regular foot exams"
    },
    "Hypertension": {
        "first_line": [
            "ACE inhibitors (e.g., Lisinopril 10-40mg daily)",
            "ARBs (e.g., Losartan 50-100mg daily) if ACE-I not tolerated",
            "Calcium channel blockers (e.g., Amlodipine 5-10mg daily)",
            "Thiazide diuretics (e.g., Hydrochlorothiazide 12.5-25mg daily)"
        ],
        "combination_therapy": [
            "ACE-I + CCB for better BP control",
            "ARB + Thiazide for resistant hypertension",
            "Beta-blockers (e.g., Metoprolol) if cardiac comorbidity"
        ],
        "resistant_htn": [
            "Add Spironolactone 25-50mg if BP still >140/90",
            "Consider secondary causes screening",
            "Refer to hypertension specialist if uncontrolled on 3+ agents"
        ],
        "monitoring": "Home BP monitoring twice daily, monthly follow-up until controlled"
    },
    "Pneumonia": {
        "antibiotics": [
            "Amoxicillin-Clavulanate 875mg twice daily (7-10 days)",
            "Azithromycin 500mg day 1, then 250mg daily (5 days total)",
            "Levofloxacin 750mg daily if severe or resistant"
        ],
        "supportive": [
            "Supplemental oxygen to maintain SpO2 >92%",
            "Bronchodilators (e.g., Albuterol inhaler) if wheezing",
            "Acetaminophen 500mg every 6 hours for fever"
        ],
        "severe_cases": [
            "IV antibiotics (Ceftriaxone + Azithromycin) if hospitalized",
            "Corticosteroids (Prednisone 40mg x 5 days) if severe inflammation",
            "Consider ICU if respiratory failure"
        ],
        "monitoring": "Chest X-ray at 6 weeks, follow-up in 48-72 hours if outpatient"
    },
    "Chronic Kidney Disease": {
        "nephroprotection": [
            "ACE inhibitors (e.g., Enalapril 5-20mg daily) to slow progression",
            "ARBs (e.g., Irbesartan 150-300mg daily) if ACE-I not tolerated",
            "SGLT2 inhibitors (e.g., Dapagliflozin 10mg) if diabetic"
        ],
        "complications": [
            "Phosphate binders (e.g., Calcium acetate) with meals if hyperphosphatemia",
            "Erythropoietin if hemoglobin <10 g/dL",
            "Vitamin D supplementation (Calcitriol) for bone health",
            "Sodium bicarbonate if metabolic acidosis"
        ],
        "avoid": [
            "NSAIDs (kidney toxicity)",
            "Metformin if eGFR <30 mL/min",
            "Adjust doses for renally cleared drugs"
        ],
        "monitoring": "eGFR and creatinine every 3 months, nephrology referral if Stage 4+"
    },
    "COPD": {
        "bronchodilators": [
            "LABA + LAMA combo (e.g., Tiotropium + Olodaterol inhaler)",
            "Short-acting beta-agonist (Albuterol) as rescue inhaler",
            "Theophylline if persistent symptoms"
        ],
        "anti_inflammatory": [
            "Inhaled corticosteroids (e.g., Fluticasone) if frequent exacerbations",
            "PDE4 inhibitor (Roflumilast) for severe COPD",
            "Oral corticosteroids (Prednisone 40mg x 5 days) during exacerbations"
        ],
        "oxygen_therapy": [
            "Long-term oxygen if SpO2 <88% or PaO2 <55 mmHg",
            "Pulmonary rehabilitation program",
            "Smoking cessation support (Varenicline or Bupropion)"
        ],
        "monitoring": "Spirometry annually, pulse oximetry, vaccination (flu + pneumococcal)"
    }
}

# ------------------------------
# 6. NEW: Related disease progression mapping
# ------------------------------
DISEASE_PROGRESSION_MAP = {
    "Type 2 Diabetes": {
        "high_risk": [
            {
                "disease": "Diabetic Nephropathy",
                "risk_factors": ["elevated creatinine", "proteinuria", "poor HbA1c control"],
                "time_frame": "5-10 years",
                "prevention": "Strict BP control, ACE-I/ARB therapy, HbA1c <7%"
            },
            {
                "disease": "Diabetic Retinopathy",
                "risk_factors": ["HbA1c >8%", "hypertension", "diabetes duration >10 years"],
                "time_frame": "10-15 years",
                "prevention": "Annual eye exams, optimal glucose control"
            },
            {
                "disease": "Cardiovascular Disease",
                "risk_factors": ["high LDL", "obesity", "smoking", "hypertension"],
                "time_frame": "10-20 years",
                "prevention": "Statin therapy, aspirin, lifestyle modification"
            },
            {
                "disease": "Peripheral Neuropathy",
                "risk_factors": ["poor glycemic control", "long diabetes duration"],
                "time_frame": "5-10 years",
                "prevention": "Glucose control, B12 supplementation, foot care"
            }
        ],
        "moderate_risk": [
            {
                "disease": "Diabetic Foot Ulcers",
                "risk_factors": ["neuropathy", "poor circulation", "foot deformity"],
                "prevention": "Daily foot inspections, proper footwear"
            },
            {
                "disease": "Gastroparesis",
                "risk_factors": ["autonomic neuropathy", "poor glucose control"],
                "prevention": "Controlled glucose, smaller frequent meals"
            }
        ]
    },
    "Hypertension": {
        "high_risk": [
            {
                "disease": "Stroke",
                "risk_factors": ["systolic BP >160", "atrial fibrillation", "age >65"],
                "time_frame": "5-10 years",
                "prevention": "BP <130/80, anticoagulation if AFib, lifestyle changes"
            },
            {
                "disease": "Heart Failure",
                "risk_factors": ["uncontrolled BP", "LV hypertrophy", "coronary disease"],
                "time_frame": "10-15 years",
                "prevention": "ACE-I/ARB therapy, diuretics, sodium restriction"
            },
            {
                "disease": "Chronic Kidney Disease",
                "risk_factors": ["BP >140/90", "diabetes", "proteinuria"],
                "time_frame": "10-20 years",
                "prevention": "BP control, nephroprotective agents"
            }
        ],
        "moderate_risk": [
            {
                "disease": "Atrial Fibrillation",
                "risk_factors": ["left atrial enlargement", "uncontrolled HTN"],
                "prevention": "BP control, reduce alcohol intake"
            }
        ]
    },
    "Pneumonia": {
        "high_risk": [
            {
                "disease": "COPD",
                "risk_factors": ["smoking history", "recurrent infections", "age >50"],
                "time_frame": "2-5 years",
                "prevention": "Smoking cessation, vaccination, pulmonary rehab"
            },
            {
                "disease": "Chronic Respiratory Failure",
                "risk_factors": ["severe pneumonia", "underlying lung disease", "low SpO2"],
                "time_frame": "1-3 years",
                "prevention": "Oxygen therapy, pulmonary follow-up"
            }
        ],
        "moderate_risk": [
            {
                "disease": "Bronchiectasis",
                "risk_factors": ["recurrent pneumonia", "incomplete treatment"],
                "prevention": "Complete antibiotic course, chest physiotherapy"
            },
            {
                "disease": "Pleural Effusion",
                "risk_factors": ["severe pneumonia", "delayed treatment"],
                "prevention": "Early antibiotics, follow-up imaging"
            }
        ]
    },
    "Chronic Kidney Disease": {
        "high_risk": [
            {
                "disease": "End-Stage Renal Disease",
                "risk_factors": ["eGFR <30", "uncontrolled diabetes/HTN", "proteinuria"],
                "time_frame": "2-5 years (Stage 4), 1-2 years (Stage 5)",
                "prevention": "Nephrology care, dialysis planning, transplant evaluation"
            },
            {
                "disease": "Cardiovascular Disease",
                "risk_factors": ["CKD Stage 3+", "hypertension", "anemia"],
                "time_frame": "5-10 years",
                "prevention": "BP control, statin therapy, anemia management"
            },
            {
                "disease": "Anemia of CKD",
                "risk_factors": ["eGFR <45", "low EPO production"],
                "time_frame": "2-4 years",
                "prevention": "Iron supplementation, EPO therapy if Hgb <10"
            }
        ],
        "moderate_risk": [
            {
                "disease": "Secondary Hyperparathyroidism",
                "risk_factors": ["hyperphosphatemia", "low calcium", "CKD Stage 3+"],
                "prevention": "Phosphate binders, vitamin D, calcium supplementation"
            }
        ]
    },
    "COPD": {
        "high_risk": [
            {
                "disease": "Respiratory Failure",
                "risk_factors": ["FEV1 <30%", "frequent exacerbations", "hypoxemia"],
                "time_frame": "2-5 years",
                "prevention": "Oxygen therapy, pulmonary rehab, medication adherence"
            },
            {
                "disease": "Cor Pulmonale (Right Heart Failure)",
                "risk_factors": ["severe COPD", "chronic hypoxia", "pulmonary hypertension"],
                "time_frame": "5-10 years",
                "prevention": "Long-term oxygen, diuretics, treat underlying COPD"
            },
            {
                "disease": "Lung Cancer",
                "risk_factors": ["smoking history", "age >55", "COPD severity"],
                "time_frame": "10-20 years",
                "prevention": "Smoking cessation, annual low-dose CT screening"
            }
        ],
        "moderate_risk": [
            {
                "disease": "Pneumonia (Recurrent)",
                "risk_factors": ["impaired clearance", "immunosuppression"],
                "prevention": "Vaccination, inhaler technique, smoking cessation"
            }
        ]
    }
}

# ------------------------------
# 7. Helper: interpret individual feature
# ------------------------------
def interpret_feature(disease, feature, shap_value, value=None):
    feature_l = feature.lower()
    base = INTERPRETATION_RULES.get(disease.lower(), {}).get(
        feature_l, f"{feature} influences readmission risk."
    )

    # Reference range & abnormality detection
    ref = REFERENCE_RANGES.get(feature_l)
    ref_txt = ""
    if value is not None and ref is not None:
        try:
            if isinstance(value, (int, float, str)):
                val = float(value)
                if val > ref["high"]:
                    ref_txt = f" ({val:.2f}{ref['unit']} — above ref {ref['low']}-{ref['high']}{ref['unit']})"
                elif val < ref["low"]:
                    ref_txt = f" ({val:.2f}{ref['unit']} — below ref {ref['low']}-{ref['high']}{ref['unit']})"
                else:
                    ref_txt = f" ({val:.2f}{ref['unit']}; ref {ref['low']}-{ref['high']}{ref['unit']})"
            else:
                ref_txt = f" ({str(value)})"
        except Exception:
            ref_txt = f" ({str(value)})"

    # SHAP direction and strength
    mag = abs(shap_value)
    strength = (
        "major" if mag > 1.0 else "moderate" if mag > 0.5 else "minor" if mag > 0.2 else "minimal"
    )
    direction = "increases" if shap_value > 0 else "reduces"

    rec = MED_RECOMMENDATIONS.get(feature_l, "")
    corr = CORRELATED_CONDITIONS.get(feature_l, [])
    corr_txt = f" May be associated with: {', '.join(corr)}." if corr else ""

    return (
        f"{base}{ref_txt}. This feature has a {strength} effect and {direction} the readmission risk. "
        f"{rec}{corr_txt}"
    )

# ------------------------------
# 8. Helper: generate summary paragraph
# ------------------------------
def generate_summary(contrib_df, disease, proba, decision):
    """Generate readable summary with risk level and key features."""
    risk_level = "high" if decision == 1 else "low"

    top_pos = contrib_df[contrib_df["Contribution"] > 0]["Feature"].tolist()[:3]
    top_neg = contrib_df[contrib_df["Contribution"] < 0]["Feature"].tolist()[:3]

    base = f"The model predicts a <b>{risk_level}</b> 30-day readmission risk ({proba:.2f}) for <b>{disease}</b>. "
    detail = (
        f"Key risk factors include <b>{', '.join(top_pos) if top_pos else 'none'}</b>. "
        f"Protective factors include <b>{', '.join(top_neg) if top_neg else 'none'}</b>. "
    )

    if "pneumonia" in disease.lower():
        follow = "Recommend infection monitoring and follow-up chest imaging."
    elif "diabetes" in disease.lower():
        follow = "Review glycemic control and medication adherence."
    elif "copd" in disease.lower():
        follow = "Encourage respiratory therapy and inhaler adherence."
    elif "heart" in disease.lower():
        follow = "Suggest cardiac review and fluid management."
    else:
        follow = "Recommend scheduled follow-up and monitoring."

    return f"<b>Summary:</b> {base}{detail}{follow}"

# ------------------------------
# 9. NEW: Generate medication recommendations
# ------------------------------
def generate_medication_recommendations(disease, contrib_df, feature_values):
    """
    Generate specific medication recommendations based on disease and risk factors.
    
    Returns formatted HTML string with medication protocols.
    """
    protocols = MEDICATION_PROTOCOLS.get(disease, {})
    
    if not protocols:
        return "<b>Medication Recommendations:</b><br/>Consult with attending physician for appropriate therapy."
    
    output = ["<b>Recommended Medication Protocol:</b><br/>"]
    
    # First-line therapy
    if "first_line" in protocols:
        output.append("<br/><b>First-Line Therapy:</b><br/>")
        for med in protocols["first_line"]:
            output.append(f"• {med}<br/>")
    
    # Additional categories
    for key, meds in protocols.items():
        if key in ["first_line", "monitoring"]:
            continue
        
        category_name = key.replace("_", " ").title()
        output.append(f"<br/><b>{category_name}:</b><br/>")
        
        if isinstance(meds, list):
            for med in meds:
                output.append(f"• {med}<br/>")
        else:
            output.append(f"• {meds}<br/>")
    
    # Monitoring recommendations
    if "monitoring" in protocols:
        output.append(f"<br/><b>Monitoring:</b><br/>• {protocols['monitoring']}<br/>")
    
    output.append("<br/><i>Note: These are general guidelines. All medications should be prescribed and adjusted by the attending physician based on individual patient factors.</i>")
    
    return "".join(output)

# ------------------------------
# 10. NEW: Generate related disease predictions
# ------------------------------
def generate_related_disease_predictions(disease, contrib_df, feature_values):
    """
    Predict potential future diseases based on current condition and risk factors.
    
    Returns formatted HTML string with disease progression risks.
    """
    progression = DISEASE_PROGRESSION_MAP.get(disease, {})
    
    if not progression:
        return "<b>Related Disease Risk:</b><br/>No specific progression data available for this condition."
    
    output = ["<b>Potential Disease Progression & Related Conditions:</b><br/>"]
    
    # High-risk diseases
    if "high_risk" in progression:
        output.append("<br/><b>⚠️ High-Risk Conditions (Requires Active Prevention):</b><br/>")
        for idx, risk_disease in enumerate(progression["high_risk"], 1):
            output.append(f"<br/>{idx}. <b>{risk_disease['disease']}</b><br/>")
            output.append(f"   • <i>Risk Factors:</i> {', '.join(risk_disease['risk_factors'])}<br/>")
            output.append(f"   • <i>Typical Time Frame:</i> {risk_disease['time_frame']}<br/>")
            output.append(f"   • <i>Prevention Strategy:</i> {risk_disease['prevention']}<br/>")
    
    # Moderate-risk diseases
    if "moderate_risk" in progression:
        output.append("<br/><b>⚡ Moderate-Risk Conditions (Monitor Closely):</b><br/>")
        for idx, risk_disease in enumerate(progression["moderate_risk"], 1):
            output.append(f"<br/>{idx}. <b>{risk_disease['disease']}</b><br/>")
            output.append(f"   • <i>Risk Factors:</i> {', '.join(risk_disease['risk_factors'])}<br/>")
            output.append(f"   • <i>Prevention:</i> {risk_disease['prevention']}<br/>")
    
    # Add personalized risk assessment based on feature values
    output.append("<br/><b>Personalized Risk Assessment:</b><br/>")
    output.append(generate_personalized_risk_assessment(disease, feature_values))
    
    return "".join(output)

def generate_personalized_risk_assessment(disease, feature_values):
    """Generate personalized risk factors based on actual patient values."""
    risks = []
    
    # Check for elevated risk markers
    if "creatinine" in feature_values:
        try:
            creat = float(feature_values["creatinine"])
            if creat > 1.5:
                risks.append("Elevated creatinine suggests increased kidney disease risk")
        except:
            pass
    
    if "hba1c" in feature_values:
        try:
            hba1c = float(feature_values["hba1c"])
            if hba1c > 8.0:
                risks.append("HbA1c >8% significantly increases microvascular complication risk")
        except:
            pass
    
    if "systolic_bp" in feature_values:
        try:
            sbp = float(feature_values["systolic_bp"])
            if sbp > 160:
                risks.append("Systolic BP >160 increases stroke and heart failure risk")
        except:
            pass
    
    if "oxygen_saturation" in feature_values:
        try:
            spo2 = float(feature_values["oxygen_saturation"])
            if spo2 < 90:
                risks.append("Chronic hypoxemia may lead to cor pulmonale and respiratory failure")
        except:
            pass
    
    if risks:
        return "• " + "<br/>• ".join(risks) + "<br/>"
    else:
        return "• Current markers within acceptable ranges. Continue monitoring.<br/>"

# ------------------------------
# 11. UPDATED: Clinical recommendations with medications & related diseases
# ------------------------------
def generate_clinical_recommendations(contrib_df, disease, feature_values):
    """
    Enhanced function that generates:
    1. Clinical management recommendations
    2. Medication protocols
    3. Related disease predictions
    
    Returns combined formatted text for reports.
    """
    # Original recommendations
    recommendations = []
    correlations = []

    top_features = contrib_df.sort_values(by="Contribution", key=abs, ascending=False).head(6)

    for _, row in top_features.iterrows():
        feature = row["Feature"]
        shap_val = row["Contribution"]
        value = feature_values.get(feature, None)

        explanation = interpret_feature(disease, feature, shap_val, value)
        if not explanation:
            continue

        rec_matches = re.findall(
            r"(?:Review|Ensure|Adjust|Monitor|Assess|Reinforce|Encourage|Consider)[^.;]+[.;]",
            explanation
        )
        recommendations.extend(rec_matches)

        assoc_match = re.search(r"May be associated with:(.+)", explanation)
        if assoc_match:
            conditions = [c.strip().strip(".") for c in assoc_match.group(1).split(",")]
            correlations.extend(conditions)

    if not recommendations:
        recommendations = [
            "Review ongoing therapy and lab markers.",
            "Ensure adherence to medication and follow-up appointments."
        ]

    correlation_counts = Counter(correlations)
    correlation_str = (
        ", ".join([f"{c} (×{n})" for c, n in correlation_counts.items()])
        if correlation_counts
        else "None detected"
    )

    # Build comprehensive output
    output = []
    
    # Section 1: Clinical recommendations
    output.append("<b>Clinical Management Recommendations:</b><br/>")
    output.append("• " + "<br/>• ".join(recommendations[:5]))  # Top 5 recommendations
    
    # Section 2: Medication protocols
    output.append("<br/><br/>")
    output.append(generate_medication_recommendations(disease, contrib_df, feature_values))
    
    # Section 3: Related disease predictions
    output.append("<br/><br/>")
    output.append(generate_related_disease_predictions(disease, contrib_df, feature_values))
    
    # Section 4: Immediate correlations
    output.append("<br/><br/><b>Current Associated Conditions:</b><br/>")
    output.append(f"Based on feature analysis: {correlation_str}<br/>")
    
    return "".join(output)