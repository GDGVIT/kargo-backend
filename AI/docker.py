from main import dockerise
from sys import argv

def main():
    if len(argv) < 2:
        print("Usage: python docker.py git-repo-url")
        exit(1)
    repo_url_small = argv[1]
    dockerfile, docker_compose = dockerise(repo_url_small)
    with open("Dockerfile", "w") as f:
        f.write(dockerfile)
    with open("docker-compose.yml", "w") as f:
        f.write(docker_compose)


main()