# Loaders
from langchain.schema import Document
# Splitters
from langchain.text_splitter import RecursiveCharacterTextSplitter
#Model
from langchain_groq import ChatGroq
from langchain.chains.summarize import load_summarize_chain
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
import re
import requests
import tempfile
import subprocess
import shutil
import os
from urllib.parse import urlparse
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
        separators=["\n\n", "\n", "\t"], chunk_size=10000, chunk_overlap=50
    )

    docs = text_splitter.create_documents([text])

    num_documents = len(docs)

#    llm = ChatGroq(
#        groq_api_key=os.getenv("GROQ"),
#        model_name="llama-3.2-3b-preview",
#        max_tokens=1000,
#    )

    map_prompt = """The following text contains snippets from a project’s codebase. Enclosed within triple backticks (```), extract only the **relevant information** needed to write a `Dockerfile` and `docker-compose.yml`, including:
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

        # If the summary is a dict (as returned by some LLM chains), extract the string
        if isinstance(chunk_summary, dict):
            # Try to get the main content from common keys
            if 'output_text' in chunk_summary:
                chunk_summary = chunk_summary['output_text']
            elif 'text' in chunk_summary:
                chunk_summary = chunk_summary['text']
            else:
                chunk_summary = str(chunk_summary)
            print(chunk_summary)
        # Append that summary to your list
        summary_list.append(chunk_summary)

    summaries = "\n".join(str(s) for s in summary_list)
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
the output should only consist of the dockerfile and docker-compose code block, nothing more under no circumstances. The out put should be enclosed in ```dockerfile <content>``` for the dockerfile and ```yml <content>``` for the docker-compose
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



def get_folder_structure(repo_root_path: Path, ignore_patterns: list = None, max_depth: int = 8) -> str:
    """
    Generates a string representation of the folder structure of a repository.

    Args:
        repo_root_path (Path): The absolute path to the root of the cloned repository.
        ignore_patterns (list, optional): List of directory/file names to ignore.
                                          Defaults to common patterns.
        max_depth (int, optional): Maximum depth to traverse. 0 means no limit (within reason).

    Returns:
        str: A string representing the folder structure.
    """
    if ignore_patterns is None:
        ignore_patterns = ['.git', 'node_modules', '__pycache__', 'dist', 'build', 'target', '.venv', 'venv', '*.egg-info']

    structure_lines = [f"Repository Root: {repo_root_path.name}"]
    prefix_item = "├── "
    prefix_last_item = "└── "
    prefix_indent = "│   "
    prefix_empty_indent = "    "

    def _should_ignore(path_obj: Path, root_path: Path) -> bool:
        relative_path_parts = path_obj.relative_to(root_path).parts
        for pattern in ignore_patterns:
            if pattern.startswith('*.'): # Simple extension check e.g. *.pyc
                if path_obj.name.endswith(pattern[1:]):
                    return True
            elif pattern in relative_path_parts or path_obj.name == pattern:
                return True
        return False

    def _generate_structure_recursive(current_path: Path, current_prefix: str, depth: int):
        if max_depth > 0 and depth > max_depth:
            structure_lines.append(f"{current_prefix}{prefix_last_item}... (max depth reached)")
            return

        items = []
        try:
            for item in sorted(os.listdir(current_path)): # Sort for consistent output
                item_path = current_path / item
                if not _should_ignore(item_path, repo_root_path):
                    items.append(item_path)
        except OSError as e:
            structure_lines.append(f"{current_prefix}└── [Error reading: {e.strerror}]")
            return


        for i, item_path in enumerate(items):
            is_last = (i == len(items) - 1)
            connector = prefix_last_item if is_last else prefix_item
            structure_lines.append(f"{current_prefix}{connector}{item_path.name}")

            if item_path.is_dir():
                new_prefix = current_prefix + (prefix_empty_indent if is_last else prefix_indent)
                _generate_structure_recursive(item_path, new_prefix, depth + 1)

    _generate_structure_recursive(repo_root_path, "", 1)
    return "\n".join(structure_lines)

def extract_port_snippets(codebase_text, context_lines=3):
    """
    Extracts snippets of code from a large text string wherever a potential
    port declaration is found.

    Args:
        codebase_text (str): The entire codebase as a single string.
        context_lines (int): Number of lines before and after the matching line
                             to include in the snippet.

    Returns:
        list: A list of strings, where each string is a code snippet.
              Each snippet will also include a header indicating the
              approximate line number and the pattern that matched.
    """
    snippets = []
    # Split the codebase into lines to easily get context
    # Keepends=True is important if you want to preserve original line endings in snippets
    lines = codebase_text.splitlines(keepends=True)
    if not lines:  # Handle empty codebase text
        return []

    # Regex patterns for port declarations.
    # These are illustrative; you'll want to expand and refine them.
    # The 'desc' field helps identify which pattern matched.
    PORT_REGEX_PATTERNS = [
        {"desc": "Dockerfile EXPOSE", "pattern": r"^\s*EXPOSE\s+([1-9]\d{2,4})\b"},
        {"desc": "docker-compose ports (target)", "pattern": r"ports:\s*-\s*[\"']?\d+:([1-9]\d{2,4})[\"']?"},
        {"desc": "docker-compose ports (simple)", "pattern": r"ports:\s*-\s*[\"']?([1-9]\d{2,4})[\"']?"},
        # e.g. - "3000"
        {"desc": "Node.js/Express app.listen", "pattern": r"\.listen\(\s*([1-9]\d{2,4})\s*[,)]"},
        {"desc": "Python Flask app.run port", "pattern": r"app\.run\(.*port\s*=\s*([1-9]\d{2,4})"},
        {"desc": "Python http.server", "pattern": r"HTTPServer\(\s*\([^,]+,\s*([1-9]\d{2,4})\s*\)"},
        {"desc": "Python socket.bind port", "pattern": r"\.bind\(\s*\([^,]+,\s*([1-9]\d{2,4})\s*\)"},
        {"desc": "Java Spring server.port", "pattern": r"^\s*server\.port\s*=\s*([1-9]\d{2,4})"},
        {"desc": ".env PORT variable", "pattern": r"^\s*PORT\s*=\s*([1-9]\d{2,4})\b"},
        {"desc": "Generic 'port' keyword followed by number", "pattern": r"port[\s:=]+([1-9]\d{2,4})\b"},
    ]

    # To avoid adding highly overlapping snippets from different regexes on the same line,
    # we can keep track of line numbers already processed for a snippet.
    # This is a simple form of deduplication.
    processed_line_indices = set()

    for i, line_content in enumerate(lines):
        if i in processed_line_indices:
            continue  # Already part of a snippet from this line

        for config in PORT_REGEX_PATTERNS:
            pattern = config["pattern"]
            description = config["desc"]
            try:
                # We search line by line because finditer on the whole text
                # makes it harder to get line-based context without more complex line mapping.
                match = re.search(pattern, line_content, re.IGNORECASE)
                if match:
                    # Determine snippet boundaries
                    start_line_idx = max(0, i - context_lines)
                    end_line_idx = min(len(lines), i + 1 + context_lines)  # +1 because slice is exclusive

                    # Extract the snippet lines
                    snippet_lines = lines[start_line_idx:end_line_idx]

                    # Add a header to the snippet
                    header = f"--- Snippet: Match for '{description}' (approx line {i + 1}) ---\n"
                    snippet_text = header + "".join(snippet_lines)
                    snippets.append(snippet_text)

                    # Mark these lines as processed to avoid too much overlap
                    for j in range(start_line_idx, end_line_idx):
                        processed_line_indices.add(j)

                    break  # Move to the next line in the codebase after finding a match on this line
            except re.error as e:
                print(f"Regex error with pattern '{pattern}': {e}")
                continue

    # A more robust deduplication if identical snippets are generated by different means
    # (though the processed_line_indices helps a lot)
    # Convert to set and back to list to remove exact duplicate snippet strings
    if snippets:
        unique_snippets_dict = {snip: None for snip in snippets}  # Preserves order in Python 3.7+
        snippets = list(unique_snippets_dict.keys())

    return snippets


def _extract_volume_snippets_from_content(
    file_content_str: str,
    file_relative_path: Path, # Relative path of the current file within the repo
    repo_root_path: Path,     # Absolute path to the root of the cloned repo on the host
    context_lines: int = 2
) -> list:
    """
    Extracts snippets of code from file content wherever a potential
    volume, persistent path, or database file is mentioned.
    Resolves relative paths to be "normalized relative to the repository root".
    Attempts to filter out URLs and non-path-like strings.
    """
    snippets = []
    lines = file_content_str.splitlines(keepends=True)
    if not lines:
        return []

    # Regex patterns for volumes/paths.
    # Each dict: desc, pattern, path_group_idx, is_container_absolute, confidence
    VOLUME_PATTERNS_CONFIG = [
        {
            "desc": "Dockerfile VOLUME instruction",
            # Matches "VOLUME /path" or "VOLUME ["/path1", "/path2"]"
            "pattern": r"^\s*VOLUME\s+(?:\[\s*(?:\"([^\"]+)\"|\'([^\']+)\')(?:,\s*(?:\"([^\"]+)\"|\'([^\']+)\'))*\s*\]|([/\w\.-]+(?:[/\w\s\.-]*[/\w\.-]+)?))",
            "path_groups": [1, 2, 3, 4, 5], # All potential quoted paths or the direct path
            "is_container_absolute": True, "confidence": 10
        },
        {
            "desc": "docker-compose volume (container path)",
            "pattern": r"volumes:\s*-.*:(?<!\$)(\{?\s*[/\w\.\-\$]+[^#\s]*)", # Path after colon, avoid env var placeholders like ${VAR} for path
            "path_group": 1, "is_container_absolute": True, "confidence": 9
        },
        {
            "desc": "SQLite/DB file connection/path", # More specific to common DB file extensions
            "pattern": r"""(?:sqlite3|db|connect|Connection|database_url|DATABASE_URL)\s*\(?\s*(['"])([^'"\s]+\.(?:db|sqlite|sqlite3|duckdb|mv\.db|h2\.db|leveldb|rocksdb))\1""",
            "path_group": 2, "is_container_absolute": False, "confidence": 8
        },
        {
            "desc": "File open for write/append (more path-like)",
            # Ensure path looks somewhat like a path, not just any string
            "pattern": r"""open\(\s*(['"])((?:[a-zA-Z0-9_.-][/\\]?)+)\1\s*,\s*(['"])[awx+b]{1,2}\3""",
            "path_group": 2, "is_container_absolute": False, "confidence": 7 # Increased confidence due to stricter pattern
        },
        { # Specific to common persistent dirs
            "desc": "Common persistent directory name",
            "pattern": r"""(['"])((?:[./\w-]*?/)?(?:uploads?|media|static/uploads|data|logs?|storage|db|database)(?:[/\w.-]*?)?)\1""",
            "path_group": 2, "is_container_absolute": False, "confidence": 6
        },
        { # Relative paths that look like paths
            "desc": "Generic relative filepath in quotes",
             # Starts with ./ or ../ or is just filename.ext or dir/filename.ext
            "pattern": r"""(['"])((?:\.(?:[/\\]|\b))?[a-zA-Z0-9_.-]+(?:[/\\][a-zA-Z0-9_.-]+)+\.[a-zA-Z0-9]{1,5}|(?:\.(?:[/\\]|\b))?[a-zA-Z0-9_.-]+[/\\][a-zA-Z0-9_.-]+)\1""",
            "path_group": 2, "is_container_absolute": False, "confidence": 4
        },
         { # Absolute paths that look like paths
            "desc": "Generic absolute filepath in quotes",
            "pattern": r"""(['"])(/(?:[a-zA-Z0-9_.-][/\\]?)+[a-zA-Z0-9_.-]*)\1""", # Starts with /
            "path_group": 2, "is_container_absolute": True, "confidence": 5
        }
    ]

    processed_line_indices = set()

    for i, line_content in enumerate(lines):
        if i in processed_line_indices:
            continue

        for config in VOLUME_PATTERNS_CONFIG:
            try:
                for match in re.finditer(config["pattern"], line_content, re.IGNORECASE):
                    original_matched_path_str = None
                    if "path_groups" in config: # For Dockerfile VOLUME with multiple paths
                        for grp_idx in config["path_groups"]:
                            if match.group(grp_idx):
                                original_matched_path_str = match.group(grp_idx).strip()
                                break # Use the first non-None group
                    elif "path_group" in config:
                         original_matched_path_str = match.group(config["path_group"]).strip()

                    if not original_matched_path_str or original_matched_path_str == "." or original_matched_path_str == "..":
                        continue

                    # --- Filtering out URLs and non-path like strings ---
                    # 1. Basic URL check
                    parsed_url = urlparse(original_matched_path_str)
                    if parsed_url.scheme in ('http', 'https', 'ftp', 'ftps', 'mailto', 'tel', 'ws', 'wss') and parsed_url.netloc:
                        # print(f"Skipping URL: {original_matched_path_str}")
                        continue
                    # 2. Avoid matching overly generic English phrases (simple check)
                    if ' ' in original_matched_path_str and not (original_matched_path_str.startswith('"') and original_matched_path_str.endswith('"')): # Paths with spaces usually quoted
                        if len(original_matched_path_str.split()) > 3 and not any(c in original_matched_path_str for c in '/\\.'): # more than 3 words, no path chars
                            # print(f"Skipping generic phrase: {original_matched_path_str}")
                            continue
                    # 3. Filter out if looks like env var placeholder
                    if original_matched_path_str.startswith("${") and original_matched_path_str.endswith("}"):
                        # print(f"Skipping env var placeholder: {original_matched_path_str}")
                        continue
                    # 4. Avoid non-path parts of Dockerfile VOLUME array string
                    if config["desc"] == "Dockerfile VOLUME instruction" and original_matched_path_str in ('[', ']', ','):
                        continue


                    notes = ""
                    effective_path_str = ""

                    if config["is_container_absolute"]:
                        effective_path_str = Path(original_matched_path_str).as_posix()
                        notes = " (Path is absolute in container definition or code)"
                    else:
                        path_in_code = Path(original_matched_path_str)
                        if path_in_code.is_absolute():
                            effective_path_str = path_in_code.as_posix()
                            notes = " (Path is absolute in code, refers to container filesystem)"
                        else:
                            path_from_repo_root = file_relative_path.parent / path_in_code
                            normalized_path_str = os.path.normpath(path_from_repo_root.as_posix())
                            effective_path_str = Path(normalized_path_str).as_posix()
                            notes = " (Path normalized relative to repository root)"
                            if effective_path_str.startswith(".."):
                                notes += " - WARNING: Path appears to go above repository root."

                    start_line_idx = max(0, i - context_lines)
                    end_line_idx = min(len(lines), i + 1 + context_lines)
                    snippet_lines = lines[start_line_idx:end_line_idx]

                    # Desired output format
                    header = (
                        f"    {effective_path_str}    Effective Path Suggestion (relative to repo root or absolute): '{effective_path_str}'{notes}\n"
                        f"    (Original in code: '{original_matched_path_str}', File: {file_relative_path.as_posix()}:{i + 1}, Pattern: '{config['desc']}')\n"
                        f"--- Code Context ---\n"
                    )
                    snippet_text = header + "".join(snippet_lines)
                    snippets.append(snippet_text)

                    for j in range(start_line_idx, end_line_idx):
                        processed_line_indices.add(j)
                    # Important: break from inner loop (patterns) once a suitable match on this line is processed
                    # but continue to check the rest of the line with re.finditer for multiple matches on the same line.
                    # Actually, for simplicity and to avoid over-complicating `processed_line_indices` with sub-line positions,
                    # let's stick to one main snippet per line from the first pattern that matches and passes filters.
                    # If multiple actual paths on one line are needed, `re.finditer` logic needs to be more careful.
                    # For now, let's break from the config loop to simplify processed_line_indices logic.
                    break # Break from iterating through VOLUME_PATTERNS_CONFIG for this line
                if i in processed_line_indices: # If the inner loop added to processed_line_indices
                    break # Break from outer match loop to go to next line

            except re.error as e:
                print(f"Regex error for '{config['desc']}' with pattern '{config['pattern']}': {e}")
                continue
            except IndexError:
                print(f"Warning: Path group issue for pattern '{config['pattern']}'")
                continue

    if snippets:
        unique_snippets_dict = {snip: None for snip in snippets}
        snippets = list(unique_snippets_dict.keys())
    return snippets

# The main `get_repo_code_as_string_and_volume_snippets` function remains the same.
# Ensure you have it in your script.

# --- Main function (get_repo_code_as_string_and_volume_snippets) ---
# ... (This function remains the same as in the previous answer) ...
def get_repo_code_as_string_and_volume_snippets(
    github_url: str,
    max_size_mb: float = 200.0,
    target_extensions: list = None, # For main codebase string
    snippet_scan_extensions: list = None, # For volume snippet scanning (broader by default)
    ignore_patterns: list = None,
    branch: str = None
) -> tuple: # Returns (str | None, list | None) -> (codebase_string, volume_snippets)
    """
    Checks GitHub repo size, downloads it, consolidates code into a single string,
    and extracts snippets related to potential persistent volumes.
    (Full function body from previous correct answer)
    """
    if ignore_patterns is None:
        ignore_patterns = ['.git', 'node_modules', '__pycache__', 'dist', 'build', 'target', 'vendor', '.venv', 'venv', '*.lock', 'package-lock.json']
    if snippet_scan_extensions is None:
        snippet_scan_extensions = []

    match = re.match(r"https?://github\.com/([^/]+)/([^/.]+)(\.git)?", github_url)
    if not match:
        return "Error: Invalid GitHub URL format.", None
    owner, repo_name = match.group(1), match.group(2)

    api_url = f"https://api.github.com/repos/{owner}/{repo_name}"
    try:
        response = requests.get(api_url)
        response.raise_for_status()
        repo_data = response.json()
    except requests.exceptions.RequestException as e:
        return f"Error: Could not fetch repository data from GitHub API: {e}", None

    repo_size_kb = repo_data.get("size", 0)
    repo_size_mb = repo_size_kb / 1024
    print(f"Repository: {owner}/{repo_name}, Reported size: {repo_size_mb:.2f} MB")

    if repo_size_mb > max_size_mb:
        return f"Error: Repository size ({repo_size_mb:.2f}MB) > max ({max_size_mb}MB).", None

    temp_dir_path_obj = Path(tempfile.mkdtemp())
    print(f"Cloning into temporary directory: {temp_dir_path_obj}...")
    try:
        clone_command = ["git", "clone", "--depth", "1"]
        if branch:
            clone_command.extend(["--branch", branch])
        clone_command.extend([github_url, str(temp_dir_path_obj)])
        subprocess.run(clone_command, capture_output=True, text=True, check=True, encoding='utf-8')
        print("Clone successful.")
    except subprocess.CalledProcessError as e:
        shutil.rmtree(temp_dir_path_obj)
        error_message = f"Error: Could not clone repository.\nGit stderr: {e.stderr}\nGit stdout: {e.stdout}"
        # Attempt to decode if bytes
        if isinstance(e.stderr, bytes):
            error_message = f"Error: Could not clone repository.\nGit stderr: {e.stderr.decode(errors='replace')}\nGit stdout: {e.stdout.decode(errors='replace')}"
        return error_message, None
    except FileNotFoundError:
        shutil.rmtree(temp_dir_path_obj)
        return "Error: Git command not found. Ensure Git is installed and in PATH.", None

    all_code_string = ""
    all_volume_snippets = []
    processed_files_for_code = 0
    scanned_files_for_snippets = 0 # Total files scanned, not just those yielding snippets

    print("Processing files...")
    for current_path_obj in temp_dir_path_obj.rglob('*'):
        relative_path_obj = current_path_obj.relative_to(temp_dir_path_obj)

        skip = False
        path_parts = relative_path_obj.parts
        for pattern in ignore_patterns:
            # Handle glob patterns in ignore_patterns if needed, e.g. using fnmatch
            if pattern in path_parts or (pattern.startswith('.') and relative_path_obj.name == pattern) or \
               (pattern.endswith('.lock') and relative_path_obj.name.endswith('.lock')) or \
               (relative_path_obj.name == 'package-lock.json' and pattern == 'package-lock.json'):
                skip = True
                break
        if skip:
            continue

        if current_path_obj.is_file():
            file_content = None
            try:
                with open(current_path_obj, 'r', encoding='utf-8', errors='ignore') as f:
                    file_content = f.read()
            except Exception as e:
                print(f"Warning: Could not read file {relative_path_obj.as_posix()}: {e}")
                continue

            include_in_main_code = not target_extensions or \
                                   current_path_obj.suffix.lower() in [ext.lower() for ext in target_extensions]
            if include_in_main_code:
                all_code_string += f"--- File: {relative_path_obj.as_posix()} ---\n"
                all_code_string += file_content
                all_code_string += "\n\n"
                processed_files_for_code += 1

            scan_for_snippets = not snippet_scan_extensions or \
                                 current_path_obj.suffix.lower() in [ext.lower() for ext in snippet_scan_extensions]
            if scan_for_snippets and file_content:
                scanned_files_for_snippets += 1 # Count every file we attempt to scan
                snippets_from_file = _extract_volume_snippets_from_content(
                    file_content,
                    relative_path_obj,
                    temp_dir_path_obj
                )
                if snippets_from_file:
                    all_volume_snippets.extend(snippets_from_file)

    print(f"Processed {processed_files_for_code} files for codebase string.")
    print(f"Scanned {scanned_files_for_snippets} files for volume snippets.")

    try:
        shutil.rmtree(temp_dir_path_obj)
        print(f"Cleaned up temporary directory: {temp_dir_path_obj}")
    except Exception as e:
        print(f"Warning: Could not remove temporary directory {temp_dir_path_obj}: {e}")

    if not all_code_string and processed_files_for_code == 0 and target_extensions:
        all_code_string = "Warning: No files matched target_extensions for codebase string."
    if not all_volume_snippets and scanned_files_for_snippets > 0: # If we scanned but found nothing
         all_volume_snippets.append("--- Info: No potential volume snippets found in scanned files. ---")
    elif scanned_files_for_snippets == 0 and snippet_scan_extensions:
         all_volume_snippets.append("--- Info: No files matched snippet_scan_extensions for volume snippets. ---")


    return all_code_string, all_volume_snippets #get_folder_structure(temp_dir_path_obj) -> could be used to get directory structure to use in the combine prompt


def dockerise(url):
    code_str, vol_snippets = get_repo_code_as_string_and_volume_snippets(repo_url_small)
    code_str = "".join(code_str)
    vol_snippets = "Possible volumes\n"+("".join(vol_snippets))
    ports = "Possible ports\n"+("".join(extract_port_snippets(code_str)))
    if ports == []:
        ports = "None"
    if vol_snippets == []:
        vol_snippets = "None"
    result = vol_snippets+"\n"+ports


    docker = large_summariser(result)
    # If the output is a dict, try to extract the main text
    if isinstance(docker, dict):
        if 'output_text' in docker:
            docker = docker['output_text']
        elif 'text' in docker:
            docker = docker['text']
        else:
            docker = str(docker)
    # Now docker is a string
    docker = str(docker)
    # Defensive: check for 'dockerfile' and 'yml' blocks before extracting
    if "dockerfile" in docker and "yml" in docker:
        docker = docker[docker.index("dockerfile"):]
        dockerfile = docker[:docker.index("```")]
        docker_compose = docker[docker.index("yml"):]
        docker_compose = docker_compose[:docker_compose.index("```")]
    else:
        dockerfile = ""
        docker_compose = ""
    return "#"+dockerfile, "#"+docker_compose

if __name__ == "__main__":
    repo_url_small = "https://github.com/tiangolo/fastapi"
    repo_url_small = "https://github.com/Noel-Alex/ultrachat"
    code_str, vol_snippets = get_repo_code_as_string_and_volume_snippets(repo_url_small)
    ports = extract_port_snippets(code_str)
    print(vol_snippets)
    print(ports)


    with open("temp.txt", "w", encoding="utf-8") as f:
        f.write("".join(vol_snippets))
        f.write("\nPORTS\n\n\n")
        f.write("".join(ports))

#    dockerfile, docker_compose = dockerise(repo_url_small)
#    print(dockerfile)
#    print(docker_compose)



