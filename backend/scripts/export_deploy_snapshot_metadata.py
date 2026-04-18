from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql

REQUIRED_NON_EMPTY_TABLES = [
    "role_definitions",
    "access_spaces",
    "role_space_permissions",
    "measurement_units",
    "signal_types",
    "data_types",
    "main_equipment",
    "equipment_categories",
    "manufacturers",
    "digital_twin_documents",
    "network_topology_documents",
    "serial_map_documents",
    "personnel_yearly_schedule_assignments",
]

DICTIONARY_TABLES = [
    "role_definitions",
    "access_spaces",
    "role_space_permissions",
    "measurement_units",
    "signal_types",
    "data_types",
    "main_equipment",
    "equipment_categories",
    "manufacturers",
]


def _load_env(env_file: Path) -> None:
    if env_file.exists():
        load_dotenv(env_file)


def _connect():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "equipment_crm"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


def _get_tables(cur) -> list[str]:
    cur.execute(
        """
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
        """
    )
    return [row[0] for row in cur.fetchall()]


def _get_columns(cur, table_name: str) -> list[str]:
    cur.execute(
        """
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = %s
        order by ordinal_position
        """,
        (table_name,),
    )
    return [row[0] for row in cur.fetchall()]


def _order_sql(columns: list[str]) -> sql.SQL:
    if "id" in columns:
        return sql.SQL(" order by {}").format(sql.Identifier("id"))
    if "key" in columns:
        return sql.SQL(" order by {}").format(sql.Identifier("key"))
    if {"role", "space_key"}.issubset(columns):
        return sql.SQL(" order by {}, {}").format(sql.Identifier("role"), sql.Identifier("space_key"))
    if "name" in columns:
        return sql.SQL(" order by {}").format(sql.Identifier("name"))
    return sql.SQL("")


def _write_counts(counts_path: Path, revision: str, total_exact_rows: int, table_counts: list[tuple[str, int]]) -> None:
    counts_path.parent.mkdir(parents=True, exist_ok=True)
    with counts_path.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write("table_name\trow_count\n")
        fh.write(f"__alembic_version__\t{revision}\n")
        fh.write(f"__total_exact_rows__\t{total_exact_rows}\n")
        for table_name, row_count in table_counts:
            fh.write(f"{table_name}\t{row_count}\n")


def _write_enums_and_dictionaries(
    enums_path: Path,
    revision: str,
    total_exact_rows: int,
    enum_rows: list[tuple[str, str]],
    dictionary_rows: dict[str, list[dict]],
) -> None:
    enums_path.parent.mkdir(parents=True, exist_ok=True)
    with enums_path.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write("# EQM deploy snapshot metadata\n")
        fh.write(f"alembic_version: {revision}\n")
        fh.write(f"total_exact_rows: {total_exact_rows}\n\n")
        fh.write("[enums]\n")
        current_enum = None
        for enum_name, enum_value in enum_rows:
            if enum_name != current_enum:
                if current_enum is not None:
                    fh.write("\n")
                fh.write(f"{enum_name}:\n")
                current_enum = enum_name
            fh.write(f"  - {enum_value}\n")
        fh.write("\n[dictionaries]\n")
        for table_name in DICTIONARY_TABLES:
            rows = dictionary_rows.get(table_name, [])
            fh.write(f"{table_name} ({len(rows)} rows):\n")
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False, default=str))
                fh.write("\n")
            fh.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default="backend/.env")
    parser.add_argument("--counts-output", required=True)
    parser.add_argument("--enums-output", required=True)
    parser.add_argument("--expected-revision")
    parser.add_argument("--min-rows", type=int, default=1300)
    args = parser.parse_args()

    _load_env(Path(args.env_file))

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("select version_num from alembic_version")
            revision = cur.fetchone()[0]
            if args.expected_revision and revision != args.expected_revision:
                raise SystemExit(
                    f"Expected alembic revision {args.expected_revision}, got {revision}"
                )

            tables = _get_tables(cur)
            table_counts: list[tuple[str, int]] = []
            total_exact_rows = 0
            for table_name in tables:
                cur.execute(
                    sql.SQL("select count(*) from {}").format(sql.Identifier("public", table_name))
                )
                row_count = int(cur.fetchone()[0])
                table_counts.append((table_name, row_count))
                total_exact_rows += row_count

            if total_exact_rows < args.min_rows:
                raise SystemExit(
                    f"Exact row count {total_exact_rows} is below required minimum {args.min_rows}"
                )

            counts_map = dict(table_counts)
            missing_required = [name for name in REQUIRED_NON_EMPTY_TABLES if counts_map.get(name, 0) <= 0]
            if missing_required:
                raise SystemExit(
                    "Required tables are missing or empty: " + ", ".join(sorted(missing_required))
                )

            cur.execute(
                """
                select t.typname, e.enumlabel
                from pg_type t
                join pg_enum e on e.enumtypid = t.oid
                join pg_namespace n on n.oid = t.typnamespace
                where n.nspname = 'public'
                order by t.typname, e.enumsortorder
                """
            )
            enum_rows = [(str(row[0]), str(row[1])) for row in cur.fetchall()]

            dictionary_rows: dict[str, list[dict]] = {}
            for table_name in DICTIONARY_TABLES:
                columns = _get_columns(cur, table_name)
                query = sql.SQL("select {} from {}{}").format(
                    sql.SQL(", ").join(sql.Identifier(column) for column in columns),
                    sql.Identifier("public", table_name),
                    _order_sql(columns),
                )
                cur.execute(query)
                dictionary_rows[table_name] = [
                    dict(zip(columns, row, strict=False))
                    for row in cur.fetchall()
                ]

    _write_counts(Path(args.counts_output), revision, total_exact_rows, table_counts)
    _write_enums_and_dictionaries(Path(args.enums_output), revision, total_exact_rows, enum_rows, dictionary_rows)
    print(f"alembic_version={revision}")
    print(f"total_exact_rows={total_exact_rows}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
