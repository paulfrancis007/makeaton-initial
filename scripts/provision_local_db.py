"""Provision or verify isolated local PostgreSQL databases without logging secrets."""

import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
from urllib.parse import quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PSQL = Path("C:/Program Files/PostgreSQL/18/bin/psql.exe")
TARGETS = (("DATABASE_URL", "brightloop_app", "brightloop_dev"),
           ("TEST_DATABASE_URL", "brightloop_test", "brightloop_test"))
STEP = "initialization"


def read_env(path):
    values = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    return values


def sql(host, port, user, password, database, statement, expected_failure=False):
    env = os.environ.copy()
    # Ignore ambient libpq settings that could redirect a local connection.
    for key in list(env):
        if key.startswith("PG"):
            del env[key]
    env.update(PGPASSWORD=password, PGCONNECT_TIMEOUT="5", PGCLIENTENCODING="UTF8")
    result = subprocess.run(
        [str(PSQL), "-X", "-q", "-w", "-A", "-t", "-v", "ON_ERROR_STOP=1",
         "-h", host, "-p", str(port), "-U", user, "-d", database],
        input=statement, capture_output=True, text=True, encoding="utf-8", env=env,
        timeout=30,
    )
    if expected_failure:
        if result.returncode == 0:
            raise RuntimeError("Cross-database access was unexpectedly allowed")
        # Verify a permissions rejection rather than counting any connection error.
        if "permission denied for database" not in result.stderr.lower():
            raise RuntimeError("Cross-database check failed for an unexpected reason")
        return ""
    if result.returncode:
        # Raw psql output may contain SQL/passwords; deliberately do not echo it.
        raise RuntimeError("PostgreSQL operation failed; credentials/output suppressed")
    return result.stdout.strip()


def connection(value, role, database):
    parsed = urlsplit(value)
    if (parsed.scheme != "postgresql+psycopg" or parsed.hostname not in
            {"127.0.0.1", "localhost"} or parsed.username != role or
            parsed.path != "/" + database or not parsed.password):
        raise RuntimeError("Existing environment does not match the local project targets")
    return parsed.hostname, parsed.port or 5432, unquote(parsed.password)


def verify(values):
    global STEP
    for key, role, database in TARGETS:
        STEP = f"verifying {database}"
        host, port, password = connection(values[key], role, database)
        result = json.loads(sql(host, port, role, password, database, """
            SELECT json_build_object('role', current_user, 'database', current_database(),
                'owner', pg_get_userbyid(d.datdba), 'superuser', r.rolsuper,
                'create_role', r.rolcreaterole, 'create_db', r.rolcreatedb,
                'replicate', r.rolreplication, 'bypass_rls', r.rolbypassrls)
            FROM pg_database d JOIN pg_roles r ON r.rolname = current_user
            WHERE d.datname = current_database();
        """))
        assert result["role"] == result["owner"] == role
        assert result["database"] == database
        assert not any(result[k] for k in
                       ("superuser", "create_role", "create_db", "replicate", "bypass_rls"))
        sql(host, port, role, password, database, """
            BEGIN;
            CREATE TABLE public.brightloop_setup_permission_probe (id integer PRIMARY KEY);
            INSERT INTO public.brightloop_setup_permission_probe VALUES (1);
            ROLLBACK;
        """)
        assert sql(host, port, role, password, database,
                   "SELECT to_regclass('public.brightloop_setup_permission_probe') IS NULL;") == "t"
        other = "brightloop_test" if database == "brightloop_dev" else "brightloop_dev"
        sql(host, port, role, password, other, "SELECT 1;", expected_failure=True)
        print(f"PASS: {database}: owner login, restricted role, transactional DDL, isolation")


def main():
    global STEP
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify using application credentials only")
    args = parser.parse_args()
    app_path = ROOT / "backend/.env"
    values = read_env(app_path)
    if args.check:
        verify(values)
        return

    setup_path = ROOT / ".env.setup"
    setup = read_env(setup_path)
    host, port = setup.get("PGHOST", "127.0.0.1"), int(setup.get("PGPORT", "5432"))
    if host not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Only local PostgreSQL setup is supported")
    admin, password = setup.get("PGADMIN_USER", "postgres"), setup.get("PGADMIN_PASSWORD", "")
    if not password:
        if all(key in values for key, _, _ in TARGETS):
            verify(values)
            return
        raise RuntimeError("Fill PGADMIN_PASSWORD in the ignored .env.setup file")

    def admin_sql(statement, database="postgres"):
        return sql(host, port, admin, password, database, statement)

    STEP = "checking administrator connection and existing project objects"
    state = json.loads(admin_sql("""
        SELECT json_build_object(
            'roles', (SELECT coalesce(json_agg(rolname), '[]'::json) FROM pg_roles
                      WHERE rolname IN ('brightloop_app', 'brightloop_test')),
            'databases', (SELECT coalesce(json_object_agg(datname, pg_get_userbyid(datdba)),
                          '{}'::json) FROM pg_database
                          WHERE datname IN ('brightloop_dev', 'brightloop_test')));
    """))
    for key, role, database in TARGETS:
        if key not in values:
            if role in state["roles"] or database in state["databases"]:
                raise RuntimeError("Existing project object has no matching saved credentials; left untouched")
            token = secrets.token_urlsafe(36)
            values[key] = f"postgresql+psycopg://{role}:{quote(token, safe='')}@{host}:{port}/{database}"
        saved_host, saved_port, _ = connection(values[key], role, database)
        if saved_host != host or saved_port != port:
            raise RuntimeError("Saved database endpoint differs from setup endpoint")
        if database in state["databases"] and state["databases"][database] != role:
            raise RuntimeError("Existing database has a different owner; left untouched")
    # Save generated credentials before any server mutation, enabling safe retry.
    STEP = "saving private application credentials"
    app_path.parent.mkdir(exist_ok=True)
    values.setdefault("FRONTEND_ORIGIN", "http://localhost:3000")
    app_path.write_text("# Private local application credentials. Never commit.\n" +
                        "\n".join(f"{key}={value}" for key, value in values.items()) + "\n",
                        encoding="utf-8")

    for key, role, database in TARGETS:
        STEP = f"provisioning {database}"
        _, _, token = connection(values[key], role, database)
        if role not in state["roles"]:
            literal = token.replace("'", "''")
            admin_sql(f"CREATE ROLE {role} LOGIN PASSWORD '{literal}' NOSUPERUSER "
                      "NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;")
        else:
            # Existing roles must authenticate with saved credentials; never reset them.
            sql(host, port, role, token, database if database in state["databases"] else "postgres",
                "SELECT 1;")
        if database not in state["databases"]:
            admin_sql(f"CREATE DATABASE {database} OWNER {role};")
        admin_sql(f"REVOKE ALL ON DATABASE {database} FROM PUBLIC; "
                  f"GRANT CONNECT, TEMPORARY ON DATABASE {database} TO {role};")
        admin_sql("REVOKE ALL ON SCHEMA public FROM PUBLIC;", database)

    verify(values)
    STEP = "clearing temporary administrator password"
    lines = setup_path.read_text(encoding="utf-8-sig").splitlines()
    setup_path.write_text("\n".join("PGADMIN_PASSWORD=" if line.startswith("PGADMIN_PASSWORD=")
                                   else line for line in lines) + "\n", encoding="utf-8")
    print("PASS: setup complete; temporary administrator password cleared from .env.setup")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(f"FAILED during {STEP}. No passwords or raw database output displayed.", file=sys.stderr)
        sys.exit(1)
