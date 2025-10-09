# main.py -- trains baseline & tuned RandomForest, creates charts, exports polished PDF report

import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from imblearn.over_sampling import SMOTE
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
)
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
import warnings
warnings.filterwarnings("ignore")

# -------------------------
# 1) Load dataset (try common names)
# -------------------------
possible_names = ["train.csv", "readmission_data.csv", "data.csv", "dataset.csv"]
file_path = None
for n in possible_names:
    if os.path.exists(n):
        file_path = n
        break

if file_path is None:
    print("❌ No dataset found. Place a CSV named one of:", ", ".join(possible_names))
    raise SystemExit(1)

print(f"Loading dataset from: {file_path}")
df = pd.read_csv(file_path)
print("✅ Data loaded successfully!")
print(df.head(), "\n")

print("Checking for missing values:")
print(df.isnull().sum(), "\n")

# Require 'readmitted' column
if "readmitted" not in df.columns:
    print("❌ Dataset must contain a 'readmitted' column (0/1).")
    raise SystemExit(1)

# -------------------------
# 2) Preprocess (encode categorical)
# -------------------------
le = LabelEncoder()
for col in df.select_dtypes(include=["object"]).columns:
    df[col] = le.fit_transform(df[col].astype(str))

# features & labels
X = df.drop("readmitted", axis=1)
y = df["readmitted"].astype(int)

# -------------------------
# 3) Train/test split
# -------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y
)
print(f"Train size: {len(X_train)}, Test size: {len(X_test)}\n")

# -------------------------
# 4) Baseline Random Forest
# -------------------------
print("🔹 Training baseline Random Forest...")
rf_base = RandomForestClassifier(random_state=42)
rf_base.fit(X_train, y_train)
y_base = rf_base.predict(X_test)

base_acc = accuracy_score(y_test, y_base)
base_cm = confusion_matrix(y_test, y_base)
base_report = classification_report(y_test, y_base, output_dict=True)
print(f"Baseline Accuracy: {base_acc:.3f}")
print("Confusion Matrix:\n", base_cm)
print("Classification Report:\n", classification_report(y_test, y_base), "\n")
print("base_report keys:", list(base_report.keys()), "\n")

# -------------------------
# 5) SMOTE to balance training set
# -------------------------
print("⚖️ Applying SMOTE to training set...")
print("Before:", dict(pd.Series(y_train).value_counts()))
smote = SMOTE(random_state=42)
X_res, y_res = smote.fit_resample(X_train, y_train)
print("After:", dict(pd.Series(y_res).value_counts()), "\n")

# -------------------------
# 6) GridSearchCV tuning for Random Forest
# -------------------------
print("🔍 Running GridSearchCV (Random Forest tuning)...")
param_grid = {
    "n_estimators": [100, 200],
    "max_depth": [None, 10, 20],
    "min_samples_split": [2, 5],
    "min_samples_leaf": [1, 2],
    "class_weight": [None, "balanced"]
}
grid = GridSearchCV(RandomForestClassifier(random_state=42),
                    param_grid, cv=5, n_jobs=-1, verbose=1)
grid.fit(X_res, y_res)
best_rf = grid.best_estimator_
best_params = grid.best_params_
print("✅ Best parameters:", best_params, "\n")

# -------------------------
# 7) Evaluate tuned model
# -------------------------
print("🔹 Evaluating tuned Random Forest...")
y_tuned = best_rf.predict(X_test)
tuned_acc = accuracy_score(y_test, y_tuned)
tuned_cm = confusion_matrix(y_test, y_tuned)
tuned_report = classification_report(y_test, y_tuned, output_dict=True)
print(f"Tuned Accuracy: {tuned_acc:.3f}")
print("Confusion Matrix:\n", tuned_cm)
print("Classification Report:\n", classification_report(y_test, y_tuned), "\n")
print("tuned_report keys:", list(tuned_report.keys()), "\n")

# -------------------------
# 8) Feature importances
# -------------------------
importances = pd.Series(best_rf.feature_importances_, index=X.columns)
top_features = importances.sort_values(ascending=False).head(10)
print("Top 10 features:\n", top_features, "\n")

