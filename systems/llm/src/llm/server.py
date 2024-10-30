from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import llm_engine
import datetime
import time
import app_logging
import database
from typing import List, Union
from starlette.exceptions import HTTPException

llm_model = llm_engine.create_interface()

logger = app_logging.get_logger(__name__)


def validate_prompts(prompts: Union[List[llm_engine.ChatCompletionRequestMessage], None]):
    if type(prompts) != list:
        raise HTTPException(status_code=400, detail="Prompt have to be a list")
    if len(prompts) == 0:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    def parse_message(message):
        if type(message) != dict:
            raise HTTPException(status_code=400, detail="Prompt message have to be dict")
        try:
            return {"content": message["content"], "role": message["role"]}
        except KeyError:
            raise HTTPException(status_code=400, detail="Prompt message have to contain role and content")

    [systemPrompt, *rest_prompts] = prompts
    if parse_message(systemPrompt)['role'] != "system":
        raise HTTPException(status_code=400, detail="First prompt item role have to be system")
    if parse_message(rest_prompts[-1])['role'] != 'user':
        raise HTTPException(status_code=400, detail="Last prompt item role have to be user")
    for index, p in enumerate(rest_prompts):
        expected_role = "user" if index % 2 == 0 else "assistant"
        if parse_message(p)['role'] != expected_role:
            raise HTTPException(status_code=400,
                                detail="Prompt item should follow alternately user and assistant")
    return prompts


def validate_response_schema(schema):
    if type(schema) != dict:
        raise HTTPException(status_code=400, detail="Response schema have to be a dict")
    if schema.get('type') != 'object':
        raise HTTPException(status_code=400, detail="Response schema type have to be object")
    if type(schema.get('properties')) != dict:
        raise HTTPException(status_code=400, detail="Response schema properties have to be a dict")
    if type(schema.get('required')) != list:
        raise HTTPException(status_code=400, detail="Response schema required have to be a list")
    return schema


async def prompt(request):
    api_body = await request.json()
    resp_start = time.time()
    schema = validate_response_schema(api_body.get('response', {}).get('json_schema'))
    prompts = validate_prompts(api_body.get('prompts'))
    cache_control_header = request.headers.get('Cache-Control', '')
    use_cache = cache_control_header not in ['no-cache', 'no-store']
    should_cache_response = cache_control_header not in ['no-store']
    logger.info("Request to LLM", extra={
        "use_cache": use_cache,
        "should_cache_response": should_cache_response,
        "request_id": request.headers.get('request-id')
    })
    cached_response = database.get_cached_llm_prompt(prompts) if use_cache else None
    if cached_response is None:
        logger.info("Calculate Response", extra={
            "request_id": request.headers.get('request-id')
        })
        resp = llm_model.prompt(prompts, schema)
        if should_cache_response:
            logger.info("Cache response to db", extra={
                "request_id": request.headers.get('request-id')
            })
            database.cache_llm_prompt(prompts, resp)
    else:
        logger.info("Request cached", extra={
            "request_id": request.headers.get('request-id')
        })
        resp = cached_response
    resp_end = time.time()
    logger.info("Response from LLM", extra={
        "schema": schema,
        "prompts": prompts,
        "response": resp,
        "response_time": str(datetime.timedelta(seconds=resp_end - resp_start)),
        "request_id": request.headers.get('request-id')
    })
    return JSONResponse({'message': resp})


async def healthCheck():
    resp = llm_model.prompt([{
        "content": "Are you operating as normal? Reply in JSON Object Format with with 1 key, 'status' ('ok' or 'error')",
        "role": "system"
    }, {
        'role': "user",
        "content": "Are you operating as normal? Reply in JSON Object Format with with 1 key, 'status' ('ok' or 'error')",
    }], {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["ok", "error"]
            }
        },
        "required": ["status"]
    })
    return JSONResponse({'llm': resp})


app = Starlette(routes=[
    Route('/prompt', endpoint=prompt, methods=['POST']),
    Route('/health', endpoint=healthCheck, methods=['GET'])
])
