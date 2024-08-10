import llm_engine
import os
from google.cloud import storage
bucket_name = os.environ['LLM_STORAGE_BUCKET']
storage_client = storage.Client()
bucket = storage_client.bucket(bucket_name)
blob = bucket.blob(llm_engine.model_name)
if not blob.exists():
    model_saved = llm_engine.save_locally()
    blob.upload_from_filename(model_saved)
blob.download_to_filename(llm_engine.cache_dir.joinpath(llm_engine.model_name))
