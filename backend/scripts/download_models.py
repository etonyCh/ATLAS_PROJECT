import os
from sentence_transformers import SentenceTransformer

model_name = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
print(f"Downloading {model_name}...")
SentenceTransformer(model_name)
print("Download complete.")
