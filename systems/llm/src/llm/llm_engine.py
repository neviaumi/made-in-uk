import tempfile
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


def prompt(system, prompt_str: str):
    if not Path(cache_dir.joinpath(model_name)).is_file():
        raise Exception("Run save_locally.py before get the prompt")
    model = GPT4All(model_name, model_path=cache_dir, allow_download=False)
    with model.chat_session(system, f"""<|system|>
{system}<|end|>
{{0}}
<|assistant|>"""):
        resp = ""
        def generate_callback(token, str):
            nonlocal resp
            resp+=str
            try:
                json.loads(resp)
                return False
            except:
                return True
        model.generate(prompt_str, callback=generate_callback)
    model.close()

    return resp