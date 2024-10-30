import os
from llama_cpp import Llama, ChatCompletionRequestMessage
from typing import List, TypedDict

_JsonSchema = TypedDict("JsonSchema", {"type": str, "properties": dict, "required": List[str]})


def create_interface():
    llm = Llama(
        model_path=os.path.join(os.getcwd(), ".models", "phi-3.5", "Phi-3.5-mini-instruct-Q4_K_M.gguf"),
        n_ctx=8192,
    )

    class ModelWrapper:
        model: Llama

        def __init__(self, model: Llama):
            self.model = model

        def __del__(self):
            self.model.close()

        def prompt(self, prompts: List[ChatCompletionRequestMessage], response_schema: _JsonSchema):
            resp = self.model.create_chat_completion(
                prompts,
                response_format={"type": "json_object",
                                 "schema": response_schema}
            )
            resp_message = resp['choices'][0]['message']['content']
            return resp_message

    return ModelWrapper(llm)
