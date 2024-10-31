from google.cloud import firestore
import os
import hashlib
import app_logging
import json
from datetime import datetime, timedelta

logger = app_logging.get_logger(__name__)

IS_RUNNING_ON_EMULATOR = os.getenv('FIRESTORE_EMULATOR_HOST') is not None
APP_ENV = os.getenv('LLM_ENV')
if APP_ENV is None or not APP_ENV in ['development', 'production', 'test']:
    raise ValueError(f"""
        Invalid LLM_ENV value: {APP_ENV}
        possible values: {"/ ".join(['development', 'production', 'test'])}
    """)
DATABASE_ID = os.getenv('LLM_DATABASE_ID')
if DATABASE_ID is None:
    raise ValueError("LLM_DATABASE_ID must be set")
database = firestore.Client(database=DATABASE_ID)

logger.info(
    f"Running on Emulator in '{DATABASE_ID}'" if IS_RUNNING_ON_EMULATOR else f"Running on production in '{DATABASE_ID}'")


def cache_llm_prompt(prompts, response):
    document_id_hexer = hashlib.sha256()
    document_id_hexer.update(json.dumps(prompts).encode())
    document_id = document_id_hexer.hexdigest()
    doc_ref = database.collection('llm.prompts').document(document_id)
    doc_ref.set({
        'prompts': prompts,
        'response': response,
        'created_at': firestore.SERVER_TIMESTAMP,
        'expires_at': datetime.now() + timedelta(days=31)
    })


def get_cached_llm_prompt(prompts):
    document_id_hexer = hashlib.sha256()
    document_id_hexer.update(json.dumps(prompts).encode())
    document_id = document_id_hexer.hexdigest()
    doc_ref = database.collection('llm.prompts').document(document_id)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()['response']
    return None
