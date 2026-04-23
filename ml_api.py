from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import xgboost as xgb
import os
from pathlib import Path
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors
from rdkit.Chem.EState.EState_VSA import EState_VSA_, VSA_EState_

app = FastAPI()

# Get the base directory (where this script is located)
BASE_DIR = Path(__file__).parent

# Severity levels mapping
SEVERITY_MAP = {
    0: {"level": "SAFE", "severity": "No Interaction", "color": "#10B981", "description": "No drug-food interaction detected"},
    1: {"level": "MILD", "severity": "Mild Interaction", "color": "#F59E0B", "description": "Minor interaction - Monitor patient"},
    2: {"level": "MODERATE", "severity": "Moderate Interaction", "color": "#EF6B3E", "description": "Moderate interaction - Consider alternative"},
    3: {"level": "SEVERE", "severity": "Severe Interaction", "color": "#DC2626", "description": "Severe interaction - Avoid combination"},
    4: {"level": "CRITICAL", "severity": "Critical Interaction", "color": "#7C2D12", "description": "CRITICAL - Contraindicated"},
}

class DrugFoodInteractionPredictor:
    def __init__(self, model_path="", drugs_csv="", food_csv="", content_csv="", compound_csv=""):
        """
        Initializes the predictor with relational FooDB datasets. 
        """
        print("[*] Initializing Predictor...")

        try:
            # Convert to absolute paths if relative
            model_path = os.path.join(BASE_DIR, model_path) if model_path else ""
            drugs_csv = os.path.join(BASE_DIR, drugs_csv) if drugs_csv else ""
            food_csv = os.path.join(BASE_DIR, food_csv) if food_csv else ""
            content_csv = os.path.join(BASE_DIR, content_csv) if content_csv else ""
            compound_csv = os.path.join(BASE_DIR, compound_csv) if compound_csv else ""

            print(f"[*] Loading model from: {model_path}")

            # --- 1. Load Drugs ---
            if drugs_csv and os.path.exists(drugs_csv):
                self.drugs_df = pd.read_csv(drugs_csv)
                self.drugs_df.columns = self.drugs_df.columns.str.lower()
                self.drugs_df = self.drugs_df.set_index('name')
                print(f"[OK] Loaded {len(self.drugs_df)} drugs")
            else:
                self.drugs_df = None
                print(f"[WARN] Drugs CSV not found at {drugs_csv}")

            # --- 2. Load FooDB Relational Tables ---
            print("[*] Loading FooDB relational datasets...")
            
            if food_csv and os.path.exists(food_csv):
                self.food_df = pd.read_csv(food_csv, usecols=['id', 'name'], low_memory=False)
                self.food_df['name'] = self.food_df['name'].astype(str).str.lower()
                self.food_df.set_index('name', inplace=True)
                print(f"[OK] Loaded {len(self.food_df)} food items")
            else:
                self.food_df = None
                print(f"[WARN] Food CSV not found at {food_csv}")

            if content_csv and os.path.exists(content_csv):
                self.content_df = pd.read_csv(content_csv, usecols=['food_id', 'source_id', 'orig_content'], low_memory=False)
                print(f"[OK] Loaded {len(self.content_df)} food-compound mappings")
            else:
                self.content_df = None
                print(f"[WARN] Content CSV not found at {content_csv}")

            if compound_csv and os.path.exists(compound_csv):
                # Robustly identify which column contains the SMILES string
                header = pd.read_csv(compound_csv, nrows=0).columns.str.lower()
                
                if 'cas_number' in header:
                    smiles_col = 'cas_number'
                elif 'moldb_smiles' in header:
                    smiles_col = 'moldb_smiles'
                elif 'smiles' in header:
                    smiles_col = 'smiles'
                else:
                    smiles_col = None

                cols_to_use = ['id', 'name']
                if smiles_col:
                    cols_to_use.append(smiles_col)
                
                self.compound_df = pd.read_csv(compound_csv, usecols=cols_to_use, low_memory=False)
                
                # Ensure we have a column named 'smiles'
                if smiles_col and smiles_col != 'smiles':
                    self.compound_df.rename(columns={smiles_col: 'smiles'}, inplace=True)
                
                if 'smiles' in self.compound_df.columns:
                    self.compound_df.dropna(subset=['smiles'], inplace=True)
                else:
                    print("[WARN] No SMILES column found in Compound CSV!")
                
                self.compound_df.set_index('id', inplace=True)
                print(f"[OK] Loaded {len(self.compound_df)} chemical compounds with SMILES")
            else:
                self.compound_df = None
                print(f"[WARN] Compound CSV not found at {compound_csv}")

            # --- 3. Load XGBoost Model ---
            self.model = None
            if model_path and os.path.exists(model_path):
                self.model = xgb.XGBClassifier()
                self.model.load_model(model_path)
                print("[OK] Model loaded successfully")
            else:
                print(f"[WARN] Model not found at {model_path}")

        except Exception as e:
            print(f"[ERROR] Initialization Error: {e}")
            import traceback
            traceback.print_exc()
            self.drugs_df, self.food_df, self.content_df, self.compound_df, self.model = None, None, None, None, None

        self.feature_columns = [
            'MTPSA+MTPSA', 'MRVSA9', 'MRVSA8', 'MRVSA0', 'MRVSA2',
            'VSAEstate10+VSAEstate10', 'EstateVSA0*LabuteASA', 'PEOEVSA12',
            'PEOEVSA10', 'PEOEVSA5', 'PEOEVSA9', 'slogPVSA2', 'slogPVSA0',
            'slogPVSA9', 'VSAEstate7+VSAEstate7', 'EstateVSA7', 'EstateVSA2',
            'EstateVSA1*VSAEstate8', 'age', 'weight'
        ]

    def _get_base_features(self, smiles):
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            return None
        return {
            'MTPSA': Descriptors.TPSA(mol),
            'LabuteASA': rdMolDescriptors.CalcLabuteASA(mol),
            'MRVSA': rdMolDescriptors.SMR_VSA_(mol),
            'PEOEVSA': rdMolDescriptors.PEOE_VSA_(mol),
            'slogPVSA': rdMolDescriptors.SlogP_VSA_(mol),
            'EstateVSA': EState_VSA_(mol),
            'VSAEstate': VSA_EState_(mol)
        }

    def _get_food_compounds(self, food_name, top_n=50):
        """
        Navigates FooDB DataFrames to find constituent compounds for a food.
        Returns a list of tuples: [(compound_name, smiles_string), ...]
        """
        if self.food_df is None or self.content_df is None or self.compound_df is None:
            return []

        food_name_lower = food_name.lower()
        try:
            if food_name_lower not in self.food_df.index:
                return []
            
            food_id = self.food_df.loc[food_name_lower, 'id']
            if isinstance(food_id, pd.Series):
                food_id = food_id.iloc[0]

            food_contents = self.content_df[self.content_df['food_id'] == food_id]
            if food_contents.empty:
                return []

            compound_ids = food_contents['source_id'].dropna().unique()
            valid_ids = [cid for cid in compound_ids if cid in self.compound_df.index]
            
            if not valid_ids:
                return []

            matched_compounds = self.compound_df.loc[valid_ids]
            
            results = []
            for _, row in matched_compounds.head(top_n).iterrows():
                results.append((row['name'], row['smiles']))
                
            return results

        except Exception as e:
            print(f"[!] Error resolving compounds for {food_name}: {e}")
            return []

    def predict(self, drug_name, food_name, age, weight):
        if self.model is None or self.drugs_df is None:
            return {"error": "Model or Datasets not loaded. Check paths in ml_api.py"}

        try:
            drug_smiles = self.drugs_df.loc[drug_name, "smiles"]
        except KeyError as e:
            return {"error": f"Drug {drug_name} was not found in your CSV database."}

        d = self._get_base_features(drug_smiles)
        if not d:
            return {"error": "Invalid SMILES string for drug. RDKit parsing failed."}

        # Fetch the list of all compounds inside the food
        food_compounds = self._get_food_compounds(food_name)
        
        if not food_compounds:
            return {"error": f"Food '{food_name}' or its chemical compounds were not found in the database."}

        worst_severity_level = -1
        worst_case_result = None

        # The "Any Hit" Loop: Evaluate the drug against EVERY compound in the food
        for compound_name, food_smiles in food_compounds:
            f = self._get_base_features(food_smiles)
            
            # If RDKit fails on a single trace compound, skip it rather than crashing
            if not f:
                continue

            mol_features = [
                d['MTPSA'] + f['MTPSA'],
                d['MRVSA'][9] + f['MRVSA'][9],
                d['MRVSA'][8] + f['MRVSA'][8],
                d['MRVSA'][0] + f['MRVSA'][0],
                d['MRVSA'][2] + f['MRVSA'][2],
                d['VSAEstate'][9] + f['VSAEstate'][9],
                d['EstateVSA'][0] * f['LabuteASA'],
                d['PEOEVSA'][12] + f['PEOEVSA'][12],
                d['PEOEVSA'][10] + f['PEOEVSA'][10],
                d['PEOEVSA'][5] + f['PEOEVSA'][5],
                d['PEOEVSA'][9] + f['PEOEVSA'][9],
                d['slogPVSA'][2] + f['slogPVSA'][2],
                d['slogPVSA'][0] + f['slogPVSA'][0],
                d['slogPVSA'][9] + f['slogPVSA'][9],
                d['VSAEstate'][7] + f['VSAEstate'][7],
                d['EstateVSA'][7] + f['EstateVSA'][7],
                d['EstateVSA'][2] + f['EstateVSA'][2],
                d['EstateVSA'][1] * f['VSAEstate'][8]
            ]

            final_features = mol_features + [age, weight]
            input_df = pd.DataFrame([final_features], columns=self.feature_columns)
            
            severity_level = int(self.model.predict(input_df)[0])
            severity_level = min(max(severity_level, 0), 4)
            
            # Keep track of the highest severity interaction found so far
            if severity_level > worst_severity_level:
                worst_severity_level = severity_level
                
                try:
                    probabilities = self.model.predict_proba(input_df)[0]
                    confidence = max(probabilities) 
                    prob_distribution = {i: float(p) for i, p in enumerate(probabilities)}
                except:
                    confidence = 0.5
                    prob_distribution = {}

                severity_info = SEVERITY_MAP[severity_level]
                
                worst_case_result = {
                    "prediction": severity_level,
                    "severity": severity_info,
                    "confidence": float(confidence),
                    "probabilities": prob_distribution,
                    "interacting_compound": compound_name 
                }

        if worst_case_result is None:
            return {"error": "Failed to parse RDKit features for any compounds in this food."}

        print(f"[DEBUG] Drug: {drug_name}, Food: {food_name} (via {worst_case_result['interacting_compound']}), Severity: {worst_severity_level} ({worst_case_result['severity']['level']})")
        
        return worst_case_result

# Initialize global predictor with proper path handling
# IMPORTANT: Verify these file names match your downloaded FooDB files exactly.
predictor = DrugFoodInteractionPredictor(
    model_path="drug_food_model (1).json",
    drugs_csv="dug_dataset/PubChem_compound_FDA_approved_drugs (1).csv",
    food_csv="food_dataset/Food.csv",       # New! The FooDB Food list
    content_csv="food_dataset/Content.csv", # New! The FooDB Mapping table
    compound_csv="food_dataset/Compound (1).csv"
)

class PredictionRequest(BaseModel):
    drug_name: str
    food_name: str
    age: int
    weight: int

@app.post("/predict")
async def get_prediction(request: PredictionRequest):
    result = predictor.predict(
        request.drug_name, 
        request.food_name, 
        request.age, 
        request.weight
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)