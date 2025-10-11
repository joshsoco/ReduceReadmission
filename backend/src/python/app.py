import pandas as pd
import pickle

# --- Step 1: Load saved model, scaler, and encoders ---
with open("trained_model.pkl", "rb") as f:
    model = pickle.load(f)

with open("scaler.pkl", "rb") as f:
    scaler = pickle.load(f)

with open("label_encoders.pkl", "rb") as f:
    label_encoders = pickle.load(f)

# --- Step 2: Example new patient data ---
# You can also load this from a CSV instead of a dictionary
new_data = pd.DataFrame([{
    "Age": 65,
    "Gender": "Male",
    "BMI": 24.5,
    "Blood_Pressure": 145,
    "Heart_Rate": 82,
    "Glucose_Level": 140.2,
    "Cholesterol": 210.5,
    "Hospital_Stay_Days": 7,
    "Previous_Admissions": 2,
    "Disease": "Hypertension",
    "Risk_Score": 0.61
}])

# --- Step 3: Encode categorical columns (using the same encoders as training) ---
for col in ['Gender', 'Disease']:
    le = label_encoders[col]
    # handle unseen labels gracefully
    new_data[col] = new_data[col].apply(lambda x: le.transform([x])[0] if x in le.classes_ else -1)

# --- Step 4: Scale numeric columns using the same scaler ---
scaled_data = scaler.transform(new_data)

# --- Step 5: Predict readmission ---
prediction = model.predict(scaled_data)
probability = model.predict_proba(scaled_data)[0][1]

# --- Step 6: Display result ---
print("=== Prediction Result ===")
print(f"Predicted Readmission: {'Yes' if prediction[0] == 1 else 'No'}")
print(f"Probability of Readmission: {probability:.2f}")
