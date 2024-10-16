from google.cloud import firestore
import os
import hashlib
import app_logging
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

logger.info(f"Running on Emulator in '{DATABASE_ID}'" if IS_RUNNING_ON_EMULATOR else f"Running on production in '{DATABASE_ID}'")


def cache_llm_prompt(system, prompt_str, response):
    document_id_hexer = hashlib.sha256()
    document_id_hexer.update(f'{system}{prompt_str}'.encode())
    document_id = document_id_hexer.hexdigest()
    doc_ref = database.collection('llm.prompts').document(document_id)
    doc_ref.set({
        'system': system,
        'prompt': prompt_str,
        'response': response
    })

def get_cached_llm_prompt(system, prompt_str):
    document_id_hexer = hashlib.sha256()
    document_id_hexer.update(f'{system}{prompt_str}'.encode())
    document_id = document_id_hexer.hexdigest()
    doc_ref = database.collection('llm.prompts').document(document_id)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()['response']
    return None