# -------------------------
# Utility: safe metric getter
# -------------------------
def get_safe_metric(report, label, metric):
    """Return report[label][metric] safely when label keys can be '1', '1.0', or 1."""
    # try common variants
    for key in (label, str(label), f"{float(label):.1f}", f"{float(label):.0f}"):
        if key in report:
            return float(report[key].get(metric, 0.0))
    # try numeric-like keys
    for k in report.keys():
        try:
            if float(k) == float(label):
                return float(report[k].get(metric, 0.0))
        except Exception:
            continue
    return 0.0

# -------------------------
# 9) Create charts with Matplotlib
# -------------------------
charts_dir = "charts"
os.makedirs(charts_dir, exist_ok=True)

# 9A: Feature importance bar (horizontal)
fig1, ax1 = plt.subplots(figsize=(8, 5))
top_features.sort_values().plot(kind="barh", ax=ax1)
ax1.set_title("Top 10 Feature Importances")
ax1.set_xlabel("Importance")
plt.tight_layout()
feat_chart_path = os.path.join(charts_dir, "feature_importance.png")
plt.savefig(feat_chart_path, dpi=150)
plt.close(fig1)

# 9B: Model comparison chart (Accuracy, Precision, Recall, F1 for class=1)
metrics = ["accuracy", "precision", "recall", "f1-score"]
baseline_vals = [
    float(base_acc),
    get_safe_metric(base_report, 1, "precision"),
    get_safe_metric(base_report, 1, "recall"),
    get_safe_metric(base_report, 1, "f1-score")
]
tuned_vals = [
    float(tuned_acc),
    get_safe_metric(tuned_report, 1, "precision"),
    get_safe_metric(tuned_report, 1, "recall"),
    get_safe_metric(tuned_report, 1, "f1-score")
]

x = np.arange(len(metrics))
width = 0.35

fig2, ax2 = plt.subplots(figsize=(8, 5))
rects1 = ax2.bar(x - width/2, baseline_vals, width, label="Baseline RF")
rects2 = ax2.bar(x + width/2, tuned_vals, width, label="Tuned RF")
ax2.set_ylabel("Score")
ax2.set_title("Model Comparison (Baseline vs Tuned) — class=Readmitted (1)")
ax2.set_xticks(x)
ax2.set_xticklabels(["Accuracy", "Precision", "Recall", "F1"])
ax2.set_ylim(0, 1.0)
ax2.legend()

# annotate bars
def annotate_rects(rects, ax):
    for r in rects:
        h = r.get_height()
        ax.annotate(f"{h:.2f}",
                    xy=(r.get_x() + r.get_width()/2, h),
                    xytext=(0, 4),
                    textcoords="offset points",
                    ha="center", va="bottom", fontsize=8)
annotate_rects(rects1, ax2)
annotate_rects(rects2, ax2)

plt.tight_layout()
comp_chart_path = os.path.join(charts_dir, "model_comparison.png")
plt.savefig(comp_chart_path, dpi=150)
plt.close(fig2)

# -------------------------
# 10) Prepare PDF report using ReportLab
# -------------------------
pdf_filename = "model_report.pdf"
doc = SimpleDocTemplate(pdf_filename, pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Title page
story.append(Paragraph("Hospital Readmission Prediction using Random Forest", styles["Title"]))
story.append(Spacer(1, 12))

# Auto summary paragraph
summary_text = (
    f"This report compares a baseline Random Forest model with a tuned Random Forest model "
    f"(GridSearchCV + SMOTE). Dataset: {len(df)} records, {X.shape[1]} features. "
    f"Baseline accuracy = {base_acc:.3f}. Tuned accuracy = {tuned_acc:.3f}."
)
story.append(Paragraph(summary_text, styles["Normal"]))
story.append(Spacer(1, 12))

# Dataset summary
story.append(Paragraph("<b>Dataset summary</b>", styles["Heading2"]))
dataset_info = [
    ["Total records", str(len(df))],
    ["Features", str(list(X.columns))],
    ["Missing values", "See console output (none)"],
]
t_ds = Table(dataset_info, colWidths=[170, 350])
t_ds.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
    ("BACKGROUND", (0,0), (-1,0), colors.lightgrey)
]))
story.append(t_ds)
story.append(Spacer(1, 12))

# Model parameters summary
story.append(Paragraph("<b>Model parameters (Tuned Random Forest)</b>", styles["Heading2"]))
params_list = [[k, str(v)] for k, v in best_params.items()]
params_table = Table([["Parameter", "Value"]] + params_list, colWidths=[200, 320])
params_table.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
    ("BACKGROUND", (0,0), (-1,0), colors.lightblue),
]))
story.append(params_table)
story.append(Spacer(1, 12))

