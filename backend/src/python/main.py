import pandas as pd
import joblib
import os
from datetime import datetime

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

# --- Load model + threshold ---
model = joblib.load("best_model_LogisticRegression.pkl")   # adjust if different
best_threshold = joblib.load("best_threshold.pkl")

# --- Load training columns for alignment ---
train_df = pd.read_csv("synthetic_train_nonlinear.csv")
X_train = pd.get_dummies(
    train_df.drop(columns=["readmitted_binary", "readmitted_multiclass", "medication"]),
    drop_first=True
)
X_train = clean_columns(X_train)
training_columns = X_train.columns

# --- Function to run predictions on a test file ---
def run_predictions(test_csv, dataset_name, save_csv=True):
    print(f"\n=== Predictions for {dataset_name} ===")

    # Load test data
    df = pd.read_csv(test_csv)

    # Keep labels if present
    y_true = df["readmitted_binary"] if "readmitted_binary" in df.columns else None

    # Drop labels + medication (not used in model)
    X = df.drop(columns=["readmitted_binary", "readmitted_multiclass", "medication"], errors="ignore")

    # One-hot encode + clean
    X = pd.get_dummies(X, drop_first=True)
    X = clean_columns(X)

    # Align with training columns
    X = X.reindex(columns=training_columns, fill_value=0)

    # Predict
    y_prob = model.predict_proba(X)[:, 1]
    y_pred = (y_prob >= best_threshold).astype(int)

    # Results DataFrame
    results = pd.DataFrame({
        "probability": y_prob,
        "prediction": y_pred
    })
    if y_true is not None:
        results["true_label"] = y_true.values

    # Show first few predictions
    print(results.head(10))

    # Save to CSV if requested
    if save_csv:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_csv = f"{dataset_name.replace(' ', '_').lower()}_predictions_{timestamp}.csv"
        results.to_csv(out_csv, index=False)
        print(f"📄 Saved predictions to {os.path.abspath(out_csv)}")

    return results

# --- Run on both test sets ---
linear_results = run_predictions("synthetic_test_linear.csv", "Linear Test Set")
nonlinear_results = run_predictions("synthetic_test_nonlinear.csv", "Nonlinear Test Set")
