from main import dockerise
from sys import argv
import warnings
import os

warnings.filterwarnings("ignore", category=DeprecationWarning)

def main():
    if len(argv) < 2:
        print("Usage: python docker.py git-repo-url")
        exit(1)
    repo_url_small = argv[1]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    dockerfile, docker_compose = dockerise(repo_url_small)
    with open(os.path.join(output_dir, "Dockerfile"), "w") as f:
        f.write(dockerfile)
    with open(os.path.join(output_dir, "docker-compose.yml"), "w") as f:
        f.write(docker_compose)

if __name__ == "__main__":
    main()
