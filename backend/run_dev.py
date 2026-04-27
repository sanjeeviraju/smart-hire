import uvicorn


def main() -> None:
    try:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
        )
    except KeyboardInterrupt:
        # Ctrl+C during local development should exit quietly.
        pass


if __name__ == "__main__":
    main()
