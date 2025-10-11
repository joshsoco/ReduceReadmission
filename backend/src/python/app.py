import pandas as pd
import pickle
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

# ---------- LOAD MODELS AND SCALERS ----------
with open("disease_model.pkl", "rb") as f:
    disease_model = pickle.load(f)
with open("readmission_model.pkl", "rb") as f:
    readmission_model = pickle.load(f)
with open("disease_scaler.pkl", "rb") as f:
    disease_scaler = pickle.load(f)
with open("readmission_scaler.pkl", "rb") as f:
    readmission_scaler = pickle.load(f)

# ---------- LOAD DATA ----------
data_path = "dual_disease_data.csv"  # change to your data file
data = pd.read_csv(data_path)

# Encode categorical columns
data["Gender"] = data["Gender"].map({"Male": 1, "Female": 0})

# Drop unused columns
X = data.drop(["Disease", "Readmitted", "Patient_ID"], axis=1)
patient_ids = data["Patient_ID"]

# ---------- MAKE PREDICTIONS ----------
X_scaled_disease = disease_scaler.transform(X)
X_scaled_readmit = readmission_scaler.transform(X)

disease_preds = disease_model.predict(X_scaled_disease)
readmission_preds = readmission_model.predict(X_scaled_readmit)

# Combine results
data["Predicted_Disease"] = disease_preds
data["Predicted_Readmission"] = readmission_preds

# Map numerical labels to readable text (adjust these as used in your training)
disease_mapping = {0: "Hypertension", 1: "Influenza", 2: "Pneumonia", 3: "Type 2 Diabetes"}
readmit_mapping = {0: "No Readmission", 1: "High Readmission Risk"}

data["Predicted_Disease"] = data["Predicted_Disease"].map(disease_mapping)
data["Predicted_Readmission"] = data["Predicted_Readmission"].map(readmit_mapping)

# ---------- SAVE TO CSV ----------
output_csv = "prediction_results.csv"
data.to_csv(output_csv, index=False)
print(f"✅ Predictions saved to {output_csv}")

# ---------- GENERATE PDF REPORTS ----------
if not os.path.exists("reports"):
    os.makedirs("reports")

styles = getSampleStyleSheet()

for i, row in data.iterrows():
    patient_id = row["Patient_ID"]
    pdf_path = f"reports/Patient_{patient_id}_Report.pdf"
    doc = SimpleDocTemplate(pdf_path, pagesize=letter)

    story = []
    story.append(Paragraph("<b>Hospital Disease & Readmission Prediction Report</b>", styles["Title"]))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["Normal"]))
    story.append(Spacer(1, 12))

    # Patient Info
    story.append(Paragraph("<b>Patient Information:</b>", styles["Heading2"]))
    story.append(Paragraph(f"Patient ID: {patient_id}", styles["Normal"]))
    story.append(Paragraph(f"Age: {row['Age']}", styles["Normal"]))
    story.append(Paragraph(f"Gender: {'Male' if row['Gender'] == 1 else 'Female'}", styles["Normal"]))
    story.append(Paragraph(f"BMI: {row['BMI']}", styles["Normal"]))
    story.append(Paragraph(f"Blood Pressure: {row['Blood_Pressure']}", styles["Normal"]))
    story.append(Paragraph(f"Heart Rate: {row['Heart_Rate']}", styles["Normal"]))
    story.append(Spacer(1, 12))

    # Predictions
    story.append(Paragraph("<b>Predictions:</b>", styles["Heading2"]))
    story.append(Paragraph(f"<b>Disease Prediction:</b> {row['Predicted_Disease']}", styles["Normal"]))
    story.append(Paragraph(f"<b>Readmission Risk:</b> {row['Predicted_Readmission']}", styles["Normal"]))
    story.append(Paragraph(f"<b>Risk Score:</b> {row['Risk_Score']}", styles["Normal"]))
    story.append(Spacer(1, 12))

    # Recommendation
    recommendation = "Follow standard monitoring and preventive care."
    if row["Predicted_Readmission"] == "High Readmission Risk":
        recommendation = "Patient has high readmission risk. Schedule a follow-up and review medication adherence."

    story.append(Paragraph("<b>Recommendation:</b>", styles["Heading2"]))
    story.append(Paragraph(recommendation, styles["Normal"]))

    doc.build(story)
    print(f"📄 PDF generated for Patient {patient_id}: {pdf_path}")

print("\n✅ All reports successfully generated in the 'reports' folder!")
