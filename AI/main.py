# Loaders
from langchain.schema import Document
# Splitters
from langchain.text_splitter import RecursiveCharacterTextSplitter
#Model
from langchain_groq import ChatGroq
from langchain.chains.summarize import load_summarize_chain
from dotenv import load_dotenv
import os
from langchain_core.prompts import PromptTemplate


load_dotenv()
verbose = False
#model = OllamaLLM(model="qwen3:0.6b")
model = ChatGroq(
        groq_api_key=os.getenv("GROQ"),
        model_name="llama-3.3-70b-versatile",
        max_tokens=2000,
    )
def large_summariser(code_base):
    text = code_base
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", "\t"], chunk_size=10000, chunk_overlap=1000
    )

    docs = text_splitter.create_documents([text])

    num_documents = len(docs)

#    llm = ChatGroq(
#        groq_api_key=os.getenv("GROQ"),
#        model_name="llama-3.2-3b-preview",
#        max_tokens=1000,
#    )

    map_prompt = """The following text contains a project’s codebase. Enclosed within triple backticks (```), extract only the **relevant information** needed to write a `Dockerfile` and `docker-compose.yml`, including:
- Main programming language and estimated runtime version
- Presence of a dependency manifest (e.g., `requirements.txt`, `package.json`)
- System-level dependencies (e.g., `curl`, `gcc`)
- Use of virtual environments or language-specific package managers
- Build tools required (e.g., `make`, `maven`)
- Pre-/post-build steps
- Application entry point
- Files/folders to be added to `.dockerignore`
- Required config files (`.env`, `.yaml`, etc.)
- Environment variables used at runtime
- Custom entrypoint scripts (if any)
- Ports to expose
- Inter-container communication
- Required services (DBs like Postgres, Redis, etc.)
- Folders needing persistent volumes (only if necessary)
Only include what's clearly evident or logically inferred from the codebase. Avoid assumptions or unnecessary services, volumes, or steps.
```{text}```
    """
    map_prompt_template = PromptTemplate(template=map_prompt, input_variables=["text"])

    map_chain = load_summarize_chain(
        llm=model, chain_type="stuff", prompt=map_prompt_template, verbose=verbose
    )

    selected_docs = list(docs)

    # Make an empty list to hold your summaries
    summary_list = []

    # Loop through a range of the lenght of your selected docs
    for i, doc in enumerate(selected_docs):
        # Go get a summary of the chunk
        chunk_summary = map_chain.run([doc])

        # Append that summary to your list
        summary_list.append(chunk_summary)

    summaries = "\n".join(summary_list)
    # Convert it back to a document
    summaries = Document(page_content=summaries)

#    print(f"Your total summary has {model.get_num_tokens(summaries.page_content)} tokens")

    llm2 = ChatGroq(
        groq_api_key=os.getenv("GROQ"),
        model_name="llama-3.3-70b-versatile",
        max_tokens=2000,
    )
    combine_prompt = """
    You will be given a passage containing **compiled information extracted from a codebase** using earlier prompts that analyze various components relevant for building Dockerfiles and Docker Compose configurations.
Your task is to:
1. **Aggregate** all relevant insights from the passage.
2. **Organize the data** into clearly structured categories useful for containerization.
3. **Eliminate redundancy**, contradictions, or irrelevant assumptions.
4. **Summarize the final context** to be used for writing an optimized, production-ready `Dockerfile` and `docker-compose.yml`.
Your output should be well-organized, logically grouped, and include only details that are clearly evident or _strongly inferred_ from the provided content. The final structure should be clean and concise, ready to guide containerization of the application.
Organize your summary under the following structured headings:
- **Language & Runtime**
- **Dependency Management**
- **Build & Compilation Tools**
- **App Structure & Entry Point**
- **Environment & Configs**
- **Ports & Networking**
- **Services & Inter-Container Needs**
- **Volumes & Persistence**
- **Entrypoint/Startup Requirements**
- **Other Notable Observations (if any)**
Ensure no unnecessary Dockerfile steps or services are introduced unless logically inferred or explicitly mentioned. Volumes should also be mounted where needed (ie for data that needs to be written down and persisted)
The input will be enclosed in triple backticks:  
```{text}```

    
    """
    combine_prompt_template = PromptTemplate(
        template=combine_prompt, input_variables=["text"]
    )
    reduce_chain = load_summarize_chain(
        llm=llm2, chain_type="stuff", prompt=combine_prompt_template, verbose=verbose
    )  # Set this to true if you want to see the inner workings

    output = reduce_chain.run([summaries])
    # print(output)
    return output


if __name__ == "__main__":
    x = large_summariser("this is sample text")

    with open("sample.txt", "w", encoding="utf-8") as f:
        f.write(x)





