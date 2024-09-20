from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import os
import llm_engine
import datetime
import time
import uvicorn
import app_logging
import database

llm_model = llm_engine.create_interface()

logger = app_logging.get_logger(__name__)


async def prompt(request):
    api_body = await request.json()
    resp_start = time.time()
    system = api_body['system']
    prompt_str = api_body['prompt']
    cache_control_header = request.headers.get('Cache-Control', '')
    use_cache = cache_control_header not in ['no-cache', 'no-store']
    should_cache_response = cache_control_header not in ['no-store']
    cached_response = database.get_cached_llm_prompt(system, prompt_str) if use_cache else None
    if cached_response is None:
        resp = llm_model.prompt(system, prompt_str)
        if should_cache_response:
            database.cache_llm_prompt(system, prompt_str, resp)
    else:
        resp = cached_response
    resp_end = time.time()
    logger.info("Response from LLM", extra={
        "system": system,
        "prompt_str": prompt_str,
        "response": resp,
        "response_time": str(datetime.timedelta(seconds=resp_end - resp_start)),
        "request_id": request.headers.get('request-id')
    })
    return JSONResponse({'message': resp})


async def healthCheck(request):
    resp = llm_model.prompt("You are running Health check for yourself",
                            "<|user|>Are you operating as normal? Reply in JSON Object Format with with 1 key, 'status' ('ok' or 'error')<|end|>")
    return JSONResponse({'llm': resp})


app = Starlette(routes=[
    Route('/prompt', endpoint=prompt, methods=['POST']),
    Route('/health', endpoint=healthCheck, methods=['GET'])
])

if __name__ == "__main__":
    port = int(os.environ["LLM_PORT"])
    uvicorn.run(app, host="0.0.0.0", port=port)
