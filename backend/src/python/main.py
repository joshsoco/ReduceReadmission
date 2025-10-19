import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime
from sklearn.metrics import accuracy_score, roc_auc_score, confusion_matrix, precision_score, recall_score
import shap
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# --- Utility: clean column names ---
def clean_columns(df):
    df.columns = [col.replace('[','')
                     .replace(']','')
                     .replace('<','lt')
                     .replace('>','gt')
                     .replace(' ','_')
                     .replace('(','')
                     .replace(')','')
                 for col in df.columns]
    return df

# --- Rule-based reason generator ---
def generate_reason(row):
    reasons = []
    if "inpatient_visits" in row and row["inpatient_visits"] > 2:
        reasons.append("Frequent inpatient visits")
    if "length_of_stay" in row and row["length_of_stay"] > 7:
        reasons.append("Extended hospital stay")
    if "number_of_medications" in row and row["number_of_medications"] > 10:
        reasons.append("High medication count")
    if "a1c_test_result_[>8]" in row and row["a1c_test_result_[>8]"] == 1:
        reasons.append("Poor A1C control")
    if "glucose_test_result_[>200]" in row and row["glucose_test_result_[>200]"] == 1:
        reasons.append("High glucose level")
    if "primary_diagnosis_[Circulatory]" in row and row["primary_diagnosis_[Circulatory]"] == 1:
        reasons.append("Circulatory condition")
    return ", ".join(reasons) if reasons else "No strong risk indicators"

# --- SHAP-based reason extractor (now formatted for bullets) ---
def extract_shap_reason(shap_row, top_n=3):
    top_indices = np.argsort(np.abs(shap_row.values))[-top_n:][::-1]
    reasons = [f"• {shap_row.feature_names[i]} ({shap_row.values[i]:+.2f})" for i in top_indices]
    return "<br/>".join(reasons)

# --- PDF report generator ---
def generate_pdf_report(results, shap_values, metrics, filename="readmission_report.pdf"):
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CenterTitle', alignment=1, fontSize=16, spaceAfter=20))
    styles.add(ParagraphStyle(name='SubHeading', fontSize=12, textColor=colors.HexColor("#333333"), spaceAfter=10))
    styles.add(ParagraphStyle(name='BodyTextCustom', fontSize=10, leading=14))
    styles.add(ParagraphStyle(name='BulletText', fontSize=9, leading=12, leftIndent=12))

    elements = []

    # --- Title ---
    elements.append(Paragraph("🏥 Hospital Readmission Risk Report", styles['CenterTitle']))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['BodyTextCustom']))
    elements.append(Spacer(1, 15))

    # --- PATIENT PREDICTIONS FIRST ---
    elements.append(Paragraph("<b>Patient Readmission Predictions (Top 20)</b>", styles['SubHeading']))

    table_data = [["Patient ID", "Probability", "Prediction", "SHAP Reasons"]]
    for i, row in results.head(20).iterrows():
        pred_word = "Yes" if row["prediction"] == 1 else "No"
        shap_reason_formatted = row["shap_reason"]
        table_data.append([
            str(i),
            f"{row['probability']:.3f}",
            pred_word,
            Paragraph(shap_reason_formatted, styles['BulletText'])
        ])
    table = Table(table_data, colWidths=[60, 80, 60, 320])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 20))

    # --- Model Performance Summary ---
    elements.append(Paragraph("<b>Model Performance Metrics</b>", styles['SubHeading']))
    acc, auc, prec, rec, cm = metrics
    cm_text = f"""
        <b>Confusion Matrix</b><br/>
        TN = {cm[0,0]} FP = {cm[0,1]}<br/>
        FN = {cm[1,0]} TP = {cm[1,1]}
    """
    metrics_data = [
        ["Metric", "Value"],
        ["Accuracy", f"{acc:.3f}"],
        ["Precision", f"{prec:.3f}"],
        ["Recall", f"{rec:.3f}"],
        ["ROC AUC", f"{auc:.3f}"],
    ]
    metrics_table = Table(metrics_data, colWidths=[150, 150])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(cm_text, styles['BodyTextCustom']))
    elements.append(Spacer(1, 20))

    # --- SHAP Feature Importance Chart ---
    shap_df = pd.DataFrame(shap_values.values, columns=shap_values.feature_names)
    mean_abs_shap = shap_df.abs().mean().sort_values(ascending=False).head(10)

    plt.figure(figsize=(8, 5))
    mean_abs_shap[::-1].plot(kind='barh', color='skyblue')
    plt.title("Top 10 SHAP Features (Mean Absolute Impact)")
    plt.xlabel("Mean |SHAP Value|")
    plt.tight_layout()
    shap_chart_path = "shap_importance_temp.png"
    plt.savefig(shap_chart_path)
    plt.close()

    elements.append(Paragraph("<b>Top Feature Importances</b>", styles['SubHeading']))
    elements.append(Image(shap_chart_path, width=400, height=250))
    elements.append(Spacer(1, 20))

    doc.build(elements)
    if os.path.exists(shap_chart_path):
        os.remove(shap_chart_path)

    print(f"\n📄 PDF report saved at: {os.path.abspath(filename)}")


