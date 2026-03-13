"""
Server setup validation tests.
Verifies infrastructure configuration files are correct and complete.

Run with:
  cd backend && python -m pytest test_server_setup.py -v
"""

from __future__ import annotations

import os
import re

import pytest
import yaml

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_HETZNER_DIR = os.path.join(_ROOT, "infrastructure", "hetzner")
_COMPOSE_FILE = os.path.join(_HETZNER_DIR, "docker-compose.yml")
_ENV_EXAMPLE = os.path.join(_HETZNER_DIR, ".env.example")
_SETUP_SCRIPT = os.path.join(_HETZNER_DIR, "setup-hetzner.sh")
_BACKUP_SCRIPT = os.path.join(_HETZNER_DIR, "backup-hetzner.sh")
_RECOVER_SCRIPT = os.path.join(_HETZNER_DIR, "recover-vps.sh")
_DOCKERFILE = os.path.join(_ROOT, "backend", "Dockerfile")


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def _load_compose() -> dict:
    """Load docker-compose.yml as a dict (basic YAML parse)."""
    content = _read(_COMPOSE_FILE)
    return yaml.safe_load(content)


# ---------------------------------------------------------------------------
# 1. Docker Compose structure
# ---------------------------------------------------------------------------


class TestDockerCompose:
    @pytest.fixture(autouse=True)
    def compose(self):
        self.data = _load_compose()

    def test_compose_file_exists(self):
        assert os.path.isfile(_COMPOSE_FILE)

    def test_required_services_defined(self):
        services = set(self.data.get("services", {}).keys())
        required = {"traefik", "db", "n8n", "backend", "watchtower"}
        assert required.issubset(services), f"Missing services: {required - services}"

    def test_traefik_exposes_ports_80_and_443(self):
        traefik = self.data["services"]["traefik"]
        ports = [str(p) for p in traefik.get("ports", [])]
        port_str = " ".join(ports)
        assert "80" in port_str
        assert "443" in port_str

    def test_postgres_not_exposed_on_host(self):
        db = self.data["services"]["db"]
        assert "ports" not in db, "PostgreSQL should NOT expose ports to host"

    def test_backend_not_exposed_on_host(self):
        backend = self.data["services"]["backend"]
        assert "ports" not in backend, "Backend should only use 'expose', not 'ports'"
        assert "8001" in str(backend.get("expose", []))

    def test_n8n_depends_on_db_healthy(self):
        n8n = self.data["services"]["n8n"]
        depends = n8n.get("depends_on", {})
        assert "db" in depends
        assert depends["db"].get("condition") == "service_healthy"

    def test_postgres_has_healthcheck(self):
        db = self.data["services"]["db"]
        assert "healthcheck" in db

    def test_backend_has_healthcheck(self):
        backend = self.data["services"]["backend"]
        assert "healthcheck" in backend

    def test_all_services_restart_unless_stopped(self):
        for name, svc in self.data["services"].items():
            assert svc.get("restart") == "unless-stopped", (
                f"Service {name} should have restart: unless-stopped"
            )

    def test_watchtower_only_labeled_containers(self):
        watchtower = self.data["services"]["watchtower"]
        env = watchtower.get("environment", {})
        assert env.get("WATCHTOWER_LABEL_ENABLE") == "true"

    def test_freyai_net_network_defined(self):
        networks = self.data.get("networks", {})
        assert "freyai-net" in networks

    def test_network_not_internal(self):
        """Network must be external-facing for Traefik ACME."""
        net = self.data["networks"]["freyai-net"]
        assert net.get("internal") is False

    def test_volumes_defined(self):
        volumes = set(self.data.get("volumes", {}).keys())
        required = {"n8n_data", "postgres_data", "traefik_certs"}
        assert required.issubset(volumes)

    def test_traefik_has_rate_limiting(self):
        """Rate limiting middleware must be configured."""
        content = _read(_COMPOSE_FILE)
        assert "ratelimit" in content.lower(), "Rate limiting middleware missing from Traefik config"

    def test_traefik_has_security_headers(self):
        content = _read(_COMPOSE_FILE)
        assert "stsSeconds" in content
        assert "frameDeny" in content
        assert "contentTypeNosniff" in content

    def test_http_to_https_redirect(self):
        traefik = self.data["services"]["traefik"]
        commands = traefik.get("command", [])
        redirect_found = any("redirections" in str(c) for c in commands)
        assert redirect_found, "HTTP → HTTPS redirect must be configured"

    def test_n8n_execution_pruning_enabled(self):
        n8n = self.data["services"]["n8n"]
        env = n8n.get("environment", {})
        assert env.get("EXECUTIONS_DATA_PRUNE") == "true"

    def test_n8n_diagnostics_disabled(self):
        n8n = self.data["services"]["n8n"]
        env = n8n.get("environment", {})
        assert env.get("N8N_DIAGNOSTICS_ENABLED") == "false"


