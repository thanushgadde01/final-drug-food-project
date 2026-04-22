
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors
from rdkit.Chem.EState.EState_VSA import EState_VSA_, VSA_EState_

mol = Chem.MolFromSmiles("CN1CCN(CC1)C1=C2C=CC=CC2=NC2=C(NC1=N)C=CC=C2") # Clozapine
print(f"MRVSA: {len(rdMolDescriptors.SMR_VSA_(mol))}")
print(f"PEOEVSA: {len(rdMolDescriptors.PEOE_VSA_(mol))}")
print(f"SlogPVSA: {len(rdMolDescriptors.SlogP_VSA_(mol))}")
print(f"EstateVSA: {len(EState_VSA_(mol))}")
print(f"VSAEstate: {len(VSA_EState_(mol))}")
