
import pandas as pd
import os
from ml_api import predictor

def test_interactions():
    print("Testing Model Interactions...")
    print(f"Food DB columns: {predictor.food_df.columns.tolist()}")
    print(f"Sample row from food_df:\n{predictor.food_df.iloc[0]}")
    
    # Sample drugs from the dataset
    test_drugs = predictor.drugs_df.index.tolist()[:50]
    
    # Sample food compounds from the dataset
    test_foods = predictor.food_df.index.tolist()[:100]
    
    results = []
    
    # Check for consistency by running the same pair multiple times
    drug = test_drugs[0]
    food = test_foods[0]
    age, weight = 30, 70
    
    print(f"\nChecking consistency for {drug} + {food}...")
    first_res = predictor.predict(drug, food, age, weight)
    if 'error' in first_res:
        print(f"  [!] Initial prediction error: {first_res['error']}")
        return

    consistent = True
    for i in range(3):
        res = predictor.predict(drug, food, age, weight)
        if 'prediction' not in res or res['prediction'] != first_res['prediction']:
            consistent = False
            print(f"  [!] Variance detected or error at run {i+1}: {res.get('prediction', res.get('error'))}")
    
    if consistent:
        print("  [✓] Model is giving consistent outputs for the same input.")
    else:
        print("  [X] Model is NOT giving consistent outputs!")

    print("\nGenerating variety of outputs...")
    
    # Try more pairs to see different severity levels
    # I'll iterate through some combinations
    count = 0
    for d in test_drugs:
        for f in test_foods:
            res = predictor.predict(d, f, age, weight)
            if "error" not in res:
                results.append({
                    "Drug": d,
                    "Food Compound": f,
                    "Severity": res['severity']['level'],
                    "Prediction": res['prediction'],
                    "Confidence": f"{res['confidence']:.3f}"
                })
            else:
                print(f"  [!] Error for {d} + {f}: {res['error']}")
    
    # Try different age/weight to see if it changes
    res_young = predictor.predict(test_drugs[0], test_foods[0], 10, 30)
    res_old = predictor.predict(test_drugs[0], test_foods[0], 80, 60)
    
    print(f"\nImpact of Age/Weight on {test_drugs[0]} + {test_foods[0]}:")
    print(f"  Age 10, Weight 30: {res_young['severity']['level']} ({res_young['prediction']})")
    print(f"  Age 80, Weight 60: {res_old['severity']['level']} ({res_old['prediction']})")

    # Show the results in a table-like format
    print("\nSeverity Distribution:")
    severity_counts = {}
    for r in results:
        lvl = r['Prediction']
        severity_counts[lvl] = severity_counts.get(lvl, 0) + 1
    
    for lvl, count in sorted(severity_counts.items()):
        print(f"  {lvl}: {count}")

    print("\nSample of Diverse Drug-Food Interactions:")
    print(f"{'Drug':<20} | {'Food Compound':<40} | {'Severity':<10} | {'Confidence':<10}")
    print("-" * 90)
    # Print only non-SAFE results if possible, or just a sample
    diverse_sample = [r for r in results if r['Prediction'] > 0][:20]
    if not diverse_sample:
        diverse_sample = results[:20]
        
    for r in diverse_sample:
        print(f"{r['Drug']:<20} | {r['Food Compound']:<40} | {r['Severity']:<10} | {r['Confidence']:<10}")

if __name__ == "__main__":
    test_interactions()
