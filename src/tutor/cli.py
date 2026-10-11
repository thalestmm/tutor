import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(prog="tutor", description="Tutor study harness")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="auto-reload on code changes")
    args = parser.parse_args()
    uvicorn.run("tutor.main:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
