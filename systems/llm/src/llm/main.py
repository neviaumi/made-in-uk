from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import os
import llm_engine
import uvicorn

async def prompt(request):
    api_body = await request.json()
    system = api_body['system']
    prompt_str = api_body['prompt']
    resp = llm_engine.prompt(system, prompt_str)
    return JSONResponse({'message': resp})

async def healthCheck(request):
    resp = llm_engine.prompt("You are running Health check for yourself","<|user|>Are you operating as normal? Reply as fast as you can<|end|>")
    return JSONResponse({'status': 'ok', "message": resp})

app = Starlette(routes=[
    Route('/prompt', endpoint=prompt, methods=['POST']),
    Route('/health', endpoint=healthCheck, methods=['GET'])
])

if __name__ == "__main__":
    port = int(os.environ["LLM_PORT"])
    uvicorn.run(app, host="0.0.0.0", port=port)