import argparse
import socket
import threading


BUFFER_SIZE = 64 * 1024


def pump(source: socket.socket, target: socket.socket) -> None:
    try:
        while True:
            data = source.recv(BUFFER_SIZE)
            if not data:
                break
            target.sendall(data)
    except OSError:
        pass
    finally:
        try:
            target.shutdown(socket.SHUT_WR)
        except OSError:
            pass


def handle_client(client: socket.socket, target_host: str, target_port: int) -> None:
    upstream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        upstream.connect((target_host, target_port))
    except OSError:
        client.close()
        upstream.close()
        return

    threading.Thread(target=pump, args=(client, upstream), daemon=True).start()
    threading.Thread(target=pump, args=(upstream, client), daemon=True).start()


def serve(listen_host: str, listen_port: int, target_host: str, target_port: int) -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((listen_host, listen_port))
    server.listen()

    print(
        f"Proxy listening on {listen_host}:{listen_port} -> {target_host}:{target_port}",
        flush=True,
    )

    while True:
        client, _ = server.accept()
        threading.Thread(
            target=handle_client,
            args=(client, target_host, target_port),
            daemon=True,
        ).start()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, required=True)
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--target-port", type=int, required=True)
    args = parser.parse_args()
    serve(args.listen_host, args.listen_port, args.target_host, args.target_port)


if __name__ == "__main__":
    main()
