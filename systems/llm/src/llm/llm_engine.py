import os
import json
from pathlib import PurePath, Path
from gpt4all import GPT4All

model_name = "Phi-3-mini-4k-instruct.Q4_0.gguf"
cache_dir = PurePath(os.getcwd(), 'gpt4all')


def save_locally():
    os.makedirs(cache_dir, exist_ok=True)
    if Path(cache_dir.joinpath(model_name)).is_file():
        return cache_dir.joinpath(model_name)
    GPT4All.download_model(
        model_name,
        cache_dir,
    )
    return cache_dir.joinpath(model_name)


def create_interface():
    if not Path(cache_dir.joinpath(model_name)).is_file():
        raise Exception("Run pre_load_modal.py before get the prompt")
    model = GPT4All(model_name, model_path=cache_dir, allow_download=False)

    class ModelWrapper:
        def __init__(self, model):
            self.model = model

        def __del__(self):
            self.model.close()

        def prompt(self, system, prompt_str: str):
            with self.model.chat_session(system):
                resp = None

                def generate_callback(token, str):
                    nonlocal resp
                    if resp is None and "{" in str:
                        resp = str
                    elif resp is not None:
                        resp += str
                    try:
                        json.loads(resp)
                        return False
                    except:
                        return True

                self.model.generate(prompt_str, callback=generate_callback)
            return resp

    return ModelWrapper(model)
