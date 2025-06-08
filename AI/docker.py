from main import dockerise
from sys import argv

def main():
    if len(argv) < 2:
        print("Usage: python docker.py git-repo-url")
        exit(1)
    repo_url_small = argv[1]
    dockerfile, docker_compose = dockerise(repo_url_small)
    print("DOCKERFILE_START")
    print(dockerfile)
    print("DOCKERFILE_END")
    print("DOCKER_COMPOSE_START")
    print(docker_compose)
    print("DOCKER_COMPOSE_END")

main()