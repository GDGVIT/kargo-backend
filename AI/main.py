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
import requests
import subprocess
import shutil
import tempfile
import re
from pathlib import Path

load_dotenv()
verbose = False
PRG_EXTENSIONS = [
    # General Purpose & Scripting
    '.py',      # Python
    '.rb',      # Ruby
    '.pl',      # Perl
    '.pm',      # Perl Module
    '.php',     # PHP
    '.js',      # JavaScript
    '.mjs',     # JavaScript ES Module
    '.cjs',     # JavaScript CommonJS Module
    '.ts',      # TypeScript
    '.tsx',     # TypeScript with JSX (React)
    '.jsx',     # JavaScript with JSX (React)
    '.lua',     # Lua
    '.groovy',  # Groovy
    '.tcl',     # Tcl
    '.sh',      # Shell Script (Bash, sh, etc.)
    '.bash',    # Bash Script
    '.zsh',     # Zsh Script
    '.ps1',     # PowerShell (PowerShell Core runs on Linux)
    '.swift',   # Swift (server-side)
    '.dart',    # Dart (server-side, Flutter build)
    '.coffee',  # CoffeeScript

    # Compiled Languages (source files)
    '.c',       # C
    '.h',       # C Header
    '.cpp',     # C++
    '.cc',      # C++
    '.cxx',     # C++
    '.hpp',     # C++ Header
    '.hh',      # C++ Header
    '.java',    # Java
    '.scala',   # Scala
    '.sc',      # Scala Script
    '.kt',      # Kotlin
    '.kts',     # Kotlin Script
    '.go',      # Go
    '.rs',      # Rust
    '.cs',      # C# (.NET Core/5+)
    '.fs',      # F# (.NET Core/5+)
    '.fsx',     # F# Script
    '.vb',      # VB.NET (.NET Core/5+)
    '.d',       # D
    '.pas',     # Pascal
    '.pp',      # Free Pascal
    '.f',       # Fortran
    '.for',     # Fortran
    '.f90',     # Fortran 90
    '.f95',     # Fortran 95
    '.ada',     # Ada
    '.adb',     # Ada Body
    '.ads',     # Ada Spec
    '.cob',     # COBOL (GnuCOBOL)
    '.cbl',     # COBOL
    '.asm',     # Assembly
    '.s',       # Assembly (Unix-like)
    '.vala',    # Vala
    '.nim',     # Nim
    '.cr',      # Crystal
    '.zig',     # Zig
    '.m',       # Objective-C (compilers exist for Linux) or MATLAB/Octave

    # Functional Languages (source files)
    '.hs',      # Haskell
    '.lhs',     # Literate Haskell
    '.lisp',    # Lisp
    '.lsp',     # Lisp
    '.cl',      # Common Lisp
    '.el',      # Emacs Lisp (can be scripted)
    '.scm',     # Scheme
    '.ss',      # Scheme
    '.rkt',     # Racket
    '.clj',     # Clojure
    '.cljs',    # ClojureScript
    '.cljc',    # Clojure/ClojureScript (shared)
    '.ml',      # OCaml
    '.mli',     # OCaml Interface
    '.elm',     # Elm (compiles to JS)
    '.erl',     # Erlang
    '.hrl',     # Erlang Header
    '.ex',      # Elixir
    '.exs',     # Elixir Script
    '.purs',    # PureScript (compiles to JS)
    '.idr',     # Idris
    '.re',      # ReasonML
    '.rei',     # ReasonML Interface

    '.html',    # HTML
    '.htm',     # HTML
    '.css',     # CSS
    '.scss',    # SCSS (Sass)
    '.sass',    # Sass
    '.less',    # LESS
    '.styl',    # Stylus
    '.vue',     # Vue.js Single File Components
    '.svelte',  # Svelte components

    '.R',       # R
    '.Rmd',     # R Markdown (can be rendered in Docker)

    '.ipynb',   # Jupyter Notebook (Python, R, Julia, etc.)

    '.md'       # Markdown
]
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
the output should only consist of the dockerfile and docker-compose code block, nothing more under no circumstances
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
    print(output)
    return output


