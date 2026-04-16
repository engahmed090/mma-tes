import torch
import sys
import pprint

def inspect_model(filename):
    print(f"Inspecting {filename}:")
    try:
        data = torch.load(filename, map_location='cpu', weights_only=False)
        print("Type:", type(data))
        if isinstance(data, dict):
            print("Keys:", data.keys())
            if 'model_state_dict' in data:
                print("Found model_state_dict!")
        else:
            print("It's a full model or tensor!")
            print(data)
    except Exception as e:
        print("Error loading:", e)
    print("-" * 40)

if __name__ == "__main__":
    inspect_model('fwd_ens_square.pt')
    inspect_model('inverse_square.pt')
    inspect_model('inv_mdn_square.pt')
