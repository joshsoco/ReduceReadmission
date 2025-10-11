# dual_train.py
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib

# ======================================================
# 🩺 LOAD AND ENCODE DATA
# ======================================================
data = pd.read_csv("dual_disease_data.csv")

# Encode categorical variables (Gender and Disease)
gender_encoder = LabelEncoder()
data["Gender"] = gender_encoder.fit_transform(data["Gender"])  # Male=1, Female=0

disease_encoder = LabelEncoder()
data["Disease"] = disease_encoder.fit_transform(data["Disease"])  # Hypertension=0, Pneumonia=1, etc.

# Save encoders for later use
joblib.dump(gender_encoder, 'gender_encoder.pkl')
joblib.dump(disease_encoder, 'disease_encoder.pkl')

# ======================================================
# 🧠 MODEL 1: DISEASE PREDICTION
# ======================================================
print("\n🔹 TRAINING MODEL 1: Disease Prediction")

# Features (exclude Disease, Readmitted, Patient_ID)
X_disease = data.drop(["Disease", "Readmitted", "Patient_ID"], axis=1)
y_disease = data["Disease"]

# Split dataset
X_train_d, X_test_d, y_train_d, y_test_d = train_test_split(
    X_disease, y_disease, test_size=0.2, random_state=42
)

# Scale numeric features
scaler_disease = StandardScaler()
X_train_d = scaler_disease.fit_transform(X_train_d)
X_test_d = scaler_disease.transform(X_test_d)

# Train Random Forest
rf_disease = RandomForestClassifier(n_estimators=200, random_state=42)
rf_disease.fit(X_train_d, y_train_d)

# Evaluate
y_pred_d = rf_disease.predict(X_test_d)
print("Disease Prediction Accuracy:", accuracy_score(y_test_d, y_pred_d))
print(classification_report(y_test_d, y_pred_d))

# Save model + scaler
joblib.dump(rf_disease, 'disease_model.pkl')
joblib.dump(scaler_disease, 'disease_scaler.pkl')

# ======================================================
# 🏥 MODEL 2: READMISSION PREDICTION
# ======================================================
print("\n🔹 TRAINING MODEL 2: Readmission Prediction")

# Features (exclude Readmitted, Patient_ID)
X_readmit = data.drop(["Readmitted", "Patient_ID"], axis=1)
y_readmit = data["Readmitted"]

# Split dataset
X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
    X_readmit, y_readmit, test_size=0.2, random_state=42
)

# Scale numeric features
scaler_readmit = StandardScaler()
X_train_r = scaler_readmit.fit_transform(X_train_r)
X_test_r = scaler_readmit.transform(X_test_r)

# Train Random Forest
rf_readmit = RandomForestClassifier(n_estimators=200, random_state=42)
rf_readmit.fit(X_train_r, y_train_r)

# Evaluate
y_pred_r = rf_readmit.predict(X_test_r)
print("Readmission Prediction Accuracy:", accuracy_score(y_test_r, y_pred_r))
print(classification_report(y_test_r, y_pred_r))

# Save model + scaler
joblib.dump(rf_readmit, 'readmission_model.pkl')
joblib.dump(scaler_readmit, 'readmission_scaler.pkl')

# ======================================================
# ✅ TEST PREDICTION FUNCTION
# ======================================================
print("\n🔹 TESTING MODELS ON NEW PATIENT")

# Test single new patient
test_patient = pd.DataFrame({
    'Patient_ID': [9999],
    'Age': [55],
    'Gender': ['Female'],
    'BMI': [26.5],
    'Blood_Pressure': [130],
    'Heart_Rate': [80],
    'Glucose_Level': [90.0],
    'Cholesterol': [220.0],
    'Hospital_Stay_Days': [6],
    'Previous_Admissions': [2],
    'Disease': ['Hypertension'],  # used for readmission only
    'Risk_Score': [0.58],
    'Readmitted': [0]
})

# Encode and scale properly for testing
test_patient["Gender"] = gender_encoder.transform(test_patient["Gender"])
test_patient["Disease"] = disease_encoder.transform(test_patient["Disease"])

X_disease_new = test_patient.drop(["Disease", "Readmitted", "Patient_ID"], axis=1)
X_disease_new_scaled = scaler_disease.transform(X_disease_new)
pred_disease = rf_disease.predict(X_disease_new_scaled)

X_readmit_new = test_patient.drop(["Readmitted", "Patient_ID"], axis=1)
X_readmit_new_scaled = scaler_readmit.transform(X_readmit_new)
pred_readmit = rf_readmit.predict(X_readmit_new_scaled)

pred_disease_name = disease_encoder.inverse_transform(pred_disease)[0]
print(f"Disease Prediction: {pred_disease_name}")
print(f"Readmission Prediction: {'Yes' if pred_readmit[0] == 1 else 'No'}")