# ---------------------------------------------------------------------------
# 2. .env.example completeness
# ---------------------------------------------------------------------------


class TestEnvExample:
    @pytest.fixture(autouse=True)
    def env_content(self):
        self.content = _read(_ENV_EXAMPLE)
        self.keys = set(re.findall(r"^([A-Z_][A-Z0-9_]*)=", self.content, re.MULTILINE))

    def test_env_example_exists(self):
        assert os.path.isfile(_ENV_EXAMPLE)

    def test_required_domain_vars(self):
        required = {"DOMAIN", "TRAEFIK_EMAIL", "TRAEFIK_DASHBOARD_USERS"}
        assert required.issubset(self.keys), f"Missing: {required - self.keys}"

    def test_required_n8n_vars(self):
        required = {"N8N_ENCRYPTION_KEY", "N8N_BASIC_AUTH_USER", "N8N_BASIC_AUTH_PASSWORD"}
        assert required.issubset(self.keys)

    def test_required_postgres_vars(self):
        required = {"POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"}
        assert required.issubset(self.keys)

    def test_required_supabase_vars(self):
        required = {"SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"}
        assert required.issubset(self.keys)

    def test_required_backend_vars(self):
        required = {"BACKEND_API_KEY", "BACKEND_INTERNAL_URL"}
        assert required.issubset(self.keys)

    def test_required_backup_vars(self):
        required = {"RESTIC_REPOSITORY", "RESTIC_PASSWORD", "NAS_SSH_USER"}
        assert required.issubset(self.keys)

    def test_required_rate_limit_vars(self):
        required = {"RATE_LIMIT_AVERAGE", "RATE_LIMIT_BURST"}
        assert required.issubset(self.keys)

    def test_alert_webhook_var_present(self):
        assert "ALERT_WEBHOOK_URL" in self.keys

    def test_no_real_secrets_in_example(self):
        """Ensure no actual secrets leaked into .env.example."""
        lines = self.content.strip().split("\n")
        for line in lines:
            if line.startswith("#") or not line.strip():
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                val = val.strip()
                # Should be a placeholder (YOUR_xxx), empty, or a safe default
                if val and not val.startswith("YOUR_") and not val.startswith("http"):
                    # Allow known safe defaults
                    safe_defaults = {
                        "n8n", "smtp.gmail.com", "587", "sandbox", "gpt-4o-mini",
                        "100", "50", "INFO", "nas-vault", "sftp:nas-vault:/backups/hetzner",
                        "watchtower@freyai.local", "4", "",
                    }
                    assert val in safe_defaults, (
                        f"Potentially leaked secret in .env.example: {key}={val}"
                    )


# ---------------------------------------------------------------------------
# 3. Shell scripts validity
# ---------------------------------------------------------------------------


