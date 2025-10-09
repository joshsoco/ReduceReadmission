# main.py (robust, fixed)
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from imblearn.over_sampling import SMOTE
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
)
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
import warnings
warnings.filterwarnings("ignore")

# ---------- Try several possible dataset filenames ----------
possible_names = ["readmission_data.csv", "train.csv", "data.csv", "dataset.csv"]
file_path = None
for name in possible_names:
    if os.path.exists(name):
        file_path = name
        break

if file_path is None:
    print("❌ No dataset found. Please put your CSV in this folder named one of:")
    print(", ".join(possible_names))
    raise SystemExit(1)

print(f"Loading dataset from: {file_path}")
df = pd.read_csv(file_path)
print("✅ Data loaded successfully!")
print(df.head(), "\n")

print("Checking for missing values:")
print(df.isnull().sum(), "\n")

# ---------- Encode categorical columns ----------
le = LabelEncoder()
for col in df.select_dtypes(include=["object"]).columns:
    df[col] = le.fit_transform(df[col].astype(str))

# ---------- Split data ----------
if "readmitted" not in df.columns:
    print("❌ The dataset must contain a 'readmitted' column (0/1).")
    raise SystemExit(1)

X = df.drop("readmitted", axis=1)
y = df["readmitted"].astype(int)  # make labels ints for consistency
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y
)
print(f"Train size: {len(X_train)}, Test size: {len(X_test)}\n")

# ---------- Baseline Random Forest ----------
print("🔹 Training baseline Random Forest...")
base_model = RandomForestClassifier(random_state=42)
base_model.fit(X_train, y_train)
y_pred_base = base_model.predict(X_test)

base_acc = accuracy_score(y_test, y_pred_base)
base_cm = confusion_matrix(y_test, y_pred_base)
base_report = classification_report(y_test, y_pred_base, output_dict=True)
print(f"Baseline Accuracy: {base_acc:.2f}")
print("Confusion Matrix:\n", base_cm)
print("Classification Report:\n", classification_report(y_test, y_pred_base), "\n")
print("base_report keys:", list(base_report.keys()), "\n")  # debug helpful

# ---------- SMOTE ----------
print("⚖️ Applying SMOTE balancing...")
print("Before:", dict(pd.Series(y_train).value_counts()))
smote = SMOTE(random_state=42)
X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
print("After:", dict(pd.Series(y_train_res).value_counts()), "\n")

# ---------- Grid search ----------
print("🔍 Performing hyperparameter tuning (GridSearchCV)...")
param_grid = {
    "n_estimators": [100, 200],
    "max_depth": [None, 10, 20],
    "min_samples_split": [2, 5],
    "min_samples_leaf": [1, 2],
    "class_weight": [None, "balanced"]
}
grid = GridSearchCV(RandomForestClassifier(random_state=42), param_grid, cv=5, n_jobs=-1, verbose=1)
grid.fit(X_train_res, y_train_res)
best_model = grid.best_estimator_
print("✅ Best Parameters Found:", grid.best_params_, "\n")

# ---------- Evaluate tuned ----------
print("🔹 Evaluating Tuned Random Forest...")
y_pred_tuned = best_model.predict(X_test)
tuned_acc = accuracy_score(y_test, y_pred_tuned)
tuned_cm = confusion_matrix(y_test, y_pred_tuned)
tuned_report = classification_report(y_test, y_pred_tuned, output_dict=True)
print(f"Tuned Accuracy: {tuned_acc:.2f}")
print("Confusion Matrix:\n", tuned_cm)
print("Classification Report:\n", classification_report(y_test, y_pred_tuned), "\n")
print("tuned_report keys:", list(tuned_report.keys()), "\n")  # debug helpful

# ---------- Feature importance ----------
importances = pd.Series(best_model.feature_importances_, index=X.columns)
top_features = importances.sort_values(ascending=False).head(10)
print("🏆 Top 10 Important Features:")
print(top_features, "\n")

