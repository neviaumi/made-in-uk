from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import os
import llm_engine
import time
import uvicorn
import app_logging

llm_model = llm_engine.create_interface()

logger = app_logging.get_logger(__name__)


async def prompt(request):
    api_body = await request.json()
    resp_start = time.time()
    system = api_body['system']
    prompt_str = api_body['prompt']
    resp = llm_model.prompt(system, prompt_str)
    resp_end = time.time()
    logger.info("Response from LLM", extra={
        "system": system,
        "prompt_str": prompt_str,
        "response": resp,
        "response_time": resp_end - resp_start
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
