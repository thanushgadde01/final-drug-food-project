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
    def __init__(self, model_path="", drugs_csv="", food_csv=""):
        """
        Initializes the predictor. 
        """
        print("[*] Initializing Predictor...")

        try:
            # Convert to absolute paths if relative
            model_path = os.path.join(BASE_DIR, model_path) if model_path else ""
            drugs_csv = os.path.join(BASE_DIR, drugs_csv) if drugs_csv else ""
            food_csv = os.path.join(BASE_DIR, food_csv) if food_csv else ""

            print(f"[*] Loading model from: {model_path}")
            print(f"[*] Loading drugs from: {drugs_csv}")
            print(f"[*] Loading food from: {food_csv}")

            # Load datasets from local paths
            if drugs_csv and os.path.exists(drugs_csv):
                self.drugs_df = pd.read_csv(drugs_csv)
                # Rename columns to lowercase for consistency
                self.drugs_df.columns = self.drugs_df.columns.str.lower()
                self.drugs_df = self.drugs_df.set_index('name')
                print(f"[✓] Loaded {len(self.drugs_df)} drugs")
            else:
                self.drugs_df = None
                print(f"[!] Drugs CSV not found at {drugs_csv}")

            if food_csv and os.path.exists(food_csv):
                self.food_df = pd.read_csv(food_csv, low_memory=False)
                # Rename columns to lowercase for consistency
                self.food_df.columns = self.food_df.columns.str.lower()
                
                # Fix misalignment: SMILES are actually in 'cas_number' column
                if 'cas_number' in self.food_df.columns:
                    self.food_df.rename(columns={'cas_number': 'smiles'}, inplace=True)
                elif 'moldb_smiles' in self.food_df.columns:
                    self.food_df.rename(columns={'moldb_smiles': 'smiles'}, inplace=True)
                
                self.food_df = self.food_df.set_index('name')
                print(f"[✓] Loaded {len(self.food_df)} food compounds")
            else:
                self.food_df = None
                print(f"[!] Food CSV not found at {food_csv}")

            # Load the XGBoost model
            self.model = None
            if model_path and os.path.exists(model_path):
                self.model = xgb.XGBClassifier()
                self.model.load_model(model_path)
                print("[✓] Model loaded successfully")
            else:
                print(f"[!] Model not found at {model_path}")

        except Exception as e:
            print(f"❌ Initialization Error: {e}")
            import traceback
            traceback.print_exc()
            self.drugs_df = None
            self.food_df = None
            self.model = None

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

    def predict(self, drug_name, food_name, age, weight):
        if self.model is None or self.drugs_df is None:
            return {"error": "Model or Datasets not loaded. Check paths in ml_api.py"}

        try:
            drug_smiles = self.drugs_df.loc[drug_name, "smiles"]
            food_smiles = self.food_df.loc[food_name, "smiles"]
        except KeyError as e:
            return {"error": f"Item {e} was not found in your CSV database."}

        d = self._get_base_features(drug_smiles)
        f = self._get_base_features(food_smiles)

        if not d or not f:
            return {"error": "Invalid SMILES string. RDKit parsing failed."}

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
        
        # Get prediction (severity level 0-4)
        severity_level = int(self.model.predict(input_df)[0])
        
        # Get probability scores for confidence
        try:
            probabilities = self.model.predict_proba(input_df)[0]
            confidence = max(probabilities)  # Max probability is the confidence
            prob_distribution = {i: float(p) for i, p in enumerate(probabilities)}
        except:
            confidence = 0.5
            prob_distribution = {}
        
        # Clamp severity to valid range
        severity_level = min(max(severity_level, 0), 4)
        
        severity_info = SEVERITY_MAP[severity_level]
        
        print(f"[DEBUG] Drug: {drug_name}, Food: {food_name}, Severity: {severity_level} ({severity_info['level']}), Confidence: {confidence:.3f}")
        
        return {
            "prediction": severity_level,
            "severity": severity_info,
            "confidence": float(confidence),
            "probabilities": prob_distribution
        }

# Initialize global predictor with proper path handling
predictor = DrugFoodInteractionPredictor(
    model_path="drug_food_model (1).json",
    drugs_csv="dug_dataset/PubChem_compound_FDA_approved_drugs (1).csv",
    food_csv="food_dataset/Compound (1).csv"
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
