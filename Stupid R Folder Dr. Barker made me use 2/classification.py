import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import numpy as np

# Load your data
df = pd.read_csv("KC.csv")

# Create binary target variable: 1 if injury occurred, 0 otherwise
df['injury'] = df['desc'].str.contains('injured|injury', case=False, na=False).astype(int)

print(f"Total plays: {len(df)}")
print(f"Plays with injuries: {df['injury'].sum()}")
print(f"Injury rate: {df['injury'].mean():.2%}\n")

# Drop unnecessary columns
df = df.drop(columns=["Unnamed: 0", "desc", "game_date"])

# Drop rows with missing play_type
df = df.dropna(subset=["play_type"])

# Separate features and target
X = df.drop("injury", axis=1)
y = df["injury"]

# Convert categorical variables
X = pd.get_dummies(X)

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("Training set class distribution:")
print(f"  No injury: {(y_train == 0).sum()}")
print(f"  Injury: {(y_train == 1).sum()}\n")

# Train Decision Tree model
print("=" * 50)
print("DECISION TREE MODEL")
print("=" * 50)
dt_model = DecisionTreeClassifier(
    max_depth=5,
    min_samples_split=20,
    min_samples_leaf=10,
    class_weight='balanced',  # Handle class imbalance
    random_state=42
)
dt_model.fit(X_train, y_train)

# Predict
dt_pred = dt_model.predict(X_test)

# Evaluate Decision Tree
print("\nAccuracy:", accuracy_score(y_test, dt_pred))
print("\nClassification Report:")
print(classification_report(y_test, dt_pred, target_names=['No Injury', 'Injury']))
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, dt_pred))

# Get feature importance
feature_importance = pd.DataFrame({
    'feature': X.columns,
    'importance': dt_model.feature_importances_
}).sort_values('importance', ascending=False)

print("\n" + "=" * 50)
print("TOP 10 MOST IMPORTANT FEATURES FOR INJURY PREDICTION")
print("=" * 50)
print(feature_importance.head(10))

# Train Random Forest model (often better for imbalanced data)
print("\n" + "=" * 50)
print("RANDOM FOREST MODEL")
print("=" * 50)
rf_model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    min_samples_split=20,
    min_samples_leaf=10,
    class_weight='balanced',
    random_state=42
)
rf_model.fit(X_train, y_train)

# Predict
rf_pred = rf_model.predict(X_test)

# Evaluate Random Forest
print("\nAccuracy:", accuracy_score(y_test, rf_pred))
print("\nClassification Report:")
print(classification_report(y_test, rf_pred, target_names=['No Injury', 'Injury']))
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, rf_pred))

# Get feature importance from Random Forest
rf_feature_importance = pd.DataFrame({
    'feature': X.columns,
    'importance': rf_model.feature_importances_
}).sort_values('importance', ascending=False)

print("\n" + "=" * 50)
print("TOP 10 MOST IMPORTANT FEATURES (Random Forest)")
print("=" * 50)
print(rf_feature_importance.head(10))

# Function to predict injury risk for new plays
def predict_injury_risk(model, features):
    """
    Predict if a play is high risk for injury
    
    Args:
        model: trained classifier
        features: play features (must match training data format)
    
    Returns:
        prediction (0 or 1) and probability
    """
    prediction = model.predict(features)
    probability = model.predict_proba(features)[:, 1]  # Probability of injury
    
    return prediction, probability

# Example: Show some high-risk predictions
print("\n" + "=" * 50)
print("SAMPLE HIGH-RISK PLAY PREDICTIONS")
print("=" * 50)

# Get predictions with probabilities
y_proba = rf_model.predict_proba(X_test)[:, 1]

# Create a dataframe with predictions
results = pd.DataFrame({
    'actual': y_test.values,
    'predicted': rf_pred,
    'injury_probability': y_proba
})

# Show top 10 plays by injury risk
high_risk_plays = results.nlargest(10, 'injury_probability')
print("\nTop 10 highest risk plays:")
print(high_risk_plays)

# Statistics on predictions
print("\n" + "=" * 50)
print("RISK STATISTICS")
print("=" * 50)
print(f"Average injury probability: {y_proba.mean():.2%}")
print(f"Plays with >50% injury risk: {(y_proba > 0.5).sum()}")
print(f"Plays with >25% injury risk: {(y_proba > 0.25).sum()}")
print(f"Plays with >10% injury risk: {(y_proba > 0.10).sum()}")

# play type multiplier between 0 and 2 for run and pass plays