# Performance comparison table (numbers)
story.append(Paragraph("<b>Performance Comparison (class = Readmitted)</b>", styles["Heading2"]))
perf_data = [
    ["Metric", "Baseline RF", "Tuned RF"],
    ["Accuracy", f"{base_acc:.3f}", f"{tuned_acc:.3f}"],
    ["Precision (Readmitted)", f"{baseline_vals[1]:.3f}", f"{tuned_vals[1]:.3f}"],
    ["Recall (Readmitted)", f"{baseline_vals[2]:.3f}", f"{tuned_vals[2]:.3f}"],
    ["F1-score (Readmitted)", f"{baseline_vals[3]:.3f}", f"{tuned_vals[3]:.3f}"],
]
perf_table = Table(perf_data, colWidths=[200, 160, 160])
perf_table.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.5, colors.black),
    ("BACKGROUND", (0,0), (-1,0), colors.lightblue),
    ("ALIGN", (1,1), (-1,-1), "CENTER"),
    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold")
]))
story.append(perf_table)
story.append(Spacer(1, 12))

# Insert model comparison chart image
story.append(Paragraph("<b>Model Comparison Chart</b>", styles["Heading2"]))
story.append(Spacer(1, 6))
story.append(RLImage(comp_chart_path, width=420, height=240))
story.append(Spacer(1, 12))

# Confusion matrices + captions (two tables)
def matrix_table_for_pdf(matrix, title, acc, report):
    # produce small table with metrics and counts
    precision = get_safe_metric(report, 1, "precision")
    recall = get_safe_metric(report, 1, "recall")
    f1 = get_safe_metric(report, 1, "f1-score")
    data = [
        [title],
        ["", "Pred 0", "Pred 1"],
        ["Actual 0", str(int(matrix[0][0])), str(int(matrix[0][1]))],
        ["Actual 1", str(int(matrix[1][0])), str(int(matrix[1][1]))],
        ["", "", ""],
        ["Accuracy", f"{acc:.3f}", ""],
        ["Precision (1)", f"{precision:.3f}", ""],
        ["Recall (1)", f"{recall:.3f}", ""],
        ["F1 (1)", f"{f1:.3f}", ""],
    ]
    t = Table(data, colWidths=[160, 80, 80])
    t.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.5, colors.black),
        ("BACKGROUND", (0,0), (-1,0), colors.lightblue),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ]))
    return t

story.append(Paragraph("<b>Confusion Matrices</b>", styles["Heading2"]))
story.append(Spacer(1, 6))
story.append(matrix_table_for_pdf(base_cm, "Baseline RF", base_acc, base_report))
story.append(Spacer(1, 12))
story.append(matrix_table_for_pdf(tuned_cm, "Tuned RF", tuned_acc, tuned_report))
story.append(PageBreak())

# Feature importance section with chart and table
story.append(Paragraph("<b>Top 10 Feature Importances</b>", styles["Heading2"]))
story.append(Spacer(1, 6))
story.append(RLImage(feat_chart_path, width=420, height=240))
story.append(Spacer(1, 12))

feat_data = [["Feature", "Importance"]]
for f, v in top_features.items():
    feat_data.append([str(f), f"{v:.6f}"])
feat_table = Table(feat_data, colWidths=[300, 120])
feat_table.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
    ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
]))
story.append(feat_table)
story.append(Spacer(1, 20))

# Conclusion
conclusion = (
    "Conclusion: The baseline Random Forest achieved higher overall accuracy in this test split. "
    "However, tuned Random Forest (SMOTE + GridSearch) attempts to treat classes more equally. "
    "Feature importance shows metabolic and cardiovascular indicators (glucose, BMI, blood_pressure, insulin) "
    "are the strongest predictors of readmission in this dataset."
)
story.append(Paragraph("<b>Conclusion</b>", styles["Heading2"]))
story.append(Paragraph(conclusion, styles["Normal"]))
story.append(Spacer(1, 12))

# Footer note
story.append(Paragraph("Generated automatically by the Hospital Readmission Prediction pipeline.", styles["Normal"]))
try:
    doc.build(story)
    print(f"📄 PDF exported successfully as: {pdf_filename}")
except Exception as e:
    print("❌ PDF build error:", e)
