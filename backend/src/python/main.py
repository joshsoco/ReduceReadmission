import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib

# Load the dataset
data = pd.read_csv("dual_disease_data.csv")

# Encode categorical variables
label_encoder = LabelEncoder()
data["Gender"] = label_encoder.fit_transform(data["Gender"])
data["Disease"] = label_encoder.fit_transform(data["Disease"])  # 0–3 encoded

# -------------------------------
# 🩺 MODEL 1: Disease Prediction
# -------------------------------
print("\n🔹 TRAINING MODEL 1: Disease Prediction")

# Features for disease prediction (exclude Disease, Readmitted, and Patient_ID)
X_disease = data.drop(["Disease", "Readmitted", "Patient_ID"], axis=1)
y_disease = data["Disease"]

# Split data
X_train_d, X_test_d, y_train_d, y_test_d = train_test_split(X_disease, y_disease, test_size=0.2, random_state=42)

# Standardize numeric features
scaler_d = StandardScaler()
X_train_d = scaler_d.fit_transform(X_train_d)
X_test_d = scaler_d.transform(X_test_d)

# Train Random Forest
rf_disease = RandomForestClassifier(n_estimators=200, random_state=42)
rf_disease.fit(X_train_d, y_train_d)

# Evaluate
y_pred_d = rf_disease.predict(X_test_d)
print("Disease Prediction Accuracy:", accuracy_score(y_test_d, y_pred_d))
print(classification_report(y_test_d, y_pred_d))

# Save disease model and scaler
joblib.dump(rf_disease, 'disease_model.pkl')
joblib.dump(scaler_d, 'disease_scaler.pkl')

# -------------------------------
# 🏥 MODEL 2: Readmission Prediction
# -------------------------------
print("\n🔹 TRAINING MODEL 2: Readmission Prediction")

# Features for readmission (exclude Readmitted, but keep Disease as predictor)
X_readmit = data.drop(["Readmitted", "Patient_ID"], axis=1)
y_readmit = data["Readmitted"]

# Split data
X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X_readmit, y_readmit, test_size=0.2, random_state=42)

# Standardize numeric features
scaler_r = StandardScaler()
X_train_r = scaler_r.fit_transform(X_train_r)
X_test_r = scaler_r.transform(X_test_r)

# Train Random Forest
rf_readmit = RandomForestClassifier(n_estimators=200, random_state=42)
rf_readmit.fit(X_train_r, y_train_r)

# Evaluate
y_pred_r = rf_readmit.predict(X_test_r)
print("Readmission Prediction Accuracy:", accuracy_score(y_test_r, y_pred_r))
print(classification_report(y_test_r, y_pred_r))

# Save readmission model and scaler
joblib.dump(rf_readmit, 'readmission_model.pkl')
joblib.dump(scaler_r, 'readmission_scaler.pkl')

# -------------------------------
# 🩺 Prediction Function for New Patient
# -------------------------------
def predict_new_patient(new_patient_data, disease_model_path='disease_model.pkl', 
                      readmission_model_path='readmission_model.pkl', 
                      disease_scaler_path='disease_scaler.pkl', 
                      readmission_scaler_path='readmission_scaler.pkl'):
    """
    Predict disease and readmission for a new patient.
    
    Parameters:
    - new_patient_data: pandas DataFrame with the same columns as the training data (excluding Patient_ID).
    
    Returns:
    - dict: Predicted disease and readmission status.
    """
    # Load models and scalers
    disease_model = joblib.load(disease_model_path)
    readmission_model = joblib.load(readmission_model_path)
    disease_scaler = joblib.load(disease_scaler_path)
    readmission_scaler = joblib.load(readmission_scaler_path)
    
    # Ensure Gender is encoded
    if 'Gender' in new_patient_data.columns:
        new_patient_data['Gender'] = label_encoder.transform(new_patient_data['Gender'])
    
    # Prepare features for disease prediction
    X_disease_new = new_patient_data.drop(['Disease', 'Readmitted', 'Patient_ID'], axis=1, errors='ignore')
    X_disease_new_scaled = disease_scaler.transform(X_disease_new)
    
    # Prepare features for readmission prediction
    X_readmit_new = new_patient_data.drop(['Readmitted', 'Patient_ID'], axis=1, errors='ignore')
    X_readmit_new_scaled = readmission_scaler.transform(X_readmit_new)
    
    # Predict
    disease_pred = disease_model.predict(X_disease_new_scaled)
    readmission_pred = readmission_model.predict(X_readmit_new_scaled)
    
    return {
        'Disease_Prediction': disease_pred[0],
        'Readmission_Prediction': readmission_pred[0]
    }

# Example usage of prediction function (uncomment to test)
"""
# Example new patient data (replace with actual data)
new_patient = pd.DataFrame({
    'Gender': ['Male'],  # Must match original encoding
    'Age': [65],
    'Blood_Pressure': [120],
    'Cholesterol': [200],
    'Disease': [0],  # Included for readmission model, ignored for disease prediction
    # Add other columns as per your dataset
})
predictions = predict_new_patient(new_patient)
print("Predictions for new patient:", predictions)
"""