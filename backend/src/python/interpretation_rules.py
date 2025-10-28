# interpretation_rules.py
import numpy as np

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
# 5. Helper: interpret individual feature
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
            # Ensure value is a number, not dict/list/etc.
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
# 6. Helper: generate summary paragraph
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

import re
from collections import Counter

def generate_clinical_recommendations(contrib_df, disease, feature_values):
    """
    Generates concise medicine recommendations and possible disease correlations
    based on SHAP contributions and feature values.

    Returns:
        (rec_text, corr_text) for PDF and API use.
    """
    from interpretation_rules import interpret_feature  # ensures local import

    recommendations = []
    correlations = []

    # Iterate through top contributing features
    top_features = contrib_df.sort_values(by="Contribution", key=abs, ascending=False).head(6)

    for _, row in top_features.iterrows():
        feature = row["Feature"]
        shap_val = row["Contribution"]
        value = feature_values.get(feature, None)

        explanation = interpret_feature(disease, feature, shap_val, value)
        if not explanation:
            continue

        # --- Extract phrases that look like recommendations ---
        rec_matches = re.findall(
            r"(?:Review|Ensure|Adjust|Monitor|Assess|Reinforce|Encourage|Consider)[^.;]+[.;]",
            explanation
        )
        recommendations.extend(rec_matches)

        # --- Extract correlated diseases after "May be associated with:" ---
        assoc_match = re.search(r"May be associated with:(.+)", explanation)
        if assoc_match:
            conditions = [c.strip().strip(".") for c in assoc_match.group(1).split(",")]
            correlations.extend(conditions)

    # If no recommendations were found, fallback with general guidance
    if not recommendations:
        recommendations = [
            "Review ongoing therapy and lab markers.",
            "Ensure adherence to medication and follow-up appointments."
        ]

    # Count duplicates
    correlation_counts = Counter(correlations)
    correlation_str = (
        ", ".join([f"{c} (×{n})" for c, n in correlation_counts.items()])
        if correlation_counts
        else "None detected"
    )

    # Convert into final structured text
    rec_text = (
        "<b>Medicine Recommendations</b><br/>"
        "Key clinical management suggestions:<br/>• "
        + "<br/>• ".join(recommendations)
    )

    corr_text = (
        "<b>Potential Disease Correlations</b><br/>"
        f"The data suggests possible associations with: {correlation_str}.<br/>"
        "Continued monitoring is advised."
    )

    return rec_text, corr_text