def get_repo_code_as_string(
    github_url: str,
    max_size_mb: float = 200.0,
    target_extensions: list = None,
    ignore_patterns: list = None,  # e.g., ['.git', 'node_modules', '__pycache__']
    branch: str = None # Specify a branch, or None for default
) -> str:
    """
    Checks if a GitHub repository is below a certain size, downloads it,
    and consolidates all code files into a single string with file paths.

    Args:
        github_url (str): The URL of the GitHub repository.
        max_size_mb (float): Maximum allowed repository size in megabytes.
        target_extensions (list, optional): List of file extensions to include (e.g., ['.py', '.js']).
                                            If None, all files (except ignored) are included.
        ignore_patterns (list, optional): List of directory/file names or glob patterns to ignore.
                                          Defaults to ['.git']. Add more as needed.
        branch (str, optional): The specific branch to clone. If None, clones the default branch.

    Returns:
        str: A string containing all concatenated code files with their paths,
             or an error message if an issue occurs.
    """
    if ignore_patterns is None:
        ignore_patterns = ['.git']

    # 1. Parse GitHub URL
    match = re.match(r"https?://github\.com/([^/]+)/([^/.]+)(\.git)?", github_url)
    if not match:
        return "Error: Invalid GitHub URL format."
    owner, repo_name = match.group(1), match.group(2)

    api_url = f"https://api.github.com/repos/{owner}/{repo_name}"
    try:
        response = requests.get(api_url)
        response.raise_for_status()  # Raise an exception for HTTP errors
        repo_data = response.json()
    except requests.exceptions.RequestException as e:
        return f"Error: Could not fetch repository data from GitHub API: {e}"

    repo_size_kb = repo_data.get("size", 0)  # Size is in kilobytes
    repo_size_mb = repo_size_kb / 1024

    print(f"Repository: {owner}/{repo_name}")
    print(f"Reported size: {repo_size_mb:.2f} MB")

    if repo_size_mb > max_size_mb:
        return f"Error: Repository size ({repo_size_mb:.2f}MB) exceeds maximum allowed size ({max_size_mb}MB)."

    # 3. Download repository
    temp_dir = tempfile.mkdtemp()
    print(f"Cloning into temporary directory: {temp_dir}...")
    try:
        clone_command = ["git", "clone", "--depth", "1"]  # Shallow clone for speed
        if branch:
            clone_command.extend(["--branch", branch])
        clone_command.extend([github_url, temp_dir])

        subprocess.run(
            clone_command,
            capture_output=True,
            text=True,
            check=True  # Raises CalledProcessError for non-zero exit codes
        )
        print("Clone successful.")
    except subprocess.CalledProcessError as e:
        shutil.rmtree(temp_dir)
        return f"Error: Could not clone repository.\nGit stderr: {e.stderr}\nGit stdout: {e.stdout}"
    except FileNotFoundError:
        shutil.rmtree(temp_dir)
        return "Error: Git command not found. Please ensure Git is installed and in your PATH."

    # 4. Consolidate code files
    all_code_string = ""
    repo_root = Path(temp_dir)

    print("Processing files...")
    file_count = 0
    for current_path in repo_root.rglob('*'):  # rglob walks recursively
        relative_path_str = str(current_path.relative_to(repo_root))

        # Check against ignore patterns (simple substring check for directories, could be more complex)
        skip = False
        for pattern in ignore_patterns:
            if pattern in relative_path_str.split(os.sep):  # Check if any part of path matches
                skip = True
                break
        if skip:
            continue

        if current_path.is_file():
            # Check target extensions if provided
            if target_extensions and current_path.suffix.lower() not in [ext.lower() for ext in target_extensions]:
                continue

            try:
                with open(current_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                all_code_string += f"--- File: {relative_path_str} ---\n"
                all_code_string += content
                all_code_string += "\n\n"
                file_count += 1
            except Exception as e:
                print(f"Warning: Could not read file {relative_path_str}: {e}")

    print(f"Processed {file_count} files.")

    # 5. Clean up
    try:
        shutil.rmtree(temp_dir)
        print(f"Cleaned up temporary directory: {temp_dir}")
    except Exception as e:
        print(f"Warning: Could not remove temporary directory {temp_dir}: {e}")

    if not all_code_string and file_count == 0:
        return "Warning: No files were processed. Check target_extensions or repository content."

    return all_code_string


def dockerise(url):
    result = get_repo_code_as_string(
        repo_url_small,
        max_size_mb=200,
        target_extensions=PRG_EXTENSIONS,
        ignore_patterns=['.git', '.github', 'docs', 'tests', '__pycache__', '.tox', '.idea', 'build', 'dist', '*.egg-info']
    )

    docker = large_summariser(result)
    docker = docker[docker.index("dockerfile"):]
    dockerfile = docker[:docker.index("```")]
    docker_compose = docker[docker.index("yml"):]
    docker_compose =docker_compose[:docker_compose.index("```")]

    return "#"+dockerfile, "#"+docker_compose

if __name__ == "__main__":



    repo_url_small = "https://github.com/Noel-Alex/ultrachat"
    dockerfile, docker_compose = dockerise(repo_url_small)
    print(dockerfile)
    print(docker_compose)