# --- Load model + threshold ---
model = joblib.load("best_model_LogisticRegression.pkl")
best_threshold = joblib.load("best_threshold.pkl")

# --- Load training columns for alignment ---
train_df = pd.read_csv("synthetic_train_nonlinear.csv")
X_train = pd.get_dummies(
    train_df.drop(columns=["readmitted_binary", "readmitted_multiclass", "medication"]),
    drop_first=True
)
X_train = clean_columns(X_train)
training_columns = X_train.columns

# --- Run predictions on test set ---
def run_predictions(test_csv, dataset_name):
    print(f"\n=== Predictions for {dataset_name} ===")

    df = pd.read_csv(test_csv)
    y_true = df["readmitted_binary"] if "readmitted_binary" in df.columns else None
    X = df.drop(columns=["readmitted_binary", "readmitted_multiclass", "medication"], errors="ignore")

    X = pd.get_dummies(X, drop_first=True)
    X = clean_columns(X)
    X = X.reindex(columns=training_columns, fill_value=0)

    y_prob = model.predict_proba(X)[:, 1]
    y_pred = (y_prob >= best_threshold).astype(int)

    results = pd.DataFrame({
        "probability": y_prob,
        "prediction": y_pred
    })
    if y_true is not None:
        results["true_label"] = y_true.values

    results["reason"] = X.apply(generate_reason, axis=1)

    masker = shap.maskers.Independent(X_train)
    explainer = shap.LinearExplainer(model, masker=masker)
    shap_values = explainer(X)

    results["shap_reason"] = [extract_shap_reason(shap_row) for shap_row in shap_values]

    acc = accuracy_score(y_true, y_pred)
    auc = roc_auc_score(y_true, y_prob)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)

    print(f"Accuracy: {acc:.3f}")
    print(f"ROC AUC: {auc:.3f}")
    print(f"Precision (Positive class): {prec:.3f}")
    print(f"Recall (Positive class): {rec:.3f}")
    print("Confusion Matrix:")
    print(f"TN={cm[0,0]}  FP={cm[0,1]}")
    print(f"FN={cm[1,0]}  TP={cm[1,1]}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = f"{dataset_name.replace(' ', '_').lower()}_predictions_{timestamp}.csv"
    results.to_csv(out_csv, index=False)
    print(f"📄 Saved predictions to {os.path.abspath(out_csv)}")

    pdf_file = f"{dataset_name.replace(' ', '_').lower()}_report_{timestamp}.pdf"
    generate_pdf_report(results, shap_values, (acc, auc, prec, rec, cm), filename=pdf_file)


# --- Run on test set ---
run_predictions("synthetic_test_nonlinear10.csv", "Nonlinear Test Set")