class TestShellScripts:
    def test_setup_script_exists(self):
        assert os.path.isfile(_SETUP_SCRIPT)

    def test_backup_script_exists(self):
        assert os.path.isfile(_BACKUP_SCRIPT)

    def test_recover_script_exists(self):
        assert os.path.isfile(_RECOVER_SCRIPT)

    def test_setup_has_shebang(self):
        content = _read(_SETUP_SCRIPT)
        assert content.startswith("#!/")

    def test_backup_has_shebang(self):
        content = _read(_BACKUP_SCRIPT)
        assert content.startswith("#!/")

    def test_recover_has_shebang(self):
        content = _read(_RECOVER_SCRIPT)
        assert content.startswith("#!/")

    def test_backup_uses_set_e(self):
        content = _read(_BACKUP_SCRIPT)
        assert "set -euo pipefail" in content

    def test_backup_has_restic_check(self):
        content = _read(_BACKUP_SCRIPT)
        assert "restic check" in content

    def test_backup_has_monthly_full_check(self):
        """Monthly full integrity check should be present."""
        content = _read(_BACKUP_SCRIPT)
        assert "--read-data" in content
        assert "day_of_month" in content or "Monthly" in content

    def test_backup_has_retention_policy(self):
        content = _read(_BACKUP_SCRIPT)
        assert "keep-daily" in content
        assert "keep-weekly" in content
        assert "keep-monthly" in content

    def test_backup_has_webhook_alerting(self):
        content = _read(_BACKUP_SCRIPT)
        assert "notify_webhook" in content
        assert "ALERT_WEBHOOK_URL" in content

    def test_recover_checks_docker(self):
        content = _read(_RECOVER_SCRIPT)
        assert "docker" in content.lower()

    def test_recover_checks_disk_space(self):
        content = _read(_RECOVER_SCRIPT)
        assert "DISK_PCT" in content or "disk" in content.lower()

    def test_recover_checks_postgres_volume_size(self):
        content = _read(_RECOVER_SCRIPT)
        assert "postgres_data" in content

    def test_recover_checks_tls_expiry(self):
        content = _read(_RECOVER_SCRIPT)
        assert "DAYS_LEFT" in content or "expiry" in content.lower()

    def test_recover_checks_tailscale(self):
        content = _read(_RECOVER_SCRIPT)
        assert "tailscale" in content.lower()

    def test_setup_configures_firewall(self):
        content = _read(_SETUP_SCRIPT)
        assert "ufw" in content

    def test_setup_configures_fail2ban(self):
        content = _read(_SETUP_SCRIPT)
        assert "fail2ban" in content


# ---------------------------------------------------------------------------
# 4. Dockerfile validation
# ---------------------------------------------------------------------------


class TestDockerfile:
    @pytest.fixture(autouse=True)
    def dockerfile(self):
        self.content = _read(_DOCKERFILE)

    def test_dockerfile_exists(self):
        assert os.path.isfile(_DOCKERFILE)

    def test_uses_multi_stage_build(self):
        assert self.content.count("FROM ") >= 2

    def test_runs_as_non_root(self):
        assert "USER" in self.content
        assert "appuser" in self.content

    def test_exposes_port_8001(self):
        assert "EXPOSE 8001" in self.content

    def test_has_healthcheck(self):
        assert "HEALTHCHECK" in self.content

    def test_uses_slim_base(self):
        assert "slim" in self.content

    def test_uses_python_311(self):
        assert "python:3.11" in self.content

    def test_workers_configured(self):
        assert "--workers" in self.content


# ---------------------------------------------------------------------------
# 5. Cross-reference validation
# ---------------------------------------------------------------------------


class TestCrossReferences:
    """Verify that docker-compose env vars match .env.example keys."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.compose = _read(_COMPOSE_FILE)
        self.env_content = _read(_ENV_EXAMPLE)
        self.env_keys = set(re.findall(r"^([A-Z_][A-Z0-9_]*)=", self.env_content, re.MULTILINE))

    def test_compose_env_refs_in_env_example(self):
        """All ${VAR} references in docker-compose.yml should exist in .env.example."""
        # Extract ${VAR} and ${VAR:-default} patterns
        refs = set(re.findall(r"\$\{([A-Z_][A-Z0-9_]*)(?::-[^}]*)?\}", self.compose))
        missing = refs - self.env_keys
        # Allow some that are set within docker-compose itself
        allowed_missing = set()
        assert missing == allowed_missing, (
            f"docker-compose.yml references env vars not in .env.example: {missing}"
        )
