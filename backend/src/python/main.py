import pandas as pd
import joblib

# ---------------------------
# Utility: run predictions with risk banding
# ---------------------------
def test_model(model_file, patient_file, disease="Disease"):
    # Load pipeline
    pipe = joblib.load(model_file)

    # Load patient history
    df = pd.read_excel(patient_file)

    # Select only model features (now includes longitudinal features)
    if disease == "Diabetes":
        feature_cols = [
            "age","cci","prior_adm","los","dispo","insurance",
            "hematocrit","albumin","anemia","insulin_use","socioecon",
            "visits_so_far","days_since_last","avg_albumin_so_far",
            "avg_los_so_far","delta_albumin"   # <-- added avg_los_so_far
        ]
    elif disease == "Pneumonia":
        feature_cols = [
            "age","comorb","clin_instab","adm_type","hac",
            "gender","followup","edu_support",
            "los", "avg_los_so_far",
            "visits_so_far","days_since_last","instab_rate_so_far"
        ]
    else:
        raise ValueError("Unknown disease type")

    X = df[feature_cols]

    # Predict
    probs = pipe.predict_proba(X)[:,1]
    preds = pipe.predict(X)

    # Risk banding thresholds
    def risk_band(p):
        if p < 0.33:
            return "Low"
        elif p < 0.66:
            return "Medium"
        else:
            return "High"

    # Attach results back to patient records
    df["Predicted_Prob"] = probs.round(3)
    df["Predicted_Class"] = preds
    df["Risk_Band"] = [risk_band(p) for p in probs]

    # Save results
    out_file = patient_file.replace(".xlsx", "_with_predictions.xlsx")
    df.to_excel(out_file, index=False)
    print(f"✅ Predictions with risk bands saved to {out_file}")
    return df

# ---------------------------
# Example usage
# ---------------------------

# Diabetes patient (Juan Dela Cruz)
diabetes_results = test_model(
    model_file="model_Diabetes_XGBoost_long.pkl",
    patient_file="diabetes_patient_history.xlsx",
    disease="Diabetes"
)

# Pneumonia patient (Maria Santos)
pneumonia_results = test_model(
    model_file="model_Pneumonia_XGBoost_long.pkl",
    patient_file="pneumonia_patient_history.xlsx",
    disease="Pneumonia"
)

print(diabetes_results[["patient_name","visit_date","Predicted_Prob","Risk_Band"]].head())
print(pneumonia_results[["patient_name","visit_date","Predicted_Prob","Risk_Band"]].head())
