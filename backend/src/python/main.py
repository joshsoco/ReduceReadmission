# ===============================
# 📦 Import Libraries
# ===============================
import pandas as pd
import numpy as np
import csv
import warnings
warnings.filterwarnings('ignore')

# ML and preprocessing
from sklearn.preprocessing import LabelEncoder, RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Models
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier

# Visualization
import matplotlib.pyplot as plt
import seaborn as sns

# PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

# ===============================
# 🧠 Step 1: Smart File Loader
# ===============================
def load_data(filename):
    """Loads dataset and auto-detects type & delimiter."""
    if filename.endswith('.csv'):
        with open(filename, 'r', encoding='utf-8') as file:
            sample = file.read(2048)
            sniffer = csv.Sniffer()
            delimiter = sniffer.sniff(sample).delimiter
        print(f"Detected delimiter: '{delimiter}'")
        data = pd.read_csv(filename, delimiter=delimiter, na_values=['?', '[]'])
    elif filename.endswith('.xlsx'):
        data = pd.read_excel(filename)
    elif filename.endswith('.json'):
        data = pd.read_json(filename)
    else:
        raise ValueError("Unsupported file type. Please use CSV, Excel, or JSON.")
    return data

# ===============================
# 🧹 Step 2: Load & Clean Data
# ===============================
data = load_data('train.csv')
print("\n✅ Data loaded successfully!")
print(data.head())

# Check for missing values
print("\nChecking for missing values:")
print(data.isnull().sum())
data = data.dropna()

# ===============================
# 🏷 Step 3: Encode Categorical Columns
# ===============================
label_encoder = LabelEncoder()
for column in data.select_dtypes(include=['object']).columns:
    data[column] = label_encoder.fit_transform(data[column].astype(str))

# ===============================
# ⚖️ Step 4: Feature Scaling
# ===============================
scaler = RobustScaler()
scaled_data = pd.DataFrame(scaler.fit_transform(data), columns=data.columns)

# ===============================
# 🔀 Step 5: Train-Test Split
# ===============================
# Make sure 'readmitted' is the target column in your dataset
X = scaled_data.drop(columns=['readmitted'])
y = scaled_data['readmitted']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# ===============================
# 🤖 Step 6: Train Multiple Models
# ===============================
models = {
    "Logistic Regression": LogisticRegression(max_iter=1000),
    "Naive Bayes": GaussianNB(),
    "SVM": SVC(kernel='rbf', probability=True),
    "Decision Tree": DecisionTreeClassifier(random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42)
}

results = {}

for name, model in models.items():
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    results[name] = {
        "accuracy": acc,
        "confusion_matrix": confusion_matrix(y_test, y_pred),
        "report": classification_report(y_test, y_pred, output_dict=True)
    }
    print(f"\n🔹 {name}")
    print("Accuracy:", acc)
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
    print("Classification Report:\n", classification_report(y_test, y_pred))

# ===============================
# 📊 Step 7: Compare Model Accuracies
# ===============================
results_df = pd.DataFrame({
    "Model": [m for m in results.keys()],
    "Accuracy": [results[m]["accuracy"] for m in results.keys()]
})
print("\n✅ Model Comparison Results:")
print(results_df)

plt.figure(figsize=(8, 5))
sns.barplot(data=results_df, x='Model', y='Accuracy', palette='coolwarm')
plt.title("Hospital Readmission Prediction - Model Comparison")
plt.ylabel("Accuracy")
plt.xlabel("Model")
plt.xticks(rotation=25)
plt.ylim(0, 1)
plt.tight_layout()
plt.savefig("model_comparison_chart.png")  # save the chart for PDF
plt.show()

# ===============================
# 📄 Step 8: Export Results to PDF
# ===============================
def export_to_pdf(results, output_filename="readmission_results.pdf"):
    """Exports model results and charts to a PDF report."""
    doc = SimpleDocTemplate(output_filename, pagesize=letter)
    styles = getSampleStyleSheet()
    flowables = []

    flowables.append(Paragraph("🏥 Hospital Readmission Prediction Report", styles['Title']))
    flowables.append(Spacer(1, 12))

    for model_name, metrics in results.items():
        flowables.append(Paragraph(f"<b>{model_name}</b>", styles['Heading2']))
        flowables.append(Paragraph(f"Accuracy: {metrics['accuracy']:.4f}", styles['Normal']))
        flowables.append(Spacer(1, 6))

        # Confusion matrix table
        cm = metrics['confusion_matrix']
        cm_table = Table(cm, colWidths=[60]*len(cm))
        cm_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ALIGN', (0,0), (-1,-1), 'CENTER')
        ]))
        flowables.append(Paragraph("Confusion Matrix:", styles['Normal']))
        flowables.append(cm_table)
        flowables.append(Spacer(1, 12))

    flowables.append(Paragraph("<b>Model Comparison Chart:</b>", styles['Heading2']))
    flowables.append(Spacer(1, 6))
    flowables.append(Paragraph("See the chart image saved as 'model_comparison_chart.png'.", styles['Normal']))

    doc.build(flowables)
    print(f"\n📄 PDF report generated successfully: {output_filename}")

# Generate the PDF report
export_to_pdf(results)
