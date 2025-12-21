import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv


def get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        print(f"Missing required env: {name}")
        sys.exit(1)
    return value


def main():
    load_dotenv()

    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "equipment_crm")
    db_user = os.getenv("DB_USER", "equipment_user")
    db_password = get_env("DB_PASSWORD")
    superuser_password = get_env("POSTGRES_SUPERUSER_PASSWORD")

    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password=superuser_password,
        host=host,
        port=port,
    )
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (db_user,))
    user_exists = cur.fetchone() is not None
    if not user_exists:
        cur.execute(
            sql.SQL("CREATE USER {} WITH PASSWORD %s").format(sql.Identifier(db_user)),
            (db_password,),
        )
        print("User created")
    else:
        print("User already exists")

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    db_exists = cur.fetchone() is not None
    if not db_exists:
        cur.execute(
            sql.SQL("CREATE DATABASE {} OWNER {}").format(
                sql.Identifier(db_name), sql.Identifier(db_user)
            )
        )
        print("Database created")
    else:
        print("Database already exists")

    cur.execute(
        sql.SQL("ALTER DATABASE {} OWNER TO {}").format(
            sql.Identifier(db_name), sql.Identifier(db_user)
        )
    )
    cur.execute(
        sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
            sql.Identifier(db_name), sql.Identifier(db_user)
        )
    )
    print("Privileges granted")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