# ---------- Safe metric getter ----------
def get_safe_metric(report, label, metric):
    """
    Safely return report[label][metric] regardless of key formatting.
    label argument can be 1 or "1" or 1.0 etc.
    """
    # check int/str/float versions
    for key in (label, str(label), f"{float(label):.1f}", f"{float(label):.0f}"):
        if key in report:
            return report[key].get(metric, 0.0)
    # last resort: if numeric keys exist, try them
    for k in report.keys():
        try:
            if float(k) == float(label):
                return report[k].get(metric, 0.0)
        except Exception:
            continue
    return 0.0

# ---------- Helper: convert matrix to table (strings) ----------
def matrix_to_table(matrix, title, acc, report):
    precision = get_safe_metric(report, 1, "precision")
    recall = get_safe_metric(report, 1, "recall")
    f1 = get_safe_metric(report, 1, "f1-score")

    data = [
        [title],
        ["", "Predicted 0", "Predicted 1"],
        ["Actual 0", str(int(matrix[0][0])), str(int(matrix[0][1]))],
        ["Actual 1", str(int(matrix[1][0])), str(int(matrix[1][1]))],
        ["", "", ""],
        ["Accuracy", f"{acc:.2f}", ""],
        ["Recall (Readmitted=1)", f"{recall:.2f}", ""],
        ["Precision (Readmitted=1)", f"{precision:.2f}", ""],
        ["F1-Score (Readmitted=1)", f"{f1:.2f}", ""]
    ]

    t = Table(data, colWidths=[120, 80, 80])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightblue),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ]))
    return t

# ---------- Export to PDF ----------
def export_to_pdf(output_name="model_report.pdf"):
    doc = SimpleDocTemplate(output_name, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("Hospital Readmission Prediction Results", styles["Title"]))
    elements.append(Spacer(1, 12))

    # Performance table
    perf = [
        ["Metric", "Baseline Model", "Tuned Model"],
        ["Accuracy", f"{base_acc:.2f}", f"{tuned_acc:.2f}"],
        ["Precision (Readmitted)", f"{get_safe_metric(base_report, 1, 'precision'):.2f}", f"{get_safe_metric(tuned_report, 1, 'precision'):.2f}"],
        ["Recall (Readmitted)", f"{get_safe_metric(base_report, 1, 'recall'):.2f}", f"{get_safe_metric(tuned_report, 1, 'recall'):.2f}"],
        ["F1-Score (Readmitted)", f"{get_safe_metric(base_report, 1, 'f1-score'):.2f}", f"{get_safe_metric(tuned_report, 1, 'f1-score'):.2f}"]
    ]
    table = Table(perf, colWidths=[170, 120, 120])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightblue),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1,1), (-1,-1), "CENTER"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 18))

    # Confusion matrices with captions
    elements.append(Paragraph("Confusion Matrices and Metrics", styles["Heading2"]))
    elements.append(Spacer(1, 6))
    elements.append(matrix_to_table(base_cm, "Baseline Model", base_acc, base_report))
    elements.append(Spacer(1, 12))
    elements.append(matrix_to_table(tuned_cm, "Tuned Model", tuned_acc, tuned_report))

    elements.append(PageBreak())
    elements.append(Paragraph("Top 10 Most Important Features", styles["Heading2"]))
    feat_data = [["Feature", "Importance"]]
    for feature, val in top_features.items():
        feat_data.append([str(feature), f"{val:.4f}"])
    feat_table = Table(feat_data, colWidths=[220, 140])
    feat_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
    ]))
    elements.append(feat_table)

    elements.append(Spacer(1, 12))
    elements.append(Paragraph("Generated automatically by the Hospital Readmission Prediction System.", styles["Normal"]))

    try:
        doc.build(elements)
        print(f"📄 PDF report successfully exported as '{output_name}'")
    except Exception as e:
        print("❌ Error building PDF:", e)

# ---------- Run export ----------
export_to_pdf("model_report.pdf")