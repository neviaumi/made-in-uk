# Pick LLM agent for LLM prompt

- Status: accepted

Technical Story: [Move out from gpt4all](https://github.com/neviaumi/made-in-uk/issues/461)

## Context and Problem Statement

In [LLM systems](../../systems/llm/) in was using
package [gpt-4all](https://github.com/nomic-ai/gpt4all) to generate prompts.
The packages limited only use of few models such as Llama3 8B, Mistral 7B, Phi3 3.8B...etc.
There haven't provided a way to load custom models also the package wasn't
popular enough.

## Decision Drivers

- Popular
- Run on Intel x86 Macbook (my development machine)
- Ability to load custom models
- Call from programming in the fingertip.
- Concurrent calls

## Considered Options

- HuggingFace Transformers
- vLLM
- llama.cpp
- Ollama

## Decision Outcome

Use llama.cpp and llama-cpp-python for LLM prompt generation.

## Pros and Cons of the Options <!-- optional -->

### HuggingFace Transformers

Running on CPU was very slow and memory consuming

- Good, huge of models available
- Bad, because it's very slow on CPU and memory consuming

### vLLM

[Experimental repo](https://github.com/neviaumi/experimental-vllm)

- Good, because it builds for concurrent calls
- Bad, because I can't get it running on my x86 Macbook

### llama.cpp

[Experimental llama.cpp](https://github.com/neviaumi/experimental-llama.cpp)

- Good, because it's working on my x86 Macbook
- Good, because it quicker then gpt4all
- Good, because it can load any gguf model
- Bad, because installation is a bit tricky
- Bad, because it is not designed for concurrent calls

## Links

- [LLM inference server performances comparison](https://github.com/ggerganov/llama.cpp/discussions/6730)
