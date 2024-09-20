from google.cloud import firestore
import os
import hashlib

APP_ENV = os.getenv('LLM_ENV')
if APP_ENV is None or not APP_ENV in ['development', 'production', 'test']:
    raise ValueError(f"""
        Invalid LLM_ENV value: {APP_ENV}
        possible values: {"/ ".join(['development', 'production', 'test'])}
    """)
HAS_EMULATOR_SET = os.getenv('FIRESTORE_EMULATOR_HOST') is not None
DATABASE_ID = os.getenv('LLM_DATABASE_ID',"Unused" if HAS_EMULATOR_SET and APP_ENV in ['development', 'test'] else None)
if DATABASE_ID is None:
    raise ValueError("""
        LLM_DATABASE_ID must be set if not using emulator
    """)
database = firestore.Client(database=DATABASE_ID)


def cache_llm_prompt(system, prompt_str, response):
    document_id_hexer = hashlib.sha256()
    document_id_hexer.update(f'{system}{prompt_str}'.encode())
    document_id = document_id_hexer.hexdigest()
    doc_ref = database.collection('llm.prompts').document(document_id)
    doc_ref.set({
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